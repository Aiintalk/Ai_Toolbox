from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import threading
from typing import Callable, Sequence

import cv2
import numpy as np

from app.core.final_shot_config import FinalShotSamplingConfig
from app.models.shot import ShotRecord
from app.utils.commands import run_command


CommandRunner = Callable[[Sequence[str]], str]

_FACE_MODEL_PATH = Path(__file__).resolve().parents[1] / "assets" / "face_detection_yunet_2023mar.onnx"
_FACE_DETECTOR_LOCAL = threading.local()


@dataclass(frozen=True, slots=True)
class CandidateSample:
    candidate_segment_id: str
    sample_index: int
    timestamp_ms: int
    relative_ms: int
    path: Path
    mouth_path: Path | None = None


def _face_detector(frame):
    if not hasattr(cv2, "FaceDetectorYN_create"):
        return None
    model_path = Path(os.getenv("LENS_FACE_MODEL_PATH", str(_FACE_MODEL_PATH))).expanduser()
    if not model_path.exists():
        return None
    height, width = frame.shape[:2]
    cache = getattr(_FACE_DETECTOR_LOCAL, "detectors", None)
    if cache is None:
        cache = {}
        _FACE_DETECTOR_LOCAL.detectors = cache
    key = (str(model_path), width, height)
    detector = cache.get(key)
    if detector is None:
        detector = cv2.FaceDetectorYN_create(
            str(model_path), "", (width, height), 0.6, 0.3, 5000
        )
        cache[key] = detector
    return detector


def mouth_crop_from_frame(frame):
    """Return a mouth crop from detected face landmarks, or ``None``.

    A fixed normalized rectangle is unsafe for split-screen, product and
    hands-on demonstrations.  YuNet supplies face boxes and mouth-corner
    landmarks; if more than one similarly sized face is visible, the frame is
    considered ambiguous and no crop is produced rather than guessing.
    """
    if frame is None or getattr(frame, "size", 0) == 0:
        return None
    height, width = frame.shape[:2]
    if height <= 0 or width <= 0:
        return None
    detector = _face_detector(frame)
    if detector is None:
        return None
    try:
        detector.setInputSize((width, height))
        _, faces = detector.detect(frame)
    except cv2.error:
        return None
    if faces is None:
        return None
    candidates = []
    for face in np.asarray(faces):
        x, y, face_width, face_height, score = [float(value) for value in face[:5]]
        if score < 0.6 or face_width < 48 or face_height < 48:
            continue
        mouth_right = np.asarray(face[10:12], dtype=float)
        mouth_left = np.asarray(face[12:14], dtype=float)
        if not np.all(np.isfinite([*mouth_right, *mouth_left])):
            continue
        mouth_width = float(np.linalg.norm(mouth_right - mouth_left))
        if mouth_width < max(8.0, face_width * 0.08):
            continue
        candidates.append((face_width * face_height, score, mouth_right, mouth_left, (x, y, face_width, face_height)))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    if len(candidates) > 1:
        largest_area = candidates[0][0]
        second_area = candidates[1][0]
        # Similar-sized faces are common in split-screen/product demos.  Do
        # not select one arbitrarily because its motion would be misleading.
        if second_area >= largest_area * 0.55:
            return None
    _, _, mouth_right, mouth_left, (face_x, face_y, face_width, face_height) = candidates[0]
    mouth_center = (mouth_right + mouth_left) / 2.0
    mouth_width = float(np.linalg.norm(mouth_right - mouth_left))
    pad_x = max(mouth_width * 1.7, face_width * 0.16)
    pad_y = max(mouth_width * 1.35, face_height * 0.12)
    face_x1 = max(0, int(round(face_x)))
    face_y1 = max(0, int(round(face_y)))
    face_x2 = min(width, int(round(face_x + face_width)))
    face_y2 = min(height, int(round(face_y + face_height)))
    x1 = max(face_x1, int(round(mouth_center[0] - pad_x)))
    x2 = min(face_x2, int(round(mouth_center[0] + pad_x)))
    y1 = max(face_y1, int(round(mouth_center[1] - pad_y)))
    y2 = min(face_y2, int(round(mouth_center[1] + pad_y)))
    if x2 <= x1 or y2 <= y1:
        return None
    return frame[y1:y2, x1:x2]


