# --- BUILD CACHE BREAKER: 2026-04-25-v5 ---
FROM node:20-alpine

WORKDIR /app

ARG NEXT_PUBLIC_EVALUATION_API_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_TTS_WORD_API_URL=http://localhost:8001/narrate/word

ENV NEXT_PUBLIC_EVALUATION_API_BASE_URL=$NEXT_PUBLIC_EVALUATION_API_BASE_URL
ENV NEXT_PUBLIC_TTS_WORD_API_URL=$NEXT_PUBLIC_TTS_WORD_API_URL

COPY package.json package-lock.json ./
RUN npm ci

# Explicitly copy the core App Router directory to ensure nothing is skipped by standard globbing
COPY app ./app
COPY . .

# Verification: Ensure high-capacity Bridge and Results page were successfully copied
RUN test -d app/api/evaluation/evaluate && test -d app/results || (echo "CRITICAL: app directory sync failed" && exit 1)

# [V5.4 STABILITY] Try to download if missing, but skip if files are already in context
RUN if [ ! -s public/sherpa-onnx-small/tokens.txt ]; then npm run download-model; fi \
    && test -s public/sherpa-onnx/sherpa-onnx-wasm-main-asr.wasm \
    && test -s public/sherpa-onnx-small/encoder.onnx \
    && test -s public/sherpa-onnx-small/tokens.txt

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
