import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'SherpaModelCache';
const STORE_NAME = 'models';
const DB_VERSION = 1;

/**
 * ModelCache provides a persistent storage for large WASM/ONNX assets using IndexedDB.
 */
export class ModelCache {
  private db: Promise<IDBPDatabase>;

  constructor() {
    if (typeof window === 'undefined') {
      this.db = Promise.resolve(null as any);
      return;
    }
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  /**
   * Fetches a file from cache or network, providing progress updates.
   */
  async getFile(url: string, name: string, onProgress?: (pct: number) => void): Promise<string> {
    const database = await this.db;
    if (!database) {
      console.warn(`[ModelCache] DB not initialized. Returning original URL for ${name}`);
      return url;
    }
    const cached = await database.get(STORE_NAME, name);

    if (cached) {
      console.log(`[ModelCache] Cache hit for ${name}`);
      const blob = name.endsWith('.wasm') ? new Blob([cached], { type: 'application/wasm' }) : new Blob([cached]);
      return URL.createObjectURL(blob);
    }

    console.log(`[ModelCache] Cache miss for ${name}. Downloading...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);

    const contentLength = +(response.headers.get('Content-Length') || '0');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const chunks: Uint8Array[] = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;
      if (contentLength > 0 && onProgress) {
        onProgress(Math.round((receivedLength / contentLength) * 100));
      }
    }

    const allChunks = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    await database.put(STORE_NAME, allChunks, name);
    console.log(`[ModelCache] Cached ${name} (${receivedLength} bytes)`);
    const blob = name.endsWith('.wasm') ? new Blob([allChunks], { type: 'application/wasm' }) : new Blob([allChunks]);
    return URL.createObjectURL(blob);
  }

  /**
   * Returns the raw bytes of a cached file.
   */
  async getBytes(name: string): Promise<Uint8Array | null> {
    const database = await this.db;
    if (!database) return null;
    return await database.get(STORE_NAME, name);
  }
}

export const modelCache = new ModelCache();
