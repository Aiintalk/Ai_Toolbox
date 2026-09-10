from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class VideoMetadata:
    video_id: str
    source_path: str
    file_name: str
    relative_path: str
    file_size_bytes: int
    duration_ms: int
    width: int
    height: int
    source_fps: float | None
    codec_name: str | None
    has_audio: bool
    time_base: str | None
    start_time_ms: int | None
    avg_frame_rate: str | None
    r_frame_rate: str | None
    vfr_possible: bool
    file_fingerprint: str
    format_name: str | None
    file_mtime_ns: int

    def to_dict(self, processing_status: str = "completed", error_message: str | None = None) -> dict[str, Any]:
        return {
            "video_id": self.video_id,
            "source_path": self.source_path,
            "file_name": self.file_name,
            "relative_path": self.relative_path,
            "file_size_bytes": self.file_size_bytes,
            "duration_ms": self.duration_ms,
            "width": self.width,
            "height": self.height,
            "source_fps": self.source_fps,
            "codec_name": self.codec_name,
            "has_audio": self.has_audio,
            "time_base": self.time_base,
            "start_time_ms": self.start_time_ms,
            "avg_frame_rate": self.avg_frame_rate,
            "r_frame_rate": self.r_frame_rate,
            "vfr_possible": self.vfr_possible,
            "file_fingerprint": self.file_fingerprint,
            "format_name": self.format_name,
            "file_mtime_ns": self.file_mtime_ns,
            "processing_status": processing_status,
            "error_message": error_message,
        }
