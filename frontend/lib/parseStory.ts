// =============================================================================
// parseStory.ts — Punctuation-Based Story Chunker
// =============================================================================
// Slices raw story text into the strict hierarchy:
//   Story → Paragraph → Sentence → Chunk → Word
//
// Chunking rules:
//   - Paragraphs: split by blank lines
//   - Sentences:  split by sentence-ending punctuation (. ! ? ; :)
//   - Chunks:     split by natural pauses (commas, dashes, quotes, conjunctions)
//   - Words:      split by whitespace
// =============================================================================

import type { Story, Paragraph, Sentence, Chunk, Word } from "./types";

/**
 * Normalize a word for STT matching.
 * Strips all non-alphanumeric characters and lowercases.
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9']/g, "")
    .trim();
}

/**
 * Split a sentence string into chunk strings based on natural punctuation.
 * Delimiters: commas, em-dashes, en-dashes, semicolons within sentence,
 * and coordinating conjunctions (and, but, or, so, yet) when preceded by a comma.
 */
/**
 * Split a paragraph into chunks using the exact same logic as the TTS engine.
 * Delimiters: [c], [p], [...], punctuation (ignoring abbreviations).
 */
function splitByUnifiedDelimiter(text: string): string[] {
  // JavaScript Lookbehind support for abbreviations
  const pattern = /(\[c\]|\[p\]|\[\.\.\.\]|(?<!\bMr|Mrs|Dr|Ms|Prof|St|vs)\.|,)/gi;
  
  const parts = text.split(pattern);
  const chunks: string[] = [];
  let currentChunk = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;

    if (pattern.test(part)) {
      // It's a delimiter
      if (part === "." || part === ",") {
        currentChunk += part;
        chunks.push(currentChunk.trim());
        currentChunk = "";
      } else {
        // [c], [p], or [...]
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        currentChunk = "";
      }
    } else {
      // It's content
      currentChunk += part;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.trim().length > 0);
}

function groupChunksIntoSentences(rawChunks: string[]): Array<{ text: string; chunks: string[] }> {
  const grouped: Array<{ text: string; chunks: string[] }> = [];
  let currentChunks: string[] = [];

  for (const rawChunk of rawChunks) {
    currentChunks.push(rawChunk);
    if (/[.!?]["')\]]*$/.test(rawChunk)) {
      grouped.push({
        text: currentChunks.join(" ").trim(),
        chunks: [...currentChunks],
      });
      currentChunks = [];
    }
  }

  if (currentChunks.length > 0) {
    grouped.push({
      text: currentChunks.join(" ").trim(),
      chunks: [...currentChunks],
    });
  }

  return grouped;
}

/**
 * Parse a raw text block into the full Story hierarchy.
 *
 * @param text  - Raw story text (paragraphs separated by blank lines)
 * @param title - Display title for the story
 * @returns     - Fully structured Story object
 */
export function parseStory(text: string, title: string = "Story"): Story {
  let totalWords = 0;
  let totalChunks = 0;

  // Split into paragraphs by blank lines OR explicit [p] markers
  const rawParagraphs = text
    .split(/\n\s*\n|\[p\]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const paragraphs: Paragraph[] = rawParagraphs.map(
    (rawParagraph, pIdx): Paragraph => {
      // Use the unified logic to get chunks
      const explicitChunks = splitByUnifiedDelimiter(rawParagraph);

      // Group those chunks into sentences based on punctuation (.!?)
      const sentenceInputs = groupChunksIntoSentences(explicitChunks);

      const sentences: Sentence[] = sentenceInputs.map(
        (sentenceInput, sIdx): Sentence => {
          const rawChunks = sentenceInput.chunks;

          const chunks: Chunk[] = rawChunks.map(
            (rawChunk, cIdx): Chunk => {
              const rawWords = rawChunk.split(/\s+/).filter((w) => w.length > 0);

              const words: Word[] = rawWords.map(
                (rawWord, wIdx): Word => {
                  totalWords++;
                  return {
                    id: `p${pIdx}-s${sIdx}-c${cIdx}-w${wIdx}`,
                    text: normalizeWord(rawWord),
                    display: rawWord,
                    status: "pending",
                    paragraphIndex: pIdx,
                    sentenceIndex: sIdx,
                    chunkIndex: cIdx,
                    wordIndex: wIdx,
                  };
                }
              );

              totalChunks++;
              return {
                id: `p${pIdx}-s${sIdx}-c${cIdx}`,
                words,
                status: "pending",
              };
            }
          );

          return {
            id: `p${pIdx}-s${sIdx}`,
            chunks,
            text: sentenceInput.text,
          };
        }
      );

      return {
        id: `p${pIdx}`,
        sentences,
      };
    }
  );

  return {
    title,
    paragraphs,
    totalWords,
    totalChunks,
  };
}

/**
 * Get a flat array of all words in the story, in reading order.
 * Useful for cursor arithmetic and progress tracking.
 */
export function flattenWords(story: Story): Word[] {
  const words: Word[] = [];
  for (const paragraph of story.paragraphs) {
    for (const sentence of paragraph.sentences) {
      for (const chunk of sentence.chunks) {
        for (const word of chunk.words) {
          words.push(word);
        }
      }
    }
  }
  return words;
}

/**
 * Get the word at a specific cursor position.
 * Returns undefined if the cursor is out of bounds (story complete).
 */
export function getWordAtCursor(
  story: Story,
  cursor: { paragraphIndex: number; sentenceIndex: number; chunkIndex: number; wordIndex: number }
): Word | undefined {
  const paragraph = story.paragraphs[cursor.paragraphIndex];
  if (!paragraph) return undefined;

  const sentence = paragraph.sentences[cursor.sentenceIndex];
  if (!sentence) return undefined;

  const chunk = sentence.chunks[cursor.chunkIndex];
  if (!chunk) return undefined;

  return chunk.words[cursor.wordIndex];
}

/**
 * Advance the cursor to the next word position.
 * Handles chunk, sentence, and paragraph boundaries.
 * Returns null if story is complete.
 */
export function advanceCursor(
  story: Story,
  cursor: { paragraphIndex: number; sentenceIndex: number; chunkIndex: number; wordIndex: number }
): { paragraphIndex: number; sentenceIndex: number; chunkIndex: number; wordIndex: number } | null {
  const p = story.paragraphs[cursor.paragraphIndex];
  if (!p) return null;

  const s = p.sentences[cursor.sentenceIndex];
  if (!s) return null;

  const c = s.chunks[cursor.chunkIndex];
  if (!c) return null;

  // Try next word in current chunk
  if (cursor.wordIndex + 1 < c.words.length) {
    return { ...cursor, wordIndex: cursor.wordIndex + 1 };
  }

  // Try next chunk in current sentence
  if (cursor.chunkIndex + 1 < s.chunks.length) {
    return { ...cursor, chunkIndex: cursor.chunkIndex + 1, wordIndex: 0 };
  }

  // Try next sentence in current paragraph
  if (cursor.sentenceIndex + 1 < p.sentences.length) {
    return {
      ...cursor,
      sentenceIndex: cursor.sentenceIndex + 1,
      chunkIndex: 0,
      wordIndex: 0,
    };
  }

  // Try next paragraph
  if (cursor.paragraphIndex + 1 < story.paragraphs.length) {
    return {
      paragraphIndex: cursor.paragraphIndex + 1,
      sentenceIndex: 0,
      chunkIndex: 0,
      wordIndex: 0,
    };
  }

  // Story complete
  return null;
}
