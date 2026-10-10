"""Brainbox Python SDK (package ``spres-ai``).

Talk to your Brainbox from servers, scripts and cron jobs: train it from files, text,
database rows and third-party APIs, check training progress, and chat with it.

Authentication uses a **secret key** (``sk_live_...``). The key decides which tenant
(company knowledge base) you act on, so ``tenant_id`` is optional. Never ship a secret
key to a browser or mobile app.
"""
import ast
import mimetypes
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

__version__ = "1.1.0"

DEFAULT_API_URL = "https://port.smartpowerbilling.com"
AUDIENCES = ("public", "customer", "vendor", "internal", "admin")
TERMINAL_STATUSES = ("completed", "failed", "error", "cancelled")
SUCCESS_STATUSES = ("completed",)


class BrainboxError(Exception):
    """Raised when the Brainbox API returns an error.

    ``status_code`` is the HTTP status (``None`` for network errors) and ``detail`` is the
    backend's own explanation (its ``detail`` field) when there is one.
    """

    def __init__(self, message: str, status_code: Optional[int] = None, detail: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


class BrainboxAuthError(BrainboxError):
    """401/403: missing, invalid or wrong kind of key (training needs a secret key)."""


class BrainboxNotFoundError(BrainboxError):
    """404: the source or task does not exist (or belongs to another tenant)."""


class BrainboxValidationError(BrainboxError):
    """400/409/413/415/422: the request was rejected (bad file type, bad field, too large...)."""


class BrainboxTimeoutError(BrainboxError):
    """wait_for_task() gave up before the task finished."""


def _format_detail(detail: Any) -> str:
    """Turn a backend ``detail`` (string or list of validation errors) into one readable line."""
    if detail is None:
        return ""
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        parts = []
        for item in detail:
            if isinstance(item, dict):
                loc = ".".join(str(p) for p in item.get("loc", []) if p not in ("body", "query"))
                msg = item.get("msg", "")
                parts.append(f"{loc}: {msg}" if loc else msg)
            else:
                parts.append(str(item))
        return "; ".join(p for p in parts if p)
    return str(detail)


@dataclass
class FunctionInfo:
    """Function location and metadata"""
    name: str
    file_path: str
    line_number: int
    language: str
    signature: str
    parameters: List[str]
    is_async: bool = False
    class_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "language": self.language,
            "signature": self.signature,
            "parameters": self.parameters,
            "is_async": self.is_async,
            "class_name": self.class_name
        }


