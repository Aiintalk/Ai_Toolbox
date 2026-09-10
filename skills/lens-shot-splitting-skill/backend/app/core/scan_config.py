from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True, slots=True)
class DetectionConfig:
    detector: str
    threshold: float
    min_scene_len: int | float | str
    min_content_val: float
    window_width: int
    weights: tuple[float, float, float, float]
    frame_skip: int
    downscale: int | None
    auto_downscale: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "detector": self.detector,
            "threshold": self.threshold,
            "min_scene_len": self.min_scene_len,
            "min_content_val": self.min_content_val,
            "window_width": self.window_width,
            "weights": {
                "delta_hue": self.weights[0],
                "delta_sat": self.weights[1],
                "delta_lum": self.weights[2],
                "delta_edges": self.weights[3],
            },
            "frame_skip": self.frame_skip,
            "downscale": self.downscale,
            "auto_downscale": self.auto_downscale,
        }


@dataclass(frozen=True, slots=True)
class ThumbnailConfig:
    safe_offset_ms: int
    width: int
    quality: int


@dataclass(frozen=True, slots=True)
class ClipConfig:
    video_codec: str
    audio_codec: str
    preset: str
    crf: int
    audio_bitrate: str
    keep_audio: bool


@dataclass(frozen=True, slots=True)
class ScanConfig:
    detection: DetectionConfig
    thumbnail: ThumbnailConfig
    clip: ClipConfig


def _required(mapping: dict[str, Any], key: str, section: str = "root") -> Any:
    if key not in mapping:
        raise ValueError(f"Missing required config key: {section}.{key}")
    return mapping[key]


def load_scan_config(path: Path) -> ScanConfig:
    path = path.expanduser().resolve()
    if not path.exists():
        raise FileNotFoundError(f"Config file does not exist: {path}")

    with path.open("r", encoding="utf-8") as config_file:
        raw = yaml.safe_load(config_file) or {}

    if not isinstance(raw, dict):
        raise ValueError("The YAML config root must be a mapping")

    detection = DetectionConfig(
        detector=str(_required(raw, "detector")).lower(),
        threshold=float(_required(raw, "threshold")),
        min_scene_len=_required(raw, "min_scene_len"),
        min_content_val=float(_required(raw, "min_content_val")),
        window_width=int(_required(raw, "window_width")),
        weights=_parse_weights(_required(raw, "weights")),
        frame_skip=int(_required(raw, "frame_skip")),
        downscale=(None if raw.get("downscale") in (None, 0) else int(raw["downscale"])),
        auto_downscale=bool(_required(raw, "auto_downscale")),
    )
    if detection.detector not in {"content", "adaptive"}:
        raise ValueError("detector must be either 'content' or 'adaptive'")
    if detection.threshold <= 0 or detection.min_content_val < 0:
        raise ValueError("threshold must be greater than zero and min_content_val cannot be negative")
    if detection.window_width <= 0 or detection.frame_skip < 0:
        raise ValueError("window_width must be positive and frame_skip cannot be negative")

    thumbnail_raw = _required(raw, "thumbnail")
    clip_raw = _required(raw, "clip")
    if not isinstance(thumbnail_raw, dict) or not isinstance(clip_raw, dict):
        raise ValueError("thumbnail and clip must be YAML mappings")

    thumbnail = ThumbnailConfig(
        safe_offset_ms=int(_required(thumbnail_raw, "safe_offset_ms", "thumbnail")),
        width=int(_required(thumbnail_raw, "width", "thumbnail")),
        quality=int(_required(thumbnail_raw, "quality", "thumbnail")),
    )
    clip = ClipConfig(
        video_codec=str(_required(clip_raw, "video_codec", "clip")),
        audio_codec=str(_required(clip_raw, "audio_codec", "clip")),
        preset=str(_required(clip_raw, "preset", "clip")),
        crf=int(_required(clip_raw, "crf", "clip")),
        audio_bitrate=str(_required(clip_raw, "audio_bitrate", "clip")),
        keep_audio=bool(_required(clip_raw, "keep_audio", "clip")),
    )
    if thumbnail.safe_offset_ms < 0 or thumbnail.width <= 0:
        raise ValueError("thumbnail safe_offset_ms must be non-negative and width must be positive")
    if thumbnail.quality < 1 or thumbnail.quality > 31:
        raise ValueError("thumbnail quality must be between 1 and 31")

    return ScanConfig(detection=detection, thumbnail=thumbnail, clip=clip)


def _parse_weights(value: Any) -> tuple[float, float, float, float]:
    if isinstance(value, dict):
        keys = ("delta_hue", "delta_sat", "delta_lum", "delta_edges")
        try:
            weights = tuple(float(value[key]) for key in keys)
        except KeyError as exc:
            raise ValueError(f"Missing weight key: {exc.args[0]}") from exc
    elif isinstance(value, (list, tuple)) and len(value) == 4:
        weights = tuple(float(item) for item in value)
    else:
        raise ValueError("weights must contain four values: hue, saturation, luminance, edges")
    if any(weight < 0 for weight in weights) or not any(weight > 0 for weight in weights):
        raise ValueError("weights must be non-negative and contain at least one positive value")
    return weights
