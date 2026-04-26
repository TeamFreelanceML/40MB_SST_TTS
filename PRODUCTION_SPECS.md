# ReadAloud Production Specification & Roadmap
## Technical Documentation for Production Deployment

This document outlines the professional technical architecture, model specifications, and feature roadmap for the ReadAloud platform.

---

### 1. System Architecture
The project is built on a **Micro-service Architecture** managed by Docker.

- **Frontend**: Next.js 16 (Turbopack) with Sherpa-ONNX WebAssembly integration.
- **Backend API**: FastAPI (Python 3.11) for high-concurrency evaluation.
- **TTS Service**: Piper/Coqui Neural TTS engine for human-like reading help.
- **Data Layer**: Redis 7 (Alpine) for ultra-low latency audio caching and session management.

---

### 2. AI Model Specifications

#### A. Frontend "Real-Time Ear"
- **Model**: Sherpa-ONNX Zipformer (Small)
- **Size**: ~35 MB
- **Format**: ONNX (INT8 Quantized)
- **Processing**: Client-side WASM (runs in browser memory).
- **Benefit**: Zero-latency word tracking and extreme privacy.

#### B. Backend "Surgical Audit"
- **Model**: OpenAI Whisper
- **Size**: ~140 MB (Base) / ~460 MB (Small)
- **Deployment**: Server-side Docker container.
- **Benefit**: Provides the "Gold Standard" for the final accuracy report.

#### C. Neural Voice Helper
- **Engine**: Piper / Coqui
- **Voice Quality**: High-fidelity neural voice (Lewis/English).
- **Latency**: <200ms using Redis caching.

---

### 3. Core Feature Mechanics

#### Balanced Tolerance Matching (Logic v7.0)
To ensure the app is encouraging for students, the matching algorithm uses a weighted Levenshtein distance:
- **Small Words (<6 chars)**: 1 error allowed.
- **Large Words (≥6 chars)**: 2 errors allowed.
- **The Result**: The system recognizes the *intent* of the reader, ignoring minor speech slips or background noise.

#### The "Lookahead" Cursor
The system intelligently tracks the student's progress. If a student jumps ahead by a few words, the cursor follows them instantly, ensuring the "Active" highlight is always in the right place.

#### Audio Pre-processing
Both the STT and the Backend use High-Pass filters to strip out background "hum" (AC noise, traffic) before the AI hears the voice, drastically increasing accuracy in noisy classrooms.

---

### 4. Technical Workflow (End-to-End)

1. **Ignition**: Browser downloads the ~35MB model once and stores it in the local `indexedDB` cache.
2. **Streaming**: Student's voice is streamed at 16kHz to the WASM worker.
3. **Live Sync**: The worker sends "Word Matched" signals to the UI, updating CSS classes from `pending` to `correct` (Green) or `skipped` (Red).
4. **Helper Intervention**: If 6 seconds of silence is detected, the system triggers a TTS call and advances the word via the `advanceManual` hook.
5. **Evaluation**: On session end, the backend performs a final transcript-to-story alignment to generate the accuracy metrics.

---

### 5. Deployment & Reliability
The system is designed for **One-Click Deployment**:
- **Environment**: Docker & Docker Compose.
- **Health Checks**: Every service (Backend, Redis, TTS) has automated health checks to ensure 99.9% uptime.
- **Resource Management**: Node.js memory limits are optimized for student-grade hardware.

---

### 6. Future Roadmap
- **Q2 2026**: Implementation of Teacher Dashboard (Multi-student monitoring).
- **Q3 2026**: Integration of "Phoneme Awareness" (Detecting exactly which sound a student struggled with).
- **Q4 2026**: Mobile PWA (Progressive Web App) for tablets and low-spec smartphones.
