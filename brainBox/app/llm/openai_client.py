from typing import Optional
from app.config import settings
from app.utils.logging import logger

async def ask_openai(prompt: str) -> Optional[str]:
    if not settings.USE_OPENAI or not settings.OPENAI_API_KEY:
        logger.warning("OpenAI not configured")
        return None

    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        response = await client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error calling OpenAI: {str(e)}")
        return None

def ask_openai_sync(prompt: str) -> Optional[str]:
    if not settings.USE_OPENAI or not settings.OPENAI_API_KEY:
        logger.warning("OpenAI not configured")
        return None

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error calling OpenAI: {str(e)}")
        return None
