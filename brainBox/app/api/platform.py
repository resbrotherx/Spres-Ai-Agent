"""Platform admin API (/api/platform/*): every tenant ("company"), its staff and its API keys.

Callers: a staff JWT whose user has ``is_platform_admin`` (checked in the DB on every request), or
the ``X-Admin-Token`` header (server-to-server). See ``require_platform_admin``.

Secrets are never returned: API keys and invite/reset tokens are stored as SHA-256 hashes and
passwords as bcrypt hashes, so listings show key prefixes and account status only. A raw key is
returned exactly once - in the response that created (or rolled) it.
"""
import re
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import apikeys
from app import staff as staff_mod
from app import tenant_settings
from app.db.models import (APIKey, ChatEvent, ChatSession, Document, KnowledgeGap, Notification,
                           TenantSettings, TrainingSource, User)
from app.db.session import get_db
from app.dependencies import AuthContext, require_platform_admin
from app.utils.logging import logger

router = APIRouter()

TENANT_ID_RE = re.compile(r"^[A-Za-z0-9._-]{3,64}$")
LAST_OWNER = "A tenant must keep at least one active owner"
NOT_FOUND_TENANT = "Company not found"
NOT_FOUND_USER = "User not found"
NOT_FOUND_KEY = "API key not found"


# ---------------------------------------------------------------------------
# schemas
# ---------------------------------------------------------------------------

class OwnerIn(BaseModel):
    email: str = Field(..., max_length=254)
    full_name: Optional[str] = Field(None, max_length=120)
    password: Optional[str] = Field(None, max_length=256, description="Omit to get an invite link instead")


class CreateKeysIn(BaseModel):
    publishable: bool = False
    secret: bool = False


class TenantCreate(BaseModel):
    tenant_id: str = Field(..., max_length=64)
    display_name: Optional[str] = Field(None, max_length=120)
    owner: OwnerIn
    create_keys: CreateKeysIn = CreateKeysIn()


class TenantPatch(BaseModel):
    display_name: Optional[str] = Field(None, max_length=120)


class UserCreate(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=512)
    email: str = Field(..., max_length=254)
    full_name: Optional[str] = Field(None, max_length=120)
    role: str = "viewer"
    password: Optional[str] = Field(None, max_length=256)
    must_change_password: bool = True
    is_platform_admin: bool = False


