"""OpenAI-compatible chat client (OpenAI, Groq, Together, … via OPENAI_BASE_URL)."""
import time
from typing import Iterator, Optional

from app.config import settings
from app.utils.logging import logger


def openai_enabled() -> bool:
    return bool(settings.OPENAI_API_KEY) and (settings.LLM_PROVIDER == "openai" or settings.USE_OPENAI)


def _client_kwargs() -> dict:
    kwargs = {"api_key": settings.OPENAI_API_KEY, "timeout": settings.LLM_TIMEOUT}
    if settings.OPENAI_BASE_URL:
        kwargs["base_url"] = settings.OPENAI_BASE_URL
    return kwargs


def _request(prompt: str) -> dict:
    return {
        "model": settings.OPENAI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": settings.OLLAMA_NUM_PREDICT,
    }


async def ask_openai(prompt: str) -> Optional[str]:
    if not openai_enabled():
        return None
    try:
        from openai import AsyncOpenAI

        started = time.time()
        response = await AsyncOpenAI(**_client_kwargs()).chat.completions.create(**_request(prompt))
        logger.info(f"{settings.OPENAI_MODEL} answered in {time.time() - started:.1f}s")
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error calling OpenAI-compatible API: {str(e)}")
        return None


def ask_openai_sync(prompt: str) -> Optional[str]:
    if not openai_enabled():
        return None
    try:
        from openai import OpenAI

        started = time.time()
        response = OpenAI(**_client_kwargs()).chat.completions.create(**_request(prompt))
        logger.info(f"{settings.OPENAI_MODEL} answered in {time.time() - started:.1f}s")
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error calling OpenAI-compatible API: {str(e)}")
        return None


def stream_openai_sync(prompt: str) -> Iterator[str]:
    """Yield answer text deltas (``stream=True``). Raises on failure; yields nothing when the
    OpenAI-compatible provider isn't enabled."""
    if not openai_enabled():
        return
    from openai import OpenAI

    started = time.time()
    stream = OpenAI(**_client_kwargs()).chat.completions.create(**_request(prompt), stream=True)
    try:
        for chunk in stream:
            if not chunk.choices:
                continue
            piece = chunk.choices[0].delta.content
            if piece:
                yield piece
        logger.info(f"{settings.OPENAI_MODEL} streamed its answer in {time.time() - started:.1f}s")
    finally:
        close = getattr(stream, "close", None)
        if close is not None:
            close()
