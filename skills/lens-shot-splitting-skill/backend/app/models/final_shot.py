from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class FinalShotRecord:
    final_shot_id: str
    video_id: str
    source_path: str
    start_ms: int
    end_ms: int
    duration_ms: int
    candidate_segment_ids: list[str]
    scene: str
    main_subject: str
    action: str
    observable_goal: str
    scene_change_reason: str
    action_completion_reason: str
    confidence: float
    clip_path: str | None = None
    clip_status: str = "not_requested"
    clip_error: str | None = None
    model_name: str = ""
    model_version: str = ""
    speech_type: str = "no_speech"
    speaker_id: str = ""
    speech_start_ms: int | None = None
    speech_end_ms: int | None = None
    transcript: str = ""
    av_sync_confidence: float = 0.0
    speech_boundary_reason: str = ""
    review_status: str = "pending"
    error_message: str | None = None
    created_at: str = ""
    updated_at: str = ""
    # Classification is a versioned enrichment of the immutable split result.
    # The combined model also returns quality fields; the raw JSON is kept for
    # audit while these columns provide the library's fast display path.
    shot_category: str = ""
    category_label: str = ""
    category_confidence: float | None = None
    category_reason: str = ""
    taxonomy_version: str = ""
    prompt_version: str = ""
    classification_run_id: str = ""
    quality_score: float | None = None
    quality_level: str | None = None
    quality_reason: str = ""
    quality_details: dict[str, Any] = field(default_factory=dict)
    classification_status: str = "pending_prompt"
    classification_model: str = ""
    classification_model_version: str = ""
    classification_error: str | None = None
    classification_raw: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "final_shot_id": self.final_shot_id,
            "video_id": self.video_id,
            "source_path": self.source_path,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "duration_ms": self.duration_ms,
            "candidate_segment_ids": self.candidate_segment_ids,
            "scene": self.scene,
            "main_subject": self.main_subject,
            "action": self.action,
            "observable_goal": self.observable_goal,
            "scene_change_reason": self.scene_change_reason,
            "action_completion_reason": self.action_completion_reason,
            "confidence": self.confidence,
            "clip_path": self.clip_path,
            "clip_status": self.clip_status,
            "clip_error": self.clip_error,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "speech_type": self.speech_type,
            "speaker_id": self.speaker_id,
            "speech_start_ms": self.speech_start_ms,
            "speech_end_ms": self.speech_end_ms,
            "transcript": self.transcript,
            "av_sync_confidence": self.av_sync_confidence,
            "speech_boundary_reason": self.speech_boundary_reason,
            "review_status": self.review_status,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "shot_category": self.shot_category,
            "category_label": self.category_label,
            "category_confidence": self.category_confidence,
            "category_reason": self.category_reason,
            "taxonomy_version": self.taxonomy_version,
            "prompt_version": self.prompt_version,
            "classification_run_id": self.classification_run_id,
            "quality_score": self.quality_score,
            "quality_level": self.quality_level,
            "quality_reason": self.quality_reason,
            "quality_details": self.quality_details,
            "classification_status": self.classification_status,
            "classification_model": self.classification_model,
            "classification_model_version": self.classification_model_version,
            "classification_error": self.classification_error,
            "classification_raw": self.classification_raw,
        }
