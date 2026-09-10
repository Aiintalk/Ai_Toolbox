from __future__ import annotations

from dataclasses import asdict, dataclass
from collections.abc import Callable
from pathlib import Path

from app.core.scan_config import ScanConfig
from app.models.shot import ShotRecord
from app.repositories.sqlite_repository import SQLiteRepository
from app.services.clip_generator import ClipGenerator
from app.services.metadata_extractor import FFprobeMetadataExtractor
from app.services.output_store import VideoOutputStore
from app.services.scene_detector import PySceneDetector
from app.services.thumbnail_generator import ThumbnailGenerator
from app.services.video_discovery import VideoDiscovery
from app.utils.paths import stable_video_id
from app.utils.timecode import normalize_boundaries

ProgressCallback = Callable[[int, str], None]


@dataclass(slots=True)
class ScanSummary:
    discovered: int = 0
    processed: int = 0
    skipped: int = 0
    failed_videos: int = 0
    shots: int = 0
    thumbnails: int = 0
    thumbnail_failures: int = 0
    clips_completed: int = 0
    clip_failures: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


class ScanPipeline:
    def __init__(
        self,
        discovery: VideoDiscovery,
        metadata_extractor: FFprobeMetadataExtractor,
        scene_detector: PySceneDetector,
        config: ScanConfig,
    ):
        self.discovery = discovery
        self.metadata_extractor = metadata_extractor
        self.scene_detector = scene_detector
        self.config = config

    def run(
        self,
        input_root: Path,
        output_root: Path,
        skip_completed: bool = True,
        force: bool = False,
        with_clips: bool = False,
        flat_output: bool = False,
        progress_callback: ProgressCallback | None = None,
    ) -> ScanSummary:
        input_root = input_root.expanduser().resolve()
        output_root = output_root.expanduser().resolve()
        single_video = input_root.is_file()
        video_paths = [input_root] if single_video else self.discovery.discover(input_root)
        summary = ScanSummary(discovered=len(video_paths))

        for video_path in video_paths:
            relative_path = video_path.name if single_video else video_path.relative_to(input_root).as_posix()
            video_id = stable_video_id(relative_path)
            store = VideoOutputStore(output_root, video_id, flat_layout=flat_output)
            if skip_completed and not force and store.is_completed(with_clips=with_clips):
                summary.skipped += 1
                continue

            self._process_video(
                video_path=video_path,
                relative_path=relative_path,
                video_id=video_id,
                store=store,
                summary=summary,
                force=force,
                with_clips=with_clips,
                progress_callback=progress_callback,
            )

        return summary

    def _process_video(
        self,
        video_path: Path,
        relative_path: str,
        video_id: str,
        store: VideoOutputStore,
        summary: ScanSummary,
        force: bool,
        with_clips: bool,
        progress_callback: ProgressCallback | None,
    ) -> None:
        repository: SQLiteRepository | None = None
        metadata = None
        shots: list[ShotRecord] = []
        store.prepare(reset_log=True, clean_assets=True)
        store.log("video_started", source_path=str(video_path), relative_path=relative_path, force=force)
        try:
            repository = SQLiteRepository(store.database_path)
            metadata = self.metadata_extractor.extract(video_path, relative_path, video_id)
            store.log(
                "metadata_extracted",
                duration_ms=metadata.duration_ms,
                width=metadata.width,
                height=metadata.height,
                source_fps=metadata.source_fps,
                vfr_possible=metadata.vfr_possible,
            )
            if progress_callback is not None:
                progress_callback(15, f"已提取元数据，开始识别镜头：{video_path.name}")

            boundaries = normalize_boundaries(
                self.scene_detector.detect(video_path),
                metadata.duration_ms,
            )
            store.log("scenes_detected", count=len(boundaries), detector=self.scene_detector.name)
            if progress_callback is not None:
                progress_callback(20, f"已识别 {len(boundaries)} 个候选镜头，开始生成缩略图")
            thumbnail_generator = ThumbnailGenerator(store.video_dir, self.config.thumbnail)
            clip_generator = ClipGenerator(store.video_dir, self.config.clip) if with_clips else None

            for shot_index, boundary in enumerate(boundaries, start=1):
                shot_id = f"{video_id}_shot_{shot_index:04d}"
                thumbnails: dict[str, str] = {}
                thumbnail_status = "completed"
                thumbnail_error = None
                try:
                    thumbnails = thumbnail_generator.generate(video_path, shot_index, boundary)
                    summary.thumbnails += len(thumbnails)
                except Exception as exc:
                    thumbnail_status = "failed"
                    thumbnail_error = str(exc)
                    summary.thumbnail_failures += 1
                    store.log(
                        "thumbnail_failed",
                        level="ERROR",
                        shot_id=shot_id,
                        error=thumbnail_error,
                    )

                clip_path = None
                clip_duration_ms = None
                clip_status = "not_requested"
                clip_error = None
                if clip_generator is not None:
                    clip_status = "completed"
                    try:
                        clip_path, clip_duration_ms = clip_generator.generate(video_path, shot_index, boundary)
                        summary.clips_completed += 1
                    except Exception as exc:
                        clip_status = "failed"
                        clip_error = str(exc)
                        summary.clip_failures += 1
                        store.log(
                            "clip_failed",
                            level="ERROR",
                            shot_id=shot_id,
                            error=clip_error,
                        )

                shots.append(
                    ShotRecord(
                        video_id=video_id,
                        shot_id=shot_id,
                        source_path=metadata.source_path,
                        shot_index=shot_index,
                        start_frame=boundary.start_frame,
                        end_frame=boundary.end_frame,
                        start_ms=boundary.start_ms,
                        end_ms=boundary.end_ms,
                        duration_ms=boundary.duration_ms,
                        source_fps=metadata.source_fps,
                        detector=self.scene_detector.name,
                        detector_config=self.config.detection.to_dict(),
                        thumbnails=thumbnails,
                        thumbnail_status=thumbnail_status,
                        thumbnail_error=thumbnail_error,
                        clip_path=clip_path,
                        clip_duration_ms=clip_duration_ms,
                        clip_status=clip_status,
                        clip_error=clip_error,
                    )
                )
                store.log(
                    "shot_processed",
                    shot_id=shot_id,
                    start_ms=boundary.start_ms,
                    end_ms=boundary.end_ms,
                    clip_status=clip_status,
                    thumbnail_status=thumbnail_status,
                )
                if progress_callback is not None and boundaries:
                    scan_progress = 20 + int((shot_index / len(boundaries)) * 21)
                    progress_callback(min(41, scan_progress), f"正在生成候选镜头 {shot_index}/{len(boundaries)}")

            has_errors = any(
                shot.thumbnail_status != "completed"
                or (with_clips and shot.clip_status != "completed")
                for shot in shots
            )
            status = "completed_with_errors" if has_errors else "completed"
            repository.save_result(metadata, shots, status)
            store.write_metadata(metadata, status)
            store.write_shots(shots)
            store.write_report(metadata, shots, status)
            store.log("video_completed", status=status, shots=len(shots))
            summary.processed += 1
            summary.shots += len(shots)
        except Exception as exc:
            error_message = str(exc)
            summary.failed_videos += 1
            if repository is not None:
                if metadata is not None:
                    repository.save_result(metadata, shots, "failed", error_message)
                    store.write_metadata(metadata, "failed", error_message)
                    store.write_shots(shots)
                    store.write_report(metadata, shots, "failed", error_message)
                else:
                    repository.record_failure(video_id, video_path, relative_path, error_message)
                    store.write_report(None, shots, "failed", error_message)
            store.log("video_failed", level="ERROR", error=error_message)
        finally:
            if repository is not None:
                repository.close()
