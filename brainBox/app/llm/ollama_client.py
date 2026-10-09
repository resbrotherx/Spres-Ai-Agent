import time
from typing import Optional

import httpx

from app.config import settings
from app.utils.logging import logger

OLLAMA_TIMEOUT = httpx.Timeout(settings.LLM_TIMEOUT, connect=10.0)


def _keep_alive():
    value = str(settings.OLLAMA_KEEP_ALIVE).strip()
    try:
        return int(value)  # -1 / 0 / seconds
    except ValueError:
        return value  # e.g. "30m"


def _payload(prompt: str, model: str) -> dict:
    # The options must stay identical between requests: a different num_ctx makes Ollama
    # reload the model, which costs several seconds on a CPU-only server.
    options = {
        "num_ctx": settings.OLLAMA_NUM_CTX,
        "num_predict": settings.OLLAMA_NUM_PREDICT,
        "temperature": settings.LLM_TEMPERATURE,
    }
    if settings.OLLAMA_NUM_THREAD > 0:
        options["num_thread"] = settings.OLLAMA_NUM_THREAD
    return {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "keep_alive": _keep_alive(),
        "options": options,
    }


def _log_timing(result: dict, started: float) -> None:
    try:
        prompt_tokens = result.get("prompt_eval_count", 0)
        gen_tokens = result.get("eval_count", 0)
        load_s = result.get("load_duration", 0) / 1e9
        logger.info(
            f"Ollama answered in {time.time() - started:.1f}s "
            f"(load {load_s:.1f}s, prompt {prompt_tokens} tok, answer {gen_tokens} tok)"
        )
    except Exception:
        pass


async def ask_ollama(prompt: str, model: str = None) -> Optional[str]:
    model = model or settings.OLLAMA_MODEL
    started = time.time()
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=_payload(prompt, model))
            response.raise_for_status()
            result = response.json()
            _log_timing(result, started)
            return result.get("response", "")
    except httpx.TimeoutException:
        logger.error(f"Ollama request timed out after {OLLAMA_TIMEOUT.read}s")
        return None
    except Exception as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        return None


def ask_ollama_sync(prompt: str, model: str = None) -> Optional[str]:
    model = model or settings.OLLAMA_MODEL
    started = time.time()
    try:
        response = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate", json=_payload(prompt, model), timeout=OLLAMA_TIMEOUT
        )
        response.raise_for_status()
        result = response.json()
        _log_timing(result, started)
        return result.get("response", "")
    except httpx.TimeoutException:
        logger.error(f"Ollama request timed out after {OLLAMA_TIMEOUT.read}s")
        return None
    except Exception as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        return None


def warm_up_ollama() -> None:
    """Load the model into memory at startup so the first real question isn't slow.

    Uses the same options as real requests (so Ollama doesn't reload later). Runs in a
    background thread; failures are only logged.
    """
    if settings.LLM_PROVIDER != "ollama" or not settings.OLLAMA_WARMUP:
        return
    logger.info(f"Warming up Ollama model {settings.OLLAMA_MODEL}…")
    if ask_ollama_sync("Reply with OK.") is not None:
        logger.info("Ollama model is loaded and ready")
