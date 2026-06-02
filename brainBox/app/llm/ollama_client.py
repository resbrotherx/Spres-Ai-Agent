import httpx
from typing import Optional
from app.config import settings
from app.utils.logging import logger

async def ask_ollama(prompt: str, model: str = None) -> Optional[str]:
    if model is None:
        model = settings.OLLAMA_MODEL

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                }
            )
            response.raise_for_status()
            result = response.json()
            return result.get("response", "")
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
                "stream": False
            },
            timeout=60.0
        )
        response.raise_for_status()
        result = response.json()
        return result.get("response", "")
    except Exception as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        return None
