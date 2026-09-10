from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.core.scan_config import load_scan_config
from app.services.metadata_extractor import FFprobeMetadataExtractor
from app.services.scan_pipeline import ScanPipeline
from app.services.scene_detector import PySceneDetector
from app.services.video_discovery import VideoDiscovery


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[3] / "config" / "shot_detection.yaml"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lens Analysis shot splitting MVP")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Scan videos and export shot assets")
    scan_parser.add_argument("--input", required=True, type=Path, help="Recursive input video directory")
    scan_parser.add_argument("--output", required=True, type=Path, help="Output root directory")
    scan_parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help=f"YAML config path (default: {DEFAULT_CONFIG_PATH})",
    )
    scan_parser.add_argument(
        "--skip-completed",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Skip videos whose requested assets are already complete (default: true)",
    )
    scan_parser.add_argument("--force", action="store_true", help="Reprocess videos even when completed")
    asset_group = scan_parser.add_mutually_exclusive_group()
    asset_group.add_argument(
        "--thumbnails-only",
        action="store_true",
        help="Generate thumbnails without exporting shot videos (default)",
    )
    asset_group.add_argument(
        "--with-clips",
        action="store_true",
        help="Generate thumbnails and re-encoded shot MP4 files",
    )
    scan_parser.set_defaults(handler=run_scan)
    return parser


def run_scan(args: argparse.Namespace) -> int:
    config = load_scan_config(args.config)
    pipeline = ScanPipeline(
        discovery=VideoDiscovery(),
        metadata_extractor=FFprobeMetadataExtractor(),
        scene_detector=PySceneDetector(config.detection),
        config=config,
    )
    summary = pipeline.run(
        input_root=args.input,
        output_root=args.output,
        skip_completed=args.skip_completed,
        force=args.force,
        with_clips=args.with_clips,
    )
    print(json.dumps(summary.as_dict(), ensure_ascii=False, indent=2))
    return int(bool(summary.failed_videos or summary.thumbnail_failures or summary.clip_failures))


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.handler(args)
