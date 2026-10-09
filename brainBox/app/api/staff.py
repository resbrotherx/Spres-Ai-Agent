"""Staff dashboard accounts: login, profile, invites, password reset, staff management.

Roles: owner > admin > trainer > viewer. Admins manage trainers/viewers; owners manage everyone.
A tenant always keeps at least one active owner. Platform-admin accounts can only be changed by a
platform admin (so a tenant owner can't take over or lock out a platform admin in their tenant).
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import staff as staff_mod
from app.db.models import Notification, User
from app.db.session import SessionLocal, get_db
from app.dependencies import AuthContext, require_staff, role_forbidden
from app.notify.email import render, smtp_configured
from app.notify.service import notify_staff, send_transactional
from app.utils.logging import logger

router = APIRouter()

INVALID_LOGIN = "Invalid email or password"
INVALID_TOKEN = "This link is invalid or has expired"
LAST_OWNER = "A tenant must keep at least one active owner"


# ---------------------------------------------------------------------------
# schemas
# ---------------------------------------------------------------------------

class LoginPayload(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=256)


class MePatch(BaseModel):
    full_name: Optional[str] = Field(None, max_length=120)
    notify_email: Optional[bool] = None
    notify_in_app: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str = Field(..., max_length=256)
    new_password: str = Field(..., min_length=8, max_length=256)


class AcceptInvite(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)
    password: str = Field(..., min_length=8, max_length=256)
    full_name: Optional[str] = Field(None, max_length=120)


class ForgotPassword(BaseModel):
    email: str = Field(..., max_length=254)


class ResetPassword(BaseModel):
    token: str = Field(..., min_length=10, max_length=256)
    password: str = Field(..., min_length=8, max_length=256)


class InvitePayload(BaseModel):
    email: str = Field(..., max_length=254)
    full_name: Optional[str] = Field(None, max_length=120)
    role: str
    password: Optional[str] = Field(
        None, max_length=256,
        description="Set a temporary password (>= 10 chars) instead of emailing an invite; "
                    "the user must change it at first login")


class AdminSetPassword(BaseModel):
    password: str = Field(..., max_length=256)
    must_change_password: bool = True


class StaffPatch(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = Field(None, max_length=120)
    notify_email: Optional[bool] = None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _raise(e: staff_mod.StaffError):
    raise HTTPException(status_code=e.status, detail=str(e))


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


def _me(db: Session, auth: AuthContext) -> User:
    user = db.query(User).filter(User.id == auth.staff_user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Staff login required")
    return user


def _target(db: Session, auth: AuthContext, user_id: int) -> User:
    user = staff_mod.staff_query(db, auth.tenant_id).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return user


PLATFORM_ADMIN_TARGET = "Only a platform admin can change a platform admin account"


def _guard_platform_admin(auth: AuthContext, user: User) -> None:
    if user.is_platform_admin and not auth.is_platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=PLATFORM_ADMIN_TARGET)


def _can_manage(auth: AuthContext, target_role: Optional[str]) -> bool:
    """Owners manage everyone; admins manage roles below admin."""
    if auth.staff_role == "owner":
        return True
    return staff_mod.rank(target_role) < staff_mod.rank(auth.staff_role)


def _invite_email(user: User, url: str, inviter: Optional[str], tenant_name: str):
    title = f"You're invited to the {tenant_name} Brainbox dashboard"
    intro = (f"{inviter or 'An administrator'} invited you to join the {tenant_name} staff dashboard "
             f"as {user.role}. Set your password to get started - this link is valid for 7 days.")
    return title, *render(title, intro, [], "Accept invitation", url)


def _send_invite(db: Session, user: User, raw_token: str, origin: Optional[str], inviter: Optional[str]):
    """Returns (invite_url, email_sent). Sends synchronously so email_sent is accurate."""
    url = staff_mod.dashboard_link(f"accept-invite?token={raw_token}", origin)
    sent = False
    if smtp_configured() and not url.startswith("#"):
        from app.tenant_settings import get_settings
        tenant_name = get_settings(db, user.tenant_id)["display_name"] or user.tenant_id
        subject, html_body, text_body = _invite_email(user, url, inviter, tenant_name)
        sent = send_transactional(db, user.tenant_id, user.email, "invite", subject, html_body, text_body)
    return url, sent


def _send_reset_bg(user_id: int, raw_token: str, origin: Optional[str]) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return
        url = staff_mod.dashboard_link(f"reset-password?token={raw_token}", origin)
        if url.startswith("#"):
            logger.warning("Password reset requested but DASHBOARD_URL is unknown; no email sent")
            return
        title = "Reset your Brainbox password"
        intro = ("We received a request to reset the password of your Brainbox dashboard account. "
                 "This link is valid for 1 hour. If you didn't ask for it, you can ignore this email.")
        html_body, text_body = render(title, intro, [], "Choose a new password", url)
        send_transactional(db, user.tenant_id, user.email, "reset", title, html_body, text_body)
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
    finally:
        db.close()


def _notify_joined_bg(tenant_id: str, user_id: int) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user is None:
            return
        notify_staff(db, tenant_id, "staff", title=f"{staff_mod.display_name(user)} joined the dashboard",
                     body=f"{user.email} accepted the invite as {user.role}.", link="#/staff",
                     min_role="admin", email=False, exclude_user_id=user.id)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# auth (no credentials needed)
# ---------------------------------------------------------------------------

@router.post("/staff/login")
def login(payload: LoginPayload, request: Request, db: Session = Depends(get_db)):
    email = staff_mod.normalize_email(payload.email)
    key = (email, _client_ip(request))
    if staff_mod.login_limiter.blocked(key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many failed attempts. Try again in a few minutes.")
    user = staff_mod.get_by_email(db, email)
    if (user is None or not staff_mod.is_staff(user) or not user.is_active
            or not staff_mod.check_password(user, payload.password)):
        staff_mod.login_limiter.fail(key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_LOGIN)
    staff_mod.login_limiter.reset(key)
    return staff_mod.login_response(db, user)


@router.post("/staff/accept-invite")
def accept_invite(payload: AcceptInvite, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = staff_mod.user_by_token(db, payload.token, "invite")
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN)
    try:
        staff_mod.validate_password(payload.password)
    except staff_mod.StaffError as e:
        _raise(e)
    if payload.full_name and payload.full_name.strip():
        user.full_name = payload.full_name.strip()
    user.invite_token_hash = None
    user.invite_expires_at = None
    staff_mod.set_password(db, user, payload.password)
    background_tasks.add_task(_notify_joined_bg, user.tenant_id, user.id)
    return staff_mod.login_response(db, user)


@router.post("/staff/forgot-password")
def forgot_password(payload: ForgotPassword, request: Request, background_tasks: BackgroundTasks,
                    db: Session = Depends(get_db)):
    """Always {ok: true} (doesn't reveal whether the account exists)."""
    user = staff_mod.get_by_email(db, payload.email)
    if user is not None and staff_mod.is_staff(user) and user.is_active and user.invite_token_hash is None:
        now = staff_mod.utcnow()
        last_expiry = staff_mod.aware(user.reset_expires_at)
        recently = last_expiry is not None and last_expiry - staff_mod.RESET_TTL + staff_mod.RESET_RESEND_AFTER > now
        if not recently:
            raw, digest = staff_mod.new_token()
            user.reset_token_hash = digest
            user.reset_expires_at = now + staff_mod.RESET_TTL
            db.commit()
            background_tasks.add_task(_send_reset_bg, user.id, raw, request.headers.get("origin"))
    return {"ok": True}


@router.post("/staff/reset-password")
def reset_password(payload: ResetPassword, db: Session = Depends(get_db)):
    user = staff_mod.user_by_token(db, payload.token, "reset")
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN)
    try:
        staff_mod.set_password(db, user, payload.password)
    except staff_mod.StaffError as e:
        _raise(e)
    return staff_mod.login_response(db, user)


