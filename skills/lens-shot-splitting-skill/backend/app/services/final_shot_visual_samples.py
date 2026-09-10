"""Extract traceable visual evidence for one already-cut final shot."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2

from app.services.media_library import resolve_storage_reference


@dataclass(frozen=True, slots=True)
class FinalShotVisualSample:
    label: str
    offset_ms: int
    path: Path


class FinalShotVisualSampler:
    """Save start/middle/end frames alongside the corresponding finished clip."""

    def __init__(self, width: int = 768, quality: int = 3):
        self.width = width
        self.quality = quality

    def extract(self, clip_reference: str, duration_ms: int) -> list[FinalShotVisualSample]:
        clip_path = resolve_storage_reference(clip_reference)
        if not clip_path.is_file():
            raise FileNotFoundError(f"Finished clip is unavailable for visual classification: {clip_path}")
        samples_dir = clip_path.parent.parent / "classification_samples" / clip_path.stem
        samples_dir.mkdir(parents=True, exist_ok=True)
        positions = self._positions(duration_ms)
        capture = cv2.VideoCapture(str(clip_path))
        if not capture.isOpened():
            raise RuntimeError(f"OpenCV could not open finished clip: {clip_path}")
        try:
            samples: list[FinalShotVisualSample] = []
            for label, offset_ms in positions:
                output_path = samples_dir / f"{label}.jpg"
                # Always refresh evidence. A repaired/replaced clip must never
                # reuse JPEGs extracted from an older file at the same path.
                capture.set(cv2.CAP_PROP_POS_MSEC, float(offset_ms))
                success, frame = capture.read()
                if not success or frame is None:
                    raise RuntimeError(f"Could not extract {label} frame from: {clip_path}")
                height, width = frame.shape[:2]
                if width > self.width:
                    scaled_height = max(1, round(height * self.width / width))
                    frame = cv2.resize(frame, (self.width, scaled_height), interpolation=cv2.INTER_AREA)
                if not cv2.imwrite(str(output_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85]):
                    raise RuntimeError(f"Could not save visual classification frame: {output_path}")
                samples.append(FinalShotVisualSample(label, offset_ms, output_path))
            return samples
        finally:
            capture.release()

    @staticmethod
    def _positions(duration_ms: int) -> list[tuple[str, int]]:
        duration = max(1, duration_ms)
        safe = max(0, min(250, duration // 8))
        return [
            ("start", safe),
            ("middle", duration // 2),
            ("end", max(safe, duration - safe)),
        ]
