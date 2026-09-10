from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Sequence

from app.models.video import VideoMetadata
from app.utils.commands import run_command
from app.utils.paths import file_fingerprint


CommandRunner = Callable[[Sequence[str]], str]


class MetadataExtractionError(RuntimeError):
    pass


def parse_frame_rate(value: str | None) -> float | None:
    if not value or value in {"0/0", "N/A"}:
        return None
    try:
        if "/" in value:
            numerator, denominator = value.split("/", maxsplit=1)
            denominator_value = float(denominator)
            if denominator_value == 0:
                return None
            return float(numerator) / denominator_value
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_float(value: object) -> float | None:
    if value in (None, "", "N/A"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class FFprobeMetadataExtractor:
    def __init__(self, runner: CommandRunner = run_command):
        self.runner = runner

    def extract(self, video_path: Path, relative_path: str, video_id: str) -> VideoMetadata:
        video_path = video_path.expanduser().resolve()
        payload_text = self.runner(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_format",
                "-show_streams",
                "-print_format",
                "json",
                str(video_path),
            ]
        )
        try:
            payload = json.loads(payload_text)
        except json.JSONDecodeError as exc:
            raise MetadataExtractionError(f"ffprobe returned invalid JSON for {video_path}") from exc

        format_info = payload.get("format", {})
        video_stream = next(
            (stream for stream in payload.get("streams", []) if stream.get("codec_type") == "video"),
            None,
        )
        if video_stream is None:
            raise MetadataExtractionError(f"No video stream found: {video_path}")

        duration_seconds = _parse_float(format_info.get("duration"))
        if duration_seconds is None:
            duration_seconds = _parse_float(video_stream.get("duration"))
        if duration_seconds is None:
            raise MetadataExtractionError(f"Video duration is unavailable: {video_path}")

        width = int(video_stream.get("width") or 0)
        height = int(video_stream.get("height") or 0)
        if width <= 0 or height <= 0:
            raise MetadataExtractionError(f"Video resolution is unavailable: {video_path}")

        stat = video_path.stat()
        avg_frame_rate = video_stream.get("avg_frame_rate")
        r_frame_rate = video_stream.get("r_frame_rate")
        avg_fps = parse_frame_rate(avg_frame_rate)
        r_fps = parse_frame_rate(r_frame_rate)
        vfr_possible = bool(
            avg_fps is not None
            and r_fps is not None
            and abs(avg_fps - r_fps) > max(0.001, r_fps * 0.001)
        )
        start_time_seconds = _parse_float(video_stream.get("start_time"))
        if start_time_seconds is None:
            start_time_seconds = _parse_float(format_info.get("start_time"))
        return VideoMetadata(
            video_id=video_id,
            source_path=str(video_path),
            file_name=video_path.name,
            relative_path=relative_path,
            file_size_bytes=stat.st_size,
            duration_ms=max(0, int(round(duration_seconds * 1000))),
            width=width,
            height=height,
            source_fps=avg_fps or r_fps,
            codec_name=video_stream.get("codec_name"),
            has_audio=any(stream.get("codec_type") == "audio" for stream in payload.get("streams", [])),
            time_base=video_stream.get("time_base"),
            start_time_ms=(None if start_time_seconds is None else int(round(start_time_seconds * 1000))),
            avg_frame_rate=avg_frame_rate,
            r_frame_rate=r_frame_rate,
            vfr_possible=vfr_possible,
            file_fingerprint=file_fingerprint(relative_path, stat.st_size, stat.st_mtime_ns),
            format_name=format_info.get("format_name"),
            file_mtime_ns=stat.st_mtime_ns,
        )