# ---------------------------------------------------------------------------
# me
# ---------------------------------------------------------------------------

@router.get("/staff/me")
def get_me(auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    return staff_mod.to_dict(_me(db, auth))


@router.patch("/staff/me")
def update_me(payload: MePatch, auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    user = _me(db, auth)
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or None
    if payload.notify_email is not None:
        user.notify_email = payload.notify_email
    if payload.notify_in_app is not None:
        user.notify_in_app = payload.notify_in_app
    db.commit()
    db.refresh(user)
    return staff_mod.to_dict(user)


@router.post("/staff/me/password")
def change_password(payload: PasswordChange, auth: AuthContext = Depends(require_staff("viewer")),
                    db: Session = Depends(get_db)):
    user = _me(db, auth)
    if not staff_mod.check_password(user, payload.current_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    try:
        staff_mod.set_password(db, user, payload.new_password)
    except staff_mod.StaffError as e:
        _raise(e)
    return {"ok": True}


# ---------------------------------------------------------------------------
# staff management
# ---------------------------------------------------------------------------

@router.get("/staff")
def list_staff(auth: AuthContext = Depends(require_staff("viewer")), db: Session = Depends(get_db)):
    users = staff_mod.staff_query(db, auth.tenant_id).order_by(User.created_at.asc(), User.id.asc()).all()
    return {"staff": [staff_mod.to_dict(u) for u in users]}


@router.post("/staff/invite")
def invite_staff(payload: InvitePayload, request: Request, auth: AuthContext = Depends(require_staff("admin")),
                 db: Session = Depends(get_db)):
    try:
        role = staff_mod.validate_role(payload.role)
        if not _can_manage(auth, role):
            raise role_forbidden(auth.staff_role)
        if payload.password:
            user, raw = staff_mod.create_staff(
                db, auth.tenant_id, payload.email, role, payload.full_name, payload.password,
                must_change_password=True, min_password=staff_mod.ADMIN_MIN_PASSWORD)
        else:
            user, raw = staff_mod.create_staff(db, auth.tenant_id, payload.email, role, payload.full_name)
    except staff_mod.StaffError as e:
        _raise(e)
    if payload.password:
        logger.info(f"Staff created with a temporary password: user={user.id} tenant={auth.tenant_id} "
                    f"role={role} by={auth.staff_user_id}")
        return {"user": staff_mod.to_dict(user), "invite_url": None, "email_sent": False, "password_set": True}
    url, sent = _send_invite(db, user, raw, request.headers.get("origin"), auth.staff_name)
    logger.info(f"Staff invited: user={user.id} tenant={auth.tenant_id} role={role} by={auth.staff_user_id}")
    return {"user": staff_mod.to_dict(user), "invite_url": url, "email_sent": sent}


@router.patch("/staff/{user_id}")
def update_staff(user_id: int, payload: StaffPatch, auth: AuthContext = Depends(require_staff("admin")),
                 db: Session = Depends(get_db)):
    user = _target(db, auth, user_id)
    if not _can_manage(auth, user.role):
        raise role_forbidden(auth.staff_role)
    _guard_platform_admin(auth, user)
    new_role = user.role
    if payload.role is not None:
        try:
            new_role = staff_mod.validate_role(payload.role)
        except staff_mod.StaffError as e:
            _raise(e)
        if not _can_manage(auth, new_role):
            raise role_forbidden(auth.staff_role)
    new_active = user.is_active if payload.is_active is None else payload.is_active
    is_active_owner = user.role == "owner" and user.is_active and user.invite_token_hash is None
    loses_owner = is_active_owner and (new_role != "owner" or not new_active)
    if loses_owner and staff_mod.active_owner_count(db, auth.tenant_id, exclude_id=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LAST_OWNER)
    user.role = new_role
    user.is_active = new_active
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip() or None
    if payload.notify_email is not None:
        user.notify_email = payload.notify_email
    db.commit()
    db.refresh(user)
    return staff_mod.to_dict(user)


@router.delete("/staff/{user_id}")
def delete_staff(user_id: int, auth: AuthContext = Depends(require_staff("admin")), db: Session = Depends(get_db)):
    user = _target(db, auth, user_id)
    if not _can_manage(auth, user.role):
        raise role_forbidden(auth.staff_role)
    _guard_platform_admin(auth, user)
    is_active_owner = user.role == "owner" and user.is_active and user.invite_token_hash is None
    if is_active_owner and staff_mod.active_owner_count(db, auth.tenant_id, exclude_id=user.id) == 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LAST_OWNER)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    logger.info(f"Staff removed: user={user_id} tenant={auth.tenant_id} by={auth.staff_user_id}")
    return {"deleted": True}


@router.post("/staff/{user_id}/resend-invite")
def resend_invite(user_id: int, request: Request, auth: AuthContext = Depends(require_staff("admin")),
                  db: Session = Depends(get_db)):
    user = _target(db, auth, user_id)
    if not _can_manage(auth, user.role):
        raise role_forbidden(auth.staff_role)
    _guard_platform_admin(auth, user)
    if user.invite_token_hash is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This user has already accepted the invite")
    raw = staff_mod.refresh_invite(db, user)
    url, sent = _send_invite(db, user, raw, request.headers.get("origin"), auth.staff_name)
    return {"invite_url": url, "email_sent": sent}


@router.post("/staff/{user_id}/password")
def set_staff_password(user_id: int, payload: AdminSetPassword, auth: AuthContext = Depends(require_staff("admin")),
                       db: Session = Depends(get_db)):
    """Set a (temporary) password for a staff member (admin+, same rules as role management).
    Completes a pending invite. Use /staff/me/password for your own password."""
    user = _target(db, auth, user_id)
    if user.id == auth.staff_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Use Account settings to change your own password")
    if not _can_manage(auth, user.role):
        raise role_forbidden(auth.staff_role)
    _guard_platform_admin(auth, user)
    try:
        staff_mod.admin_set_password(db, user, payload.password, payload.must_change_password)
    except staff_mod.StaffError as e:
        _raise(e)
    logger.info(f"Staff password set by admin: user={user.id} tenant={auth.tenant_id} by={auth.staff_user_id}")
    return {"ok": True, "user": staff_mod.to_dict(user)}
