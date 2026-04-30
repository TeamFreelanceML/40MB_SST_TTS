import logging

from whisper_engine import WhisperEngine


logger = logging.getLogger("AIJudge.TranscriptionService")


class TranscriptionService:
    def __init__(self, engine: WhisperEngine):
        self.engine = engine

    def transcribe(self, audio_path: str, prompt: str = None) -> list[dict]:
        logger.info("[PHASE 1] Dispatching audio to transcription engine with prompt...")
        return self.engine.transcribe(audio_path, prompt=prompt)
