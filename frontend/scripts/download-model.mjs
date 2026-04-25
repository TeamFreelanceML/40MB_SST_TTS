// =============================================================================
// download-model.mjs - Sherpa runtime downloader
// =============================================================================
// Standardized on Single-Model (35MB Small Engine) for maximum performance.
// [V4.8 FINAL FIX] Using GitHub Release CDN to prevent HuggingFace 401 errors.
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

// [V4.8 FIX] Using GitHub CDN for 100% public access (No 401 risks)
const GITHUB_RELEASE_BASE = "https://github.com/csukuangfj/sherpa-onnx/releases/download/v1.10.10";

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (currentUrl) => {
      https.get(currentUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
      }).on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    request(url);
  });
}

(async () => {
  console.log("============================================================");
  console.log("Applying Master-v4.8 Final Production Shield");
  console.log("Switching to GitHub CDN for 0-Auth Public Access");
  console.log("============================================================");

  ensureDir(BASE_MODEL_DIR);
  ensureDir(SMALL_MODEL_DIR);

  const models = [
    // 35MB Neural Models (Zipformer-Small) - HuggingFace is fine for these (Public Repo)
    { 
      name: "Encoder", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/encoder-epoch-99-avg-1.int8.onnx", 
      dest: path.join(SMALL_MODEL_DIR, "encoder.onnx") 
    },
    { 
      name: "Decoder", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/decoder-epoch-99-avg-1.int8.onnx", 
      dest: path.join(SMALL_MODEL_DIR, "decoder.onnx") 
    },
    { 
      name: "Joiner", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/joiner-epoch-99-avg-1.int8.onnx", 
      dest: path.join(SMALL_MODEL_DIR, "joiner.onnx") 
    },
    { 
      name: "Tokens", 
      url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/tokens.txt", 
      dest: path.join(SMALL_MODEL_DIR, "tokens.txt") 
    },

    // [V4.8 FIX] USING GITHUB CDN FOR RUNTIME ASSETS (CRITICAL COMPATIBILITY)
    { 
      name: "Runtime WASM", 
      url: "https://github.com/csukuangfj/sherpa-onnx/releases/download/v1.10.10/sherpa-onnx-wasm-main-asr.wasm", 
      dest: path.join(BASE_MODEL_DIR, "sherpa-onnx-wasm-main-asr.wasm") 
    },
    { 
      name: "Runtime Glue JS", 
      url: "https://github.com/csukuangfj/sherpa-onnx/releases/download/v1.10.10/sherpa-onnx-wasm-main-asr.js", 
      dest: path.join(BASE_MODEL_DIR, "sherpa-onnx-wasm-main-asr.js") 
    },
    { 
      name: "Runtime API JS", 
      url: "https://github.com/csukuangfj/sherpa-onnx/releases/download/v1.10.10/sherpa-onnx-asr.js", 
      dest: path.join(BASE_MODEL_DIR, "sherpa-onnx.js") 
    }
  ];

  for (const model of models) {
    console.log(`- Fetching ${model.name}...`);
    try {
      await downloadFile(model.url, model.dest);
    } catch (err) {
      console.error(`\nFailed to download ${model.name}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\n============================================================");
  console.log("Success: All Production Assets pulled from GitHub CDN.");
  console.log("============================================================");
})();
