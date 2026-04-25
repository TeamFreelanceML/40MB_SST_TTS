// =============================================================================
// download-model.mjs - Sherpa runtime downloader
// =============================================================================
// Standardized on Single-Model (35MB Small Engine) for maximum performance.
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

function fileExistsWithContent(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
  } catch { return false; }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (currentUrl) => {
      https.get(currentUrl, (response) => {
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
  console.log("Initializing Single-Model Download (35MB Small Engine)");
  console.log("============================================================");

  ensureDir(BASE_MODEL_DIR);
  ensureDir(SMALL_MODEL_DIR);

  const models = [
    { name: "Encoder", url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/encoder.int8.onnx", dest: path.join(SMALL_MODEL_DIR, "encoder.onnx") },
    { name: "Decoder", url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/decoder.int8.onnx", dest: path.join(SMALL_MODEL_DIR, "decoder.onnx") },
    { name: "Joiner", url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/joiner.int8.onnx", dest: path.join(SMALL_MODEL_DIR, "joiner.onnx") },
    { name: "Tokens", url: "https://huggingface.co/csukuangfj/sherpa-onnx-zipformer-small-en-2023-06-26/resolve/main/tokens.txt", dest: path.join(SMALL_MODEL_DIR, "tokens.txt") },
    { name: "Runtime WASM", url: "https://huggingface.co/csukuangfj/sherpa-onnx-wasm-main-asr/resolve/main/sherpa-onnx-wasm-main-asr.wasm", dest: path.join(BASE_MODEL_DIR, "sherpa-onnx-wasm-main-asr.wasm") },
    { name: "Runtime JS (API)", url: "https://huggingface.co/csukuangfj/sherpa-onnx-wasm-main-asr/resolve/main/sherpa-onnx.js", dest: path.join(BASE_MODEL_DIR, "sherpa-onnx.js") },
    { name: "Runtime JS (Glue)", url: "https://huggingface.co/csukuangfj/sherpa-onnx-wasm-main-asr/resolve/main/sherpa-onnx-wasm-main-asr.js", dest: path.join(BASE_MODEL_DIR, "sherpa-onnx-wasm-main-asr.js") }
  ];

  for (const model of models) {
    if (fileExistsWithContent(model.dest)) {
        console.log(`- ${model.name} exists, skipping.`);
        continue;
    }
    console.log(`- Fetching ${model.name}...`);
    await downloadFile(model.url, model.dest);
  }

  console.log("\nDeployment Success: All lightweight assets ready.");
})();
