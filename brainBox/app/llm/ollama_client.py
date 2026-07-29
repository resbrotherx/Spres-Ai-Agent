import httpx
from typing import Optional
from app.config import settings
from app.utils.logging import logger

OLLAMA_TIMEOUT = httpx.Timeout(180.0, connect=10.0)

async def ask_ollama(prompt: str, model: str = None) -> Optional[str]:
    if model is None:
        model = settings.OLLAMA_MODEL

    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "30m"
                }
            )
            response.raise_for_status()
            result = response.json()
            return result.get("response", "")
    except httpx.TimeoutException:
        logger.error(f"Ollama request timed out after {OLLAMA_TIMEOUT.read}s")
        return None
    except Exception as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        return None

def ask_ollama_sync(prompt: str, model: str = None) -> Optional[str]:
    if model is None:
        model = settings.OLLAMA_MODEL

    try:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "keep_alive": "30m"
            },
            timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        result = response.json()
        return result.get("response", "")
    except httpx.TimeoutException:
        logger.error(f"Ollama request timed out after {OLLAMA_TIMEOUT.read}s")
        return None
    except Exception as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        return None