class UserPatch(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = Field(None, max_length=120)
    is_platform_admin: Optional[bool] = None
    tenant_id: Optional[str] = Field(None, min_length=1, max_length=512)


class PasswordSet(BaseModel):
    password: str = Field(..., max_length=256)
    must_change_password: bool = True


class KeyCreate(BaseModel):
    tenant_id: str = Field(..., min_length=1, max_length=512)
    key_type: Literal["publishable", "secret"]
    name: Optional[str] = Field(None, max_length=120)
    expires_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _actor(auth: AuthContext) -> str:
    return "admin-token" if auth.is_admin_token else f"user:{auth.staff_user_id}"


def _staff_rows(db: Session):
    return db.query(User).filter(User.tenant_id.isnot(None), User.role.in_(staff_mod.STAFF_ROLES))


def _latest(*values) -> Optional[datetime]:
    vals = [staff_mod.aware(v) for v in values if v is not None]
    return max(vals) if vals else None


def _earliest(*values) -> Optional[datetime]:
    vals = [staff_mod.aware(v) for v in values if v is not None]
    return min(vals) if vals else None


def _names(db: Session, tenant_ids: Optional[Iterable[str]] = None) -> Dict[str, Optional[str]]:
    q = db.query(TenantSettings.tenant_id, TenantSettings.display_name)
    if tenant_ids is not None:
        ids = list(set(tenant_ids))
        if not ids:
            return {}
        q = q.filter(TenantSettings.tenant_id.in_(ids))
    return {t: n for t, n in q.all()}


def _grouped(db: Session, col, *aggs, only: Optional[str] = None, filters=()):
    q = db.query(col, *aggs).filter(col.isnot(None), *filters)
    if only is not None:
        q = q.filter(col == only)
    return q.group_by(col).all()


def tenant_summaries(db: Session, only: Optional[str] = None) -> List[Dict[str, Any]]:
    """One summary per tenant id found in users / api_keys / documents / training_sources /
    chat_sessions / tenant_settings. A fixed number of grouped queries (no per-tenant loops)."""
    t: Dict[str, Dict[str, Any]] = {}

    def row(tid: str) -> Dict[str, Any]:
        if tid not in t:
            t[tid] = {
                "tenant_id": tid, "display_name": None, "staff_count": 0, "owners": [],
                "key_counts": {"publishable": 0, "secret": 0, "active": 0, "total": 0},
                "documents": 0, "sources": 0, "conversations": 0, "open_gaps": 0,
                "last_activity_at": None, "created_at": None, "_named": False,
            }
        return t[tid]

    roles = staff_mod.STAFF_ROLES
    settings_q = db.query(TenantSettings.tenant_id, TenantSettings.display_name, TenantSettings.created_at)
    if only is not None:
        settings_q = settings_q.filter(TenantSettings.tenant_id == only)
    for tid, name, created in settings_q.all():
        r = row(tid)
        r["display_name"] = name
        r["_named"] = True
        r["created_at"] = _earliest(r["created_at"], created)

    for tid, n, first, last in _grouped(db, User.tenant_id, func.count(User.id), func.min(User.created_at),
                                         func.max(User.last_login_at), only=only, filters=(User.role.in_(roles),)):
        r = row(tid)
        r["staff_count"] = n
        r["created_at"] = _earliest(r["created_at"], first)
        r["last_activity_at"] = _latest(r["last_activity_at"], last)
    owners_q = db.query(User.tenant_id, User.email).filter(User.tenant_id.isnot(None), User.role == "owner")
    if only is not None:
        owners_q = owners_q.filter(User.tenant_id == only)
    for tid, email in owners_q.order_by(User.id.asc()).all():
        row(tid)["owners"].append(email)

    keys_q = db.query(APIKey.tenant_id, APIKey.key_type, APIKey.is_active, func.count(APIKey.id),
                      func.min(APIKey.created_at), func.max(APIKey.last_used))
    if only is not None:
        keys_q = keys_q.filter(APIKey.tenant_id == only)
    for tid, ktype, active, n, first, last in keys_q.group_by(APIKey.tenant_id, APIKey.key_type, APIKey.is_active).all():
        r = row(tid)
        kc = r["key_counts"]
        kc["total"] += n
        if active:
            kc["active"] += n
            kc["secret" if ktype == "secret" else "publishable"] += n
        r["created_at"] = _earliest(r["created_at"], first)
        r["last_activity_at"] = _latest(r["last_activity_at"], last)

    for tid, n, first in _grouped(db, Document.tenant_id, func.count(Document.id), func.min(Document.created_at), only=only):
        r = row(tid)
        r["documents"] = n
        r["created_at"] = _earliest(r["created_at"], first)
    for tid, n, first, last in _grouped(db, TrainingSource.tenant_id, func.count(TrainingSource.id),
                                         func.min(TrainingSource.created_at), func.max(TrainingSource.updated_at), only=only):
        r = row(tid)
        r["sources"] = n
        r["created_at"] = _earliest(r["created_at"], first)
        r["last_activity_at"] = _latest(r["last_activity_at"], last)
    for tid, n, first, last in _grouped(db, ChatSession.tenant_id, func.count(ChatSession.id),
                                         func.min(ChatSession.created_at), func.max(ChatSession.updated_at), only=only):
        r = row(tid)
        r["conversations"] = n
        r["created_at"] = _earliest(r["created_at"], first)
        r["last_activity_at"] = _latest(r["last_activity_at"], last)
    # Open gaps only count for tenants found above (gaps alone don't make a tenant).
    for tid, n in _grouped(db, KnowledgeGap.tenant_id, func.count(KnowledgeGap.id), only=only,
                           filters=(KnowledgeGap.status == "open",)):
        if tid in t:
            t[tid]["open_gaps"] = n

    out = []
    for r in t.values():
        r.pop("_named")
        r["display_name"] = r["display_name"] or r["tenant_id"]
        out.append(r)
    out.sort(key=lambda r: (r["display_name"] or "").lower())
    return out


def _summary_or_404(db: Session, tenant_id: str) -> Dict[str, Any]:
    found = tenant_summaries(db, only=tenant_id)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND_TENANT)
    return found[0]


