import whisper
import os
import time
import logging

logger = logging.getLogger("AIJudge.WhisperEngine")

# ---------------------------------------------------------------------------
# Whisper Engine Utility
# ---------------------------------------------------------------------------

class WhisperEngine:
    def __init__(self, model_name: str = "base"):
        """
        Initialize the Whisper model. 
        'base' is ideal for speed/accuracy balance on most CPUs.
        """
        logger.info(f"[*] Loading Whisper model: {model_name}...")
        self.model = whisper.load_model(model_name)

    def transcribe(self, audio_path: str, prompt: str = None):
        """
        Transcribe audio with granular word timestamps.
        Returns a list of word objects: {word, start, end}
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info(f"[*] Transcribing: {audio_path} (Prompt length: {len(prompt) if prompt else 0})")
        start_ts = time.time()

        result = self.model.transcribe(
            audio_path,
            word_timestamps=True,
            task="transcribe",
            language="en",
            fp16=False,
            verbose=False,
            initial_prompt=prompt
        )

        elapsed = time.time() - start_ts
        logger.info(f"[*] Transcription finished in {elapsed:.1f}s")

        words = []
        # [SURGICAL FIREWALL] Only block words that contain Russian/Cyrillic characters.
        # This is 100% safe for English and will only kill the "Ghost Russian" words.
        import re
        cyrillic_pattern = re.compile(r'[\u0400-\u04FF]')

        for segment in result.get("segments", []):
            for word_info in segment.get("words", []):
                clean_word = word_info["word"].strip()
                
                # Check if the word contains any Russian letters
                if cyrillic_pattern.search(clean_word):
                    logger.warning(f"[FIREWALL] Blocked Russian hallucination: {clean_word}")
                    continue

                words.append({
                    "word": clean_word,
                    "start": word_info["start"],
                    "end": word_info["end"],
                    "probability": word_info.get("probability", 1.0)
                })

        return words
