from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models.candidate_decision import CandidateDecision
from app.models.final_shot import FinalShotRecord
from app.models.speech_evidence import SpeechEvidence
from app.models.shot import ShotRecord
from app.models.video import VideoMetadata
from app.services.report_generator import generate_report
from app.services.media_library import resolve_storage_reference, storage_reference


class VideoOutputStore:
    def __init__(
        self,
        output_root: Path,
        video_id: str,
        final_shots_dir: Path | None = None,
        flat_layout: bool = False,
    ):
        root = output_root.expanduser().resolve()
        self.video_dir = root / video_id if flat_layout else root / "videos" / video_id
        self.video_id = video_id
        self.metadata_path = self.video_dir / "video_metadata.json"
        self.shots_path = self.video_dir / "shots.json"
        self.candidate_decisions_path = self.video_dir / "candidate_decisions.json"
        self.speech_evidence_path = self.video_dir / "speech_evidence.json"
        self.final_shots_path = self.video_dir / "final_shots.json"
        self.report_path = self.video_dir / "report.html"
        self.log_path = self.video_dir / "processing.log"
        self.database_path = self.video_dir / "shots.db"
        self.final_shots_dir = (final_shots_dir or self.video_dir / "final_shots").expanduser().resolve()

    def prepare(self, reset_log: bool = False, clean_assets: bool = False) -> None:
        self.video_dir.mkdir(parents=True, exist_ok=True)
        thumbnails_dir = self.video_dir / "thumbnails"
        clips_dir = self.video_dir / "clips"
        candidate_samples_dir = self.video_dir / "candidate_samples"
        speech_audio_dir = self.video_dir / "speech_audio"
        thumbnails_dir.mkdir(exist_ok=True)
        clips_dir.mkdir(exist_ok=True)
        candidate_samples_dir.mkdir(exist_ok=True)
        speech_audio_dir.mkdir(exist_ok=True)
        self.final_shots_dir.mkdir(parents=True, exist_ok=True)
        if clean_assets:
            for asset_path in thumbnails_dir.glob("*.jpg"):
                asset_path.unlink(missing_ok=True)
            for asset_path in clips_dir.glob("*.mp4"):
                asset_path.unlink(missing_ok=True)
        if reset_log:
            self.log_path.write_text("", encoding="utf-8")

    def log(self, event: str, level: str = "INFO", **fields: Any) -> None:
        self.prepare()
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "event": event,
            **fields,
        }
        with self.log_path.open("a", encoding="utf-8") as log_file:
            log_file.write(json.dumps(record, ensure_ascii=False) + "\n")

    def write_metadata(self, metadata: VideoMetadata, processing_status: str, error_message: str | None = None) -> None:
        self.metadata_path.write_text(
            json.dumps(metadata.to_dict(processing_status, error_message), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def write_shots(self, shots: list[ShotRecord]) -> None:
        self.shots_path.write_text(
            json.dumps([shot.to_dict() for shot in shots], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def write_candidate_decisions(self, decisions: list[CandidateDecision]) -> None:
        self.candidate_decisions_path.write_text(
            json.dumps([decision.to_dict() for decision in decisions], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def load_candidate_decisions(self) -> dict[str, CandidateDecision]:
        if not self.candidate_decisions_path.exists():
            return {}
        try:
            payload = json.loads(self.candidate_decisions_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        result: dict[str, CandidateDecision] = {}
        for item in payload if isinstance(payload, list) else []:
            if not isinstance(item, dict) or not item.get("candidate_segment_id"):
                continue
            result[item["candidate_segment_id"]] = CandidateDecision(
                candidate_segment_id=item["candidate_segment_id"],
                scene_continuity=item.get("scene_continuity", "unknown"),
                scene_change=bool(item.get("scene_change", False)),
                camera_only_change=bool(item.get("camera_only_change", False)),
                action_change=bool(item.get("action_change", False)),
                primary_subject_change=bool(item.get("primary_subject_change", False)),
                scene=item.get("scene", ""),
                main_subject=item.get("main_subject", ""),
                current_action=item.get("current_action", ""),
                observable_goal=item.get("observable_goal", ""),
                action_phase=item.get("action_phase", "ongoing"),
                action_completed=bool(item.get("action_completed", False)),
                should_split_before=bool(item.get("should_split_before", False)),
                split_reason=item.get("split_reason", "uncertain"),
                confidence=float(item.get("confidence", 0.0)),
                speech_type=item.get("speech_type", "uncertain"),
                face_visible=bool(item.get("face_visible", False)),
                mouth_moving=bool(item.get("mouth_moving", False)),
                speaker_id=item.get("speaker_id", ""),
                speech_start_ms=item.get("speech_start_ms"),
                speech_end_ms=item.get("speech_end_ms"),
                transcript=item.get("transcript", ""),
                av_sync_confidence=float(item.get("av_sync_confidence", 0.0)),
                mouth_motion_score=(
                    float(item["mouth_motion_score"])
                    if item.get("mouth_motion_score") is not None
                    else None
                ),
                speech_boundary_reason=item.get("speech_boundary_reason", ""),
                error_message=item.get("error_message"),
            )
        return result

    def write_speech_evidence(self, evidence: list[SpeechEvidence]) -> None:
        self.speech_evidence_path.write_text(
            json.dumps([item.to_dict() for item in evidence], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def load_speech_evidence(self) -> dict[str, SpeechEvidence]:
        if not self.speech_evidence_path.exists():
            return {}
        try:
            payload = json.loads(self.speech_evidence_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        result: dict[str, SpeechEvidence] = {}
        for item in payload if isinstance(payload, list) else []:
            if not isinstance(item, dict) or not item.get("candidate_segment_id"):
                continue
            result[item["candidate_segment_id"]] = SpeechEvidence(
                candidate_segment_id=item["candidate_segment_id"],
                has_audio=bool(item.get("has_audio", False)),
                transcript=str(item.get("transcript", "")),
                speech_start_ms=item.get("speech_start_ms"),
                speech_end_ms=item.get("speech_end_ms"),
                confidence=float(item.get("confidence", 0.0)),
                error_message=item.get("error_message"),
            )
        return result

    def write_final_shots(self, final_shots: list[FinalShotRecord]) -> None:
        self.final_shots_path.write_text(
            json.dumps([final_shot.to_dict() for final_shot in final_shots], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def clip_reference(self, clip_path: Path) -> str:
        """Return the canonical persisted path for a finished clip."""
        try:
            return storage_reference(clip_path)
        except ValueError:
            return str(clip_path.resolve().relative_to(self.video_dir))

    def resolve_clip_path(self, reference: str) -> Path:
        return resolve_storage_reference(reference, analysis_dir=self.video_dir)

    def write_report(
        self,
        metadata: VideoMetadata | None,
        candidates: list[ShotRecord],
        status: str,
        error_message: str | None = None,
        decisions: list[CandidateDecision] | None = None,
        final_shots: list[FinalShotRecord] | None = None,
    ) -> None:
        self.report_path.write_text(
            generate_report(
                self.video_dir,
                metadata,
                candidates,
                status,
                error_message,
                decisions or [],
                final_shots or [],
            ),
            encoding="utf-8",
        )

    def is_completed(self, with_clips: bool) -> bool:
        if not self.metadata_path.exists() or not self.shots_path.exists() or not self.report_path.exists():
            return False
        try:
            metadata = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            shots = json.loads(self.shots_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return False
        if metadata.get("processing_status") != "completed":
            return False
        for shot in shots:
            if shot.get("thumbnail_status") != "completed":
                return False
            if any(not (self.video_dir / path).exists() for path in shot.get("thumbnails", {}).values()):
                return False
            if with_clips and (
                shot.get("clip_status") != "completed"
                or not shot.get("clip_path")
                or not (self.video_dir / shot["clip_path"]).exists()
            ):
                return False
        return True

    def is_final_completed(
        self,
        with_clips: bool = True,
        require_classification: bool = False,
    ) -> bool:
        if (
            not self.final_shots_path.exists()
            or not self.candidate_decisions_path.exists()
            or not self.speech_evidence_path.exists()
        ):
            return False
        try:
            final_shots = json.loads(self.final_shots_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return False
        if not isinstance(final_shots, list) or not final_shots:
            return False
        if any(item.get("error_message") for item in final_shots):
            return False
        if require_classification and any(
            item.get("classification_status") != "completed"
            or item.get("quality_score") is None
            for item in final_shots
        ):
            return False
        if not with_clips:
            return True
        return all(
            item.get("clip_status") == "completed"
            and item.get("clip_path")
            and self.resolve_clip_path(str(item["clip_path"])).exists()
            for item in final_shots
        )