class CandidateSampleExtractor:
    def __init__(self, output_dir: Path, config: FinalShotSamplingConfig, runner: CommandRunner = run_command):
        self.output_dir = output_dir.expanduser().resolve()
        self.config = config
        self.runner = runner

    def positions_ms(self, candidate: ShotRecord, speech_mode: bool = False) -> list[int]:
        duration = max(0, candidate.duration_ms)
        if duration <= 0:
            return [candidate.start_ms]
        safe = min(self.config.short_safe_offset_ms, max(1, duration // 5))
        lower = candidate.start_ms + safe
        upper = max(lower, candidate.end_ms - safe)
        if speech_mode:
            positions: list[int] = []
            # Short speech candidates are where a single static-looking frame
            # most often masquerades as lip motion.  Sample them at twice the
            # normal cadence so the temporal gate can observe an actual
            # open/close transition.  Keep the existing cap as the request
            # bound for longer candidates.
            interval = self.config.speech_interval_ms
            if duration <= self.config.short_candidate_threshold_ms:
                interval = max(25, interval // 2)
            timestamp = lower
            while timestamp <= upper:
                positions.append(timestamp)
                timestamp += interval
            positions.extend([
                candidate.start_ms,
                candidate.start_ms + duration // 2,
                upper,
            ])
            if len(positions) > self.config.max_speech_samples_per_candidate:
                positions = self._evenly_sample(
                    positions,
                    self.config.max_speech_samples_per_candidate,
                )
            return self._unique(positions, candidate.start_ms, candidate.end_ms)
        if duration <= self.config.short_candidate_threshold_ms:
            middle = candidate.start_ms + duration // 2
            return self._unique(
                [min(lower, middle), middle, max(upper, middle)],
                candidate.start_ms,
                candidate.end_ms,
            )

        positions: list[int] = []
        timestamp = lower
        while timestamp <= upper:
            positions.append(timestamp)
            timestamp += self.config.interval_ms
        if len(positions) > self.config.max_samples_per_candidate:
            positions = self._evenly_sample(positions, self.config.max_samples_per_candidate)
        return self._unique(positions or [candidate.start_ms + duration // 2], candidate.start_ms, candidate.end_ms)

    @staticmethod
    def _evenly_sample(positions: list[int], limit: int) -> list[int]:
        if len(positions) <= limit:
            return positions
        last = len(positions) - 1
        return [positions[round(index * last / (limit - 1))] for index in range(limit)]

    @staticmethod
    def _unique(positions: list[int], start_ms: int, end_ms: int) -> list[int]:
        result: list[int] = []
        for position in positions:
            bounded = min(max(position, start_ms), end_ms)
            if not result or bounded > result[-1]:
                result.append(bounded)
        return result

    def extract(
        self,
        candidate: ShotRecord,
        source_path: Path | None = None,
        source_offset_ms: int = 0,
        speech_mode: bool = False,
    ) -> list[CandidateSample]:
        source = (source_path or Path(candidate.source_path)).expanduser().resolve()
        sample_dir = self.output_dir / "candidate_samples" / f"candidate_{candidate.shot_index:04d}"
        if speech_mode:
            sample_dir = sample_dir / "speech"
        sample_dir.mkdir(parents=True, exist_ok=True)
        samples: list[CandidateSample] = []
        for sample_index, timestamp_ms in enumerate(self.positions_ms(candidate, speech_mode=speech_mode)):
            path = sample_dir / f"sample_{sample_index:04d}.jpg"
            self.runner(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-ss", f"{max(0, timestamp_ms - source_offset_ms) / 1000:.3f}",
                    # Fast seek is important here: candidates can contain
                    # dozens of samples and accurate post-input seeking would
                    # decode the source from the beginning for every frame.
                    "-i", str(source),
                    "-frames:v", "1",
                    "-vf", f"scale={self.config.width}:-2",
                    "-q:v", str(self.config.quality),
                    str(path),
                ]
            )
            if not path.exists():
                raise RuntimeError(f"FFmpeg did not create candidate sample: {path}")
            mouth_path = sample_dir / f"sample_{sample_index:04d}_mouth.jpg"
            decoded = cv2.imread(str(path))
            mouth_crop = mouth_crop_from_frame(decoded)
            if mouth_crop is not None and cv2.imwrite(str(mouth_path), mouth_crop):
                saved_mouth_path: Path | None = mouth_path
            else:
                saved_mouth_path = None
            samples.append(
                CandidateSample(
                    candidate.shot_id,
                    sample_index,
                    timestamp_ms,
                    timestamp_ms - candidate.start_ms,
                    path,
                    saved_mouth_path,
                )
            )
        return samples
