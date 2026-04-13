# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Story Narration TTS API (Stability Rescue)
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# 1. System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    espeak-ng \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# NOTE: We run as ROOT temporarily to bypass Windows Docker Permission Denied (os error 13)
# on model volumes. This ensures the first-time model download is 100% successful.

COPY . .

# Ensure model and audio paths exist with full permissions
RUN mkdir -p /app/weights /app/audio_cache && chmod -R 777 /app

EXPOSE 8001
ENV PORT=8001

# Probing the health endpoint with a very generous start period
HEALTHCHECK --interval=30s --timeout=15s --start-period=300s --retries=5 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "run_prod.py"]