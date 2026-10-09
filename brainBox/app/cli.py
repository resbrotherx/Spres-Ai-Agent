"""Brainbox command line (run on the server, e.g. over SSH; talks to the DB directly).

    python -m app.cli keys create --tenant acme --type publishable --name "Website widget"
    python -m app.cli keys create --tenant acme --type secret --name "Odoo server"
    python -m app.cli keys create --tenant acme --type publishable --name "Legacy site" --key "<existing key>"
    python -m app.cli keys create --tenant acme --type secret --expires 2027-01-01
    python -m app.cli keys list [--tenant acme]
    python -m app.cli keys revoke 42

    python -m app.cli staff create --tenant acme --email owner@acme.com --role owner [--name "Ada"] [--password-stdin]
    python -m app.cli staff create --tenant brainbox --email ops@brainbox.io --role owner --platform-admin --password-stdin
    python -m app.cli staff list [--tenant acme]
    python -m app.cli staff set-password owner@acme.com [--password-stdin] [--must-change | --no-must-change]
    python -m app.cli staff platform-admin ops@brainbox.io --on   (or --off)
    python -m app.cli staff deactivate owner@acme.com
    python -m app.cli tenants list

`staff create` without a password prints an invite link (valid 7 days) instead.
The raw key is printed only by `create` (once). Prefer `--key-stdin` over `--key` when importing,
so the key doesn't end up in your shell history.
"""
import argparse
import getpass
import sys
from datetime import datetime, timezone
from typing import List, Optional

from app import apikeys


def _session():
    from app.db.session import SessionLocal, init_db
    init_db(reset_interrupted=False)  # make sure the key columns exist; never touch running jobs
    return SessionLocal()


