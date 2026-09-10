from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from typing import Callable
from uuid import uuid4

from app.core.final_shot_config import FinalShotConfig
from app.models.candidate_decision import (
    CandidateDecision,
    fallback_candidate_decision,
    parse_candidate_decision,
)
from app.models.final_shot import FinalShotRecord
from app.models.speech_evidence import SpeechEvidence
from app.models.shot import ShotBoundary, ShotRecord
from app.repositories.sqlite_repository import SQLiteRepository
from app.services.candidate_sampling import CandidateSample, CandidateSampleExtractor
from app.services.clip_generator import ClipGenerator
from app.services.final_shot_builder import build_final_shots
from app.services.final_shot_visual_samples import FinalShotVisualSample, FinalShotVisualSampler
from app.services.output_store import VideoOutputStore
from app.services.qwen_client import QwenVisionClient
from app.services.qwen_classification_client import QwenClassificationClient
from app.services.qwen_speech_client import QwenSpeechClient
from app.services.speech_audio import CandidateAudioExtractor
from app.services.speech_sync import enforce_mouth_motion_gate

ProgressCallback = Callable[[int, str], None]


def final_clip_filename(final_shot: FinalShotRecord, index: int) -> str:
    """Include the source video name so clips remain identifiable outside its folder."""
    source_stem = Path(final_shot.source_path).stem or final_shot.video_id
    return f"{source_stem}_final_shot_{index:04d}.mp4"


@dataclass(slots=True)
class FinalShotSummary:
    discovered_candidates: int = 0
    processed_videos: int = 0
    skipped_videos: int = 0
    failed_videos: int = 0
    final_shots: int = 0
    clips_completed: int = 0
    clip_failures: int = 0
    model_fallbacks: int = 0
    speech_fallbacks: int = 0
    classification_completed: int = 0
    classification_needs_review: int = 0
    classification_pending: int = 0
    classification_failures: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)


