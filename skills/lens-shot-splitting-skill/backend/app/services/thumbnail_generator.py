from __future__ import annotations

from pathlib import Path
from typing import Callable, Sequence

from app.core.scan_config import ThumbnailConfig
from app.models.shot import ShotBoundary
from app.utils.commands import run_command


CommandRunner = Callable[[Sequence[str]], str]


class ThumbnailGenerator:
    def __init__(self, output_dir: Path, config: ThumbnailConfig, runner: CommandRunner = run_command):
        self.output_dir = output_dir.expanduser().resolve()
        self.config = config
        self.runner = runner

    def positions_ms(self, boundary: ShotBoundary) -> dict[str, int]:
        duration_ms = boundary.duration_ms
        if duration_ms <= 0:
            return {"start": boundary.start_ms, "middle": boundary.start_ms, "end": boundary.start_ms}

        safe_offset = min(self.config.safe_offset_ms, max(1, duration_ms // 5))
        middle_ms = boundary.start_ms + duration_ms // 2
        start_ms = min(boundary.start_ms + safe_offset, middle_ms)
        end_ms = max(boundary.end_ms - safe_offset, middle_ms)
        return {"start": start_ms, "middle": middle_ms, "end": end_ms}

    def generate(
        self,
        video_path: Path,
        shot_index: int,
        boundary: ShotBoundary,
    ) -> dict[str, str]:
        thumbnail_dir = self.output_dir / "thumbnails"
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        paths: dict[str, str] = {}
        for label, timestamp_ms in self.positions_ms(boundary).items():
            thumbnail_path = thumbnail_dir / f"shot_{shot_index:04d}_{label}.jpg"
            self.runner(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(video_path),
                    "-ss",
                    f"{timestamp_ms / 1000:.3f}",
                    "-frames:v",
                    "1",
                    "-vf",
                    f"scale={self.config.width}:-2",
                    "-q:v",
                    str(self.config.quality),
                    str(thumbnail_path),
                ]
            )
            if not thumbnail_path.exists():
                raise RuntimeError(f"FFmpeg did not create thumbnail: {thumbnail_path}")
            paths[label] = str(thumbnail_path.relative_to(self.output_dir))
        return paths
