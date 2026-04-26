// =============================================================================
// download-model.mjs - Sherpa runtime downloader
// =============================================================================
// Standardized on Single-Model (35MB Small Engine) for maximum performance.
// [V4.9 FINAL FIX] Chrome Identity Masking to bypass Hugging Face 401 security.
// =============================================================================

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_MODEL_DIR = path.resolve(__dirname, "..", "public", "sherpa-onnx");
const SMALL_MODEL_DIR = path.resolve(__dirname, "..", "public", "sherpa-onnx-small");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadFile(url, dest, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = (currentUrl) => {
          const req = https.get(currentUrl, {
            timeout: 30000, // 30 second timeout
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Referer': 'https://huggingface.co/'
            }
          }, (response) => {
            if ([301, 302, 307, 308].includes(response.statusCode)) {
              const location = response.headers.location;
              if (location) { request(new URL(location, currentUrl).href); return; }
            }
            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode} for ${currentUrl}`));
              return;
            }

            const contentLength = parseInt(response.headers["content-length"] || "0", 10);
            let downloaded = 0;

            response.on("data", (chunk) => {
              downloaded += chunk.length;
              if (contentLength > 0) {
                const pct = ((downloaded / contentLength) * 100).toFixed(1);
                process.stdout.write(`\rDownloading ${path.basename(dest)}: ${pct}%`);
              }
            });

            response.pipe(file);
            file.on("finish", () => {
              file.close();
              process.stdout.write("\n");
              resolve();
            });
          });

          req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timed out (30s)"));
          });

          req.on("error", (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        };
        request(url);
      });
      return;
    } catch (error) {
      console.error(`\n[RETRY ${i + 1}/${retries}] Failed to download ${path.basename(dest)}: ${error.message}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

(async () => {
  console.log("============================================================");
  console.log("Applying Master-v4.9 Production Lock");
  console.log("Active: Chrome Identity Masking to prevent HF 401 Blocks");
  console.log("============================================================");

  ensureDir(BASE_MODEL_DIR);
  ensureDir(SMALL_MODEL_DIR);

  const models = [
    // 35MB Neural Models (Streaming Zipformer-20M)
    { 
      name: "Encoder", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17/resolve/main/encoder-epoch-99-avg-1.int8.onnx", 
      dest: path.join(SMALL_MODEL_DIR, "encoder.onnx") 
    },
    { 
      name: "Decoder", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17/resolve/main/decoder-epoch-99-avg-1.int8.onnx", 
      dest: path.join(SMALL_MODEL_DIR, "decoder.onnx") 
    },
    { 
      name: "Joiner", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17/resolve/main/joiner-epoch-99-avg-1.int8.onnx", 
      dest: path.join(SMALL_MODEL_DIR, "joiner.onnx") 
    },
    { 
      name: "Tokens", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17/resolve/main/tokens.txt", 
      dest: path.join(SMALL_MODEL_DIR, "tokens.txt") 
    },

    // [V4.9 FIX] Synchronized Runtime Assets using original HF Space endpoints (No LinkErrors!)
    { 
      name: "Runtime WASM", 
      url: "https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en/resolve/main/sherpa-onnx-wasm-main-asr.wasm", 
      dest: path.join(BASE_MODEL_DIR, "sherpa-onnx-wasm-main-asr.wasm") 
    },
    { 
      name: "Runtime Glue JS", 
      url: "https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en/resolve/main/sherpa-onnx-wasm-main-asr.js", 
      dest: path.join(BASE_MODEL_DIR, "sherpa-onnx-wasm-main-asr.js") 
    },
    { 
      name: "Runtime API JS", 
      url: "https://huggingface.co/spaces/k2-fsa/web-assembly-asr-sherpa-onnx-en/resolve/main/sherpa-onnx-asr.js", 
      dest: path.join(BASE_MODEL_DIR, "sherpa-onnx.js") 
    }
  ];

  for (const model of models) {
    if (fs.existsSync(model.dest) && fs.statSync(model.dest).size > 0) {
      console.log(`- Skipping ${model.name} (Already exists)`);
      continue;
    }
    console.log(`- Fetching ${model.name}...`);
    try {
      await downloadFile(model.url, model.dest);
    } catch (err) {
      console.error(`\n[CRITICAL] Failed to download ${model.name}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\n============================================================");
  console.log("Success: HF Neural Trio downloaded using Chrome Masking.");
  console.log("============================================================");
})();
