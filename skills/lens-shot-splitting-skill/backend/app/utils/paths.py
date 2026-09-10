from __future__ import annotations

import hashlib
from pathlib import Path


def stable_asset_key(relative_path: str) -> str:
    digest = hashlib.sha1(relative_path.encode("utf-8")).hexdigest()[:12]
    return f"{Path(relative_path).stem[:48]}-{digest}"


def stable_video_id(relative_path: str) -> str:
    digest = hashlib.sha1(relative_path.encode("utf-8")).hexdigest()[:12]
    return f"video_{digest}"


def file_fingerprint(relative_path: str, size_bytes: int, mtime_ns: int) -> str:
    value = f"{relative_path}|{size_bytes}|{mtime_ns}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
