"""Outgoing email over SMTP (stdlib smtplib).

Configured by SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM / SMTP_TLS
(starttls | ssl | none). Without SMTP_HOST every send is skipped (logged at INFO). Sends never
raise: failures are logged and reported as False. Callers run them in background tasks.
"""
import html
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Iterable, Optional, Tuple

from app.config import settings
from app.utils.logging import logger

BRAND = "Brainbox"
BLUE = "#2563eb"
BLUE_DARK = "#1e40af"


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and (settings.SMTP_FROM or settings.SMTP_USER))


def _from_address() -> str:
    sender = settings.SMTP_FROM or settings.SMTP_USER or ""
    return sender if "<" in sender else formataddr((BRAND, sender))


def render(
    title: str,
    intro: str,
    lines: Iterable[str] = (),
    cta_text: Optional[str] = None,
    cta_url: Optional[str] = None,
    footer: Optional[str] = None,
) -> Tuple[str, str]:
    """(html, text) bodies. All arguments are plain text and are escaped here."""
    lines = [l for l in lines if l]
    footer = footer or f"You are receiving this because you are a member of a {BRAND} workspace."
    text_parts = [title, "", intro]
    if lines:
        text_parts += [""] + [f"  {l}" for l in lines]
    if cta_url:
        text_parts += ["", f"{cta_text or 'Open'}: {cta_url}"]
    text_parts += ["", "--", footer]
    text = "\n".join(text_parts)

    e = html.escape
    quote = "".join(
        f'<p style="margin:0 0 8px;color:#1f2937;font-size:14px;line-height:20px;">{e(l)}</p>' for l in lines
    )
    quote_block = (
        f'<div style="margin:16px 0;padding:12px 16px;background:#eff6ff;border-left:4px solid {BLUE};'
        f'border-radius:6px;">{quote}</div>' if quote else ""
    )
    button = (
        f'<p style="margin:24px 0 8px;"><a href="{e(cta_url, quote=True)}" style="display:inline-block;'
        f'background:{BLUE};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;'
        f'padding:11px 20px;border-radius:8px;">{e(cta_text or "Open")}</a></p>'
        f'<p style="margin:0;color:#6b7280;font-size:12px;word-break:break-all;">{e(cta_url)}</p>'
        if cta_url else ""
    )
    body = f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:linear-gradient(135deg,{BLUE},{BLUE_DARK});background-color:{BLUE};padding:18px 24px;">
<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px;">{BRAND}</span></td></tr>
<tr><td style="padding:24px;">
<h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#0f172a;">{e(title)}</h1>
<p style="margin:0;color:#334155;font-size:14px;line-height:22px;">{e(intro)}</p>
{quote_block}{button}
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;">{e(footer)}</td></tr>
</table></td></tr></table></body></html>"""
    return body, text


def send_email(to: str, subject: str, html_body: str, text_body: str) -> bool:
    """Send one email. Returns True on success; never raises."""
    if not smtp_configured():
        logger.info(f"SMTP not configured; skipping email '{subject}'")
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = _from_address()
    msg["To"] = to
    msg["Message-ID"] = make_msgid(domain=(settings.SMTP_FROM or "brainbox.local").split("@")[-1].strip("> "))
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    mode = settings.SMTP_TLS if settings.SMTP_TLS in ("starttls", "ssl", "none") else "starttls"
    port = settings.SMTP_PORT or {"ssl": 465, "starttls": 587, "none": 25}[mode]
    timeout = settings.SMTP_TIMEOUT
    try:
        if mode == "ssl":
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=timeout,
                                      context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, port, timeout=timeout)
        try:
            if mode == "starttls":
                server.starttls(context=ssl.create_default_context())
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        finally:
            try:
                server.quit()
            except Exception:
                pass
        logger.info(f"Email sent: '{subject}'")
        return True
    except Exception as e:
        logger.error(f"Email '{subject}' failed: {type(e).__name__}: {e}")
        return False
