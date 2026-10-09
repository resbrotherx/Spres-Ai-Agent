"""In-app notifications + notification emails for staff users.

``notify_staff`` is called from background work (gap recording, feedback, failed training):
it creates one in-app notification per active staff user with notify_in_app, and emails every
active staff user with notify_email - when SMTP is configured, the caller says email is wanted
(tenant settings notify_on_gap / notify_on_feedback) and the tenant is under its hourly email
budget (``email_max_per_hour``, counted per recipient email in ``email_log``).
"""
from datetime import timedelta
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import staff as staff_mod
from app.db.models import EmailLog, Notification, User
from app.notify.email import render, send_email, smtp_configured
from app.utils.logging import logger

NOTIFICATION_TYPES = ("gap", "feedback", "training_failed", "staff")
THROTTLED_KINDS = NOTIFICATION_TYPES  # invites / password resets are never throttled


def notification_to_dict(n: Notification) -> Dict[str, Any]:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body or "",
        "link": n.link,
        "read": bool(n.read),
        "created_at": n.created_at,
    }


def emails_sent_last_hour(db: Session, tenant_id: str) -> int:
    since = staff_mod.utcnow() - timedelta(hours=1)
    return db.query(func.count(EmailLog.id)).filter(
        EmailLog.tenant_id == tenant_id,
        EmailLog.status == "sent",
        EmailLog.kind.in_(THROTTLED_KINDS),
        EmailLog.created_at >= since,
    ).scalar() or 0


def _log_email(db: Session, tenant_id: Optional[str], to: str, kind: str, subject: str,
               status: str, error: Optional[str] = None) -> None:
    db.add(EmailLog(tenant_id=tenant_id, to_email=to, kind=kind, subject=subject[:250],
                    status=status, error=error, created_at=staff_mod.utcnow()))
    db.commit()


def send_transactional(db: Session, tenant_id: Optional[str], to: str, kind: str, subject: str,
                       html_body: str, text_body: str) -> bool:
    """Invite / password-reset email (not throttled). Logged in email_log."""
    if not smtp_configured():
        return False
    ok = send_email(to, subject, html_body, text_body)
    try:
        _log_email(db, tenant_id, to, kind, subject, "sent" if ok else "failed")
    except Exception as e:  # logging must never break the caller
        db.rollback()
        logger.warning(f"email_log write failed: {e}")
    return ok


def _publish_notifications(tenant_id: str, items: List[Notification]) -> None:
    """Live "notification" events, each only to its addressee. Never raises."""
    try:
        from app import realtime
        if not items or not realtime.broker.has_subscribers(tenant_id):
            return
        for n in items:
            realtime.publish(tenant_id, "notification", notification_to_dict(n), user_id=n.user_id)
    except Exception as e:
        logger.warning(f"Publishing notifications failed: {e}")


def notify_staff(
    db: Session,
    tenant_id: str,
    type: str,
    title: str,
    body: str,
    link: Optional[str],
    email: bool = True,
    min_role: str = "viewer",
    email_lines: Iterable[str] = (),
    cta_text: str = "Open dashboard",
    max_per_hour: Optional[int] = None,
    exclude_user_id: Optional[int] = None,
) -> Dict[str, int]:
    """Create in-app notifications (+ emails) for the tenant's active staff. Never raises."""
    result = {"in_app": 0, "emailed": 0, "throttled": 0}
    try:
        recipients: List[User] = [
            u for u in staff_mod.staff_query(db, tenant_id).filter(
                User.is_active.is_(True), User.invite_token_hash.is_(None)).all()
            if staff_mod.rank(u.role) >= staff_mod.rank(min_role) and u.id != exclude_user_id
        ]
        created: List[Notification] = []
        for user in recipients:
            if user.notify_in_app is not False:
                n = Notification(tenant_id=tenant_id, user_id=user.id, type=type, title=title[:250],
                                 body=body, link=link, read=False, created_at=staff_mod.utcnow())
                db.add(n)
                created.append(n)
                result["in_app"] += 1
        db.commit()
        _publish_notifications(tenant_id, created)

        if not (email and smtp_configured()):
            return result
        to_email = [u for u in recipients if u.notify_email is not False]
        if not to_email:
            return result
        if max_per_hour is None:
            from app.tenant_settings import get_settings
            max_per_hour = get_settings(db, tenant_id)["email_max_per_hour"]
        url = staff_mod.dashboard_link(link[2:]) if link and link.startswith("#/") else None
        if url and url.startswith("#"):
            url = None  # no DASHBOARD_URL: a relative link is useless in an email
        html_body, text_body = render(title, body, email_lines, cta_text if url else None, url)
        subject = f"[Brainbox] {title}"
        sent = emails_sent_last_hour(db, tenant_id)
        for user in to_email:
            if sent >= max_per_hour:
                _log_email(db, tenant_id, user.email, type, subject, "throttled")
                result["throttled"] += 1
                continue
            ok = send_email(user.email, subject, html_body, text_body)
            _log_email(db, tenant_id, user.email, type, subject, "sent" if ok else "failed")
            if ok:
                sent += 1
                result["emailed"] += 1
        if result["throttled"]:
            logger.warning(f"Tenant {tenant_id}: {result['throttled']} notification email(s) skipped "
                           f"(email_max_per_hour={max_per_hour})")
    except Exception as e:
        db.rollback()
        logger.error(f"notify_staff failed for tenant {tenant_id}: {e}", exc_info=True)
    return result