class FinalShotPipeline:
    def __init__(
        self,
        config: FinalShotConfig,
        analyzer: QwenVisionClient | None = None,
        speech_analyzer: QwenSpeechClient | None = None,
        classifier: QwenClassificationClient | None = None,
        sample_extractor_cls=CandidateSampleExtractor,
        clip_generator_cls=ClipGenerator,
    ):
        self.config = config
        self.analyzer = analyzer or QwenVisionClient(config.model)
        self.speech_analyzer = speech_analyzer or (
            QwenSpeechClient(config.speech) if config.speech.enabled else None
        )
        self.classifier = classifier or QwenClassificationClient(config.classification)
        self._speech_fallbacks = 0
        self.sample_extractor_cls = sample_extractor_cls
        self.clip_generator_cls = clip_generator_cls

    def run(
        self,
        database_path: Path,
        video_id: str | None = None,
        candidate_segment_id: str | None = None,
        candidate_segment_ids: set[str] | None = None,
        force: bool = False,
        with_clips: bool = True,
        run_id: str | None = None,
        final_clips_dir: Path | None = None,
        flat_output: bool = False,
        progress_callback: ProgressCallback | None = None,
    ) -> FinalShotSummary:
        database_path = database_path.expanduser().resolve()
        self._speech_fallbacks = 0
        repository = SQLiteRepository(database_path)
        target = repository.list_candidate_segments(candidate_segment_id=candidate_segment_id) if candidate_segment_id else []
        if candidate_segment_id and not target:
            repository.close()
            raise ValueError(f"Candidate segment not found: {candidate_segment_id}")
        if target:
            video_id = target[0].video_id
        target_ids = set(candidate_segment_ids or ())
        if candidate_segment_id:
            target_ids.add(candidate_segment_id)
        candidates = repository.list_candidate_segments(video_id=video_id)
        summary = FinalShotSummary(discovered_candidates=len(candidates))
        output_root = self._infer_output_root(database_path)
        execution_id = run_id or f"run_{uuid4().hex[:12]}"
        try:
            grouped: dict[str, list[ShotRecord]] = {}
            for candidate in candidates:
                grouped.setdefault(candidate.video_id, []).append(candidate)
            for current_video_id, video_candidates in grouped.items():
                self._process_video(
                    repository,
                    output_root,
                    current_video_id,
                    video_candidates,
                    summary,
                    execution_id=execution_id,
                    final_clips_dir=final_clips_dir,
                    flat_output=flat_output,
                    target_candidate_ids=target_ids or None,
                    force=force,
                    with_clips=with_clips,
                    progress_callback=progress_callback,
                )
        finally:
            close = getattr(self.analyzer, "close", None)
            if close:
                close()
            close_speech = getattr(self.speech_analyzer, "close", None)
            if close_speech:
                close_speech()
            close_classifier = getattr(self.classifier, "close", None)
            if close_classifier:
                close_classifier()
            repository.close()
        summary.speech_fallbacks = self._speech_fallbacks
        return summary

    def _process_video(
        self,
        repository: SQLiteRepository,
        output_root: Path,
        video_id: str,
        candidates: list[ShotRecord],
        summary: FinalShotSummary,
        execution_id: str,
        final_clips_dir: Path | None,
        flat_output: bool,
        target_candidate_ids: set[str] | None,
        force: bool,
        with_clips: bool,
        progress_callback: ProgressCallback | None,
    ) -> None:
        ordered_candidates = sorted(candidates, key=lambda item: item.shot_index)
        store = VideoOutputStore(
            output_root,
            video_id,
            final_shots_dir=final_clips_dir,
            flat_layout=flat_output,
        )
        store.prepare()
        classification_requested = bool(
            self.config.classification.enabled and getattr(self.classifier, "ready", True)
        )
        if not force and not target_candidate_ids and store.is_final_completed(
            with_clips, require_classification=classification_requested
        ):
            summary.skipped_videos += 1
            store.log("final_shot_video_skipped", video_id=video_id)
            return

        store.log("final_shot_video_started", video_id=video_id, force=force)
        self._emit_progress(progress_callback, 49, "准备最终镜头分析")
        if force or target_candidate_ids:
            for path in store.final_shots_dir.glob("*.mp4"):
                path.unlink(missing_ok=True)
        decisions_by_id = store.load_candidate_decisions()
        speech_evidence_by_id = store.load_speech_evidence()
        samples_by_id: dict[tuple[str, bool], list[CandidateSample]] = {}
        extractor = self.sample_extractor_cls(store.video_dir, self.config.sampling)
        audio_extractor = CandidateAudioExtractor(store.video_dir)
        self._prefetch_speech_evidence(
            store,
            audio_extractor,
            ordered_candidates,
            speech_evidence_by_id,
            progress_callback=progress_callback,
        )
        self._emit_progress(progress_callback, 53, "分析候选镜头")
        decisions: list[CandidateDecision] = []
        try:
            pending: list[tuple[int, ShotRecord, ShotRecord | None, SpeechEvidence, SpeechEvidence | None]] = []
            for index, candidate in enumerate(ordered_candidates):
                previous = ordered_candidates[index - 1] if index > 0 else None
                current_speech = self._speech_for_candidate(
                    store, audio_extractor, candidate, speech_evidence_by_id
                )
                previous_speech = (
                    self._speech_for_candidate(store, audio_extractor, previous, speech_evidence_by_id)
                    if previous is not None
                    else None
                )
                should_analyze = (
                    force
                    or (target_candidate_ids is not None and candidate.shot_id in target_candidate_ids)
                    or candidate.shot_id not in decisions_by_id
                    or decisions_by_id[candidate.shot_id].error_message is not None
                )
                if should_analyze:
                    if current_speech is None:
                        raise RuntimeError(f"Missing speech evidence: {candidate.shot_id}")
                    pending.append((index, candidate, previous, current_speech, previous_speech))

            if pending:
                completed = 0
                with ThreadPoolExecutor(
                    max_workers=min(3, len(pending)),
                    thread_name_prefix="vision",
                ) as pool:
                    futures = {
                        pool.submit(
                            self._analyze_candidate,
                            store,
                            extractor,
                            candidate,
                            previous,
                            current_speech,
                            previous_speech,
                            samples_by_id,
                        ): (index, candidate)
                        for index, candidate, previous, current_speech, previous_speech in pending
                    }
                    for future in as_completed(futures):
                        index, candidate = futures[future]
                        decision, model_fallback = future.result()
                        completed += 1
                        if index == 0 and decision.should_split_before:
                            decision = replace(decision, should_split_before=False, split_reason="first_candidate")
                        if model_fallback:
                            summary.model_fallbacks += 1
                        decisions_by_id[candidate.shot_id] = decision
                        store.write_candidate_decisions(
                            [
                                decisions_by_id[item.shot_id]
                                for item in ordered_candidates
                                if item.shot_id in decisions_by_id
                            ]
                        )
                        self._emit_progress(
                            progress_callback,
                            self._progress_in_range(53, 70, completed, len(pending)),
                            f"分析候选镜头 {completed}/{len(pending)}",
                        )

            store.write_speech_evidence(
                [speech_evidence_by_id[item.shot_id] for item in ordered_candidates]
            )
            decisions = [decisions_by_id[item.shot_id] for item in ordered_candidates]
            self._emit_progress(progress_callback, 71, "生成最终镜头")

            final_shots = build_final_shots(
                ordered_candidates,
                decisions,
                self.config.model.model_name,
                self.config.model.model_version,
                speech_gap_tolerance_ms=self.config.speech.speech_gap_tolerance_ms,
            )
            self._emit_progress(progress_callback, 72, "生成成品片段")
            final_shots = self._export_clips(
                store,
                final_shots,
                with_clips,
                summary,
                progress_callback=progress_callback,
            )
            self._emit_progress(progress_callback, 89, "分类最终镜头")
            repository.replace_final_shots(video_id, final_shots)
            split_run_id = f"{execution_id}-split"
            repository.start_analysis_run(
                run_id=split_run_id,
                video_id=video_id,
                stage="split",
                rule_version=self.config.split_rule_version,
                config_snapshot={
                    "model": asdict(self.config.model),
                    "sampling": asdict(self.config.sampling),
                    "speech": asdict(self.config.speech),
                },
                model_name=self.config.model.model_name,
                model_version=self.config.model.model_version,
            )
            repository.complete_analysis_run(split_run_id, "completed")
            final_shots = self._classify_final_shots(
                repository,
                video_id,
                execution_id,
                store,
                final_shots,
                summary,
                ordered_candidates,
                progress_callback=progress_callback,
            )
            self._emit_progress(progress_callback, 99, "写入结果")
            all_decisions = [decisions_by_id[item.shot_id] for item in ordered_candidates]
            metadata = repository.get_video_metadata(video_id)
            store.write_candidate_decisions(all_decisions)
            store.write_speech_evidence(
                [speech_evidence_by_id[item.shot_id] for item in ordered_candidates]
            )
            store.write_final_shots(final_shots)
            status = (
                "completed_with_errors"
                if any(
                    item.error_message
                    or item.clip_error
                    or item.classification_status == "error"
                    for item in final_shots
                )
                else "completed"
            )
            store.write_report(metadata, candidates, status, decisions=all_decisions, final_shots=final_shots)
            store.log("final_shot_video_completed", video_id=video_id, final_shots=len(final_shots), status=status)
            summary.processed_videos += 1
            summary.final_shots += len(final_shots)
        except Exception as exc:
            summary.failed_videos += 1
            store.log("final_shot_video_failed", level="ERROR", video_id=video_id, error=str(exc))

    def _classify_final_shots(
        self,
        repository: SQLiteRepository,
        video_id: str,
        execution_id: str,
        store: VideoOutputStore,
        final_shots: list[FinalShotRecord],
        summary: FinalShotSummary,
        candidates: list[ShotRecord] | None = None,
        progress_callback: ProgressCallback | None = None,
    ) -> list[FinalShotRecord]:
        """Run one visual model pass for understanding, class and quality."""
        model_name = self.config.classification.model_name
        model_version = self.config.classification.model_version
        taxonomy_version = self.config.classification.taxonomy_version
        prompt_version = self.config.classification.prompt_version
        classification_run_id = f"{execution_id}-classification"
        repository.start_analysis_run(
            run_id=classification_run_id,
            video_id=video_id,
            stage="classification",
            rule_version=taxonomy_version,
            config_snapshot=asdict(self.config.classification),
            model_name=model_name,
            model_version=model_version,
            prompt_version=prompt_version,
        )
        records: list[dict[str, object]] = []
        if not self.config.classification.enabled or not getattr(self.classifier, "ready", True):
            summary.classification_pending += len(final_shots)
            pending = [
                replace(
                    item,
                    classification_status="pending_prompt",
                    classification_model=model_name,
                    classification_model_version=model_version,
                    taxonomy_version=taxonomy_version,
                    prompt_version=prompt_version,
                    classification_run_id=classification_run_id,
                    classification_error=None,
                )
                for item in final_shots
            ]
            records.extend(
                {
                    "final_shot_id": item.final_shot_id,
                    "classification_status": item.classification_status,
                    "classification_error": item.classification_error,
                    "quality_score": item.quality_score,
                    "quality_level": item.quality_level,
                    "quality_reason": item.quality_reason,
                    "quality_details": item.quality_details,
                    "input_snapshot": self.classifier._structured_input(item),
                }
                for item in pending
            )
            repository.save_shot_classifications(
                run_id=classification_run_id,
                video_id=video_id,
                taxonomy_version=taxonomy_version,
                prompt_version=prompt_version,
                model_name=model_name,
                model_version=model_version,
                records=records,
            )
            repository.complete_analysis_run(classification_run_id, "pending_prompt")
            return pending

        enriched: list[FinalShotRecord] = []
        visual_sampler = (
            FinalShotVisualSampler(
                width=self.config.sampling.width,
                quality=self.config.sampling.quality,
            )
            if self.config.classification.use_visual_samples
            else None
        )
        candidates = candidates or []
        candidates_by_id = {candidate.shot_id: candidate for candidate in candidates}
        candidate_extractor = self.sample_extractor_cls(store.video_dir, self.config.sampling)
        total = len(final_shots)
        for index, item in enumerate(final_shots, start=1):
            structured_snapshot = self.classifier._structured_input(item)
            input_snapshot: dict[str, object] = structured_snapshot
            quality_level: str | None = None
            quality_details: dict[str, object] = {}
            try:
                visual_samples = []
                candidate_samples = [
                    candidates_by_id[candidate_id]
                    for candidate_id in item.candidate_segment_ids
                    if candidate_id in candidates_by_id
                ]
                if candidate_samples and visual_sampler is not None:
                    visual_samples = self._classification_samples_from_candidates(
                        store,
                        item,
                        candidate_samples,
                        candidate_extractor,
                    )
                if not visual_samples and visual_sampler is not None:
                    if not item.clip_path or item.clip_status != "completed":
                        visual_sampling_error = "最终镜头没有可用成品"
                    else:
                        try:
                            visual_samples = visual_sampler.extract(item.clip_path, item.duration_ms)
                            visual_sampling_error = None
                        except Exception as sample_exc:
                            visual_sampling_error = str(sample_exc)
                            store.log(
                                "final_shot_visual_samples_failed",
                                level="WARNING",
                                final_shot_id=item.final_shot_id,
                                error=visual_sampling_error,
                            )
                else:
                    visual_sampling_error = None
                if self.config.classification.use_visual_samples:
                    input_snapshot = {
                        "structured_understanding": structured_snapshot,
                        "visual_samples": [
                            {
                                "label": str(getattr(sample, "label", "sample")),
                                "offset_ms": getattr(sample, "offset_ms", None),
                                "path": str(getattr(sample, "path", sample)),
                            }
                            for sample in visual_samples
                        ],
                    }
                    if visual_sampling_error:
                        input_snapshot["visual_sampling_error"] = visual_sampling_error
                if visual_sampling_error and self.config.classification.use_visual_samples:
                    result = {
                        "shot_category": "",
                        "category_label": "",
                        "category_confidence": None,
                        "category_reason": f"画面证据不可用，需人工复核：{visual_sampling_error}",
                        "classification_status": "needs_review",
                        "classification_raw": None,
                    }
                else:
                    result = self.classifier.classify(item, visual_samples=visual_samples)
                quality_level = result.get("quality_level")
                quality_details = result.get("quality_details", {}) or {}
                enriched_item = replace(
                    item,
                    shot_category=str(result.get("shot_category", "")),
                    category_label=str(result.get("category_label", "")),
                    category_confidence=result.get("category_confidence"),
                    category_reason=str(result.get("category_reason", "")),
                    taxonomy_version=taxonomy_version,
                    prompt_version=prompt_version,
                    classification_run_id=classification_run_id,
                    classification_status=str(result.get("classification_status", "completed")),
                    classification_model=model_name,
                    classification_model_version=model_version,
                    classification_error=None,
                    classification_raw=result.get("classification_raw"),
                    quality_score=result.get("quality_score"),
                    quality_level=quality_level,
                    quality_reason=str(result.get("quality_reason", "")),
                    quality_details=quality_details,
                )
                if enriched_item.classification_status == "needs_review":
                    summary.classification_needs_review += 1
                elif enriched_item.classification_status == "completed":
                    summary.classification_completed += 1
                else:
                    summary.classification_pending += 1
                store.log(
                    "final_shot_classified",
                    final_shot_id=item.final_shot_id,
                    shot_category=enriched_item.shot_category,
                    classification_status=enriched_item.classification_status,
                )
            except Exception as exc:
                summary.classification_failures += 1
                enriched_item = replace(
                    item,
                    classification_status="error",
                    classification_model=model_name,
                    classification_model_version=model_version,
                    taxonomy_version=taxonomy_version,
                    prompt_version=prompt_version,
                    classification_run_id=classification_run_id,
                    classification_error=str(exc),
                )
                store.log(
                    "final_shot_classification_failed",
                    level="ERROR",
                    final_shot_id=item.final_shot_id,
                    error=str(exc),
                )
            enriched.append(enriched_item)
            records.append(
                {
                    "final_shot_id": enriched_item.final_shot_id,
                    "shot_category": enriched_item.shot_category,
                    "category_label": enriched_item.category_label,
                    "category_confidence": enriched_item.category_confidence,
                    "category_reason": enriched_item.category_reason,
                    "classification_status": enriched_item.classification_status,
                    "classification_raw": enriched_item.classification_raw,
                    "quality_score": enriched_item.quality_score,
                    "quality_reason": enriched_item.quality_reason,
                    "quality_level": quality_level,
                    "quality_details": quality_details,
                    "classification_error": enriched_item.classification_error,
                    "input_snapshot": input_snapshot,
                }
            )
            self._emit_progress(
                progress_callback,
                self._progress_in_range(89, 98, index, total),
                f"分类最终镜头 {index}/{total}",
            )
        repository.save_shot_classifications(
            run_id=classification_run_id,
            video_id=video_id,
            taxonomy_version=taxonomy_version,
            prompt_version=prompt_version,
            model_name=model_name,
            model_version=model_version,
            records=records,
        )
        repository.complete_analysis_run(
            classification_run_id,
            "completed_with_errors" if summary.classification_failures else "completed",
        )
        return enriched

    def _classification_samples_from_candidates(
        self,
        store: VideoOutputStore,
        final_shot: FinalShotRecord,
        candidates: list[ShotRecord],
        extractor: CandidateSampleExtractor,
    ) -> list[object]:
        """Reuse the dense candidate evidence that was already extracted.

        A semantic shot can merge several physical candidates.  In that case
        every candidate's normal (non-speech) samples are passed in order so
        the model sees the full transition.  Missing legacy samples are
        generated once with the same adaptive cadence; no extra video decode
        is performed when the persisted JPEGs are available.
        """
        result = []
        for candidate in candidates:
            sample_dir = store.video_dir / "candidate_samples" / f"candidate_{candidate.shot_index:04d}"
            paths = sorted(
                path for path in sample_dir.glob("sample_*.jpg") if not path.name.endswith("_mouth.jpg")
            )
            if paths:
                positions = extractor.positions_ms(candidate)
                for index, path in enumerate(paths):
                    timestamp_ms = positions[index] if index < len(positions) else candidate.start_ms
                    result.append(
                        FinalShotVisualSample(
                            label=f"candidate_{candidate.shot_index:04d}_sample_{index:04d}",
                            offset_ms=max(0, timestamp_ms - final_shot.start_ms),
                            path=path,
                        )
                    )
                continue

            # Historical folders may have thumbnails but no candidate_samples.
            # Extract using the existing sampler's short/long cadence and cache
            # the result in the standard candidate_samples directory.
            try:
                source, offset = self._source_for_candidate(store, candidate)
                generated = extractor.extract(candidate, source_path=source, source_offset_ms=offset)
            except Exception as exc:
                store.log(
                    "final_shot_candidate_visual_samples_failed",
                    level="WARNING",
                    final_shot_id=final_shot.final_shot_id,
                    candidate_segment_id=candidate.shot_id,
                    error=str(exc),
                )
                continue
            for index, sample in enumerate(generated):
                result.append(
                    FinalShotVisualSample(
                        label=f"candidate_{candidate.shot_index:04d}_sample_{index:04d}",
                        offset_ms=max(0, sample.timestamp_ms - final_shot.start_ms),
                        path=sample.path,
                    )
                )
        if result:
            store.log(
                "final_shot_candidate_visual_samples_ready",
                final_shot_id=final_shot.final_shot_id,
                candidate_count=len(candidates),
                sample_count=len(result),
                merged=len(candidates) > 1,
            )
        return result

    def _speech_for_candidate(
        self,
        store: VideoOutputStore,
        extractor: CandidateAudioExtractor,
        candidate: ShotRecord | None,
        cache: dict[str, SpeechEvidence],
    ) -> SpeechEvidence | None:
        if candidate is None:
            return None
        if candidate.shot_id in cache:
            return cache[candidate.shot_id]
        if not self.config.speech.enabled or self.speech_analyzer is None:
            evidence = SpeechEvidence(candidate.shot_id, has_audio=False, error_message="speech analysis disabled")
            cache[candidate.shot_id] = evidence
            return evidence
        source, offset = self._source_for_candidate(store, candidate)
        try:
            audio_path = extractor.extract(candidate, source_path=source, source_offset_ms=offset)
            transcript = self.speech_analyzer.transcribe(audio_path)
            evidence = SpeechEvidence(
                candidate_segment_id=candidate.shot_id,
                has_audio=True,
                transcript=transcript,
                speech_start_ms=candidate.start_ms if transcript else None,
                speech_end_ms=candidate.end_ms if transcript else None,
                confidence=0.75 if transcript else 0.0,
            )
            store.log(
                "candidate_speech_analyzed",
                candidate_segment_id=candidate.shot_id,
                speech_detected=evidence.speech_detected,
                transcript_length=len(transcript),
            )
        except Exception as exc:
            self._speech_fallbacks += 1
            evidence = SpeechEvidence(
                candidate_segment_id=candidate.shot_id,
                has_audio=True,
                error_message=str(exc),
            )
            store.log(
                "candidate_speech_fallback",
                level="ERROR",
                candidate_segment_id=candidate.shot_id,
                error=str(exc),
            )
        cache[candidate.shot_id] = evidence
        return evidence

    def _analyze_candidate(
        self,
        store: VideoOutputStore,
        extractor: CandidateSampleExtractor,
        candidate: ShotRecord,
        previous: ShotRecord | None,
        current_speech: SpeechEvidence,
        previous_speech: SpeechEvidence | None,
        samples_by_id: dict[tuple[str, bool], list[CandidateSample]],
    ) -> tuple[CandidateDecision, bool]:
        """Analyze one candidate; safe to run concurrently with other candidates."""
        speech_mode = current_speech.speech_detected or bool(
            previous_speech and previous_speech.speech_detected
        )
        current_samples = self._samples_for_candidate(
            store,
            extractor,
            candidate,
            samples_by_id,
            speech_mode=speech_mode,
        )
        # The vision model makes the speech classification from the same
        # transition payload as the scene/action decision.  Keep the sampled
        # sequence bounded so the request remains predictable.
        sequence = self._temporal_samples(current_samples, max_pairs=6)
        if previous is not None:
            previous_samples = self._samples_for_candidate(
                store,
                extractor,
                previous,
                samples_by_id,
                speech_mode=speech_mode or bool(
                    previous_speech and previous_speech.speech_detected
                ),
            )
            # The current candidate needs dense frames for speech
            # classification; the previous candidate only needs a small
            # temporal/scene context window.
            sequence = self._representative_samples(previous_samples, limit=3) + sequence
        try:
            payload = self.analyzer.analyze_transition(
                previous,
                candidate,
                sequence,
                [item for item in (previous_speech, current_speech) if item is not None],
            )
            decision = parse_candidate_decision(payload, candidate.shot_id)
            decision, motion = enforce_mouth_motion_gate(
                decision,
                current_speech,
                current_samples,
                self.config.sampling.mouth_motion_threshold,
            )
            store.log(
                "candidate_mouth_motion_checked",
                candidate_segment_id=candidate.shot_id,
                mouth_motion_score=motion.score,
                comparable_pairs=motion.comparable_pairs,
                gated_speech_type=decision.speech_type,
            )
            return decision, False
        except Exception as exc:
            store.log(
                "candidate_decision_fallback",
                level="ERROR",
                candidate_segment_id=candidate.shot_id,
                error=str(exc),
            )
            return fallback_candidate_decision(candidate.shot_id, str(exc), False), True

    def _source_for_candidate(self, store: VideoOutputStore, candidate: ShotRecord) -> tuple[Path, int]:
        source = Path(candidate.source_path)
        offset = 0
        if candidate.clip_path and candidate.clip_status == "completed":
            physical_clip = store.video_dir / candidate.clip_path
            if physical_clip.exists():
                source = physical_clip
                offset = candidate.start_ms
        return source, offset

    def _samples_for_candidate(
        self,
        store: VideoOutputStore,
        extractor: CandidateSampleExtractor,
        candidate: ShotRecord,
        cache: dict[tuple[str, bool], list[CandidateSample]],
        speech_mode: bool = False,
    ) -> list[CandidateSample]:
        cache_key = (candidate.shot_id, speech_mode)
        if cache_key in cache:
            return cache[cache_key]
        source = Path(candidate.source_path)
        offset = 0
        if candidate.clip_path and candidate.clip_status == "completed":
            physical_clip = store.video_dir / candidate.clip_path
            if physical_clip.exists():
                source = physical_clip
                offset = candidate.start_ms
        samples = extractor.extract(
            candidate,
            source_path=source,
            source_offset_ms=offset,
            speech_mode=speech_mode,
        )
        cache[cache_key] = samples
        store.log(
            "candidate_samples_extracted",
            candidate_segment_id=candidate.shot_id,
            sample_count=len(samples),
            speech_mode=speech_mode,
            source_path=str(source),
        )
        return samples

    @staticmethod
    def _representative_samples(samples: list[CandidateSample], limit: int = 9) -> list[CandidateSample]:
        """Keep model payloads small while covering the whole candidate."""
        if len(samples) <= limit:
            return samples
        last = len(samples) - 1
        return [samples[round(index * last / (limit - 1))] for index in range(limit)]

    @staticmethod
    def _temporal_samples(samples: list[CandidateSample], max_pairs: int = 6) -> list[CandidateSample]:
        """Select adjacent frame pairs while covering the candidate range."""
        if len(samples) <= max_pairs * 2:
            return samples
        pair_starts = FinalShotPipeline._evenly_spaced_indices(len(samples) - 1, max_pairs)
        selected: list[CandidateSample] = []
        for start in pair_starts:
            selected.extend((samples[start], samples[start + 1]))
        return selected

    @staticmethod
    def _evenly_spaced_indices(length: int, count: int) -> list[int]:
        if length <= 0 or count <= 0:
            return []
        if count == 1:
            return [0]
        if length <= count:
            return list(range(length))
        last = length - 1
        return [round(index * last / (count - 1)) for index in range(count)]

    def _prefetch_speech_evidence(
        self,
        store: VideoOutputStore,
        extractor: CandidateAudioExtractor,
        candidates: list[ShotRecord],
        cache: dict[str, SpeechEvidence],
        progress_callback: ProgressCallback | None = None,
    ) -> None:
        """Transcribe candidates concurrently before sequential visual analysis."""
        pending = [candidate for candidate in candidates if candidate.shot_id not in cache]
        if not pending:
            return
        worker_count = min(3, len(pending))
        with ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="speech") as pool:
            futures = {
                pool.submit(self._speech_for_candidate, store, extractor, candidate, cache): candidate
                for candidate in pending
            }
            completed = 0
            for future in as_completed(futures):
                future.result()
                completed += 1
                self._emit_progress(
                    progress_callback,
                    self._progress_in_range(49, 52, completed, len(pending)),
                    f"提取口播证据 {completed}/{len(pending)}",
                )

    def _export_clips(
        self,
        store: VideoOutputStore,
        final_shots: list[FinalShotRecord],
        with_clips: bool,
        summary: FinalShotSummary,
        progress_callback: ProgressCallback | None = None,
    ) -> list[FinalShotRecord]:
        if not with_clips:
            return final_shots
        generator = self.clip_generator_cls(store.final_shots_dir, self.config.clip)
        exported: list[FinalShotRecord] = []
        total = len(final_shots)
        for index, final_shot in enumerate(final_shots, start=1):
            try:
                clip_path, _ = self._clip_with_retry(
                    generator,
                    store,
                    final_shot,
                    final_clip_filename(final_shot, index),
                )
                exported.append(replace(final_shot, clip_path=clip_path, clip_status="completed"))
                summary.clips_completed += 1
            except Exception as exc:
                summary.clip_failures += 1
                store.log("final_shot_clip_failed", level="ERROR", final_shot_id=final_shot.final_shot_id, error=str(exc))
                exported.append(replace(final_shot, clip_status="failed", clip_error=str(exc)))
            self._emit_progress(
                progress_callback,
                self._progress_in_range(72, 88, index, total),
                f"生成成品片段 {index}/{total}",
            )
        return exported

    def _clip_with_retry(
        self,
        generator: ClipGenerator,
        store: VideoOutputStore,
        final_shot: FinalShotRecord,
        filename: str,
    ) -> tuple[str, int]:
        boundary = ShotBoundary(0, 0, final_shot.start_ms, final_shot.end_ms)
        last_error: Exception | None = None
        for attempt in range(self.config.clip_retries + 1):
            try:
                generated_path, duration_ms = generator.generate_to(
                    Path(final_shot.source_path),
                    store.final_shots_dir,
                    filename,
                    boundary,
                )
                return store.clip_reference(store.final_shots_dir / generated_path), duration_ms
            except Exception as exc:
                last_error = exc
                store.log(
                    "final_shot_clip_retry",
                    level="ERROR",
                    final_shot_id=final_shot.final_shot_id,
                    attempt=attempt + 1,
                    error=str(exc),
                )
        raise RuntimeError(str(last_error or "final shot clip generation failed")) from last_error

    @staticmethod
    def _infer_output_root(database_path: Path) -> Path:
        parent = database_path.parent
        if parent.name.startswith("video_"):
            return parent.parent.parent if parent.parent.name == "videos" else parent.parent
        if parent.parent.name.startswith("video_"):
            return parent.parent.parent
        return parent

    @staticmethod
    def _progress_in_range(start: int, end: int, completed: int, total: int) -> int:
        if total <= 0:
            return end
        completed = max(0, min(completed, total))
        if start >= end:
            return end
        return min(end, max(start, start + round((completed / total) * (end - start))))

    @staticmethod
    def _emit_progress(progress_callback: ProgressCallback | None, progress: int, stage: str) -> None:
        if progress_callback is None:
            return
        try:
            progress_callback(max(0, min(progress, 99)), stage)
        except Exception:
            return