def _parse_expiry(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        raise SystemExit(f"error: --expires must be an ISO date/datetime, got {value!r}")
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _fmt(dt) -> str:
    return dt.strftime("%Y-%m-%d %H:%M") if dt else "-"


def cmd_create(args) -> int:
    raw = args.key
    if args.key_stdin:
        raw = sys.stdin.readline().strip()
    db = _session()
    try:
        record, key = apikeys.create_key(db, args.tenant, args.type, args.name, _parse_expiry(args.expires), raw)
    except apikeys.KeyRequestError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    print(f"Created {record.key_type} key #{record.id} for tenant '{record.tenant_id}' ({record.name}).")
    if raw is None:
        print("Store it now - it cannot be shown again:")
        print(key)
    else:
        print(f"Imported existing key {record.key_prefix}... (not echoed).")
    return 0


def cmd_list(args) -> int:
    db = _session()
    try:
        rows = [apikeys.key_to_dict(k) for k in apikeys.list_keys(db, args.tenant)]
    finally:
        db.close()
    if not rows:
        print("No API keys.")
        return 0
    header = ("ID", "TENANT", "TYPE", "PREFIX", "STATUS", "NAME", "CREATED", "LAST USED", "EXPIRES")
    table: List[tuple] = [header]
    for r in rows:
        state = "active" if r["is_active"] and not r["expired"] else ("expired" if r["is_active"] else "revoked")
        table.append((str(r["id"]), r["tenant_id"], r["key_type"], (r["key_prefix"] or "") + "...", state,
                      r["name"], _fmt(r["created_at"]), _fmt(r["last_used"]), _fmt(r["expires_at"])))
    widths = [max(len(row[i]) for row in table) for i in range(len(header))]
    for row in table:
        print("  ".join(cell.ljust(w) for cell, w in zip(row, widths)).rstrip())
    return 0


def cmd_revoke(args) -> int:
    db = _session()
    try:
        record = apikeys.revoke_key(db, args.id)
    finally:
        db.close()
    if record is None:
        print(f"error: API key #{args.id} not found", file=sys.stderr)
        return 1
    print(f"Revoked key #{record.id} ({record.key_prefix}...) for tenant '{record.tenant_id}'.")
    return 0


def _read_password(from_stdin: bool, confirm: bool = True) -> str:
    if from_stdin:
        return sys.stdin.readline().rstrip("\r\n")
    first = getpass.getpass("Password (min 8 chars): ")
    if confirm and getpass.getpass("Repeat password: ") != first:
        raise SystemExit("error: passwords don't match")
    return first


def cmd_staff_create(args) -> int:
    from app import staff as staff_mod
    password = _read_password(True) if args.password_stdin else (
        _read_password(False) if args.password else None)
    db = _session()
    try:
        user, raw = staff_mod.create_staff(db, args.tenant, args.email, args.role, args.name, password or None,
                                           is_platform_admin=args.platform_admin)
    except staff_mod.StaffError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    finally:
        db.close()
    print(f"Created {user.role} #{user.id} {user.email} for tenant '{user.tenant_id}'"
          f"{' (platform admin)' if user.is_platform_admin else ''}.")
    if raw:
        print("Invite link (valid 7 days, shown once):")
        print(staff_mod.dashboard_link(f"accept-invite?token={raw}"))
    return 0


def cmd_staff_list(args) -> int:
    from app import staff as staff_mod
    from app.db.models import User
    db = _session()
    try:
        q = db.query(User).filter(User.role.in_(staff_mod.STAFF_ROLES), User.tenant_id.isnot(None))
        if args.tenant:
            q = q.filter(User.tenant_id == args.tenant)
        users = q.order_by(User.tenant_id, User.id).all()
        rows = [(str(u.id), u.tenant_id, u.email, u.role + (" +platform" if u.is_platform_admin else ""),
                 staff_mod.status_of(u), u.full_name or "", _fmt(u.last_login_at)) for u in users]
    finally:
        db.close()
    if not rows:
        print("No staff users.")
        return 0
    table = [("ID", "TENANT", "EMAIL", "ROLE", "STATUS", "NAME", "LAST LOGIN")] + rows
    widths = [max(len(r[i]) for r in table) for i in range(len(table[0]))]
    for row in table:
        print("  ".join(c.ljust(w) for c, w in zip(row, widths)).rstrip())
    return 0


def _staff_user(db, email):
    from app import staff as staff_mod
    user = staff_mod.get_by_email(db, email)
    if user is None or not staff_mod.is_staff(user):
        print(f"error: no staff user with email {email}", file=sys.stderr)
        return None
    return user


def cmd_staff_set_password(args) -> int:
    from app import staff as staff_mod
    password = _read_password(args.password_stdin)
    db = _session()
    try:
        user = _staff_user(db, args.email)
        if user is None:
            return 1
        try:
            staff_mod.set_password(db, user, password, must_change=args.must_change)
        except staff_mod.StaffError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
        user.invite_token_hash = None  # a set password also completes a pending invite
        user.invite_expires_at = None
        user.is_active = True
        db.commit()
        print(f"Password set for {user.email}"
              f"{' (must change it at next login)' if args.must_change else ''}.")
        return 0
    finally:
        db.close()


def cmd_staff_deactivate(args) -> int:
    from app import staff as staff_mod
    db = _session()
    try:
        user = _staff_user(db, args.email)
        if user is None:
            return 1
        if (user.role == "owner" and user.is_active and not args.force
                and staff_mod.active_owner_count(db, user.tenant_id, exclude_id=user.id) == 0):
            print("error: this is the tenant's last active owner (use --force to deactivate anyway)", file=sys.stderr)
            return 1
        user.is_active = False
        db.commit()
        print(f"Deactivated {user.email}.")
        return 0
    finally:
        db.close()


def cmd_staff_platform_admin(args) -> int:
    db = _session()
    try:
        user = _staff_user(db, args.email)
        if user is None:
            return 1
        user.is_platform_admin = bool(args.on)
        db.commit()
        print(f"{user.email} is {'now' if args.on else 'no longer'} a platform admin.")
        return 0
    finally:
        db.close()


def cmd_tenants_list(args) -> int:
    from app.api.platform import tenant_summaries
    db = _session()
    try:
        rows = tenant_summaries(db)
    finally:
        db.close()
    if not rows:
        print("No tenants.")
        return 0
    def short(v: str, n: int = 40) -> str:
        return v if len(v) <= n else v[: n - 3] + "..."
    table = [("TENANT", "NAME", "STAFF", "OWNERS", "PK", "SK", "DOCS", "CONVOS", "OPEN GAPS", "LAST ACTIVITY")]
    for r in rows:
        table.append((short(r["tenant_id"]), short(r["display_name"] or "", 30), str(r["staff_count"]),
                      short(", ".join(r["owners"]) or "-", 40), str(r["key_counts"]["publishable"]),
                      str(r["key_counts"]["secret"]), str(r["documents"]), str(r["conversations"]),
                      str(r["open_gaps"]), _fmt(r["last_activity_at"])))
    widths = [max(len(row[i]) for row in table) for i in range(len(table[0]))]
    for row in table:
        print("  ".join(c.ljust(w) for c, w in zip(row, widths)).rstrip())
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Brainbox administration")
    sub = parser.add_subparsers(dest="group", required=True)
    keys = sub.add_parser("keys", help="Manage API keys").add_subparsers(dest="action", required=True)

    c = keys.add_parser("create", help="Create (or import) an API key")
    c.add_argument("--tenant", required=True)
    c.add_argument("--type", required=True, choices=apikeys.KEY_TYPES)
    c.add_argument("--name")
    c.add_argument("--expires", help="ISO date/datetime (UTC if no offset)")
    src = c.add_mutually_exclusive_group()
    src.add_argument("--key", help=f"Import this existing raw key (>= {apikeys.MIN_IMPORTED_KEY_LENGTH} chars)")
    src.add_argument("--key-stdin", action="store_true", help="Read the key to import from stdin")
    c.set_defaults(func=cmd_create)

    ls = keys.add_parser("list", help="List keys (never shows raw keys)")
    ls.add_argument("--tenant")
    ls.set_defaults(func=cmd_list)

    r = keys.add_parser("revoke", help="Revoke a key by id")
    r.add_argument("id", type=int)
    r.set_defaults(func=cmd_revoke)

    staff = sub.add_parser("staff", help="Manage staff dashboard users").add_subparsers(dest="action", required=True)
    sc = staff.add_parser("create", help="Create a staff user (invite link unless a password is given)")
    sc.add_argument("--tenant", required=True)
    sc.add_argument("--email", required=True)
    sc.add_argument("--role", default="owner", choices=("owner", "admin", "trainer", "viewer"))
    sc.add_argument("--name")
    pw = sc.add_mutually_exclusive_group()
    pw.add_argument("--password", action="store_true", help="Prompt for a password")
    pw.add_argument("--password-stdin", action="store_true", help="Read the password from stdin")
    sc.add_argument("--platform-admin", action="store_true",
                    help="Also make this user a platform admin (manages every tenant)")
    sc.set_defaults(func=cmd_staff_create)
    sl = staff.add_parser("list", help="List staff users")
    sl.add_argument("--tenant")
    sl.set_defaults(func=cmd_staff_list)
    sp = staff.add_parser("set-password", help="Set a staff user's password")
    sp.add_argument("email")
    sp.add_argument("--password-stdin", action="store_true")
    sp.add_argument("--must-change", action=argparse.BooleanOptionalAction, default=False,
                    help="Ask the user to choose a new password at the next login (default: no)")
    sp.set_defaults(func=cmd_staff_set_password)
    pa = staff.add_parser("platform-admin", help="Grant or remove platform admin access")
    pa.add_argument("email")
    onoff = pa.add_mutually_exclusive_group(required=True)
    onoff.add_argument("--on", dest="on", action="store_true")
    onoff.add_argument("--off", dest="on", action="store_false")
    pa.set_defaults(func=cmd_staff_platform_admin)
    sd = staff.add_parser("deactivate", help="Deactivate a staff user")
    sd.add_argument("email")
    sd.add_argument("--force", action="store_true")
    sd.set_defaults(func=cmd_staff_deactivate)

    tenants = sub.add_parser("tenants", help="Tenants (companies)").add_subparsers(dest="action", required=True)
    tl = tenants.add_parser("list", help="List tenants with staff / key / usage counts")
    tl.set_defaults(func=cmd_tenants_list)
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
