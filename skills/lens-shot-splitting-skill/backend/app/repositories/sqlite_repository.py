from __future__ import annotations

import json
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import create_engine, delete, desc, func, select, text
from sqlalchemy.orm import Session

from app.models.database import AnalysisRunRow, Base, FinalShotRow, ShotClassificationRow, ShotRow, VideoRow
from app.models.final_shot import FinalShotRecord
from app.models.shot import ShotRecord
from app.models.video import VideoMetadata
from app.services.media_library import resolve_storage_reference, storage_reference


class SQLiteRepository:
    def __init__(self, database_path: Path):
        self.database_path = database_path.expanduser().resolve()
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(
            f"sqlite:///{self.database_path}",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(self.engine)
        self._ensure_final_shot_columns()
        self._ensure_classification_columns()

    def _ensure_final_shot_columns(self) -> None:
        with self.engine.connect() as connection:
            columns = {
                row[1]
                for row in connection.exec_driver_sql("PRAGMA table_info(final_shots)").fetchall()
            }
        additions = {
            "speech_type": "VARCHAR(32) DEFAULT 'no_speech'",
            "speaker_id": "VARCHAR(128) DEFAULT ''",
            "speech_start_ms": "INTEGER",
            "speech_end_ms": "INTEGER",
            "transcript": "TEXT DEFAULT ''",
            "av_sync_confidence": "FLOAT DEFAULT 0.0",
            "speech_boundary_reason": "TEXT DEFAULT ''",
            "shot_category": "TEXT DEFAULT ''",
            "category_confidence": "FLOAT",
            "category_reason": "TEXT DEFAULT ''",
            "quality_score": "FLOAT",
            "quality_reason": "TEXT DEFAULT ''",
            "classification_status": "VARCHAR(32) DEFAULT 'pending_prompt'",
            "classification_model": "VARCHAR(128) DEFAULT ''",
            "classification_model_version": "VARCHAR(128) DEFAULT ''",
            "classification_error": "TEXT",
            "classification_raw": "TEXT",
        }
        with self.engine.begin() as connection:
            for name, definition in additions.items():
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE final_shots ADD COLUMN {name} {definition}"))

    def _ensure_classification_columns(self) -> None:
        with self.engine.connect() as connection:
            columns = {
                row[1]
                for row in connection.exec_driver_sql("PRAGMA table_info(shot_classifications)").fetchall()
            }
        additions = {
            "quality_score": "FLOAT",
            "quality_level": "VARCHAR(32)",
            "quality_reason": "TEXT",
            "quality_details": "TEXT DEFAULT '{}'",
        }
        with self.engine.begin() as connection:
            for name, definition in additions.items():
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE shot_classifications ADD COLUMN {name} {definition}"))

    def save_result(
        self,
        metadata: VideoMetadata,
        shots: list[ShotRecord],
        status: str,
        error_message: str | None = None,
    ) -> int:
        now = datetime.now(timezone.utc)
        with Session(self.engine) as session, session.begin():
            video = session.scalar(select(VideoRow).where(VideoRow.video_id == metadata.video_id))
            if video is None:
                video = VideoRow(video_id=metadata.video_id, source_path=_persist_path(metadata.source_path))
                session.add(video)
            self._update_video(video, metadata, status, error_message, now)
            video.shots.clear()
            session.flush()
            video.shots.extend(self._shot_row(shot, video.id) for shot in shots)
            return video.id

    def record_failure(
        self,
        video_id: str,
        source_path: Path,
        relative_path: str,
        error_message: str,
    ) -> None:
        now = datetime.now(timezone.utc)
        source_path = source_path.expanduser().resolve()
        with Session(self.engine) as session, session.begin():
            video = session.scalar(select(VideoRow).where(VideoRow.video_id == video_id))
            if video is None:
                video = VideoRow(video_id=video_id, source_path=_persist_path(source_path), file_name=source_path.name)
                session.add(video)
            video.relative_path = relative_path
            video.status = "failed"
            video.error_message = error_message
            video.scanned_at = now
            video.shots.clear()

    def count_videos(self) -> int:
        with Session(self.engine) as session:
            return int(session.scalar(select(func.count(VideoRow.id))) or 0)

    def count_shots(self) -> int:
        with Session(self.engine) as session:
            return int(session.scalar(select(func.count(ShotRow.id))) or 0)

    def list_candidate_segments(
        self,
        video_id: str | None = None,
        candidate_segment_id: str | None = None,
    ) -> list[ShotRecord]:
        statement = select(ShotRow, VideoRow).join(VideoRow, ShotRow.video_id == VideoRow.id)
        if video_id:
            statement = statement.where(VideoRow.video_id == video_id)
        if candidate_segment_id:
            statement = statement.where(ShotRow.shot_id == candidate_segment_id)
        with Session(self.engine) as session:
            rows = session.execute(statement.order_by(VideoRow.video_id, ShotRow.shot_index)).all()
            return [self._shot_record(shot, video) for shot, video in rows]

    def list_physical_shots(
        self,
        video_id: str | None = None,
        physical_shot_id: str | None = None,
    ) -> list[ShotRecord]:
        return self.list_candidate_segments(video_id, physical_shot_id)

    def get_video_metadata(self, video_id: str) -> VideoMetadata | None:
        with Session(self.engine) as session:
            video = session.scalar(select(VideoRow).where(VideoRow.video_id == video_id))
            if video is None:
                return None
            return VideoMetadata(
                video_id=video.video_id,
                source_path=str(resolve_storage_reference(video.source_path)),
                file_name=video.file_name,
                relative_path=video.relative_path,
                file_size_bytes=video.file_size_bytes or 0,
                duration_ms=video.duration_ms or 0,
                width=video.width or 0,
                height=video.height or 0,
                source_fps=video.source_fps,
                codec_name=video.codec_name,
                has_audio=video.has_audio,
                time_base=video.time_base,
                start_time_ms=video.start_time_ms,
                avg_frame_rate=video.avg_frame_rate,
                r_frame_rate=video.r_frame_rate,
                vfr_possible=video.vfr_possible,
                file_fingerprint=video.file_fingerprint or "",
                format_name=video.format_name,
                file_mtime_ns=video.file_mtime_ns or 0,
            )

    def replace_final_shots(self, video_id: str, final_shots: list[FinalShotRecord]) -> None:
        now = datetime.now(timezone.utc)
        with Session(self.engine) as session, session.begin():
            video = session.scalar(select(VideoRow).where(VideoRow.video_id == video_id))
            if video is None:
                raise ValueError(f"Video not found: {video_id}")
            session.execute(delete(FinalShotRow).where(FinalShotRow.video_id == video.id))
            session.add_all(self._final_row(item, video.id, now) for item in final_shots)

    def list_final_shots(self, video_id: str | None = None) -> list[FinalShotRecord]:
        statement = select(FinalShotRow, VideoRow).join(VideoRow, FinalShotRow.video_id == VideoRow.id)
        if video_id:
            statement = statement.where(VideoRow.video_id == video_id)
        with Session(self.engine) as session:
            rows = session.execute(statement.order_by(VideoRow.video_id, FinalShotRow.start_ms)).all()
            classifications = self._latest_classifications(session, video_id)
            records: list[FinalShotRecord] = []
            for row, video in rows:
                record = self._final_record(row, video.video_id)
                classification = classifications.get(record.final_shot_id)
                if classification is not None:
                    record = replace(
                        record,
                        shot_category=classification.shot_category or "",
                        category_label=classification.category_label or "",
                        category_confidence=classification.category_confidence,
                        category_reason=classification.category_reason or "",
                        quality_score=classification.quality_score,
                        quality_level=classification.quality_level,
                        quality_reason=classification.quality_reason or "",
                        quality_details=json.loads(classification.quality_details or "{}"),
                        taxonomy_version=classification.taxonomy_version,
                        prompt_version=classification.prompt_version,
                        classification_run_id=classification.run_id,
                        classification_status=classification.status,
                        classification_model=classification.model_name,
                        classification_model_version=classification.model_version,
                        classification_error=classification.error_message,
                        classification_raw=classification.raw_response,
                    )
                records.append(record)
            return records

    def start_analysis_run(
        self,
        *,
        run_id: str,
        video_id: str,
        stage: str,
        rule_version: str,
        config_snapshot: dict[str, object],
        model_name: str = "",
        model_version: str = "",
        prompt_version: str = "",
    ) -> None:
        now = datetime.now(timezone.utc)
        with Session(self.engine) as session, session.begin():
            existing = session.scalar(select(AnalysisRunRow).where(AnalysisRunRow.run_id == run_id))
            if existing is None:
                session.add(
                    AnalysisRunRow(
                        run_id=run_id,
                        video_id=video_id,
                        stage=stage,
                        rule_version=rule_version,
                        config_snapshot=json.dumps(config_snapshot, ensure_ascii=False, sort_keys=True),
                        model_name=model_name,
                        model_version=model_version,
                        prompt_version=prompt_version,
                        started_at=now,
                        status="running",
                    )
                )

    def complete_analysis_run(self, run_id: str, status: str, error_message: str | None = None) -> None:
        with Session(self.engine) as session, session.begin():
            run = session.scalar(select(AnalysisRunRow).where(AnalysisRunRow.run_id == run_id))
            if run is None:
                return
            run.status = status
            run.error_message = error_message
            run.completed_at = datetime.now(timezone.utc)

    def save_shot_classifications(
        self,
        *,
        run_id: str,
        video_id: str,
        taxonomy_version: str,
        prompt_version: str,
        model_name: str,
        model_version: str,
        records: list[dict[str, object]],
    ) -> None:
        now = datetime.now(timezone.utc)
        with Session(self.engine) as session, session.begin():
            for item in records:
                final_shot_id = str(item["final_shot_id"])
                session.add(
                    ShotClassificationRow(
                        classification_id=f"classification_{uuid4().hex}",
                        final_shot_id=final_shot_id,
                        video_id=video_id,
                        run_id=run_id,
                        taxonomy_version=taxonomy_version,
                        prompt_version=prompt_version,
                        model_name=model_name,
                        model_version=model_version,
                        shot_category=str(item.get("shot_category") or "") or None,
                        category_label=str(item.get("category_label") or "") or None,
                        category_confidence=item.get("category_confidence"),
                        category_reason=str(item.get("category_reason") or "") or None,
                        quality_score=item.get("quality_score"),
                        quality_level=str(item.get("quality_level") or "") or None,
                        quality_reason=str(item.get("quality_reason") or "") or None,
                        quality_details=json.dumps(item.get("quality_details") or {}, ensure_ascii=False, sort_keys=True),
                        status=str(item.get("classification_status") or "pending_prompt"),
                        raw_response=str(item.get("classification_raw") or "") or None,
                        input_snapshot=json.dumps(item.get("input_snapshot") or {}, ensure_ascii=False, sort_keys=True),
                        error_message=str(item.get("classification_error") or "") or None,
                        created_at=now,
                    )
                )

    @staticmethod
    def _latest_classifications(
        session: Session,
        video_id: str | None,
    ) -> dict[str, ShotClassificationRow]:
        statement = select(ShotClassificationRow).order_by(desc(ShotClassificationRow.created_at))
        if video_id:
            statement = statement.where(ShotClassificationRow.video_id == video_id)
        latest: dict[str, ShotClassificationRow] = {}
        for row in session.scalars(statement):
            latest.setdefault(row.final_shot_id, row)
        return latest

    def count_final_shots(self) -> int:
        with Session(self.engine) as session:
            return int(session.scalar(select(func.count(FinalShotRow.id))) or 0)

    def _update_video(
        self,
        video: VideoRow,
        metadata: VideoMetadata,
        status: str,
        error_message: str | None,
        scanned_at: datetime,
    ) -> None:
        video.video_id = metadata.video_id
        video.source_path = _persist_path(metadata.source_path)
        video.file_name = metadata.file_name
        video.relative_path = metadata.relative_path
        video.file_size_bytes = metadata.file_size_bytes
        video.duration_ms = metadata.duration_ms
        video.width = metadata.width
        video.height = metadata.height
        video.source_fps = metadata.source_fps
        video.codec_name = metadata.codec_name
        video.has_audio = metadata.has_audio
        video.time_base = metadata.time_base
        video.start_time_ms = metadata.start_time_ms
        video.avg_frame_rate = metadata.avg_frame_rate
        video.r_frame_rate = metadata.r_frame_rate
        video.vfr_possible = metadata.vfr_possible
        video.file_fingerprint = metadata.file_fingerprint
        video.format_name = metadata.format_name
        video.file_mtime_ns = metadata.file_mtime_ns
        video.status = status
        video.error_message = error_message
        video.scanned_at = scanned_at

    @staticmethod
    def _shot_row(shot: ShotRecord, video_row_id: int) -> ShotRow:
        return ShotRow(
            shot_id=shot.shot_id,
            video_id=video_row_id,
            shot_index=shot.shot_index,
            source_path=_persist_path(shot.source_path),
            start_frame=shot.start_frame,
            end_frame=shot.end_frame,
            start_ms=shot.start_ms,
            end_ms=shot.end_ms,
            duration_ms=shot.duration_ms,
            source_fps=shot.source_fps,
            detector=shot.detector,
            detector_config=json.dumps(shot.detector_config, ensure_ascii=False, sort_keys=True),
            thumbnails=json.dumps(shot.thumbnails, ensure_ascii=False, sort_keys=True),
            thumbnail_status=shot.thumbnail_status,
            thumbnail_error=shot.thumbnail_error,
            clip_path=shot.clip_path,
            clip_duration_ms=shot.clip_duration_ms,
            clip_status=shot.clip_status,
            clip_error=shot.clip_error,
        )

    @staticmethod
    def _shot_record(shot: ShotRow, video: VideoRow) -> ShotRecord:
        return ShotRecord(
            video_id=video.video_id,
            shot_id=shot.shot_id,
            source_path=str(resolve_storage_reference(shot.source_path)),
            shot_index=shot.shot_index,
            start_frame=shot.start_frame,
            end_frame=shot.end_frame,
            start_ms=shot.start_ms,
            end_ms=shot.end_ms,
            duration_ms=shot.duration_ms,
            source_fps=shot.source_fps,
            detector=shot.detector,
            detector_config=json.loads(shot.detector_config or "{}"),
            thumbnails=json.loads(shot.thumbnails or "{}"),
            thumbnail_status=shot.thumbnail_status,
            thumbnail_error=shot.thumbnail_error,
            clip_path=shot.clip_path,
            clip_duration_ms=shot.clip_duration_ms,
            clip_status=shot.clip_status,
            clip_error=shot.clip_error,
        )

    @staticmethod
    def _final_row(final_shot: FinalShotRecord, video_row_id: int, now: datetime) -> FinalShotRow:
        return FinalShotRow(
            final_shot_id=final_shot.final_shot_id,
            video_id=video_row_id,
            source_path=_persist_path(final_shot.source_path),
            start_ms=final_shot.start_ms,
            end_ms=final_shot.end_ms,
            duration_ms=final_shot.duration_ms,
            candidate_segment_ids=json.dumps(final_shot.candidate_segment_ids, ensure_ascii=False),
            scene=final_shot.scene,
            main_subject=final_shot.main_subject,
            action=final_shot.action,
            observable_goal=final_shot.observable_goal,
            scene_change_reason=final_shot.scene_change_reason,
            action_completion_reason=final_shot.action_completion_reason,
            confidence=final_shot.confidence,
            clip_path=final_shot.clip_path,
            clip_status=final_shot.clip_status,
            clip_error=final_shot.clip_error,
            model_name=final_shot.model_name,
            model_version=final_shot.model_version,
            speech_type=final_shot.speech_type,
            speaker_id=final_shot.speaker_id,
            speech_start_ms=final_shot.speech_start_ms,
            speech_end_ms=final_shot.speech_end_ms,
            transcript=final_shot.transcript,
            av_sync_confidence=final_shot.av_sync_confidence,
            speech_boundary_reason=final_shot.speech_boundary_reason,
            review_status=final_shot.review_status,
            error_message=final_shot.error_message,
            created_at=now,
            updated_at=now,
            shot_category=final_shot.shot_category,
            category_confidence=final_shot.category_confidence,
            category_reason=final_shot.category_reason,
            quality_score=final_shot.quality_score,
            quality_reason=final_shot.quality_reason,
            classification_status=final_shot.classification_status,
            classification_model=final_shot.classification_model,
            classification_model_version=final_shot.classification_model_version,
            classification_error=final_shot.classification_error,
            classification_raw=final_shot.classification_raw,
        )

    @staticmethod
    def _final_record(row: FinalShotRow, video_id: str) -> FinalShotRecord:
        return FinalShotRecord(
            final_shot_id=row.final_shot_id,
            video_id=video_id,
            source_path=str(resolve_storage_reference(row.source_path)),
            start_ms=row.start_ms,
            end_ms=row.end_ms,
            duration_ms=row.duration_ms,
            candidate_segment_ids=json.loads(row.candidate_segment_ids or "[]"),
            scene=row.scene,
            main_subject=row.main_subject,
            action=row.action,
            observable_goal=row.observable_goal,
            scene_change_reason=row.scene_change_reason,
            action_completion_reason=row.action_completion_reason,
            confidence=row.confidence,
            clip_path=row.clip_path,
            clip_status=row.clip_status,
            clip_error=row.clip_error,
            model_name=row.model_name,
            model_version=row.model_version,
            speech_type=row.speech_type,
            speaker_id=row.speaker_id,
            speech_start_ms=row.speech_start_ms,
            speech_end_ms=row.speech_end_ms,
            transcript=row.transcript,
            av_sync_confidence=row.av_sync_confidence,
            speech_boundary_reason=row.speech_boundary_reason,
            review_status=row.review_status,
            error_message=row.error_message,
            created_at=row.created_at.isoformat() if row.created_at else "",
            updated_at=row.updated_at.isoformat() if row.updated_at else "",
            shot_category=getattr(row, "shot_category", "") or "",
            category_confidence=getattr(row, "category_confidence", None),
            category_reason=getattr(row, "category_reason", "") or "",
            quality_score=getattr(row, "quality_score", None),
            quality_level=getattr(row, "quality_level", None),
            quality_reason=getattr(row, "quality_reason", "") or "",
            quality_details={},
            classification_status=getattr(row, "classification_status", "pending_prompt") or "pending_prompt",
            classification_model=getattr(row, "classification_model", "") or "",
            classification_model_version=getattr(row, "classification_model_version", "") or "",
            classification_error=getattr(row, "classification_error", None),
            classification_raw=getattr(row, "classification_raw", None),
        )

    def close(self) -> None:
        self.engine.dispose()


def _persist_path(value: str | Path) -> str:
    path = Path(value).expanduser()
    try:
        return storage_reference(path)
    except ValueError:
        return str(path.resolve())
