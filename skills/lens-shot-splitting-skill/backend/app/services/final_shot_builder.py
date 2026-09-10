from __future__ import annotations

from dataclasses import dataclass, replace
from statistics import mean

from app.models.candidate_decision import CandidateDecision
from app.models.final_shot import FinalShotRecord
from app.models.shot import ShotRecord


class FinalShotBoundaryError(ValueError):
    pass


@dataclass(slots=True)
class _FinalGroup:
    candidates: list[ShotRecord]
    decisions: list[CandidateDecision]
    end_scene_reason: str = ""
    end_action_reason: str = ""
    end_speech_reason: str = ""


@dataclass(frozen=True, slots=True)
class _SemanticPart:
    candidate: ShotRecord
    decision: CandidateDecision


def build_final_shots(
    candidates: list[ShotRecord],
    decisions: list[CandidateDecision],
    model_name: str,
    model_version: str,
    speech_gap_tolerance_ms: int = 1200,
) -> list[FinalShotRecord]:
    """Merge candidates and honor an explicitly detected speech end inside a candidate."""
    if not candidates:
        return []
    candidates = sorted(candidates, key=lambda item: item.shot_index)
    by_id = {decision.candidate_segment_id: decision for decision in decisions}
    if len(by_id) != len(candidates) or any(candidate.shot_id not in by_id for candidate in candidates):
        raise FinalShotBoundaryError("Every candidate segment must have exactly one decision")
    for previous, current in zip(candidates, candidates[1:]):
        if previous.end_ms != current.start_ms:
            raise FinalShotBoundaryError("Candidate segments contain a time gap or overlap")

    parts: list[_SemanticPart] = []
    for candidate in candidates:
        decision = by_id[candidate.shot_id]
        speech_end = _internal_speech_end(candidate, decision)
        if speech_end is None:
            parts.append(_SemanticPart(candidate, decision))
            continue
        spoken_part = replace(
            candidate,
            end_ms=speech_end,
            duration_ms=speech_end - candidate.start_ms,
        )
        silent_part = replace(
            candidate,
            start_ms=speech_end,
            duration_ms=candidate.end_ms - speech_end,
        )
        parts.append(
            _SemanticPart(
                spoken_part,
                replace(
                    decision,
                    should_split_before=False,
                    split_reason="same_scene_same_action",
                    speech_boundary_reason="continuous_speech",
                ),
            )
        )
        parts.append(
            _SemanticPart(
                silent_part,
                replace(
                    decision,
                    speech_type="voice_over" if decision.transcript else "no_speech",
                    face_visible=False,
                    mouth_moving=False,
                    speech_start_ms=speech_end,
                    speech_end_ms=candidate.end_ms,
                    should_split_before=True,
                    split_reason="on_camera_speech_end",
                    speech_boundary_reason="on_camera_speech_end",
                ),
            )
        )

    groups: list[_FinalGroup] = []
    current = _FinalGroup([parts[0].candidate], [parts[0].decision])
    previous_decision = parts[0].decision
    for part in parts[1:]:
        candidate = part.candidate
        decision = part.decision
        split = _should_split_for_boundary(
            decision,
            previous_decision,
            speech_gap_tolerance_ms,
            candidate.duration_ms,
        )
        if split:
            if decision.scene_change or decision.primary_subject_change:
                current.end_scene_reason = decision.split_reason
            elif _is_speech_boundary(decision, previous_decision):
                current.end_speech_reason = _speech_boundary_label(decision, previous_decision)
            else:
                current.end_action_reason = decision.split_reason
            groups.append(current)
            current = _FinalGroup([candidate], [decision])
        else:
            current.candidates.append(candidate)
            current.decisions.append(decision)
        previous_decision = decision
    groups.append(current)

    result: list[FinalShotRecord] = []
    for index, group in enumerate(groups, start=1):
        first = group.candidates[0]
        last = group.candidates[-1]
        errors = "; ".join(
            decision.error_message for decision in group.decisions if decision.error_message
        ) or None
        result.append(
            FinalShotRecord(
                final_shot_id=f"{first.video_id}_final_shot_{index:04d}",
                video_id=first.video_id,
                source_path=first.source_path,
                start_ms=first.start_ms,
                end_ms=last.end_ms,
                duration_ms=last.end_ms - first.start_ms,
                candidate_segment_ids=[candidate.shot_id for candidate in group.candidates],
                scene=_first_text(group.decisions, "scene") or "",
                main_subject=_join_unique(decision.main_subject for decision in group.decisions),
                action=_join_unique(decision.current_action for decision in group.decisions),
                observable_goal=_join_unique(decision.observable_goal for decision in group.decisions),
                scene_change_reason=group.end_scene_reason,
                action_completion_reason=group.end_action_reason,
                confidence=round(mean(decision.confidence for decision in group.decisions), 4),
                model_name=model_name,
                model_version=model_version,
                speech_type=_speech_type(group.decisions),
                speaker_id=_join_unique(decision.speaker_id for decision in group.decisions),
                speech_start_ms=_min_optional(decision.speech_start_ms for decision in group.decisions),
                speech_end_ms=_max_optional(decision.speech_end_ms for decision in group.decisions),
                transcript=_join_unique(decision.transcript for decision in group.decisions),
                av_sync_confidence=_speech_confidence(group.decisions),
                speech_boundary_reason=group.end_speech_reason,
                error_message=errors,
            )
        )
    _validate_final_ranges([part.candidate for part in parts], result)
    return result


