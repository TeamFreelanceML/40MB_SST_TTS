# ReadAloud: Technical Whitepaper & System Architecture
## Version 1.1 — Production Environment

This document provides a exhaustive deep-dive into the technical architecture, data flow, and specialized algorithms powering the ReadAloud platform.

---

### 1. High-Level Service Architecture (Docker Stack)

The platform is orchestrated as a cluster of 5 specialized containers:

| Service Name | Technology | Port | Purpose |
| :--- | :--- | :--- | :--- |
| **`readaloud-frontend`** | Next.js 16 / React | `3000` | UI, WASM Speech Engine, State Management |
| **`readaloud-backend`** | FastAPI / Python | `8000` | Post-session Evaluation, Result Persistence |
| **`readaloud-tts-api`** | Python / Piper | `8001` | Neural Voice Generation (Helper Service) |
| **`readaloud-tts-admin`** | Next.js | `8002` | Admin panel for managing voice profiles |
| **`readaloud-redis`** | Redis 7 | `6379` | High-speed cache for audio and session state |

---

### 2. The Speech Processing Pipeline

#### A. Client-Side (Real-Time)
1. **Audio Capture**: Uses `Web Audio API`. We lock the sample rate to **16,000Hz** to match the Neural Engine requirements.
2. **High-Pass Filter**: A BiquadFilter is applied at **200Hz** to remove low-frequency background noise (AC units, traffic) before the AI processes the signal.
3. **WASM Threading**: The **Sherpa-ONNX** engine runs in a separate Web Worker. This ensures that even if the student is interacting with the UI, the speech recognition remains uninterrupted.
4. **Tokenization**: The story text is broken into "Phonetic Tokens." We normalize these by removing punctuation and converting to lowercase to ensure high match rates.

#### B. Server-Side (Evaluation)
1. **Whisper ASR**: When a session ends, the raw audio (WAV) is uploaded.
2. **Surgical Alignment**: We use a custom alignment algorithm to map the Whisper transcript back to the original story text. This allows us to detect exactly where a student skipped a word or added an extra word.

---

### 3. Logic & Algorithms

#### I. Balanced Tolerance (The "Forgiving Ear")
We utilize a weighted **Levenshtein Distance** algorithm. Unlike standard STT which is binary (correct/incorrect), our system calculates the "Edit Distance" between the heard word and the target word.
- **Tolerance Formula**: `max(1, floor(word_length / 3))`
- **Benefit**: This mathematical approach allows for minor speech errors while still maintaining the integrity of the reading assessment.

#### II. Frontier-Search Tracking
To prevent the "Say it Twice" bug (where repeating a word causes the cursor to jump), we use **Frontier-Search**. The system only looks for matches in a "Lookahead Window" of 3 words relative to the last successfully read word.

#### III. Hot-Reload Resiliency
The system includes "Hot-Reload Guards" in the frontend. If a student refreshes the page or the connection flickers, the WASM runtime detects the existing models in the browser's **IndexedDB** and restores the session in milliseconds without a full re-download.

---

### 4. API Interface Specifications

#### Post-Session Evaluation (`POST /api/evaluation`)
- **Input**: `Multipart/Form-Data` containing a `.wav` file and the `story_id`.
- **Process**: Server-side Whisper analysis + Alignment logic.
- **Output**: JSON object containing `accuracy_rate`, `wpm`, and a `word_audit_log` (an array showing the status of every single word in the story).

#### Neural Help Service (`POST /api/tts/narrate`)
- **Input**: `{"word": "string", "voice_id": "string"}`
- **Process**: Piper engine generates the audio $\rightarrow$ cached in Redis $\rightarrow$ returned as a Stream.
- **Performance**: Sub-200ms response time ensures the "Helper" doesn't break the student's concentration.

---

### 5. Deployment & Scalability

#### Environment Variables
The system is fully configurable via `.env` files:
- `STT_MODEL_NAME`: Toggle between `base`, `small`, and `medium` models.
- `API_BASE_URL`: Defines the bridge between the internal Docker network and the public web.

#### Infrastructure Security
- **Data Minimization**: Voice data is processed locally whenever possible.
- **Stateless Backend**: The server doesn't store permanent user sessions, making it easy to scale horizontally by adding more backend containers behind a load balancer.

---

### 6. Maintenance & Monitoring
- **Health Checks**: Every service includes a `/health` endpoint monitored by Docker.
- **Log Management**: Unified logs are accessible via `docker-compose logs -f`.
- **Evaluation Accuracy**: Teachers can review the "Audit Log" to verify if the AI's grading matches their human observation, allowing for continuous refinement of the "Strictness" settings.
