from __future__ import annotations

import logging
from pathlib import Path

from scenedetect import ContentDetector, SceneManager, open_video
from scenedetect.detectors import AdaptiveDetector

from app.core.scan_config import DetectionConfig
from app.models.shot import ShotBoundary
from app.utils.timecode import timecode_to_ms


logger = logging.getLogger("uvicorn.error")


class PySceneDetector:
    name = "PySceneDetect"

    def __init__(self, config: DetectionConfig):
        self.config = config

    def detect(self, video_path: Path) -> list[ShotBoundary]:
        logger.info("scene detection started: %s", video_path.name)
        video = open_video(str(video_path))
        try:
            scene_manager = SceneManager()
            scene_manager.auto_downscale = self.config.auto_downscale
            if self.config.downscale is not None:
                scene_manager.downscale = self.config.downscale
            weights = ContentDetector.Components(
                delta_hue=self.config.weights[0],
                delta_sat=self.config.weights[1],
                delta_lum=self.config.weights[2],
                delta_edges=self.config.weights[3],
            )
            if self.config.detector == "adaptive":
                detector = AdaptiveDetector(
                    adaptive_threshold=self.config.threshold,
                    min_scene_len=self.config.min_scene_len,
                    window_width=self.config.window_width,
                    min_content_val=self.config.min_content_val,
                    weights=weights,
                )
            else:
                detector = ContentDetector(
                    threshold=self.config.threshold,
                    min_scene_len=self.config.min_scene_len,
                    weights=weights,
                )
            scene_manager.add_detector(detector)
            processed_frames = scene_manager.detect_scenes(video=video, frame_skip=self.config.frame_skip)
            scenes = scene_manager.get_scene_list(start_in_scene=True)
            logger.info(
                "scene detection completed: file=%s frames=%s scenes=%s",
                video_path.name,
                processed_frames,
                len(scenes),
            )
            boundaries = [
                ShotBoundary(
                    start_frame=int(start.frame_num),
                    end_frame=int(end.frame_num),
                    start_ms=timecode_to_ms(start),
                    end_ms=timecode_to_ms(end),
                )
                for start, end in scenes
            ]
            if boundaries:
                return [boundary for boundary in boundaries if boundary.end_ms > boundary.start_ms]

            duration = getattr(video, "duration", None)
            duration_ms = timecode_to_ms(duration) if duration is not None else 0
            duration_frames = int(getattr(duration, "frame_num", 0)) if duration is not None else 0
            return (
                [ShotBoundary(0, duration_frames, 0, duration_ms)]
                if duration_ms > 0
                else []
            )
        finally:
            close = getattr(video, "close", None)
            if close is not None:
                close()
