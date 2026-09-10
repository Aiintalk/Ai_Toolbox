from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ShotBoundary:
    start_frame: int
    end_frame: int
    start_ms: int
    end_ms: int

    @property
    def duration_ms(self) -> int:
        return max(0, self.end_ms - self.start_ms)


@dataclass(frozen=True, slots=True)
class ShotRecord:
    video_id: str
    shot_id: str
    source_path: str
    shot_index: int
    start_frame: int
    end_frame: int
    start_ms: int
    end_ms: int
    duration_ms: int
    source_fps: float | None
    detector: str
    detector_config: dict[str, Any]
    thumbnails: dict[str, str]
    thumbnail_status: str = "completed"
    thumbnail_error: str | None = None
    clip_path: str | None = None
    clip_duration_ms: int | None = None
    clip_status: str = "not_requested"
    clip_error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "video_id": self.video_id,
            "shot_id": self.shot_id,
            "source_path": self.source_path,
            "shot_index": self.shot_index,
            "start_frame": self.start_frame,
            "end_frame": self.end_frame,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "duration_ms": self.duration_ms,
            "source_fps": self.source_fps,
            "detector": self.detector,
            "detector_config": self.detector_config,
            "thumbnails": self.thumbnails,
            "thumbnail_status": self.thumbnail_status,
            "thumbnail_error": self.thumbnail_error,
            "clip_path": self.clip_path,
            "clip_duration_ms": self.clip_duration_ms,
            "clip_status": self.clip_status,
            "clip_error": self.clip_error,
        }
