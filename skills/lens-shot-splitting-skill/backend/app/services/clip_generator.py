from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Sequence

from app.core.scan_config import ClipConfig
from app.models.shot import ShotBoundary
from app.utils.commands import run_command


CommandRunner = Callable[[Sequence[str]], str]


class ClipGenerationError(RuntimeError):
    pass


class ClipGenerator:
    def __init__(self, output_dir: Path, config: ClipConfig, runner: CommandRunner = run_command):
        self.output_dir = output_dir.expanduser().resolve()
        self.config = config
        self.runner = runner

    def generate(self, video_path: Path, shot_index: int, boundary: ShotBoundary) -> tuple[str, int]:
        return self.generate_to(video_path, self.output_dir / "clips", f"shot_{shot_index:04d}.mp4", boundary)

    def generate_to(
        self,
        video_path: Path,
        output_dir: Path,
        filename: str,
        boundary: ShotBoundary,
    ) -> tuple[str, int]:
        if boundary.duration_ms <= 0:
            raise ClipGenerationError("Cannot generate a clip with zero duration")

        clip_dir = output_dir.expanduser().resolve()
        clip_dir.mkdir(parents=True, exist_ok=True)
        clip_path = clip_dir / filename
        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(video_path),
            "-ss",
            f"{boundary.start_ms / 1000:.3f}",
            "-t",
            f"{boundary.duration_ms / 1000:.3f}",
            "-map",
            "0:v:0",
        ]
        if self.config.keep_audio:
            command.extend(["-map", "0:a:0?"])
        else:
            command.append("-an")
        command.extend(
            [
                "-c:v",
                self.config.video_codec,
                "-preset",
                self.config.preset,
                "-crf",
                str(self.config.crf),
                "-pix_fmt",
                "yuv420p",
            ]
        )
        if self.config.keep_audio:
            command.extend(
                [
                    "-c:a",
                    self.config.audio_codec,
                    "-b:a",
                    self.config.audio_bitrate,
                ]
            )
        command.extend(["-movflags", "+faststart", "-avoid_negative_ts", "make_zero", str(clip_path)])
        self.runner(command)
        if not clip_path.exists():
            raise ClipGenerationError(f"FFmpeg did not create clip: {clip_path}")

        duration_payload = self.runner(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(clip_path),
            ]
        )
        try:
            duration_seconds = float(json.loads(duration_payload)["format"]["duration"])
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ClipGenerationError(f"Unable to read generated clip duration: {clip_path}") from exc
        return str(clip_path.relative_to(self.output_dir)), max(0, int(round(duration_seconds * 1000)))
