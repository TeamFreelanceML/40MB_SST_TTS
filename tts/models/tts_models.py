from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────

class StoryMeta(BaseModel):
    id: int
    name: str = Field(max_length=200)


class VoiceConfig(BaseModel):
    voice_id: str = Field(max_length=64)
    language: str = Field(default="en-US", max_length=10)


class SpeechConfig(BaseModel):
    wpm: int = Field(default=140, ge=60, le=300)
    chunk_delimiter: str = Field(default="[...]", max_length=20)  # delimiter must be short


class ParagraphInput(BaseModel):
    para_id: int
    para_text: str = Field(max_length=5000)


class TextInput(BaseModel):
    story_text: List[ParagraphInput] = Field(min_length=1, max_length=50)


class OutputConfig(BaseModel):
    include_word_timestamps: bool = True
    include_chunk_timestamps: bool = True


class StoryNarrationRequest(BaseModel):
    story: StoryMeta
    voice: VoiceConfig
    speech_config: SpeechConfig
    text: TextInput
    output_config: OutputConfig = Field(default_factory=OutputConfig)


# ─────────────────────────────────────────────
# RESPONSE MODELS
# ─────────────────────────────────────────────

class WordAlignment(BaseModel):
    word_id: str
    text: str
    start_ms: int
    end_ms: int


class ChunkAlignment(BaseModel):
    chunk_id: str
    start_ms: int
    end_ms: int
    words: List[WordAlignment]


class ParagraphAlignment(BaseModel):
    para_id: int
    start_ms: int
    end_ms: int
    chunks: List[ChunkAlignment]


class AudioInfo(BaseModel):
    url: str
    duration_ms: int


class AlignmentResult(BaseModel):
    paragraphs: List[ParagraphAlignment]


class NarrationMetadata(BaseModel):
    wpm: int
    voice_id: str          # client voice_id e.g. "voice_1_bm_lewis"
    voice_name: str        # actual Kokoro voice name e.g. "bm_lewis"
    voice_number: int      # 1-based index in CLIENT_VOICE_CATALOGUE e.g. 1
    chunk_delimiter: str   # delimiter used to split chunks e.g. "[...]"
    total_chunks: int
    total_paragraphs: int


class StoryNarrationResponse(BaseModel):
    story: StoryMeta
    audio: AudioInfo
    alignment: AlignmentResult
    metadata: NarrationMetadata


# ─────────────────────────────────────────────
# WORD LEVEL MODELS (NEW)
# ─────────────────────────────────────────────

class WordMetadata(BaseModel):
    wpm: int
    voice_id: str
    language: str


class WordNarrationRequest(BaseModel):
    voice: VoiceConfig
    speech_config: SpeechConfig
    word: str = Field(max_length=100)


class WordNarrationResponse(BaseModel):
    audio: AudioInfo
    metadata: WordMetadata