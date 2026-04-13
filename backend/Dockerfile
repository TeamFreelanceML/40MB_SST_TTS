FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# 1. System Dependencies
# - ffmpeg/libsndfile1: Mandatory for Whisper audio stream processing
# - curl: For health probes
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# 2. Atomic Dependency Installation
# Integrating pip commands with high timeouts.
# Using CPU-only Torch for maximum compatibility and lightweight image.
RUN pip install --no-cache-dir --upgrade "pip<25" setuptools wheel packaging && \
    pip install --no-cache-dir --default-timeout=100 torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir --default-timeout=100 --no-deps openai-whisper==20231117 && \
    pip install --no-cache-dir --default-timeout=100 -r requirements.txt

# NOTE: We no longer "bake" the model here to prevent build-time disk exhaustion.
# The model will download on first run and persist in a Docker Volume.

COPY . .

EXPOSE 8000

# Healthcheck probing the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "main.py"]
