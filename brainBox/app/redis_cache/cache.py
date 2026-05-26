import redis
import json
from typing import Any, Optional
from app.config import settings

redis_client = redis.Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True
)

def get_cache(key: str) -> Optional[Any]:
    value = redis_client.get(key)
    if value:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return None

def set_cache(key: str, value: Any, ttl: int = 3600) -> None:
    if isinstance(value, (dict, list)):
        value = json.dumps(value)
    redis_client.setex(key, ttl, value)

def delete_cache(key: str) -> None:
    redis_client.delete(key)

def clear_tenant_cache(tenant_id: str) -> None:
    pattern = f"tenant:{tenant_id}:*"
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)

def cache_key(tenant_id: str, key_type: str, identifier: str) -> str:
    return f"tenant:{tenant_id}:{key_type}:{identifier}"
