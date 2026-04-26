# ReadAloud: AI-Powered Neural Reading Coach
## Complete Product & System Guide

This document provides a comprehensive overview of the **ReadAloud** platform, explaining how the technology works from the moment a student clicks "Start" to the final evaluation report.

---

### 1. Product Mission
ReadAloud is designed to solve the "Fluency Gap." By providing a real-time AI "ear" that listens to students as they read, the system provides the immediate feedback required to build confidence and accuracy without needing a 1-on-1 human tutor for every session.

---

### 2. Key Features

#### A. Real-Time Neural STT (Speech-to-Text)
The system uses **Sherpa-ONNX WebAssembly**. 
- **What it is**: An advanced "Neural Ear" that runs entirely inside the user's web browser.
- **Client Benefit**: It is incredibly fast (zero latency) and works even if the internet connection is unstable, as the "brain" is downloaded locally when the page opens.

#### B. The Dual-Highlighting Feedback System
The interface is intentionally simple to keep students focused:
- **Green Underline (Success)**: Confirms the student spoke the word correctly.
- **Red Stripe (Missed/Skipped)**: Clearly marks words that were missed or skipped, allowing the student to see exactly where they lost their place.

#### C. Intelligent Reading Helper (Auto-Tutor)
A 6-second "Stuck Timer" monitors the student's progress. 
- If a student pauses for more than 6 seconds on a word, the system's **Neural Voice** (TTS) will speak the word for them and automatically move the highlight to the next word. 
- This prevents frustration and keeps the "flow" of reading alive.

#### D. Deep Evaluation Engine
Once the reading is finished, a secondary, high-accuracy AI (OpenAI Whisper) analyzes the full recording.
- It calculates **Accuracy Rate**, **Words Per Minute (WPM)**, and provides a word-by-word audit log for teachers to review.

---

### 3. End-to-End System Flow

#### Phase 1: The Initialization (Frontend)
When the student lands on the page, the system pre-caches the AI models (approx. 35MB). 
- **Tech used**: Next.js (Frontend framework) + Sherpa-ONNX (AI Engine).
- **Result**: The app is ready to listen instantly once the student clicks "Start."

#### Phase 2: The Live Session
1. **Audio Capture**: The student's microphone captures audio at 16,000Hz (optimized for voice).
2. **Neural Processing**: The browser-based AI compares the spoken audio against the "Target Text" of the story.
3. **Visual Update**: The UI updates the word colors instantly.
4. **Resiliency**: We use "Reduced Strictness" logic, meaning the AI is smart enough to ignore background noise and handle different accents gracefully.

#### Phase 3: The Helper Service (TTS)
If the student needs help, the system makes a quick call to the **TTS Service**.
- **Tech used**: A dedicated Python service using Neural Voices.
- **Result**: A high-quality, human-sounding voice models the word for the student.

#### Phase 4: Final Processing (Backend)
When the student clicks "Stop," the entire audio recording is uploaded to the **FastAPI Backend**.
- The server performs a final "Surgical Audit" of the audio to ensure the scoring is 100% accurate before saving it to the database.

#### Phase 5: The Results Dashboard
The student and teacher can immediately view a "Scorecard" showing:
- A visual map of the story (Greens and Reds).
- Fluency metrics (WPM and Total Correct).
- Progress over time.

---

### 4. Infrastructure & Deployment (Docker)
The entire system is "Dockerized," which means it is packaged into isolated containers.
- **Container 1 (Frontend)**: The user interface and browser-AI.
- **Container 2 (Backend)**: The evaluation and file management system.
- **Container 3 (TTS API)**: The neural voice generation engine.
- **Container 4 (Redis)**: A high-speed "memory" to make the voice responses near-instant.

**Why this matters**: This "Containerized" approach ensures that the app will run exactly the same way on any server, whether it's a small local machine or a large cloud provider.

---

### 5. Technical Summary for Clients
- **Language**: TypeScript (Frontend), Python (Backend).
- **AI Models**: Sherpa-ONNX (Real-time), Whisper (Audit), Piper/Coqui (Voice).
- **Safety**: No voice data is permanently stored without encryption, and real-time processing happens on the student's own device.