def _tenant_exists(db: Session, tenant_id: str) -> bool:
    for model in (User, APIKey, TenantSettings, TrainingSource, ChatSession, Document):
        if db.query(model.id).filter(model.tenant_id == tenant_id).first() is not None:
            return True
    return False


def _require_tenant(db: Session, tenant_id: str) -> str:
    tenant_id = (tenant_id or "").strip()
    if not tenant_id or not _tenant_exists(db, tenant_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND_TENANT)
    return tenant_id


def _user_out(user: User, names: Dict[str, Optional[str]]) -> Dict[str, Any]:
    d = staff_mod.to_dict(user)
    d["tenant_name"] = names.get(user.tenant_id) or user.tenant_id
    d["status"] = staff_mod.status_of(user)
    d["has_password"] = staff_mod.has_password(user)
    return d


def _key_out(record: APIKey, names: Dict[str, Optional[str]]) -> Dict[str, Any]:
    d = apikeys.key_to_dict(record)
    d["tenant_name"] = names.get(record.tenant_id) or record.tenant_id
    return d


def _get_user(db: Session, user_id: int) -> User:
    user = _staff_rows(db).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND_USER)
    return user


def _is_active_owner(user: User) -> bool:
    return user.role == "owner" and bool(user.is_active) and user.invite_token_hash is None


def _raise(e: staff_mod.StaffError):
    raise HTTPException(status_code=e.status, detail=str(e))


def _invite(db: Session, user: User, raw: str, request: Request, inviter: Optional[str]):
    """(invite_url, email_sent) - emails the invite when SMTP + an absolute link are available."""
    from app.api.staff import _send_invite
    return _send_invite(db, user, raw, request.headers.get("origin"), inviter)


# ---------------------------------------------------------------------------
# overview & tenants
# ---------------------------------------------------------------------------

