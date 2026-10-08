"""Server-side fetching of third-party JSON APIs (support systems etc.)."""
import hashlib
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.training.records import find_records, get_path

# httpx logs every request URL at INFO, which would write API keys passed as query params to the logs.
logging.getLogger("httpx").setLevel(logging.WARNING)

TIMEOUT_SECONDS = 30.0
MAX_RESPONSE_BYTES = 20 * 1024 * 1024
MAX_PAGES_CAP = 100

_CURSOR_PATHS = ["next_cursor", "nextCursor", "meta.next_cursor", "meta.nextCursor",
                 "pagination.next_cursor", "pagination.nextCursor", "next_page_token",
                 "nextPageToken", "links.next", "next_page", "next_page_url", "next",
                 "paging.next", "cursor"]


class FetchError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


def _request(client: httpx.Client, cfg: Dict[str, Any], url: str,
             params: Optional[Dict[str, Any]]) -> Tuple[int, Any]:
    method = (cfg.get("method") or "GET").upper()
    headers = {"Accept": "application/json", **(cfg.get("headers") or {})}
    kwargs: Dict[str, Any] = {"headers": headers, "params": params or None}
    body = cfg.get("body")
    if method == "POST" and body is not None:
        if isinstance(body, (dict, list)):
            kwargs["json"] = body
        else:
            kwargs["content"] = str(body)
    try:
        with client.stream(method, url, **kwargs) as resp:
            declared = resp.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > MAX_RESPONSE_BYTES:
                raise FetchError("Response is larger than the 20 MB limit", resp.status_code)
            buf = bytearray()
            for part in resp.iter_bytes():
                buf.extend(part)
                if len(buf) > MAX_RESPONSE_BYTES:
                    raise FetchError("Response is larger than the 20 MB limit", resp.status_code)
            status = resp.status_code
    except FetchError:
        raise
    except httpx.TimeoutException as e:
        raise FetchError(f"Request timed out after {int(TIMEOUT_SECONDS)}s") from e
    except httpx.HTTPError as e:
        raise FetchError(f"Request failed: {e.__class__.__name__}: {e}") from e

    if status >= 400:
        snippet = bytes(buf[:300]).decode("utf-8", errors="replace").strip()
        raise FetchError(f"API returned HTTP {status}" + (f": {snippet}" if snippet else ""), status)
    try:
        return status, json.loads(bytes(buf).decode("utf-8-sig", errors="replace"))
    except json.JSONDecodeError as e:
        raise FetchError("API response is not valid JSON", status) from e


def _client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT_SECONDS, follow_redirects=True)


def fetch_first_page(cfg: Dict[str, Any]) -> Tuple[int, List[Any], Optional[str]]:
    """Fetch one page. Returns (status_code, records, data_path_used)."""
    with _client() as client:
        status, data = _request(client, cfg, cfg["url"], dict(cfg.get("query") or {}))
    try:
        records, path = find_records(data, cfg.get("data_path"))
    except ValueError as e:
        raise FetchError(str(e), status) from e
    return status, records, path


def _fingerprint(records: List[Any]) -> str:
    return hashlib.sha256(json.dumps(records[:3], sort_keys=True, default=str).encode()).hexdigest()


def fetch_all(cfg: Dict[str, Any]) -> Tuple[int, List[Any], Optional[str], int]:
    """Fetch all pages according to cfg['pagination'].

    Returns (last_status_code, records, data_path_used, pages_fetched).
    """
    pagination = cfg.get("pagination") or {}
    ptype = (pagination.get("type") or "none").lower()
    max_pages = max(1, min(int(pagination.get("max_pages") or 10), MAX_PAGES_CAP))
    base_params = dict(cfg.get("query") or {})
    url = cfg["url"]
    all_records: List[Any] = []
    path_used: Optional[str] = None
    status = 0
    pages = 0

    with _client() as client:
        if ptype == "page":
            page_param = pagination.get("page_param") or "page"
            try:
                page = int(base_params.get(page_param, 1))
            except (TypeError, ValueError):
                page = 1
            last_fp = None
            while pages < max_pages:
                params = {**base_params, page_param: page}
                status, data = _request(client, cfg, url, params)
                pages += 1
                try:
                    records, path_used = find_records(data, cfg.get("data_path"))
                except ValueError as e:
                    if pages == 1:
                        raise FetchError(str(e), status) from e
                    break
                if not records:
                    break
                fp = _fingerprint(records)
                if fp == last_fp:  # API ignores the page parameter
                    break
                last_fp = fp
                all_records.extend(records)
                page += 1
        elif ptype == "cursor":
            cursor_param = pagination.get("cursor_param") or "cursor"
            cursor_path = pagination.get("cursor_path")
            params: Optional[Dict[str, Any]] = base_params
            seen = set()
            while pages < max_pages:
                status, data = _request(client, cfg, url, params)
                pages += 1
                try:
                    records, path_used = find_records(data, cfg.get("data_path"))
                except ValueError as e:
                    if pages == 1:
                        raise FetchError(str(e), status) from e
                    break
                all_records.extend(records)
                if not records:
                    break
                cursor = None
                if isinstance(data, dict):
                    for p in ([cursor_path] if cursor_path else _CURSOR_PATHS):
                        val = get_path(data, p)
                        if val not in (None, "", False) and not isinstance(val, (dict, list)):
                            cursor = str(val)
                            break
                if not cursor or cursor in seen:
                    break
                seen.add(cursor)
                if cursor.startswith("http://") or cursor.startswith("https://"):
                    url, params = cursor, None  # "next" link already carries the query
                else:
                    params = {**base_params, cursor_param: cursor}
        else:
            status, data = _request(client, cfg, url, base_params)
            pages = 1
            try:
                all_records, path_used = find_records(data, cfg.get("data_path"))
            except ValueError as e:
                raise FetchError(str(e), status) from e

    return status, all_records, path_used, pages
