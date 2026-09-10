from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.core.final_shot_config import load_final_shot_config
from app.services.final_shot_pipeline import FinalShotPipeline


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[2] / "config" / "final_shot.yaml"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lens Analysis final semantic shot builder")
    parser.add_argument("--input-db", required=True, type=Path, help="SQLite database containing candidate segments")
    parser.add_argument("--video-id", help="Process only one video")
    parser.add_argument("--candidate-segment-id", help="Re-analyze one candidate and rebuild its video final shots")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH, help=f"YAML config path (default: {DEFAULT_CONFIG_PATH})")
    parser.add_argument("--force", action="store_true", help="Re-analyze all candidate transitions")
    parser.add_argument(
        "--with-clips",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Export final shot MP4 files (default: true)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    config = load_final_shot_config(args.config)
    summary = FinalShotPipeline(config).run(
        database_path=args.input_db,
        video_id=args.video_id,
        candidate_segment_id=args.candidate_segment_id,
        force=args.force,
        with_clips=args.with_clips,
    )
    print(json.dumps(summary.as_dict(), ensure_ascii=False, indent=2))
    return int(bool(summary.failed_videos or summary.clip_failures))


if __name__ == "__main__":
    raise SystemExit(main())
