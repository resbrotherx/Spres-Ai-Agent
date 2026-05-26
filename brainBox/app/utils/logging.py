import logging
import sys
from app.config import settings

def setup_logging():
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('brainbox.log')
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logging()
