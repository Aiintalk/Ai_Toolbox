from __future__ import annotations

from dataclasses import dataclass
from typing import Any

@dataclass(frozen=True, slots=True)
class CandidateDecision:
    candidate_segment_id: str
    scene_continuity: str
    scene_change: bool
    scene: str
    main_subject: str
    current_action: str
    observable_goal: str
    action_phase: str
    action_completed: bool
    should_split_before: bool
    split_reason: str
    confidence: float
    camera_only_change: bool = False
    action_change: bool = False
    primary_subject_change: bool = False
    speech_type: str = "uncertain"
    face_visible: bool = False
    mouth_moving: bool = False
    speaker_id: str = ""
    speech_start_ms: int | None = None
    speech_end_ms: int | None = None
    transcript: str = ""
    av_sync_confidence: float = 0.0
    mouth_motion_score: float | None = None
    speech_boundary_reason: str = ""
    error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_segment_id": self.candidate_segment_id,
            "scene_continuity": self.scene_continuity,
            "scene_change": self.scene_change,
            "camera_only_change": self.camera_only_change,
            "action_change": self.action_change,
            "primary_subject_change": self.primary_subject_change,
            "scene": self.scene,
            "main_subject": self.main_subject,
            "current_action": self.current_action,
            "observable_goal": self.observable_goal,
            "action_phase": self.action_phase,
            "action_completed": self.action_completed,
            "should_split_before": self.should_split_before,
            "split_reason": self.split_reason,
            "confidence": self.confidence,
            "speech_type": self.speech_type,
            "face_visible": self.face_visible,
            "mouth_moving": self.mouth_moving,
            "speaker_id": self.speaker_id,
            "speech_start_ms": self.speech_start_ms,
            "speech_end_ms": self.speech_end_ms,
            "transcript": self.transcript,
            "av_sync_confidence": self.av_sync_confidence,
            "mouth_motion_score": self.mouth_motion_score,
            "speech_boundary_reason": self.speech_boundary_reason,
            "error_message": self.error_message,
        }


class CandidateDecisionError(ValueError):
    pass


def parse_candidate_decision(payload: dict[str, Any], candidate_segment_id: str) -> CandidateDecision:
    raw_decisions = payload.get("decisions")
    if not isinstance(raw_decisions, list):
        raise CandidateDecisionError("model response must contain a decisions list")
    raw = next(
        (item for item in raw_decisions if isinstance(item, dict) and item.get("candidate_segment_id") == candidate_segment_id),
        None,
    )
    if raw is None:
        raise CandidateDecisionError(f"model did not return decision for {candidate_segment_id}")
    primary_subject_change = _bool(raw.get("primary_subject_change"))
    scene_change = _bool(raw.get("scene_change")) or primary_subject_change
    should_split = _bool(raw.get("should_split_before")) or scene_change
    speech_type = _speech_type(raw.get("speech_type"))
    speech_boundary_reason = _text(raw.get("speech_boundary_reason"))
    if speech_boundary_reason in {
        "on_camera_speech_start",
        "on_camera_speech_end",
        "speaker_changed",
        "speech_topic_changed",
    } and speech_type not in {"on_camera_speech", "no_speech", "uncertain"}:
        should_split = scene_change
    return CandidateDecision(
        candidate_segment_id=candidate_segment_id,
        scene_continuity=_continuity(raw.get("scene_continuity")),
        scene_change=scene_change,
        camera_only_change=_bool(raw.get("camera_only_change")),
        action_change=_bool(raw.get("action_change")),
        primary_subject_change=primary_subject_change,
        scene=_text(raw.get("scene")),
        main_subject=_text(raw.get("main_subject")),
        current_action=_text(raw.get("current_action")),
        observable_goal=_text(raw.get("observable_goal")),
        action_phase=_phase(raw.get("action_phase")),
        action_completed=_bool(raw.get("action_completed")),
        should_split_before=should_split,
        split_reason=_text(raw.get("split_reason")) or "uncertain",
        confidence=_confidence(raw.get("confidence")),
        speech_type=speech_type,
        face_visible=_bool(raw.get("face_visible")),
        mouth_moving=_bool(raw.get("mouth_moving")),
        speaker_id=_text(raw.get("speaker_id")),
        speech_start_ms=_optional_int(raw.get("speech_start_ms")),
        speech_end_ms=_optional_int(raw.get("speech_end_ms")),
        transcript=_text(raw.get("transcript")),
        av_sync_confidence=_confidence(raw.get("av_sync_confidence")),
        speech_boundary_reason=speech_boundary_reason,
    )


def fallback_candidate_decision(candidate_segment_id: str, error_message: str, first: bool) -> CandidateDecision:
    return CandidateDecision(
        candidate_segment_id=candidate_segment_id,
        scene_continuity="unknown",
        scene_change=False,
        scene="",
        main_subject="",
        current_action="",
        observable_goal="",
        action_phase="ongoing",
        action_completed=False,
        should_split_before=False if not first else False,
        split_reason="analysis_failed_conservative_merge",
        confidence=0.0,
        primary_subject_change=False,
        speech_type="uncertain",
        error_message=error_message,
    )


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _continuity(value: Any) -> str:
    value = _text(value).lower()
    return value if value in {"continuous", "discontinuous", "unknown"} else "unknown"


def _phase(value: Any) -> str:
    value = _text(value).lower()
    return value if value in {"beginning", "ongoing", "complete"} else "ongoing"


def _confidence(value: Any) -> float:
    try:
        return min(1.0, max(0.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _speech_type(value: Any) -> str:
    value = _text(value).lower()
    return value if value in {
        "on_camera_speech",
        "voice_over",
        "ambient_sound",
        "no_speech",
        "uncertain",
    } else "uncertain"


def _optional_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return max(0, int(float(value)))
    except (TypeError, ValueError):
        return None
