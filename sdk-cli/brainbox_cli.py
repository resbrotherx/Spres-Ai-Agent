#!/usr/bin/env python3
"""
Brainbox CLI SDK - Collect and ingest server logs and data
"""
import os
import sys
import json
import subprocess
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import argparse
import tempfile
import hashlib

class BrainboxCLI:
    """CLI tool for collecting server logs and ingesting into Brainbox"""

    def __init__(self, api_url: str, api_key: str, tenant_id: str = None):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.tenant_id = tenant_id or "default"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        self.config_file = Path.home() / ".brainbox-cli" / "config.json"
        self.collected_logs = []

    def save_config(self):
        """Save configuration to file"""
        config_dir = self.config_file.parent
        config_dir.mkdir(parents=True, exist_ok=True)

        config = {
            "api_url": self.api_url,
            "tenant_id": self.tenant_id,
            "api_key": self.api_key,
            "last_saved": datetime.now().isoformat()
        }

        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)

        os.chmod(self.config_file, 0o600)  # Secure permissions
        print(f"✓ Configuration saved to {self.config_file}")

    def load_config(self):
        """Load configuration from file"""
        if self.config_file.exists():
            with open(self.config_file, 'r') as f:
                config = json.load(f)
            self.api_url = config.get("api_url", self.api_url)
            self.api_key = config.get("api_key", self.api_key)
            self.tenant_id = config.get("tenant_id", self.tenant_id)
            print(f"✓ Configuration loaded from {self.config_file}")

    def health_check(self) -> bool:
        """Check if backend is reachable"""
        try:
            response = requests.get(
                f"{self.api_url}/api/health",
                headers=self.headers,
                timeout=5
            )
            if response.status_code == 200:
                print("✓ Backend is healthy")
                return True
            else:
                print(f"✗ Backend returned {response.status_code}")
                return False
        except Exception as e:
            print(f"✗ Backend unreachable: {e}")
            return False

    def collect_docker_logs(self) -> List[Dict[str, Any]]:
        """Collect Docker container logs"""
        logs = []
        try:
            # Get running containers
            result = subprocess.run(
                ["docker", "ps", "--format", "{{.ID}}\t{{.Names}}"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                print("✗ Docker not available or not running")
                return logs

            containers = result.stdout.strip().split('\n')
            print(f"✓ Found {len(containers)} running containers")

            for container_line in containers:
                if not container_line:
                    continue
                container_id, container_name = container_line.split('\t')

                try:
                    # Get container logs
                    log_result = subprocess.run(
                        ["docker", "logs", "--tail", "100", container_id],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )

                    if log_result.stdout:
                        logs.append({
                            "source_type": "docker_logs",
                            "container_id": container_id,
                            "container_name": container_name,
                            "content": log_result.stdout,
                            "timestamp": datetime.now().isoformat(),
                            "file_path": f"docker://{container_name}"
                        })
                        print(f"  ✓ Collected logs from {container_name}")
                except subprocess.TimeoutExpired:
                    print(f"  ✗ Timeout collecting logs from {container_name}")
                except Exception as e:
                    print(f"  ✗ Error collecting {container_name}: {e}")

            self.collected_logs.extend(logs)
            return logs

        except FileNotFoundError:
            print("✗ Docker CLI not found - install Docker")
            return logs

    def collect_system_logs(self) -> List[Dict[str, Any]]:
        """Collect system logs"""
        logs = []
        log_paths = {
            "syslog": ["/var/log/syslog", "/var/log/messages"],
            "auth_log": ["/var/log/auth.log"],
            "kern_log": ["/var/log/kern.log"],
            "boot_log": ["/var/log/boot.log"],
        }

        for log_type, paths in log_paths.items():
            for path in paths:
                if Path(path).exists():
                    try:
                        with open(path, 'r', errors='ignore') as f:
                            content = f.readlines()[-500:]  # Last 500 lines
                            logs.append({
                                "source_type": f"system_{log_type}",
                                "content": ''.join(content),
                                "file_path": path,
                                "timestamp": datetime.now().isoformat()
                            })
                            print(f"  ✓ Collected {log_type} from {path}")
                    except Exception as e:
                        print(f"  ✗ Error reading {path}: {e}")

        self.collected_logs.extend(logs)
        return logs

    def collect_postgres_logs(self, db_log_path: str = "/var/log/postgresql/") -> List[Dict[str, Any]]:
        """Collect PostgreSQL logs"""
        logs = []
        if Path(db_log_path).exists():
            try:
                for log_file in Path(db_log_path).glob("*.log"):
                    with open(log_file, 'r', errors='ignore') as f:
                        content = f.readlines()[-200:]
                        logs.append({
                            "source_type": "postgres_logs",
                            "content": ''.join(content),
                            "file_path": str(log_file),
                            "timestamp": datetime.now().isoformat()
                        })
                        print(f"  ✓ Collected PostgreSQL logs from {log_file.name}")
            except Exception as e:
                print(f"  ✗ Error collecting PostgreSQL logs: {e}")

        self.collected_logs.extend(logs)
        return logs

    def collect_nginx_logs(self, nginx_log_path: str = "/var/log/nginx/") -> List[Dict[str, Any]]:
        """Collect Nginx logs"""
        logs = []
        if Path(nginx_log_path).exists():
            for log_type in ["access.log", "error.log"]:
                log_file = Path(nginx_log_path) / log_type
                if log_file.exists():
                    try:
                        with open(log_file, 'r', errors='ignore') as f:
                            content = f.readlines()[-200:]
                            logs.append({
                                "source_type": f"nginx_{log_type.replace('.', '_')}",
                                "content": ''.join(content),
                                "file_path": str(log_file),
                                "timestamp": datetime.now().isoformat()
                            })
                            print(f"  ✓ Collected Nginx {log_type}")
                    except Exception as e:
                        print(f"  ✗ Error collecting {log_file}: {e}")

        self.collected_logs.extend(logs)
        return logs

    def collect_ssl_logs(self, cert_path: str = "/etc/ssl/certs/") -> List[Dict[str, Any]]:
        """Collect SSL certificate information"""
        logs = []
        if Path(cert_path).exists():
            try:
                certs_info = subprocess.run(
                    ["find", cert_path, "-name", "*.pem", "-o", "-name", "*.crt"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )

                cert_files = certs_info.stdout.strip().split('\n')
                for cert_file in cert_files[:20]:  # Limit to first 20
                    if cert_file:
                        try:
                            # Use openssl to get cert details
                            result = subprocess.run(
                                ["openssl", "x509", "-in", cert_file, "-noout", "-text"],
                                capture_output=True,
                                text=True,
                                timeout=5
                            )

                            if result.returncode == 0:
                                logs.append({
                                    "source_type": "ssl_certificates",
                                    "content": result.stdout,
                                    "file_path": cert_file,
                                    "timestamp": datetime.now().isoformat()
                                })
                                print(f"  ✓ Collected SSL info from {cert_file}")
                        except Exception as e:
                            print(f"  ✗ Error reading {cert_file}: {e}")
            except Exception as e:
                print(f"  ✗ Error collecting SSL logs: {e}")

        self.collected_logs.extend(logs)
        return logs

    def collect_service_status(self) -> List[Dict[str, Any]]:
        """Collect system service status"""
        logs = []
        try:
            # Get systemctl status for key services
            services = ["nginx", "postgresql", "redis", "docker", "mysql"]

            for service in services:
                try:
                    result = subprocess.run(
                        ["systemctl", "status", service],
                        capture_output=True,
                        text=True,
                        timeout=5
                    )

                    logs.append({
                        "source_type": "service_status",
                        "service_name": service,
                        "content": result.stdout + result.stderr,
                        "file_path": f"service://{service}",
                        "timestamp": datetime.now().isoformat()
                    })
                    print(f"  ✓ Collected status for {service}")
                except Exception:
                    pass  # Service might not exist

            self.collected_logs.extend(logs)
            return logs

        except Exception as e:
            print(f"✗ Error collecting service status: {e}")
            return logs

    def collect_system_resources(self) -> List[Dict[str, Any]]:
        """Collect system resource usage"""
        logs = []
        try:
            # CPU usage
            cpu_result = subprocess.run(
                ["top", "-bn1"],
                capture_output=True,
                text=True,
                timeout=5
            )

            # Memory usage
            mem_result = subprocess.run(
                ["free", "-h"],
                capture_output=True,
                text=True,
                timeout=5
            )

            # Disk usage
            disk_result = subprocess.run(
                ["df", "-h"],
                capture_output=True,
                text=True,
                timeout=5
            )

            logs.append({
                "source_type": "system_resources",
                "content": f"CPU:\n{cpu_result.stdout}\n\nMemory:\n{mem_result.stdout}\n\nDisk:\n{disk_result.stdout}",
                "file_path": "system://resources",
                "timestamp": datetime.now().isoformat()
            })

            print(f"  ✓ Collected system resources (CPU, Memory, Disk)")
            self.collected_logs.extend(logs)
            return logs

        except Exception as e:
            print(f"✗ Error collecting system resources: {e}")
            return logs

    def ingest_logs(self, auto_send: bool = False) -> bool:
        """Ingest collected logs to backend"""
        if not self.collected_logs:
            print("✗ No logs to ingest")
            return False

        print(f"\n📤 Ingesting {len(self.collected_logs)} log entries...")

        success_count = 0
        for i, log_entry in enumerate(self.collected_logs, 1):
            try:
                # Calculate content hash for deduplication
                content_hash = hashlib.sha256(
                    log_entry.get("content", "").encode()
                ).hexdigest()

                payload = {
                    "tenant_id": self.tenant_id,
                    "source_type": log_entry.get("source_type"),
                    "content": log_entry.get("content"),
                    "file_path": log_entry.get("file_path"),
                    "content_hash": content_hash,
                    "metadata": {
                        "collected_at": log_entry.get("timestamp"),
                        "collector": "brainbox-cli"
                    }
                }

                response = requests.post(
                    f"{self.api_url}/api/ingest",
                    json=payload,
                    headers=self.headers,
                    timeout=30
                )

                if response.status_code == 200:
                    success_count += 1
                    print(f"  ✓ Ingested {log_entry.get('source_type')} ({i}/{len(self.collected_logs)})")
                else:
                    print(f"  ✗ Failed to ingest (status {response.status_code})")

            except Exception as e:
                print(f"  ✗ Error ingesting log {i}: {e}")

        print(f"\n✓ Successfully ingested {success_count}/{len(self.collected_logs)} logs")
        self.collected_logs = []
        return success_count > 0


def main():
    parser = argparse.ArgumentParser(
        description="Brainbox CLI - Collect and ingest server logs"
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Init command
    init_parser = subparsers.add_parser("init", help="Initialize configuration")
    init_parser.add_argument("--api-url", required=True, help="Backend API URL")
    init_parser.add_argument("--api-key", required=True, help="API key")
    init_parser.add_argument("--tenant-id", default="default", help="Tenant ID")

    # Collect command
    collect_parser = subparsers.add_parser("collect", help="Collect logs")
    collect_parser.add_argument(
        "--type",
        default="docker,postgres,nginx,system,resources",
        help="Comma-separated log types to collect"
    )
    collect_parser.add_argument("--docker-path", default="/var/log/docker/")
    collect_parser.add_argument("--postgres-path", default="/var/log/postgresql/")
    collect_parser.add_argument("--nginx-path", default="/var/log/nginx/")

    # Ingest command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest collected logs")
    ingest_parser.add_argument("--auto-send", action="store_true", help="Send immediately")

    # Health check command
    health_parser = subparsers.add_parser("health", help="Check backend health")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize CLI
    try:
        cli = BrainboxCLI("http://localhost:8000", "dummy-key")
        cli.load_config()
    except:
        pass

    if args.command == "init":
        cli = BrainboxCLI(args.api_url, args.api_key, args.tenant_id)
        cli.save_config()

    elif args.command == "collect":
        log_types = args.type.split(",")
        print(f"\n📋 Collecting logs: {', '.join(log_types)}\n")

        if "docker" in log_types:
            print("Collecting Docker logs...")
            cli.collect_docker_logs()

        if "system" in log_types:
            print("Collecting system logs...")
            cli.collect_system_logs()

        if "postgres" in log_types:
            print("Collecting PostgreSQL logs...")
            cli.collect_postgres_logs(args.postgres_path)

        if "nginx" in log_types:
            print("Collecting Nginx logs...")
            cli.collect_nginx_logs(args.nginx_path)

        if "ssl" in log_types:
            print("Collecting SSL logs...")
            cli.collect_ssl_logs()

        if "services" in log_types:
            print("Collecting service status...")
            cli.collect_service_status()

        if "resources" in log_types:
            print("Collecting system resources...")
            cli.collect_system_resources()

        print(f"\n✓ Collected {len(cli.collected_logs)} log entries")

    elif args.command == "ingest":
        if cli.health_check():
            cli.ingest_logs()
        else:
            print("✗ Cannot ingest - backend unreachable")

    elif args.command == "health":
        cli.health_check()


if __name__ == "__main__":
    main()
