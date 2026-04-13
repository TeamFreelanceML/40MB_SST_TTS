# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — Story Narration TTS API
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# 1. Create Non-Root Service Account 
RUN groupadd -r appgroup && useradd -r -s /bin/false -g appgroup appuser

# 2. System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    espeak-ng \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 3. Dependencies
# We use timeouts to ensure the build never hangs during pip resolution.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# NOTE: We no longer bake the Kokoro weights at build-time.
# This ensures the image is small (<200MB) and build is fast.
# Weights will download on first run (run_prod.py handles this).

COPY . .

# Set permissions for the non-root user
RUN mkdir -p /app/weights /app/audio_cache && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8001

ENV PORT=8001

# Probing the health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "run_prod.py"]