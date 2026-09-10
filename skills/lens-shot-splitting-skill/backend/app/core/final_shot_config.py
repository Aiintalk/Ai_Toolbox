from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from app.core.scan_config import ClipConfig


@dataclass(frozen=True, slots=True)
class FinalShotSamplingConfig:
    short_candidate_threshold_ms: int = 2000
    short_safe_offset_ms: int = 200
    interval_ms: int = 667
    max_samples_per_candidate: int = 16
    speech_interval_ms: int = 100
    max_speech_samples_per_candidate: int = 24
    mouth_motion_threshold: float = 0.0175
    width: int = 768
    quality: int = 3


@dataclass(frozen=True, slots=True)
class FinalShotModelConfig:
    model_name: str = "qwen3.8-flash"
    model_version: str = "qwen3.8-flash"
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key_env: str = "QWEN_API_KEY"
    timeout_seconds: float = 120.0
    max_retries: int = 3
    temperature: float = 0.0
    max_tokens: int = 3000
    enable_thinking: bool = False


@dataclass(frozen=True, slots=True)
class FinalShotSpeechConfig:
    enabled: bool = True
    model_name: str = "qwen3-asr-flash"
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key_env: str = "QWEN_API_KEY"
    timeout_seconds: float = 120.0
    max_retries: int = 2
    language: str = "zh"
    speech_gap_tolerance_ms: int = 1200


@dataclass(frozen=True, slots=True)
class FinalShotClassificationConfig:
    """Configuration for the post-split shot classification stage.

    The prompt is deliberately external and versioned. An unset prompt keeps
    the stage in a visible ``pending_prompt`` state without making an API
    request.
    """

    enabled: bool = True
    model_name: str = "qwen3.8-flash"
    model_version: str = "qwen3.8-flash"
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key_env: str = "QWEN_CLASSIFICATION_API_KEY"
    timeout_seconds: float = 120.0
    max_retries: int = 2
    temperature: float = 0.0
    max_tokens: int = 2200
    # Classification is a direct structured judgement.  Keeping Qwen's
    # optional reasoning mode off avoids spending extra time on hidden
    # reasoning for every multi-frame request.
    enable_thinking: bool = False
    prompt_path: str | None = None
    taxonomy_version: str = "beauty_shot_v3"
    prompt_version: str = "beauty_shot_prompt_v7_category_quality"
    use_visual_samples: bool = True


@dataclass(frozen=True, slots=True)
class FinalShotConfig:
    sampling: FinalShotSamplingConfig
    model: FinalShotModelConfig
    speech: FinalShotSpeechConfig
    classification: FinalShotClassificationConfig
    clip: ClipConfig
    clip_retries: int = 2
    split_rule_version: str = "semantic_split_v2_zh"


def _int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def load_final_shot_config(path: Path) -> FinalShotConfig:
    payload = yaml.safe_load(path.expanduser().read_text(encoding="utf-8")) or {}
    sampling = payload.get("sampling", {}) or {}
    model = payload.get("model", {}) or {}
    speech = payload.get("speech", {}) or {}
    classification = payload.get("classification", {}) or {}
    clip = payload.get("clip", {}) or {}
    model_name = str(model.get("model_name", model.get("name", "qwen3.8-flash")))
    return FinalShotConfig(
        sampling=FinalShotSamplingConfig(
            short_candidate_threshold_ms=max(1, _int(sampling.get("short_candidate_threshold_ms"), 2000)),
            short_safe_offset_ms=max(0, _int(sampling.get("short_safe_offset_ms"), 200)),
            interval_ms=max(1, _int(sampling.get("interval_ms"), 667)),
            max_samples_per_candidate=max(3, _int(sampling.get("max_samples_per_candidate"), 16)),
            speech_interval_ms=max(1, _int(sampling.get("speech_interval_ms"), 100)),
            max_speech_samples_per_candidate=max(
                6, _int(sampling.get("max_speech_samples_per_candidate"), 24)
            ),
            mouth_motion_threshold=max(
                0.0, _float(sampling.get("mouth_motion_threshold"), 0.0175)
            ),
            width=max(1, _int(sampling.get("width"), 768)),
            quality=max(1, _int(sampling.get("quality"), 3)),
        ),
        model=FinalShotModelConfig(
            model_name=model_name,
            model_version=str(model.get("model_version", model.get("version", model_name))),
            base_url=str(model.get("base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")),
            api_key_env=str(model.get("api_key_env", "QWEN_API_KEY")),
            timeout_seconds=max(1.0, _float(model.get("timeout_seconds"), 120.0)),
            max_retries=max(0, _int(model.get("max_retries"), 3)),
            temperature=max(0.0, _float(model.get("temperature"), 0.0)),
            max_tokens=max(256, _int(model.get("max_tokens"), 3000)),
            enable_thinking=_bool(model.get("enable_thinking"), False),
        ),
        speech=FinalShotSpeechConfig(
            enabled=_bool(speech.get("enabled"), True),
            model_name=str(speech.get("model_name", "qwen3-asr-flash")),
            base_url=str(speech.get("base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")),
            api_key_env=str(speech.get("api_key_env", "QWEN_API_KEY")),
            timeout_seconds=max(1.0, _float(speech.get("timeout_seconds"), 120.0)),
            max_retries=max(0, _int(speech.get("max_retries"), 2)),
            language=str(speech.get("language", "zh")),
            speech_gap_tolerance_ms=max(0, _int(speech.get("speech_gap_tolerance_ms"), 1200)),
        ),
        classification=FinalShotClassificationConfig(
            enabled=_bool(classification.get("enabled"), True),
            model_name=str(classification.get("model_name", classification.get("name", "qwen3.8-flash"))),
            model_version=str(
                classification.get(
                    "model_version", classification.get("version", classification.get("model_name", "qwen3.8-flash"))
                )
            ),
            base_url=str(
                classification.get("base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1")
            ),
            api_key_env=str(classification.get("api_key_env", "QWEN_CLASSIFICATION_API_KEY")),
            timeout_seconds=max(1.0, _float(classification.get("timeout_seconds"), 120.0)),
            max_retries=max(0, _int(classification.get("max_retries"), 2)),
            temperature=max(0.0, _float(classification.get("temperature"), 0.0)),
            max_tokens=max(256, _int(classification.get("max_tokens"), 2200)),
            enable_thinking=_bool(classification.get("enable_thinking"), False),
            prompt_path=(
                str(classification.get("prompt_path"))
                if classification.get("prompt_path") not in (None, "")
                else None
            ),
            taxonomy_version=str(classification.get("taxonomy_version", "beauty_shot_v3")),
            prompt_version=str(classification.get("prompt_version", "beauty_shot_prompt_v7_category_quality")),
            use_visual_samples=_bool(classification.get("use_visual_samples"), True),
        ),
        clip=ClipConfig(
            video_codec=str(clip.get("video_codec", "libx264")),
            audio_codec=str(clip.get("audio_codec", "aac")),
            preset=str(clip.get("preset", "medium")),
            crf=_int(clip.get("crf"), 18),
            audio_bitrate=str(clip.get("audio_bitrate", "192k")),
            keep_audio=_bool(clip.get("keep_audio"), True),
        ),
        clip_retries=max(0, _int(payload.get("clip_retries"), 2)),
        split_rule_version=str(payload.get("split_rule_version", "semantic_split_v2_zh")),
    )
