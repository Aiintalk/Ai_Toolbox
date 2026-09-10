from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class VideoRow(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    video_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    source_path: Mapped[str] = mapped_column(String(4096), unique=True, index=True)
    file_name: Mapped[str] = mapped_column(String(1024))
    relative_path: Mapped[str] = mapped_column(String(4096), index=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    codec_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    has_audio: Mapped[bool] = mapped_column(default=False)
    time_base: Mapped[str | None] = mapped_column(String(64), nullable=True)
    start_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_frame_rate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    r_frame_rate: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vfr_possible: Mapped[bool] = mapped_column(default=False)
    file_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    format_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_mtime_ns: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="processing")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    shots: Mapped[list[ShotRow]] = relationship(
        back_populates="video",
        cascade="all, delete-orphan",
        order_by="ShotRow.shot_index",
    )


class ShotRow(Base):
    __tablename__ = "shots"
    __table_args__ = (UniqueConstraint("video_id", "shot_index", name="uq_video_shot_index"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    shot_id: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    shot_index: Mapped[int] = mapped_column(Integer)
    source_path: Mapped[str] = mapped_column(String(4096))
    start_frame: Mapped[int] = mapped_column(Integer)
    end_frame: Mapped[int] = mapped_column(Integer)
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[int] = mapped_column(Integer)
    source_fps: Mapped[float | None] = mapped_column(Float, nullable=True)
    detector: Mapped[str] = mapped_column(String(128))
    detector_config: Mapped[str] = mapped_column(Text)
    thumbnails: Mapped[str] = mapped_column(Text)
    thumbnail_status: Mapped[str] = mapped_column(String(32), default="completed")
    thumbnail_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    clip_path: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    clip_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    clip_status: Mapped[str] = mapped_column(String(32), default="not_requested")
    clip_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    video: Mapped[VideoRow] = relationship(back_populates="shots")


class FinalShotRow(Base):
    __tablename__ = "final_shots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    final_shot_id: Mapped[str] = mapped_column(String(192), unique=True, index=True)
    video_id: Mapped[int] = mapped_column(ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    source_path: Mapped[str] = mapped_column(String(4096))
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    duration_ms: Mapped[int] = mapped_column(Integer)
    candidate_segment_ids: Mapped[str] = mapped_column(Text)
    scene: Mapped[str] = mapped_column(Text, default="")
    main_subject: Mapped[str] = mapped_column(Text, default="")
    action: Mapped[str] = mapped_column(Text, default="")
    observable_goal: Mapped[str] = mapped_column(Text, default="")
    scene_change_reason: Mapped[str] = mapped_column(Text, default="")
    action_completion_reason: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    clip_path: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    clip_status: Mapped[str] = mapped_column(String(32), default="not_requested")
    clip_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str] = mapped_column(String(128), default="")
    model_version: Mapped[str] = mapped_column(String(128), default="")
    speech_type: Mapped[str] = mapped_column(String(32), default="no_speech")
    speaker_id: Mapped[str] = mapped_column(String(128), default="")
    speech_start_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    speech_end_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transcript: Mapped[str] = mapped_column(Text, default="")
    av_sync_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    speech_boundary_reason: Mapped[str] = mapped_column(Text, default="")
    review_status: Mapped[str] = mapped_column(String(32), default="pending")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    shot_category: Mapped[str] = mapped_column(Text, default="")
    category_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    category_reason: Mapped[str] = mapped_column(Text, default="")
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_reason: Mapped[str] = mapped_column(Text, default="")
    classification_status: Mapped[str] = mapped_column(String(32), default="pending_prompt")
    classification_model: Mapped[str] = mapped_column(String(128), default="")
    classification_model_version: Mapped[str] = mapped_column(String(128), default="")
    classification_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    classification_raw: Mapped[str | None] = mapped_column(Text, nullable=True)


class AnalysisRunRow(Base):
    """An immutable record of one split or classification execution."""

    __tablename__ = "analysis_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    video_id: Mapped[str] = mapped_column(String(128), index=True)
    stage: Mapped[str] = mapped_column(String(32), index=True)
    rule_version: Mapped[str] = mapped_column(String(128), default="")
    config_snapshot: Mapped[str] = mapped_column(Text, default="{}")
    model_name: Mapped[str] = mapped_column(String(128), default="")
    model_version: Mapped[str] = mapped_column(String(128), default="")
    prompt_version: Mapped[str] = mapped_column(String(128), default="")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="running")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class ShotClassificationRow(Base):
    """Versioned classification output; never overwrites a semantic shot."""

    __tablename__ = "shot_classifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    classification_id: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    final_shot_id: Mapped[str] = mapped_column(String(192), index=True)
    video_id: Mapped[str] = mapped_column(String(128), index=True)
    run_id: Mapped[str] = mapped_column(String(128), index=True)
    taxonomy_version: Mapped[str] = mapped_column(String(128), index=True)
    prompt_version: Mapped[str] = mapped_column(String(128))
    model_name: Mapped[str] = mapped_column(String(128), default="")
    model_version: Mapped[str] = mapped_column(String(128), default="")
    shot_category: Mapped[str | None] = mapped_column(String(16), nullable=True)
    category_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    category_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    category_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    quality_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_details: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="pending_prompt")
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_snapshot: Mapped[str] = mapped_column(Text, default="{}")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
