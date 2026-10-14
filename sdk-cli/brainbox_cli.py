#!/usr/bin/env python3
"""Brainbox server agent: reads this server's logs and sends them to your Brainbox.

Runs as a systemd service (``brainbox-cli``). Standard library only, Python 3.6+.

    brainbox-cli init --api-url URL --api-key sk_live_...   save settings
    brainbox-cli add-log /var/log/myapp/build.log --name "Build log"
    brainbox-cli logs                                       list what is read
    brainbox-cli run-once                                   collect and send now
    brainbox-cli daemon                                     run forever (the service does this)
    brainbox-cli status | health

What it sends is labelled for **admins only** by default, because logs can contain
private details. Only new log lines are sent, and passwords, tokens and keys are masked.
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

VERSION = "1.1.0"
AUDIENCES = ("public", "customer", "vendor", "internal", "admin")
DEFAULT_COLLECTORS = ["nginx", "system", "docker", "services", "resources"]
ALL_COLLECTORS = ["nginx", "system", "postgres", "docker", "services", "resources", "ports", "nginx_sites", "ssl"]
SERVICES = ["nginx", "postgresql", "redis", "docker", "mysql"]
MAX_BYTES = 64 * 1024          # most new log text sent per file per cycle
FIRST_RUN_BYTES = 16 * 1024    # how far back to start on a file seen for the first time

_SECRET_PATTERNS = [
    (re.compile(r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key)(\"?\s*[=:]\s*\"?)([^\s\"'&,;]+)"), r"\1\2****"),
    (re.compile(r"(?i)\b(authorization\s*:\s*(?:bearer|basic)\s+)\S+"), r"\1****"),
    (re.compile(r"\b(sk|pk)_(live|test)_[A-Za-z0-9_\-]{6,}"), r"\1_\2_****"),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{5,}"), "****"),
]


def redact(text: str) -> str:
    """Mask passwords, tokens and keys before anything leaves the server."""
    for pattern, repl in _SECRET_PATTERNS:
        text = pattern.sub(repl, text)
    return text


def _is_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


def _config_path() -> Path:
    if os.environ.get("BRAINBOX_CLI_CONFIG"):
        return Path(os.environ["BRAINBOX_CLI_CONFIG"])
    return Path("/etc/brainbox-cli/config.json") if _is_root() else Path.home() / ".brainbox-cli" / "config.json"


def _state_path() -> Path:
    if os.environ.get("BRAINBOX_CLI_STATE"):
        return Path(os.environ["BRAINBOX_CLI_STATE"])
    return Path("/var/lib/brainbox-cli/state.json") if _is_root() else Path.home() / ".brainbox-cli" / "state.json"


LEGACY_CONFIG = Path.home() / ".brainbox-cli" / "config.json"  # where 1.0.0 kept it


def _read_json(path: Path) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def _run(cmd: List[str], timeout: int = 10, ok_only: bool = False) -> str:
    """Output of a command ("" if it is missing or times out; with ok_only also if it fails)."""
    try:
        r = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True,
                           timeout=timeout, errors="ignore")
        return "" if ok_only and r.returncode != 0 else r.stdout or ""
    except (OSError, subprocess.SubprocessError):
        return ""


class BrainboxCLI:
    """Collects server logs and sends them to Brainbox."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        cfg = dict(config) if config is not None else self.load_config()
        self.config = cfg
        self.api_url = str(cfg.get("api_url") or "").rstrip("/")
        self.api_key = str(cfg.get("api_key") or "")
        self.tenant_id = cfg.get("tenant_id") or None
        self.audience = cfg.get("audience") if cfg.get("audience") in AUDIENCES else "admin"
        self.interval = max(30, int(cfg.get("interval") or 300))
        self.snapshot_every = max(60, int(cfg.get("snapshot_every") or 3600))
        chosen = cfg["collectors"] if isinstance(cfg.get("collectors"), list) else DEFAULT_COLLECTORS
        self.collectors = [c for c in chosen if c in ALL_COLLECTORS]
        self.log_files = [f for f in (cfg.get("log_files") or []) if isinstance(f, dict) and f.get("path")]
        self.restart_services = bool(cfg.get("restart_services"))
        self.state = _read_json(_state_path())
        self.pending: List[Dict[str, Any]] = []

    # -- settings ------------------------------------------------------------

    @staticmethod
    def load_config() -> Dict[str, Any]:
        cfg = _read_json(_config_path())
        return cfg or _read_json(LEGACY_CONFIG)

    def save_config(self) -> None:
        self.config.update({
            "api_url": self.api_url, "api_key": self.api_key, "tenant_id": self.tenant_id,
            "audience": self.audience, "interval": self.interval, "snapshot_every": self.snapshot_every,
            "collectors": self.collectors, "log_files": self.log_files,
            "restart_services": self.restart_services, "last_saved": datetime.now().isoformat(),
        })
        _write_json(_config_path(), self.config)
        print("Settings saved to %s" % _config_path())

    def save_state(self) -> None:
        try:
            _write_json(_state_path(), self.state)
        except OSError as e:
            print("Could not save state: %s" % e)

    # -- talking to Brainbox ---------------------------------------------------

    def _request(self, method: str, path: str, body: Optional[Dict[str, Any]] = None, timeout: int = 30):
        req = urllib.request.Request(self.api_url + path, method=method,
                                     data=json.dumps(body).encode("utf-8") if body is not None else None)
        req.add_header("Authorization", "Bearer " + self.api_key)
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "brainbox-cli/" + VERSION)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "ignore")

    def health_check(self) -> bool:
        if not self.api_url:
            print("Not set up yet. Run: brainbox-cli init --api-url URL --api-key sk_live_...")
            return False
        try:
            code, _ = self._request("GET", "/api/health", timeout=8)
        except Exception as e:  # network errors
            print("Brainbox unreachable: %s" % e)
            return False
        print("Brainbox is reachable" if code == 200 else "Brainbox returned %s" % code)
        return code == 200

    def _add(self, source_type: str, name: str, content: str, file_path: str) -> None:
        content = redact(content).strip()
        if content:
            self.pending.append({"source_type": source_type, "name": name, "content": content, "file_path": file_path})

    def send(self) -> int:
        """Send everything collected. Returns how many items were accepted."""
        sent = 0
        host = os.uname().nodename if hasattr(os, "uname") else "server"
        for item in self.pending:
            stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            text = "[%s on %s, %s]\n%s" % (item["name"], host, stamp, item["content"])
            payload = {
                "source_type": item["source_type"], "content": text, "file_path": item["file_path"],
                "content_hash": hashlib.sha256(item["content"].encode("utf-8")).hexdigest(),
                "audience": self.audience,
                "metadata": {"collector": "brainbox-cli", "version": VERSION, "host": host, "name": item["name"]},
            }
            if self.tenant_id:
                payload["tenant_id"] = self.tenant_id
            try:
                code, body = self._request("POST", "/api/ingest", payload)
            except Exception as e:
                print("  could not send %s: %s" % (item["name"], e))
                continue
            if code == 200:
                sent += 1
            else:
                print("  %s rejected (%s): %s" % (item["name"], code, body[:160]))
                if code in (401, 403):
                    print("  The key was refused. Use a SECRET key (sk_live_...) from Settings > API keys.")
                    break
        print("Sent %d of %d item(s) as '%s'" % (sent, len(self.pending), self.audience))
        self.pending = []
        return sent

    # -- collectors --------------------------------------------------------------

    def read_new_lines(self, path: str, name: str, source_type: str = "server_log") -> None:
        """Send only what was added to a log file since the last look (handles log rotation)."""
        try:
            st = os.stat(path)
        except OSError:
            return
        seen = (self.state.setdefault("files", {})).get(path) or {}
        offset = seen.get("offset")
        if offset is None or seen.get("inode") != st.st_ino or st.st_size < offset:
            offset = max(0, st.st_size - FIRST_RUN_BYTES) if offset is None else 0
        if st.st_size - offset > MAX_BYTES:
            offset = st.st_size - MAX_BYTES
        if st.st_size > offset:
            try:
                with open(path, "rb") as f:
                    f.seek(offset)
                    data = f.read(st.st_size - offset)
            except OSError as e:
                print("  cannot read %s: %s" % (path, e))
                return
            cut = data.rfind(b"\n")  # keep whole lines only; the rest waits for the next cycle
            if cut < 0:
                return
            text = data[:cut + 1].decode("utf-8", "ignore")
            if offset and "\n" in text and not seen:
                text = text.split("\n", 1)[1]  # first look started mid-line
            self._add(source_type, name, text, path)
            offset += cut + 1
        self.state["files"][path] = {"inode": st.st_ino, "offset": offset}

    def snapshot(self, key: str, source_type: str, name: str, content: str, file_path: str) -> None:
        """Send a status snapshot only if it changed, and at most once per ``snapshot_every`` seconds."""
        if not content.strip():
            return
        snaps = self.state.setdefault("snapshots", {})
        digest = hashlib.sha256(content.encode("utf-8", "ignore")).hexdigest()
        last = snaps.get(key) or {}
        if last.get("hash") == digest or time.time() - float(last.get("at") or 0) < self.snapshot_every:
            return
        snaps[key] = {"hash": digest, "at": time.time()}
        self._add(source_type, name, content, file_path)

    def collect_custom_logs(self) -> None:
        for entry in self.log_files:
            self.read_new_lines(entry["path"], entry.get("name") or os.path.basename(entry["path"]),
                                entry.get("source_type") or "server_log")

    def collect_nginx_logs(self, nginx_log_path: str = "/var/log/nginx/") -> None:
        for fname, label in (("access.log", "Nginx access log"), ("error.log", "Nginx error log")):
            self.read_new_lines(os.path.join(nginx_log_path, fname), label, "nginx_" + fname.replace(".", "_"))

    def collect_system_logs(self) -> None:
        for path, label, kind in (("/var/log/syslog", "System log", "system_syslog"),
                                  ("/var/log/messages", "System log", "system_syslog"),
                                  ("/var/log/auth.log", "Login (auth) log", "system_auth_log"),
                                  ("/var/log/kern.log", "Kernel log", "system_kern_log")):
            self.read_new_lines(path, label, kind)

    def collect_postgres_logs(self, db_log_path: str = "/var/log/postgresql/") -> None:
        if os.path.isdir(db_log_path):
            for log_file in sorted(Path(db_log_path).glob("*.log")):
                self.read_new_lines(str(log_file), "PostgreSQL log (%s)" % log_file.name, "postgres_logs")

    def collect_docker_logs(self) -> None:
        names = [n for n in _run(["docker", "ps", "--format", "{{.Names}}"], ok_only=True).splitlines() if n.strip()]
        since = self.state.get("docker_since")
        now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        for name in names:
            cmd = ["docker", "logs", "--tail", "200"] + (["--since", since] if since else []) + [name]
            self._add("docker_logs", "Docker container %s" % name, _run(cmd, timeout=15)[-MAX_BYTES:], "docker://" + name)
        if names:
            self.state["docker_since"] = now

    def collect_service_status(self) -> None:
        for service in SERVICES:
            if "could not be found" in _run(["systemctl", "status", service]) or not _run(["systemctl", "cat", service]):
                continue
            state = _run(["systemctl", "is-active", service]).strip() or "unknown"
            note = ""
            if self.restart_services and state not in ("active", "activating"):
                ok = subprocess.call(["systemctl", "restart", service]) == 0
                note = "\nBrainbox agent %s %s." % ("restarted" if ok else "failed to restart", service)
            self.snapshot("service:" + service, "service_status", "Service %s" % service,
                          "Service %s is %s.%s" % (service, state, note), "service://" + service)

    def collect_system_resources(self) -> None:
        text = "Load and top processes:\n%s\n\nMemory:\n%s\n\nDisk:\n%s" % (
            "\n".join(_run(["top", "-bn1"], ok_only=True).splitlines()[:17]), _run(["free", "-h"], ok_only=True),
            _run(["df", "-h"], ok_only=True))
        self.snapshot("resources", "system_resources", "Server resources (CPU, memory, disk)", text, "system://resources")

    def collect_open_ports(self) -> None:
        out = _run(["ss", "-tulpn"], ok_only=True) or _run(["netstat", "-tulpn"], ok_only=True)
        self.snapshot("ports", "system_open_ports", "Open ports", out, "system://open_ports")

    def collect_nginx_sites(self, nginx_config_path: str = "/etc/nginx/") -> None:
        enabled = Path(nginx_config_path) / "sites-enabled"
        if enabled.is_dir():
            for f in sorted(p for p in enabled.glob("*") if p.is_file()):
                try:
                    self.snapshot("nginx_site:" + f.name, "nginx_sites_enabled", "Nginx site %s" % f.name,
                                  f.read_text(errors="ignore"), str(f))
                except OSError:
                    pass

    def collect_ssl_logs(self, cert_path: str = "/etc/letsencrypt/live/") -> None:
        if os.path.isdir(cert_path):
            for cert in sorted(Path(cert_path).glob("*/cert.pem"))[:20]:
                out = _run(["openssl", "x509", "-in", str(cert), "-noout", "-subject", "-enddate"], ok_only=True)
                self.snapshot("ssl:" + cert.parent.name, "ssl_certificates", "SSL certificate %s" % cert.parent.name,
                              out, str(cert))

    def collect(self, only: Optional[List[str]] = None) -> int:
        wanted = only or self.collectors
        steps = {
            "nginx": self.collect_nginx_logs, "system": self.collect_system_logs,
            "postgres": self.collect_postgres_logs, "docker": self.collect_docker_logs,
            "services": self.collect_service_status, "resources": self.collect_system_resources,
            "ports": self.collect_open_ports, "nginx_sites": self.collect_nginx_sites, "ssl": self.collect_ssl_logs,
        }
        for name in wanted:
            try:
                steps[name]()
            except Exception as e:  # one broken collector must not stop the rest
                print("  %s: %s" % (name, e))
        if not only:
            self.collect_custom_logs()
        return len(self.pending)

    def run_once(self) -> bool:
        found = self.collect()
        print("[%s] %d new item(s)" % (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), found))
        if not found:
            self.save_state()
            return True
        if not self.health_check():
            self.pending = []  # offsets are not saved, so the same lines are picked up next time
            self.state = _read_json(_state_path())
            return False
        self.send()
        self.save_state()
        return True

    def daemon(self, interval: Optional[int] = None) -> None:
        wait = max(30, int(interval or self.interval))
        print("Brainbox server agent %s started; checking every %ss" % (VERSION, wait))
        sys.stdout.flush()
        while True:
            try:
                self.__init__()  # pick up settings changed while running (add-log, set ...)
                self.run_once()
            except KeyboardInterrupt:
                break
            except Exception as e:
                print("Cycle failed: %s" % e)
            sys.stdout.flush()
            time.sleep(wait)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="brainbox-cli", description="Brainbox server agent " + VERSION)
    parser.add_argument("--version", action="version", version=VERSION)
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("init", help="Save settings")
    p.add_argument("--api-url", required=True)
    p.add_argument("--api-key", required=True, help="Secret key (sk_live_...)")
    p.add_argument("--tenant-id", default=None, help="Optional: the key already decides the company")
    p.add_argument("--audience", choices=AUDIENCES, default=None, help="Who may see it (default: admin)")
    p.add_argument("--interval", type=int, default=None, help="Seconds between checks (default 300)")

    p = sub.add_parser("set", help="Change a setting")
    p.add_argument("--audience", choices=AUDIENCES)
    p.add_argument("--interval", type=int)
    p.add_argument("--collectors", help="Comma-separated: " + ",".join(ALL_COLLECTORS))
    p.add_argument("--restart-services", choices=("on", "off"),
                   help="Let the agent restart nginx/postgresql/redis/docker/mysql when they are down")

    p = sub.add_parser("add-log", help="Read one more log file")
    p.add_argument("path")
    p.add_argument("--name", default=None, help='Label, e.g. "Build log"')
    p = sub.add_parser("remove-log", help="Stop reading a log file")
    p.add_argument("path")
    sub.add_parser("logs", help="List what is read")

    p = sub.add_parser("collect", help="Show what would be sent (sends nothing)")
    p.add_argument("--type", default=None, help="Comma-separated collectors")
    sub.add_parser("run-once", help="Collect and send now")
    sub.add_parser("ingest", help="Same as run-once").add_argument("--auto-send", action="store_true")
    sub.add_parser("daemon", help="Run forever").add_argument("--interval", type=int, default=None)
    sub.add_parser("health", help="Check that Brainbox is reachable")
    sub.add_parser("status", help="Show settings")

    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help()
        return 0

    cli = BrainboxCLI()
    if args.command == "init":
        cli.api_url, cli.api_key = args.api_url.rstrip("/"), args.api_key.strip()
        cli.tenant_id = args.tenant_id or None
        cli.audience = args.audience or cli.audience
        cli.interval = max(30, args.interval or cli.interval)
        cli.save_config()
        if not cli.api_key.startswith("sk_"):
            print("Warning: that does not look like a secret key (sk_live_...). Publishable keys cannot train.")
        return 0 if cli.health_check() else 1
    if args.command == "set":
        if args.audience:
            cli.audience = args.audience
        if args.interval:
            cli.interval = max(30, args.interval)
        if args.collectors is not None:
            cli.collectors = [c.strip() for c in args.collectors.split(",") if c.strip() in ALL_COLLECTORS]
        if args.restart_services:
            cli.restart_services = args.restart_services == "on"
        cli.save_config()
        return 0
    if args.command == "add-log":
        path = os.path.abspath(args.path)
        if not os.path.isfile(path):
            print("No such file: %s" % path)
            return 1
        cli.log_files = [f for f in cli.log_files if f["path"] != path] + [
            {"path": path, "name": args.name or os.path.basename(path)}]
        cli.save_config()
        print("Now reading %s" % path)
        return 0
    if args.command == "remove-log":
        path = os.path.abspath(args.path)
        cli.log_files = [f for f in cli.log_files if f["path"] != path]
        cli.save_config()
        return 0
    if args.command in ("logs", "status"):
        key = cli.api_key
        print("Brainbox:   %s" % (cli.api_url or "(not set)"))
        print("Key:        %s" % ((key[:8] + "..." + key[-4:]) if len(key) > 14 else "(not set)"))
        print("Seen by:    %s" % cli.audience)
        print("Every:      %ss (status snapshots at most every %ss)" % (cli.interval, cli.snapshot_every))
        print("Built-in:   %s" % (", ".join(cli.collectors) or "none"))
        print("Restart services when down: %s" % ("on" if cli.restart_services else "off"))
        print("Your logs:")
        for f in cli.log_files:
            print("  %s  (%s)%s" % (f["path"], f.get("name"), "" if os.path.isfile(f["path"]) else "  MISSING"))
        if not cli.log_files:
            print("  none. Add one: brainbox-cli add-log /path/to/file.log --name \"Build log\"")
        return 0
    if args.command == "health":
        return 0 if cli.health_check() else 1
    if args.command == "collect":
        only = [c.strip() for c in args.type.split(",") if c.strip() in ALL_COLLECTORS] if args.type else None
        cli.collect(only)
        for item in cli.pending:
            print("%-22s %-40s %6d chars" % (item["source_type"], item["name"][:40], len(item["content"])))
        print("%d item(s) would be sent. Nothing was sent." % len(cli.pending))
        return 0
    if args.command in ("run-once", "ingest"):
        return 0 if cli.run_once() else 1
    if args.command == "daemon":
        cli.daemon(args.interval)
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
