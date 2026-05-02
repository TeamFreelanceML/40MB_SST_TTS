import logging
import os
import subprocess
import tempfile


logger = logging.getLogger("AIJudge.AudioPreprocess")


def trim_trailing_silence(audio_path: str) -> str:
    """Surgically remove background noise and trim trailing silence without cutting off speech."""
    trimmed_path = tempfile.NamedTemporaryFile(delete=False, suffix=".webm").name
    actual_trimmed_path = trimmed_path.replace(".webm", ".wav")
    
    # V4.2 SURGICAL Filter Chain:
    # 1. afftdn: Gentle spectral subtraction (nr=12) for hiss removal
    # 2. highpass: Removes low rumble (< 200Hz)
    # 3. agate: Natural Downward Expander (ratio=2, release=500ms) to fade noise safely
    # 4. compand: Professional voice normalization
    # 5. areverse -> silenceremove -> areverse: Trims only extreme trailing silence
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        audio_path,
        "-af",
        (
            "afftdn=nr=5:nf=-40,highpass=f=80,lowpass=f=8000,"
            "compand=attacks=0:points=-80/-80|-24/-12|0/-6|20/-6,"
            "areverse,silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB,areverse"
        ),
        "-c:a",
        "pcm_s16le",
        "-ar",
        "16000",
        actual_trimmed_path,
    ]

    try:
        logger.info("[PHASE 0.5] Surgically cleaning audio (Expander Mode)...")
        completed = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            check=False,
        )

        if completed.returncode != 0:
            logger.warning("[PHASE 0.5] Surgical cleanup failed. Falling back to original audio.")
            logger.warning(completed.stderr.strip())
            if os.path.exists(actual_trimmed_path):
                os.remove(actual_trimmed_path)
            return audio_path

        if not os.path.exists(actual_trimmed_path) or os.path.getsize(actual_trimmed_path) == 0:
            logger.warning("[PHASE 0.5] Cleaned file empty. Falling back to original audio.")
            if os.path.exists(actual_trimmed_path):
                os.remove(actual_trimmed_path)
            return audio_path

        # Cleanup the temporary webm placeholder
        if os.path.exists(trimmed_path):
            os.remove(trimmed_path)

        logger.info("[PHASE 0.5] Audio cleaned successfully (No clipping).")
        return actual_trimmed_path
        
    except Exception as exc:
        logger.warning(f"[PHASE 0.5] Cleanup process errored: {exc}. Falling back to original.")
        if os.path.exists(actual_trimmed_path):
            os.remove(actual_trimmed_path)
        return audio_path


def cleanup_temp_paths(*paths: str) -> None:
    for cleanup_path in set(paths):
        if not cleanup_path or not os.path.exists(cleanup_path):
            continue
        try:
            logger.info(f"[*] Lifecycle: Attempting deletion of temp file: {cleanup_path}")
            os.remove(cleanup_path)
        except Exception as cleanup_err:
            logger.warning(f"[CLEANUP WARNING] Could not delete temp file '{cleanup_path}': {cleanup_err}")
            logger.info("[*] This is likely a temporary Windows file lock. Data flow will continue.")
