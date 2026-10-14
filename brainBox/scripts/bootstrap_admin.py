"""One-time: create the first platform-admin staff account (run inside the api container by deploy.sh).

Does nothing if the account already exists. The generated password is printed only encrypted to
scripts/bootstrap-admin.pub.pem, so it never appears in the repository or in deploy logs; the holder
of the matching private key decrypts it.
"""
import base64
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, "/app")

from cryptography.hazmat.primitives import hashes, serialization  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import padding  # noqa: E402

from app import staff as staff_mod  # noqa: E402
from app.api.platform import tenant_summaries  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402

EMAIL = "admin@smartpowerbilling.com"
NAME = "Brainbox Admin"
PUB = Path(__file__).with_name("bootstrap-admin.pub.pem")


def make_password() -> str:
    alphabet = string.ascii_letters + string.digits
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(14))
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw) and any(c.isdigit() for c in pw):
            return pw


def main() -> int:
    db = SessionLocal()
    try:
        if staff_mod.get_by_email(db, EMAIL) is not None:
            print(f"bootstrap-admin: {EMAIL} already exists, nothing to do")
            return 0
        rows = tenant_summaries(db)
        if not rows:
            print("bootstrap-admin: no companies found, nothing created")
            return 0
        # The company with the most knowledge is the main one; a platform admin can open the others.
        tenant = max(rows, key=lambda r: (r["documents"], r["conversations"], r["staff_count"]))["tenant_id"]
        password = make_password()
        user, _ = staff_mod.create_staff(db, tenant, EMAIL, "owner", NAME, password, is_platform_admin=True)
        key = serialization.load_pem_public_key(PUB.read_bytes())
        blob = key.encrypt(password.encode(), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),
                                                            algorithm=hashes.SHA256(), label=None))
        print(f"bootstrap-admin: created owner #{user.id} {EMAIL} (platform admin) for tenant {tenant}")
        print("bootstrap-admin-secret: " + base64.b64encode(blob).decode())
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
