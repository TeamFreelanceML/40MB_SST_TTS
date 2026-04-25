"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Story, Word, ReadingCursor } from "@/lib/types";
import { normalizeWord, getWordAtCursor, advanceCursor } from "@/lib/parseStory";
import { modelCache } from "@/lib/modelCache";

// ---------------------------------------------------------------------------
// Types for Sherpa-ONNX WASM
// ---------------------------------------------------------------------------

interface SherpaModule {
  onRuntimeInitialized?: () => void;
  locateFile?: (path: string, scriptDirectory: string) => string;
  setStatus?: (text: string) => void;
  [key: string]: any;
}

interface SherpaOnlineRecognizer {
  createStream: () => SherpaOnlineStream;
  isReady: (stream: SherpaOnlineStream) => boolean;
  decode: (stream: SherpaOnlineStream) => void;
  getResult: (stream: SherpaOnlineStream) => { text: string };
  delete?: () => void;
  free?: () => void;
}

interface SherpaOnlineStream {
  acceptWaveform: (sampleRate: number, samples: Float32Array) => void;
  inputFinished: () => void;
  delete?: () => void;
  free?: () => void;
}

// Global declaration for window object properties
declare global {
  interface Window {
    Module: SherpaModule;
    createOnlineRecognizer: (module: any, config: any) => SherpaOnlineRecognizer;
    [key: string]: any;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_RATE = 16000;
const WASM_BASE_PATH = "/sherpa-onnx";

function formatInitError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Utility: Levenshtein distance for fuzzy word matching
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

// ---------------------------------------------------------------------------
// Hook: useSherpa
// ---------------------------------------------------------------------------

export type SherpaStatus = "idle" | "loading" | "ready" | "listening" | "error";

export interface SherpaHookResult {
  status: SherpaStatus;
  statusMessage: string;
  downloadProgress: number; // Combined progress (0-100)
  start: (existingStream?: MediaStream) => Promise<void>;
  stop: () => void;
  recognizedText: string;
  cursor: ReadingCursor;
  correctCount: number;
  advanceManual: (status: "correct" | "skipped") => void;
}

/**
 * useSherpa — Neural STT engine using Sherpa-ONNX WebAssembly.
 * Handles Fast Refresh resiliency and real-time word highlighting.
 */
export function useSherpa(story: Story | null): SherpaHookResult {
  const [status, setStatus] = useState<SherpaStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [recognizedText, setRecognizedText] = useState("");
  const [cursor, setCursor] = useState<ReadingCursor>({
    paragraphIndex: 0,
    sentenceIndex: 0,
    chunkIndex: 0,
    wordIndex: 0,
  });
  const [correctCount, setCorrectCount] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Mutable Refs
  const recognizerRef = useRef<SherpaOnlineRecognizer | null>(null);
  const streamRef = useRef<SherpaOnlineStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const rawMediaStreamRef = useRef<MediaStream | null>(null);

  const cursorRef = useRef<ReadingCursor>(cursor);
  const storyRef = useRef<Story | null>(story);
  const correctCountRef = useRef<number>(0);
  const lastResultRef = useRef<string>("");
  const statusRef = useRef(status);
  const isMobileRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    // Global Standard: Use Lightweight Small Model (35MB) for maximum speed
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => { storyRef.current = story; }, [story]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // -------------------------------------------------------------------------
  // Load WASM Module (With Hot-Reload Guard)
  // -------------------------------------------------------------------------

  const loadWasmModule = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Cannot load WASM in SSR context"));
        return;
      }

      // [FIX] Hot-Reload Guard
      if (document.querySelector('script[src*="sherpa-onnx.js"]')) {
        console.log("[useSherpa] WASM Scripts already present. Skipping injection.");
        if (typeof window.createOnlineRecognizer === "function") {
          setStatus("ready");
        }
        resolve();
        return;
      }

      if (window.Module && typeof window.createOnlineRecognizer === "function") {
        setStatus("ready");
        resolve();
        return;
      }

      setStatus("loading");
      setStatusMessage("Loading Neural Engine...");

      const modelBasePath = "/sherpa-onnx-small";
      const assetMap: Record<string, string> = {};

      // [V4.4 FIX] Create a 1-byte mock blob to satisfy the .data dependency check
      const dummyDataBlob = new Blob([new Uint8Array(1)], { type: 'application/octet-stream' });
      assetMap["sherpa-onnx-wasm-main-asr.data"] = URL.createObjectURL(dummyDataBlob);

      const assets = [
        { key: "tokens", file: "tokens.txt", cacheKey: "tokens.v5.txt" },
        { key: "encoder", file: "encoder.onnx", cacheKey: "encoder.v5.onnx" },
        { key: "decoder", file: "decoder.onnx", cacheKey: "decoder.v5.onnx" },
        { key: "joiner", file: "joiner.onnx", cacheKey: "joiner.v5.onnx" },
        // Runtime scripts stay in the main folder for stability
        { key: "api", file: "sherpa-onnx.js", path: "/sherpa-onnx", cacheKey: "api.v5.js" },
        { key: "glue", file: "sherpa-onnx-wasm-main-asr.js", path: "/sherpa-onnx", cacheKey: "glue.v5.js" },
        { key: "wasm", file: "sherpa-onnx-wasm-main-asr.wasm", path: "/sherpa-onnx", cacheKey: "wasm.v5.wasm" }
      ];

      (async () => {
        try {
          let loadedCount = 0;
          for (const asset of assets) {
            const base = asset.path || modelBasePath;
            const blobUrl = await modelCache.getFile(
              `${base}/${asset.file}`,
              asset.cacheKey,
              (pct) => {
                const totalProgress = Math.round((loadedCount * 100 + pct) / assets.length);
                setDownloadProgress(totalProgress);
              }
            );
            assetMap[asset.file] = blobUrl;
            loadedCount++;
            setDownloadProgress(Math.round((loadedCount * 100) / assets.length));
          }

          const win = window as any;
          const moduleConfig: SherpaModule = {
            noInitialRun: true, // [V4.1 FIX] Prevent searching for missing .data file
            locateFile: (path: string) => {
              if (assetMap[path]) return assetMap[path];
              if (path.endsWith(".data")) return assetMap["sherpa-onnx-wasm-main-asr.data"];
              if (path.endsWith(".wasm") && assetMap["sherpa-onnx-wasm-main-asr.wasm"]) return assetMap["sherpa-onnx-wasm-main-asr.wasm"];
              return `/sherpa-onnx/${path}`;
            },
            setStatus: (text: string) => {
              if (!text) setStatusMessage("Neural Engine active");
              else setStatusMessage(text);
            },
            monitorRunDependencies: (left: number) => {
              // Ignore dependencies like the .data file
              if (left === 0) console.log("[useSherpa] Engine dependencies resolved.");
            },
            onRuntimeInitialized: function run() {
              console.log("[useSherpa] WASM Runtime Initialized (Small Engine)");
              try {
                (async () => {
                  const [encoderBytes, decoderBytes, joinerBytes, tokensBytes] = await Promise.all([
                    modelCache.getBytes("encoder.v5.onnx"),
                    modelCache.getBytes("decoder.v5.onnx"),
                    modelCache.getBytes("joiner.v5.onnx"),
                    modelCache.getBytes("tokens.v5.txt")
                  ]);

                  // [V4.5 FIX] Hardened FS Detection
                  const fs = win.Module.FS || win.FS || (window as any).FS;
                  if (!fs) {
                    console.error("[useSherpa] CRITICAL: Emscripten FS not found. Retrying in 100ms...");
                    setTimeout(() => run(), 100);
                    return;
                  }

                  if (encoderBytes) fs.writeFile("encoder.onnx", encoderBytes);
                  if (decoderBytes) fs.writeFile("decoder.onnx", decoderBytes);
                  if (joinerBytes) fs.writeFile("joiner.onnx", joinerBytes);
                  if (tokensBytes) fs.writeFile("tokens.txt", tokensBytes);

                  const config = {
                    featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 },
                    modelConfig: {
                      transducer: {
                        encoder: "./encoder.onnx",
                        decoder: "./decoder.onnx",
                        joiner: "./joiner.onnx",
                      },
                      tokens: "./tokens.txt",
                      modelType: "zipformer",
                    },
                    endpointConfig: {
                      rule1: { keepMaxFrames: 240, minUtteranceLength: 0.0, minSilenceTokenCount: 12 },
                      rule2: { keepMaxFrames: 120, minUtteranceLength: 0.0, minSilenceTokenCount: 8 },
                      rule3: { keepMaxFrames: 20, minUtteranceLength: 0.0, minSilenceTokenCount: 4 }
                    }
                  };

                  const recognizer = window.createOnlineRecognizer(window.Module, config);
                  recognizerRef.current = recognizer;
                  setStatus("ready");
                  setStatusMessage("Ready — Click Start to begin reading");
                  resolve();
                })();
              } catch (err) {
                setStatus("error");
                setStatusMessage(`ASR Initializer Failed: ${formatInitError(err)}`);
                reject(err);
              }
            }
          };

          window.Module = moduleConfig;

          // Injected pre-cached scripts
          const apiScript = document.createElement("script");
          apiScript.src = assetMap["sherpa-onnx.js"];
          apiScript.onload = () => {
            const glueScript = document.createElement("script");
            glueScript.src = assetMap["sherpa-onnx-wasm-main-asr.js"];
            glueScript.onerror = () => {
              setStatus("error");
              setStatusMessage("Failed to load binary glue");
              reject(new Error("Glue fetch failure"));
            };
            document.head.appendChild(glueScript);
          };
          document.head.appendChild(apiScript);

        } catch (err) {
          setStatus("error");
          setStatusMessage(`Failed to cache models: ${formatInitError(err)}`);
          reject(err);
        }
      })();
    });
  }, []);

  useEffect(() => {
    if (!hasInitialized && typeof window !== "undefined") {
      setHasInitialized(true);
      loadWasmModule().catch(() => { });
    }
  }, [hasInitialized, loadWasmModule]);

  // -------------------------------------------------------------------------
  // Match results
  // -------------------------------------------------------------------------

  const tokenQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || tokenQueueRef.current.length === 0) return;
    isProcessingQueueRef.current = true;

    while (tokenQueueRef.current.length > 0) {
        const token = tokenQueueRef.current.shift();
        if (!token) break;

        const curStory = storyRef.current;
        if (!curStory) break;

        let activeCursor = { ...cursorRef.current };
        if (activeCursor.wordIndex === -1) break;

        const targetWord = getWordAtCursor(curStory, activeCursor);
        if (!targetWord) break;

        const normalizedTarget = normalizeWord(targetWord.text).toLowerCase();
        
        // --- BALANCED TOLERANCE LOGIC ---
        // Allow 1 mistake for all words >= 2 letters. 
        // This is the "Sweet Spot" for high-accuracy reading coaches.
        const distance = levenshteinDistance(token, normalizedTarget);
        const isExact = token === normalizedTarget;
        const isFuzzy = normalizedTarget.length >= 2 && distance <= 1;

        if (isExact || isFuzzy) {
            targetWord.status = "correct";
            correctCountRef.current++;
            setCorrectCount(correctCountRef.current);

            const next = advanceCursor(curStory, activeCursor);
            if (next) {
                const nextWord = getWordAtCursor(curStory, next);
                if (nextWord) {
                    nextWord.status = "active";
                    activeCursor = next; 
                }
            } else {
                activeCursor = { paragraphIndex: -1, sentenceIndex: -1, chunkIndex: -1, wordIndex: -1 };
                setStatus("ready");
            }
            
            setCursor(activeCursor);
            cursorRef.current = activeCursor;
            await new Promise(r => setTimeout(r, 60));
        } else {
            // [V5.8 BALANCED LOOKAHEAD]
            let lookaheadCursor: ReadingCursor | null = { ...activeCursor };
            let foundMatch = false;

            for (let j = 0; j < 3; j++) {
                const nextCandidate = advanceCursor(curStory, lookaheadCursor as ReadingCursor);
                if (!nextCandidate) break;
                lookaheadCursor = nextCandidate;

                const aheadWord = getWordAtCursor(curStory, lookaheadCursor);
                if (!aheadWord) break;

                const normAhead = normalizeWord(aheadWord.text).toLowerCase();
                const distAhead = levenshteinDistance(token, normAhead);
                
                // Use the same Balanced Tolerance for lookahead
                if (token === normAhead || (normAhead.length >= 2 && distAhead <= 1)) {
                    // Match found! Marks all intermediate words as skipped.
                    let skipSweep: ReadingCursor | null = { ...activeCursor };
                    while (skipSweep && (skipSweep.wordIndex !== lookaheadCursor.wordIndex || skipSweep.sentenceIndex !== lookaheadCursor.sentenceIndex)) {
                        const skipWord = getWordAtCursor(curStory, skipSweep);
                        if (skipWord) skipWord.status = "skipped";
                        const nextSweep: ReadingCursor | null = advanceCursor(curStory, skipSweep);
                        if (!nextSweep) break;
                        skipSweep = nextSweep;
                    }

                    aheadWord.status = "correct";
                    correctCountRef.current++;
                    setCorrectCount(correctCountRef.current);

                    const finalNext = advanceCursor(curStory, lookaheadCursor);
                    if (finalNext) {
                        const finalNextWord = getWordAtCursor(curStory, finalNext);
                        if (finalNextWord) {
                            finalNextWord.status = "active";
                            activeCursor = finalNext; 
                        }
                    } else {
                      activeCursor = { paragraphIndex: -1, sentenceIndex: -1, chunkIndex: -1, wordIndex: -1 };
                      setStatus("ready");
                    }
                    
                    setCursor(activeCursor);
                    cursorRef.current = activeCursor;
                    await new Promise(r => setTimeout(r, 60));
                    foundMatch = true;
                    break;
                }
            }
            if (foundMatch) continue;
        }
    }
    isProcessingQueueRef.current = false;
  }, [setCursor, setCorrectCount]);

  const lastMatchedIndexRef = useRef(-1);

  const processResult = useCallback((text: string) => {
    if (statusRef.current !== "listening") return;
    
    const allTokens = text.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (allTokens.length === 0) {
        lastMatchedIndexRef.current = -1;
        return;
    }

    // FRONTIER-SEARCH: We only look at words that appear AFTER our last successful match
    // in the current speech result. This is immune to the "Say it Twice" correction bug.
    const searchFrom = lastMatchedIndexRef.current + 1;
    
    // We only look at the "Leading Edge" (the last 3 words) to prevent random chatter 
    // from matching words we haven't read yet.
    const frontier = allTokens.slice(Math.max(searchFrom, allTokens.length - 3));

    if (frontier.length > 0) {
        // Find the FIRST word in the frontier that hasn't been queued
        // To be safe, we just push the frontier words into the queue
        // and let the sequencer handle them one by one.
        tokenQueueRef.current.push(...frontier);
        
        // Update the marker so we don't process these specific words again
        lastMatchedIndexRef.current = allTokens.length - 1;
        processQueue();
    }
  }, [processQueue]);

  // Reset the count when the student stops or starts
  useEffect(() => {
    if (status === "ready") {
        lastMatchedIndexRef.current = -1;
        tokenQueueRef.current = [];
    }
  }, [status]);

  // -------------------------------------------------------------------------
  // Progressive Reset
  // -------------------------------------------------------------------------

  const resetStoryProgress = useCallback(() => {
    const curStory = storyRef.current;
    if (!curStory) return;

    for (const paragraph of curStory.paragraphs) {
      for (const sentence of paragraph.sentences) {
        for (const chunk of sentence.chunks) {
          for (const word of chunk.words) {
            word.status = "pending";
          }
        }
      }
    }

    const startCursor = {
      paragraphIndex: 0,
      sentenceIndex: 0,
      chunkIndex: 0,
      wordIndex: 0,
    };

    const firstWord = getWordAtCursor(curStory, startCursor);
    if (firstWord) firstWord.status = "active";

    setCursor(startCursor);
    cursorRef.current = startCursor;
    correctCountRef.current = 0;
    setCorrectCount(0);
  }, []);

  const advanceManual = useCallback((newStatus: "correct" | "skipped") => {
    const curStory = storyRef.current;
    if (!curStory) return;

    const targetWord = getWordAtCursor(curStory, cursorRef.current);
    if (!targetWord) return;

    targetWord.status = newStatus;
    if (newStatus === "correct") {
      correctCountRef.current++;
      setCorrectCount(correctCountRef.current);
    }

    const next = advanceCursor(curStory, cursorRef.current);
    if (next) {
      const nextWord = getWordAtCursor(curStory, next);
      if (nextWord) nextWord.status = "active";
      setCursor(next);
      cursorRef.current = next;
    } else {
      setCursor({ paragraphIndex: -1, sentenceIndex: -1, chunkIndex: -1, wordIndex: -1 });
      setStatus("ready");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Recording controls
  // -------------------------------------------------------------------------

  const start = useCallback(async (existingStream?: MediaStream) => {
    if (!storyRef.current) return;
    if (!recognizerRef.current) return;

    resetStoryProgress();

    try {
      /** [PRODUCTION BUGFIX] SHARED STREAM PROTECTION
       * If an existing stream is provided (from the recorder), we share it.
       * This prevents hardware allocation errors when requesting the mic twice.
       */
      if (existingStream) {
        console.log("[useSherpa] Sharing existing microphone stream...");
        rawMediaStreamRef.current = existingStream;
      } else {
        console.log("[useSherpa] Requesting new microphone access...");
        rawMediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: SAMPLE_RATE, echoCancellation: true }
        });
      }

      // Initialize Audio processing at 16kHz for Sherpa
      const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(rawMediaStreamRef.current);
      const processor = audioCtx.createScriptProcessor(1024, 1, 1);

      source.connect(processor);
      processor.connect(audioCtx.destination);

      const stream = recognizerRef.current.createStream();
      streamRef.current = stream;

      processor.onaudioprocess = (e) => {
        if (statusRef.current !== "listening" || !recognizerRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);

        // [V5.1 CRITICAL FIX] Use the ACTUAL Context Sample Rate
        // Some browsers ignore the 16000 request and use 48000. 
        // We must tell the engine exactly what rate the buffer is currently at.
        const actualSampleRate = audioCtx.sampleRate;
        stream.acceptWaveform(actualSampleRate, inputData);

        while (recognizerRef.current.isReady(stream)) {
          recognizerRef.current.decode(stream);
        }

        const result = recognizerRef.current?.getResult(stream);
        if (result?.text && result.text !== lastResultRef.current) {
          lastResultRef.current = result.text;
          setRecognizedText(result.text);
          processResult(result.text);
        }
      };

      processorRef.current = processor;
      setStatus("listening");
      setStatusMessage("Listening — Please read aloud");
    } catch (err) {
      setStatus("error");
      setStatusMessage(`Microphone Fail: ${(err as Error).message}`);
    }
  }, [resetStoryProgress, processResult]);

  const stop = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
    }
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => { });

    // Only stop tracks if WE created the stream (not if shared)
    // Actually in this app UI, we stop everything at once.
    if (rawMediaStreamRef.current) {
      rawMediaStreamRef.current.getTracks().forEach(t => t.stop());
    }

    if (streamRef.current) {
      const stream = streamRef.current;
      if (stream.free) stream.free();
      else if (stream.delete) (stream as any).delete();
      streamRef.current = null;
    }

    processorRef.current = null;
    audioCtxRef.current = null;
    rawMediaStreamRef.current = null;
    lastResultRef.current = "";
    setStatus("ready");
    setStatusMessage("Session Ended");
    setRecognizedText("");
  }, []);

  return { status, statusMessage, downloadProgress, start, stop, recognizedText, cursor, correctCount, advanceManual };
}
