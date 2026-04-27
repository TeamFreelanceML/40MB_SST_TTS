import logging
import os
import subprocess
import tempfile


logger = logging.getLogger("AIJudge.AudioPreprocess")


def trim_trailing_silence(audio_path: str) -> str:
    trimmed_path = tempfile.NamedTemporaryFile(delete=False, suffix=".webm").name
    actual_trimmed_path = trimmed_path # Default fallback

    # V4.0 STUDIO-GRADE Filter Chain:
    # 1. anlmdn: Arnold Non-Local Means Denoiser (Superior for music/complex noise)
    # 2. highpass/lowpass: Bandpass filter strictly for human voice range (300Hz - 8kHz)
    # 3. agate: Aggressive gate to kill music in gaps
    # 4. compand: Normalizes voice to professional levels
    # 5. areverse -> silenceremove -> areverse: Trims trailing silence
    ffmpeg_cmd = [
        "ffmpeg",
        "-y",
        "-i",
        audio_path,
        "-af",
        (
            "anlmdn=s=7:p=0.002:r=0.002,highpass=f=300,lowpass=f=8000,"
            "agate=threshold=-24dB:ratio=5:attack=2:release=100,"
            "compand=attacks=0:points=-80/-80|-24/-12|0/-6|20/-6,"
            "areverse,silenceremove=start_periods=1:start_silence=0.5:start_threshold=-40dB,areverse"
        ),
        "-c:a",
        "pcm_s16le", # Using WAV format for better internal processing
        "-ar",
        "16000",
        trimmed_path.replace(".webm", ".wav"),
    ]
    # Update path to WAV for the return
    actual_trimmed_path = trimmed_path.replace(".webm", ".wav")

    try:
        logger.info("[PHASE 0.5] Trimming trailing silence before transcription...")
        completed = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            check=False,
        )

        if completed.returncode != 0:
            logger.warning("[PHASE 0.5] Studio-Grade cleanup failed. Falling back to original audio.")
            logger.warning(completed.stderr.strip())
            if os.path.exists(actual_trimmed_path):
                os.remove(actual_trimmed_path)
            return audio_path

        if not os.path.exists(actual_trimmed_path) or os.path.getsize(actual_trimmed_path) == 0:
            logger.warning("[PHASE 0.5] Cleaned file invalid. Falling back to original audio.")
            if os.path.exists(actual_trimmed_path):
                os.remove(actual_trimmed_path)
            return audio_path

        logger.info("[PHASE 0.5] Audio cleaned and trailing silence trimmed successfully.")
        return actual_trimmed_path
    except Exception as exc:
        logger.warning(f"[PHASE 0.5] Audio cleanup errored: {exc}. Falling back to original audio.")
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
            logger.info("[*] This is likely a temporary Windows file lock from FFmpeg/Whisper. Data flow will continue.")
