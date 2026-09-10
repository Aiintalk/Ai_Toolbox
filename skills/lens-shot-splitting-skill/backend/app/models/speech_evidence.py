from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class SpeechEvidence:
    candidate_segment_id: str
    has_audio: bool
    transcript: str = ""
    speech_start_ms: int | None = None
    speech_end_ms: int | None = None
    confidence: float = 0.0
    error_message: str | None = None

    @property
    def speech_detected(self) -> bool:
        return bool(self.transcript.strip()) and self.has_audio

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_segment_id": self.candidate_segment_id,
            "has_audio": self.has_audio,
            "speech_detected": self.speech_detected,
            "transcript": self.transcript,
            "speech_start_ms": self.speech_start_ms,
            "speech_end_ms": self.speech_end_ms,
            "confidence": self.confidence,
            "error_message": self.error_message,
        }
