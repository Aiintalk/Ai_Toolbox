from __future__ import annotations

"""Canonical locations for video files kept outside transient analysis runs."""

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
STORAGE_ROOT = PROJECT_ROOT / "storage"
MEDIA_ROOT = STORAGE_ROOT / "media"
ORIGINALS_ROOT = MEDIA_ROOT / "originals"
FINISHED_ROOT = MEDIA_ROOT / "finished"


def storage_reference(path: Path) -> str:
    """Store paths relative to ``storage`` so records remain portable."""
    return path.expanduser().resolve().relative_to(STORAGE_ROOT.resolve()).as_posix()


def resolve_storage_reference(reference: str | Path, analysis_dir: Path | None = None) -> Path:
    """Resolve a persisted storage path, retaining support for old run-relative paths."""
    path = Path(reference)
    if path.is_absolute():
        return path
    if path.parts and path.parts[0] in {"media", "archive"}:
        return STORAGE_ROOT / path
    if analysis_dir is not None:
        return analysis_dir / path
    return STORAGE_ROOT / path


def original_upload_path(job_id: str, filename: str) -> Path:
    """One immutable source file per submitted analysis job."""
    return ORIGINALS_ROOT / job_id / filename


def finished_video_dir(video_id: str) -> Path:
    """Return the one directory that holds every finished artifact for a video."""
    return FINISHED_ROOT / video_id
