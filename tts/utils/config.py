import os
from pathlib import Path
from typing import List

class Settings:
    # Project Root
    BASE_DIR: Path = Path(__file__).parent.parent

    # API Security
    API_KEY: str = os.getenv("TTS_API_KEY", "")
    ALLOWED_ORIGINS: List[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")

    # Redis / Celery
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Models
    KOKORO_MODEL_PATH: Path  = BASE_DIR / "engines" / "kokoro-v1.0.onnx"
    KOKORO_VOICES_PATH: Path = BASE_DIR / "engines" / "voices-v1.0.bin"

    # Storage
    AUDIO_CACHE_DIR: Path = BASE_DIR / "audio_cache"

    # TTS Engine Constants
    # TTS Engine Timing (Strict Fluency Rules)
    INTER_CHUNK_MS: int = 450
    COMMA_PAUSE_MS: int = 500
    DOT_PAUSE_MS:   int = 1000
    PARA_PAUSE_MS:  int = 2000
    
    INTER_PARA_MS: int = PARA_PAUSE_MS
    MIN_WORD_DURATION_MS: int = 80
    FRAME_MS: int = 20  # Kokoro 24kHz frame size

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    JSON_LOGS: bool = os.getenv("JSON_LOGS", "true").lower() == "true"

settings = Settings()

# Ensure directories exist
settings.AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