@router.get("/overview")
def overview(auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    tenants = tenant_summaries(db)
    staff_total = _staff_rows(db).count()
    staff_active = _staff_rows(db).filter(User.is_active.is_(True), User.invite_token_hash.is_(None)).count()
    keys = {"publishable": 0, "secret": 0, "active": 0, "revoked": 0}
    for ktype, active, n in db.query(APIKey.key_type, APIKey.is_active, func.count(APIKey.id)).group_by(
            APIKey.key_type, APIKey.is_active).all():
        if active:
            keys["active"] += n
            keys["secret" if ktype == "secret" else "publishable"] += n
        else:
            keys["revoked"] += n
    since = staff_mod.utcnow() - timedelta(days=30)
    return {
        "tenants": len(tenants),
        "staff": staff_total,
        "staff_active": staff_active,
        "platform_admins": _staff_rows(db).filter(User.is_platform_admin.is_(True)).count(),
        "keys": keys,
        "documents": db.query(func.count(Document.id)).scalar() or 0,
        "sources": db.query(func.count(TrainingSource.id)).scalar() or 0,
        "conversations": db.query(func.count(ChatSession.id)).scalar() or 0,
        "questions_30d": db.query(func.count(ChatEvent.id)).filter(ChatEvent.created_at >= since).scalar() or 0,
        "open_gaps": db.query(func.count(KnowledgeGap.id)).filter(KnowledgeGap.status == "open").scalar() or 0,
    }


@router.get("/tenants")
def list_tenants(auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    return {"tenants": tenant_summaries(db)}


@router.post("/tenants", status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreate, request: Request, auth: AuthContext = Depends(require_platform_admin),
                  db: Session = Depends(get_db)):
    tenant_id = (payload.tenant_id or "").strip()
    if not TENANT_ID_RE.match(tenant_id):
        raise HTTPException(status_code=422, detail="Tenant id must be 3-64 characters: letters, digits, '.', '_' or '-'")
    if _tenant_exists(db, tenant_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A company with this tenant id already exists")
    # Validate everything before writing anything.
    try:
        email = staff_mod.validate_email(payload.owner.email)
        if payload.owner.password:
            staff_mod.validate_password(payload.owner.password, staff_mod.ADMIN_MIN_PASSWORD)
    except staff_mod.StaffError as e:
        _raise(e)
    if staff_mod.get_by_email(db, email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already registered")
    try:
        tenant_settings.update_settings(db, tenant_id, {"display_name": (payload.display_name or "").strip() or None})
    except tenant_settings.SettingsError as e:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(e))
    try:
        owner, raw = staff_mod.create_staff(
            db, tenant_id, email, "owner", payload.owner.full_name, payload.owner.password or None,
            must_change_password=True, min_password=staff_mod.ADMIN_MIN_PASSWORD)
    except staff_mod.StaffError as e:
        _raise(e)
    out: Dict[str, Any] = {"owner": staff_mod.to_dict(owner), "password_set": raw is None, "keys": []}
    if raw:
        url, sent = _invite(db, owner, raw, request, auth.staff_name)
        out["invite_url"], out["email_sent"] = url, sent
    for ktype, wanted, name in (("publishable", payload.create_keys.publishable, "Website chat"),
                                ("secret", payload.create_keys.secret, "Server integration")):
        if wanted:
            record, raw_key = apikeys.create_key(db, tenant_id, ktype, name)
            out["keys"].append({"key": apikeys.key_to_dict(record), "raw_key": raw_key})
    out["tenant"] = _summary_or_404(db, tenant_id)
    logger.info(f"Company created: tenant={tenant_id} owner={owner.id} keys={len(out['keys'])} by={_actor(auth)}")
    return out


@router.get("/tenants/{tenant_id}")
def get_tenant(tenant_id: str, auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    summary = _summary_or_404(db, tenant_id)
    names = {tenant_id: summary["display_name"]}
    users = _staff_rows(db).filter(User.tenant_id == tenant_id).order_by(User.created_at.asc(), User.id.asc()).all()
    since = staff_mod.utcnow() - timedelta(days=30)
    events = db.query(ChatEvent.answered, func.count(ChatEvent.id)).filter(
        ChatEvent.tenant_id == tenant_id, ChatEvent.created_at >= since).group_by(ChatEvent.answered).all()
    answered = sum(n for a, n in events if a)
    unanswered = sum(n for a, n in events if not a)
    return {
        **summary,
        "usage": {"days": 30, "questions": answered + unanswered, "unanswered": unanswered,
                  "questions_all_time": db.query(func.count(ChatEvent.id)).filter(
                      ChatEvent.tenant_id == tenant_id).scalar() or 0},
        "staff": [_user_out(u, names) for u in users],
        "keys": [_key_out(k, names) for k in apikeys.list_keys(db, tenant_id)],
    }


@router.patch("/tenants/{tenant_id}")
def update_tenant(tenant_id: str, payload: TenantPatch, auth: AuthContext = Depends(require_platform_admin),
                  db: Session = Depends(get_db)):
    _summary_or_404(db, tenant_id)
    if payload.display_name is not None:
        try:
            tenant_settings.update_settings(db, tenant_id, {"display_name": payload.display_name})
        except tenant_settings.SettingsError as e:
            db.rollback()
            raise HTTPException(status_code=422, detail=str(e))
    logger.info(f"Company updated: tenant={tenant_id} by={_actor(auth)}")
    return _summary_or_404(db, tenant_id)


# ---------------------------------------------------------------------------
# users (staff accounts of every tenant)
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(q: Optional[str] = Query(None, max_length=200), tenant_id: Optional[str] = Query(None),
               role: Optional[str] = Query(None), status_: Optional[str] = Query(None, alias="status"),
               platform_admin: Optional[bool] = Query(None),
               auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    query = _staff_rows(db)
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    if role:
        query = query.filter(User.role == role)
    if platform_admin is not None:
        query = query.filter(User.is_platform_admin.is_(True) if platform_admin else
                             or_(User.is_platform_admin.is_(False), User.is_platform_admin.is_(None)))
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        names = [t for t, n in db.query(TenantSettings.tenant_id, TenantSettings.display_name).all()
                 if n and like.strip('%') in n.lower()]
        query = query.filter(or_(func.lower(User.email).like(like), func.lower(User.full_name).like(like),
                                 func.lower(User.tenant_id).like(like), User.tenant_id.in_(names or [""])))
    if status_ == "disabled":
        query = query.filter(User.is_active.is_(False))
    elif status_ == "invited":
        query = query.filter(User.is_active.is_(True), User.invite_token_hash.isnot(None))
    elif status_ == "must_change":
        query = query.filter(User.is_active.is_(True), User.invite_token_hash.is_(None),
                             User.must_change_password.is_(True))
    elif status_ == "active":
        query = query.filter(User.is_active.is_(True), User.invite_token_hash.is_(None),
                             or_(User.must_change_password.is_(False), User.must_change_password.is_(None)))
    users = query.order_by(User.tenant_id.asc(), User.created_at.asc(), User.id.asc()).limit(5000).all()
    names = _names(db, [u.tenant_id for u in users])
    return {"users": [_user_out(u, names) for u in users]}


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, request: Request, auth: AuthContext = Depends(require_platform_admin),
                db: Session = Depends(get_db)):
    tenant_id = _require_tenant(db, payload.tenant_id)
    try:
        user, raw = staff_mod.create_staff(
            db, tenant_id, payload.email, payload.role, payload.full_name, payload.password or None,
            is_platform_admin=payload.is_platform_admin, must_change_password=payload.must_change_password,
            min_password=staff_mod.ADMIN_MIN_PASSWORD)
    except staff_mod.StaffError as e:
        _raise(e)
    names = _names(db, [tenant_id])
    out: Dict[str, Any] = {"user": _user_out(user, names), "password_set": raw is None}
    if raw:
        out["invite_url"], out["email_sent"] = _invite(db, user, raw, request, auth.staff_name)
    logger.info(f"Platform: user created id={user.id} tenant={tenant_id} role={user.role} "
                f"pa={bool(user.is_platform_admin)} by={_actor(auth)}")
    return out


@router.patch("/users/{user_id}")
def update_user(user_id: int, payload: UserPatch, auth: AuthContext = Depends(require_platform_admin),
                db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    is_self = auth.staff_user_id is not None and user.id == auth.staff_user_id
    if is_self and payload.is_platform_admin is False:
        raise HTTPException(status_code=400, detail="You can't remove your own platform admin access")
    if is_self and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You can't deactivate your own account")
    new_role = user.role
    if payload.role is not None:
        try:
            new_role = staff_mod.validate_role(payload.role)
        except staff_mod.StaffError as e:
            _raise(e)
    new_tenant = user.tenant_id
    if payload.tenant_id is not None and payload.tenant_id.strip() != user.tenant_id:
        new_tenant = _require_tenant(db, payload.tenant_id)
    new_active = user.is_active if payload.is_active is None else payload.is_active
    loses_owner = _is_active_owner(user) and (new_role != "owner" or not new_active or new_tenant != user.tenant_id)
    if loses_owner and staff_mod.active_owner_count(db, user.tenant_id, exclude_id=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LAST_OWNER)
    if new_tenant != user.tenant_id:
        db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    user.role, user.is_active, user.tenant_id = new_role, new_active, new_tenant
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or None
    if payload.is_platform_admin is not None:
        user.is_platform_admin = payload.is_platform_admin
    db.commit()
    db.refresh(user)
    logger.info(f"Platform: user updated id={user.id} fields={sorted(payload.model_dump(exclude_none=True))} by={_actor(auth)}")
    return _user_out(user, _names(db, [user.tenant_id]))


@router.post("/users/{user_id}/password")
def set_user_password(user_id: int, payload: PasswordSet, auth: AuthContext = Depends(require_platform_admin),
                      db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    try:
        staff_mod.admin_set_password(db, user, payload.password, payload.must_change_password)
    except staff_mod.StaffError as e:
        _raise(e)
    logger.info(f"Platform: password set for user={user.id} must_change={payload.must_change_password} by={_actor(auth)}")
    return {"ok": True, "user": _user_out(user, _names(db, [user.tenant_id]))}


@router.post("/users/{user_id}/invite-link")
def new_invite_link(user_id: int, request: Request, auth: AuthContext = Depends(require_platform_admin),
                    db: Session = Depends(get_db)):
    """A fresh invite link (7 days) for a user who never set a password. Not emailed."""
    user = _get_user(db, user_id)
    if user.invite_token_hash is None and staff_mod.has_password(user):
        raise HTTPException(status_code=400, detail="This user already has a password. Set a new one instead.")
    raw = staff_mod.refresh_invite(db, user)
    return {"invite_url": staff_mod.dashboard_link(f"accept-invite?token={raw}", request.headers.get("origin"))}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    if auth.staff_user_id is not None and user.id == auth.staff_user_id:
        raise HTTPException(status_code=400, detail="You can't remove your own account")
    if _is_active_owner(user) and staff_mod.active_owner_count(db, user.tenant_id, exclude_id=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LAST_OWNER)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    logger.info(f"Platform: user removed id={user_id} by={_actor(auth)}")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# API keys of every tenant (raw keys only in create/roll responses)
# ---------------------------------------------------------------------------

@router.get("/keys")
def list_keys(tenant_id: Optional[str] = Query(None), auth: AuthContext = Depends(require_platform_admin),
              db: Session = Depends(get_db)):
    keys = apikeys.list_keys(db, tenant_id)
    names = _names(db, [k.tenant_id for k in keys])
    return {"keys": [_key_out(k, names) for k in keys]}


@router.post("/keys", status_code=status.HTTP_201_CREATED)
def create_key(payload: KeyCreate, auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    tenant_id = _require_tenant(db, payload.tenant_id)
    try:
        record, raw = apikeys.create_key(db, tenant_id, payload.key_type, payload.name, payload.expires_at)
    except apikeys.KeyRequestError as e:
        raise HTTPException(status_code=422, detail=str(e))
    logger.info(f"Platform: key created id={record.id} tenant={tenant_id} type={record.key_type} by={_actor(auth)}")
    return {"key": _key_out(record, _names(db, [tenant_id])), "raw_key": raw}


@router.post("/keys/{key_id}/roll")
def roll_key(key_id: int, auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    try:
        result = apikeys.roll_key(db, key_id)
    except apikeys.KeyRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND_KEY)
    record, raw, old = result
    logger.info(f"Platform: key rolled old={old.id} new={record.id} tenant={record.tenant_id} by={_actor(auth)}")
    return {"key": _key_out(record, _names(db, [record.tenant_id])), "raw_key": raw, "revoked_id": old.id}


@router.delete("/keys/{key_id}")
def revoke_key(key_id: int, auth: AuthContext = Depends(require_platform_admin), db: Session = Depends(get_db)):
    record = apikeys.revoke_key(db, key_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND_KEY)
    logger.info(f"Platform: key revoked id={record.id} tenant={record.tenant_id} by={_actor(auth)}")
    return {"revoked": True, "key": _key_out(record, _names(db, [record.tenant_id]))}