class BrainboxPythonSDK:
    """Client for the Brainbox API.

    >>> sdk = BrainboxPythonSDK(api_key=os.environ["BRAINBOX_SECRET_KEY"])
    >>> job = sdk.train_file("handbook.pdf", audience="internal")
    >>> sdk.wait_for_task(job["task_id"])
    """

    def __init__(
        self,
        api_url: str = DEFAULT_API_URL,
        api_key: Optional[str] = None,
        tenant_id: Optional[str] = None,
        timeout: float = 60,
    ):
        if not api_key:
            api_key = os.environ.get("BRAINBOX_SECRET_KEY") or os.environ.get("BRAINBOX_API_KEY")
        if not api_key:
            raise ValueError("api_key is required (a secret key, sk_live_...). "
                             "You can also set BRAINBOX_SECRET_KEY in the environment.")
        self.api_url = (api_url or DEFAULT_API_URL).rstrip('/')
        self.api_key = api_key
        self.tenant_id = tenant_id or None
        self.timeout = timeout
        self.session = requests.Session()
        # Auth headers only; Content-Type is set per request (JSON vs multipart).
        self.headers = {
            "X-API-Key": api_key,
            "Accept": "application/json",
            "User-Agent": f"spres-ai-python/{__version__}",
        }

    def __repr__(self) -> str:  # never show the key
        return f"BrainboxPythonSDK(api_url={self.api_url!r}, tenant_id={self.tenant_id!r})"

    def get_api_url(self) -> str:
        return self.api_url

    # ------------------------------------------------------------------ http

    def _request(self, method: str, path: str, *, json: Any = None, params: Optional[Dict] = None,
                 data: Optional[Dict] = None, files: Any = None) -> Any:
        url = f"{self.api_url}{path}"
        try:
            response = self.session.request(method, url, json=json, params=params, data=data,
                                            files=files, headers=self.headers, timeout=self.timeout)
        except requests.RequestException as e:
            raise BrainboxError(f"Could not reach Brainbox at {self.api_url}: {e}") from e

        if response.status_code >= 400:
            detail: Any = None
            try:
                body = response.json()
                detail = body.get("detail", body) if isinstance(body, dict) else body
            except ValueError:
                detail = (response.text or "").strip()[:500] or None
            text = _format_detail(detail) or response.reason or "Request failed"
            message = f"Brainbox API error {response.status_code} on {method} {path}: {text}"
            code = response.status_code
            if code in (401, 403):
                cls = BrainboxAuthError
                if code == 401:
                    message += " (check your secret key)"
            elif code == 404:
                cls = BrainboxNotFoundError
            elif code in (400, 409, 413, 415, 422):
                cls = BrainboxValidationError
            else:
                cls = BrainboxError
            raise cls(message, status_code=code, detail=detail)

        if response.status_code == 204 or not response.content:
            return {}
        try:
            return response.json()
        except ValueError:
            return {"raw": response.text}

    def _tenant_params(self) -> Optional[Dict[str, str]]:
        return {"tenant_id": self.tenant_id} if self.tenant_id else None

    def _with_tenant(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.tenant_id:
            payload["tenant_id"] = self.tenant_id
        return payload

    @staticmethod
    def _check_audience(audience: Optional[str]) -> Optional[str]:
        if audience is None:
            return None
        value = str(audience).strip().lower()
        if value not in AUDIENCES:
            raise ValueError(f"audience must be one of: {', '.join(AUDIENCES)}")
        return value

    # ------------------------------------------------------------------ ingest / chat

    def ingest(
        self,
        source_type: str,
        content: str,
        file_path: Optional[str] = None,
        metadata: Optional[Dict] = None,
        audience: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Low-level ingest (logs, code, JSON...). Returns ``{"status", "task_id", "message"}``."""
        payload: Dict[str, Any] = {
            "source_type": source_type,
            "content": content,
            "file_path": file_path,
            "metadata": metadata or {},
        }
        audience = self._check_audience(audience)
        if audience:
            payload["audience"] = audience
        return self._request("POST", "/api/ingest", json=self._with_tenant(payload))

    def get_ingest_status(self, task_id: str) -> Dict[str, Any]:
        """``{"task_id", "status", "error_message"}`` for any training or ingest task."""
        return self._request("GET", f"/api/ingest/status/{task_id}")

    def wait_for_task(self, task_id: str, timeout: float = 600, poll: float = 3,
                      raise_on_failure: bool = True) -> Dict[str, Any]:
        """Poll a task until it finishes. Returns the final status dict.

        Raises ``BrainboxTimeoutError`` after ``timeout`` seconds and ``BrainboxError`` when the
        task failed (unless ``raise_on_failure=False``).
        """
        deadline = time.monotonic() + timeout
        while True:
            status = self.get_ingest_status(task_id)
            state = str(status.get("status", "")).lower()
            if state in TERMINAL_STATUSES:
                if raise_on_failure and state not in SUCCESS_STATUSES:
                    raise BrainboxError(
                        f"Training task {task_id} {state}: {status.get('error_message') or 'no details'}",
                        detail=status,
                    )
                return status
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise BrainboxTimeoutError(
                    f"Task {task_id} still '{state or 'unknown'}' after {timeout:g}s", detail=status)
            time.sleep(max(0.0, min(poll, remaining)))

    def chat(self, question: str, session_id: Optional[str] = None) -> Dict[str, Any]:
        payload = {"question": question, "session_id": session_id}
        return self._request("POST", "/api/chat", json=self._with_tenant(payload))

    def create_chat_session(self, title: Optional[str] = None) -> Dict[str, Any]:
        payload = {"title": title or "New Session"}
        return self._request("POST", "/api/chat/session", json=self._with_tenant(payload))

    def health_check(self) -> Dict[str, Any]:
        return self._request("GET", "/api/health")

    # ------------------------------------------------------------------ training

    def train_file(self, path: str, name: Optional[str] = None, audience: Optional[str] = None) -> Dict[str, Any]:
        """Upload a document (PDF, XML, DOCX, TXT, CSV, JSON...; max 25 MB).

        Returns ``{"source": {...}, "task_id": "..."}``; training continues in the background.
        """
        file_path = Path(path)
        if not file_path.is_file():
            raise FileNotFoundError(f"No such file: {path}")
        data: Dict[str, str] = {}
        if name:
            data["name"] = name
        audience = self._check_audience(audience)
        if audience:
            data["audience"] = audience
        if self.tenant_id:
            data["tenant_id"] = self.tenant_id
        mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        with open(file_path, "rb") as fh:
            return self._request("POST", "/api/train/file", data=data,
                                 files={"file": (file_path.name, fh, mime)})

    def train_text(self, content: str, name: Optional[str] = None, audience: Optional[str] = None) -> Dict[str, Any]:
        """Teach free text: an FAQ, a policy, or one database record rendered as text."""
        if not content or not str(content).strip():
            raise ValueError("content must not be empty")
        payload: Dict[str, Any] = {"content": content}
        if name:
            payload["name"] = name
        audience = self._check_audience(audience)
        if audience:
            payload["audience"] = audience
        return self._request("POST", "/api/train/text", json=self._with_tenant(payload))

    def _api_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        if not config.get("url"):
            raise ValueError("url is required")
        payload = {k: v for k, v in config.items() if v is not None}
        if "audience" in payload:
            payload["audience"] = self._check_audience(payload["audience"])
        return self._with_tenant(payload)

    def test_api_source(self, **config: Any) -> Dict[str, Any]:
        """Dry-run a third-party API: fetches the first page and previews what would be learned.

        Accepts the same keywords as ``add_api_source``. Returns ``{"ok", "records_found",
        "preview", "detected_fields", "error", ...}`` (nothing is saved).
        """
        return self._request("POST", "/api/train/api-source/test", json=self._api_config(config))

    def add_api_source(self, **config: Any) -> Dict[str, Any]:
        """Connect a third-party API (e.g. your helpdesk) and start the first sync.

        Keywords: ``url`` (required), ``name``, ``method`` ("GET"/"POST"), ``headers``, ``query``,
        ``body``, ``data_path`` (dot path to the list of records), ``source_type``
        ("support_tickets" or "api_generic"), ``mapping`` (``id_field``, ``question_field``,
        ``answer_field``, ``title_field``, ``messages_field``, ``extra_fields``), ``pagination``
        (``type``: none/page/cursor, ``page_param``, ``cursor_path``, ``cursor_param``,
        ``max_pages``) and ``audience``. Returns ``{"source", "task_id"}``.
        """
        return self._request("POST", "/api/train/api-source", json=self._api_config(config))

    def list_sources(self) -> Dict[str, Any]:
        """``{"sources": [...], "totals": {"sources", "documents"}}``"""
        return self._request("GET", "/api/train/sources", params=self._tenant_params())

    def get_source(self, source_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/api/train/sources/{source_id}", params=self._tenant_params())

    def update_source(self, source_id: str, audience: Optional[str] = None, name: Optional[str] = None) -> Dict[str, Any]:
        """Rename a source and/or change who may see it (applies to all its documents at once)."""
        payload: Dict[str, Any] = {}
        if audience is not None:
            payload["audience"] = self._check_audience(audience)
        if name is not None:
            payload["name"] = name
        if not payload:
            raise ValueError("Pass audience and/or name")
        return self._request("PATCH", f"/api/train/sources/{source_id}", json=payload,
                             params=self._tenant_params())

    def delete_source(self, source_id: str) -> Dict[str, Any]:
        """Delete a source and everything learned from it. ``{"deleted", "documents_deleted"}``"""
        return self._request("DELETE", f"/api/train/sources/{source_id}", params=self._tenant_params())

    def sync_source(self, source_id: str) -> Dict[str, Any]:
        """Re-fetch an API source now. Returns ``{"source", "task_id"}``."""
        return self._request("POST", f"/api/train/sources/{source_id}/sync", params=self._tenant_params())

    # ==================== FUNCTION LOCATOR ====================

    @staticmethod
    def _skip_path(path: Path) -> bool:
        return bool(set(path.parts) & {".venv", "venv", "node_modules", ".git", "__pycache__", "site-packages"})

    def find_function(self, function_name: str, directory: str = ".") -> List[FunctionInfo]:
        """Find functions by name in codebase"""
        results: List[FunctionInfo] = []
        root = Path(directory)
        for py_file in root.rglob("*.py"):
            if not self._skip_path(py_file):
                results.extend(self._parse_python_file(str(py_file), function_name))
        for js_file in root.rglob("*.js"):
            if not self._skip_path(js_file):
                results.extend(self._parse_js_file(str(js_file), function_name))
        return results

    def find_all_functions(self, directory: str = ".") -> List[FunctionInfo]:
        """Find all functions in codebase (each function/method exactly once)"""
        results: List[FunctionInfo] = []
        root = Path(directory)
        for py_file in root.rglob("*.py"):
            if not self._skip_path(py_file):
                results.extend(self._parse_python_file(str(py_file)))
        for js_file in root.rglob("*.js"):
            if not self._skip_path(js_file):
                results.extend(self._parse_js_file(str(js_file)))
        return results

    def find_function_by_file(self, file_path: str) -> List[FunctionInfo]:
        """Find all functions in a specific file"""
        if file_path.endswith('.py'):
            return self._parse_python_file(file_path)
        elif file_path.endswith('.js'):
            return self._parse_js_file(file_path)
        return []

    def find_async_functions(self, directory: str = ".") -> List[FunctionInfo]:
        """Find all async functions"""
        return [f for f in self.find_all_functions(directory) if f.is_async]

    def _parse_python_file(self, file_path: str, search_name: Optional[str] = None) -> List[FunctionInfo]:
        """Parse a Python file and extract functions.

        Walks the tree once, remembering the enclosing class, so every method is reported a
        single time (the old ``ast.walk`` + class-body loop counted each method twice).
        """
        functions: List[FunctionInfo] = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                tree = ast.parse(f.read())
        except Exception:
            return functions

        def visit(node: ast.AST, class_name: Optional[str]) -> None:
            for child in ast.iter_child_nodes(node):
                if isinstance(child, ast.ClassDef):
                    visit(child, child.name)
                elif isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    is_async = isinstance(child, ast.AsyncFunctionDef)
                    if not search_name or child.name.lower() == search_name.lower():
                        params = [a.arg for a in child.args.args]
                        if class_name and params and params[0] in ("self", "cls"):
                            params = params[1:]
                        functions.append(FunctionInfo(
                            name=child.name,
                            file_path=file_path,
                            line_number=child.lineno,
                            language="python",
                            signature=f"{'async ' if is_async else ''}def {child.name}({', '.join(params)})",
                            parameters=params,
                            is_async=is_async,
                            class_name=class_name,
                        ))
                    visit(child, None)  # nested functions are not methods
                else:
                    visit(child, class_name)

        visit(tree, None)
        functions.sort(key=lambda fn: fn.line_number)
        return functions

    def _parse_js_file(self, file_path: str, search_name: Optional[str] = None) -> List[FunctionInfo]:
        """Parse JavaScript file and extract functions"""
        functions: List[FunctionInfo] = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception:
            return functions

        # Regular function declarations
        for match in re.finditer(r'(async\s+)?function\s+(\w+)\s*\(([^)]*)\)', content):
            name = match.group(2)
            if search_name and name.lower() != search_name.lower():
                continue
            params_str = match.group(3)
            params = [p.strip().split(':')[0].strip() for p in params_str.split(',') if p.strip()]
            is_async = bool(match.group(1))
            functions.append(FunctionInfo(
                name=name,
                file_path=file_path,
                line_number=content[:match.start()].count('\n') + 1,
                language="javascript",
                signature=f"{'async ' if is_async else ''}function {name}({params_str})",
                parameters=params,
                is_async=is_async
            ))

        # Arrow functions
        for match in re.finditer(r'(?:const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*=>', content):
            name = match.group(1)
            if search_name and name.lower() != search_name.lower():
                continue
            params_str = match.group(3)
            params = [p.strip().split(':')[0].strip() for p in params_str.split(',') if p.strip()]
            is_async = bool(match.group(2))
            functions.append(FunctionInfo(
                name=name,
                file_path=file_path,
                line_number=content[:match.start()].count('\n') + 1,
                language="javascript",
                signature=f"{'async ' if is_async else ''}const {name} = ({params_str}) =>",
                parameters=params,
                is_async=is_async
            ))

        return functions

    def _find_js_function(self, file_path: str, search_name: str) -> List[FunctionInfo]:
        """Helper to find specific JS function"""
        return self._parse_js_file(file_path, search_name)


__all__ = [
    "BrainboxPythonSDK", "FunctionInfo", "BrainboxError", "BrainboxAuthError",
    "BrainboxNotFoundError", "BrainboxValidationError", "BrainboxTimeoutError",
    "AUDIENCES", "DEFAULT_API_URL", "__version__",
]


if __name__ == "__main__":
    # Quick connectivity check: BRAINBOX_SECRET_KEY=sk_live_... python brainbox_sdk.py
    client = BrainboxPythonSDK()
    print(client.health_check())
    print(client.list_sources()["totals"])