def _internal_speech_end(candidate: ShotRecord, decision: CandidateDecision) -> int | None:
    """Return a reliable in-candidate speech end, ignoring full-range defaults."""
    if not _is_on_camera_speech(decision):
        return None
    if decision.speech_boundary_reason != "on_camera_speech_end":
        return None
    boundary = decision.speech_end_ms
    if boundary is None:
        return None
    boundary = max(candidate.start_ms, min(candidate.end_ms, boundary))
    # Do not manufacture tiny fragments from a boundary too close to either edge.
    if boundary - candidate.start_ms < 250 or candidate.end_ms - boundary < 250:
        return None
    return boundary


def _first_text(decisions: list[CandidateDecision], field: str) -> str:
    for decision in decisions:
        value = getattr(decision, field, "")
        if value:
            return value
    return ""


def _join_unique(values) -> str:
    result: list[str] = []
    for value in values:
        value = value.strip()
        if value and value not in result:
            result.append(value)
    return "；".join(result)


_SPEECH_ONLY_REASONS = {
    "on_camera_speech_start",
    "on_camera_speech_end",
    "speaker_changed",
    "speech_topic_changed",
    "voice_over",
}


def _should_split_for_boundary(
    current: CandidateDecision,
    previous: CandidateDecision,
    speech_gap_tolerance_ms: int,
    current_duration_ms: int,
) -> bool:
    # An on-camera speech run is one semantic expression even if its temporary
    # E1–E5 subtype changes (for example, a viewpoint turns into a product
    # recommendation).  Conversely, moving from that speech run into a
    # voice-over or silent visual is a new expression and needs a boundary.
    if _is_on_camera_speech(current) != _is_on_camera_speech(previous):
        return True
    if current.scene_change or current.primary_subject_change:
        return True
    # Only adjacent candidates that the model labels as on-camera speech may
    # merge. Any voice-over, silence, ambient sound, or uncertain candidate
    # keeps its first-pass boundary and prevents merging across it.
    if not _is_on_camera_speech(current) or not _is_on_camera_speech(previous):
        return True
    speech_reason = current.speech_boundary_reason or current.split_reason
    if current.should_split_before and speech_reason in _SPEECH_ONLY_REASONS:
        if speech_reason == "on_camera_speech_start":
            return False
        return _is_on_camera_speech(current)
    if _is_on_camera_speech(current):
        if (
            current.speech_boundary_reason == "speaker_changed"
            and current.speaker_id
            and previous.speaker_id
            and current.speaker_id != previous.speaker_id
        ):
            return True
    # During an on-camera speech run, action changes are content changes, not
    # semantic boundaries. Scene changes and explicit speech boundaries above
    # still take precedence.
    if _is_on_camera_speech(current) or _is_on_camera_speech(previous):
        return False
    if current.action_change or current.split_reason in {
        "action_completed",
        "observable_goal_changed",
    }:
        return True
    # A camera/framing change is explicitly diagnostic, never a semantic boundary.
    if current.camera_only_change and current.split_reason not in {
        "action_completed",
        "observable_goal_changed",
    }:
        return False
    if current.should_split_before:
        return True
    return False


def _is_speech_boundary(current: CandidateDecision, previous: CandidateDecision) -> bool:
    reason = current.speech_boundary_reason or current.split_reason
    return reason in _SPEECH_ONLY_REASONS or (
        _is_on_camera_speech(current) and not _is_on_camera_speech(previous)
    )


def _speech_boundary_label(current: CandidateDecision, previous: CandidateDecision) -> str:
    if (
        _is_on_camera_speech(previous)
        and current.speech_type in {"voice_over", "no_speech", "ambient_sound"}
    ):
        return "on_camera_speech_end"
    if current.speech_boundary_reason in _SPEECH_ONLY_REASONS:
        return current.speech_boundary_reason
    if _is_on_camera_speech(current) and not _is_on_camera_speech(previous):
        return "on_camera_speech_start"
    if _is_on_camera_speech(previous) and not _is_on_camera_speech(current):
        return "on_camera_speech_end"
    return current.speech_boundary_reason or current.split_reason


def _speech_type(decisions: list[CandidateDecision]) -> str:
    types = {decision.speech_type for decision in decisions}
    for speech_type in ("on_camera_speech", "voice_over", "ambient_sound", "no_speech", "uncertain"):
        if speech_type in types:
            return speech_type
    return "uncertain"


def _min_optional(values) -> int | None:
    values = [value for value in values if value is not None]
    return min(values) if values else None


def _max_optional(values) -> int | None:
    values = [value for value in values if value is not None]
    return max(values) if values else None


def _speech_confidence(decisions: list[CandidateDecision]) -> float:
    values = [
        decision.av_sync_confidence
        for decision in decisions
        if decision.speech_type == "on_camera_speech"
    ]
    return round(mean(values), 4) if values else 0.0


def _is_on_camera_speech(decision: CandidateDecision) -> bool:
    """Return whether the model labeled this candidate as on-camera speech."""
    return decision.speech_type == "on_camera_speech"


def _validate_final_ranges(candidates: list[ShotRecord], finals: list[FinalShotRecord]) -> None:
    allowed_starts = {candidate.start_ms for candidate in candidates}
    allowed_ends = {candidate.end_ms for candidate in candidates}
    if not finals or finals[0].start_ms != candidates[0].start_ms or finals[-1].end_ms != candidates[-1].end_ms:
        raise FinalShotBoundaryError("Final shots do not cover all candidates")
    if any(final.start_ms not in allowed_starts or final.end_ms not in allowed_ends for final in finals):
        raise FinalShotBoundaryError("Final shot boundary is not an original candidate boundary")
    for previous, current in zip(finals, finals[1:]):
        if previous.end_ms != current.start_ms:
            raise FinalShotBoundaryError("Final shots contain a gap or overlap")
