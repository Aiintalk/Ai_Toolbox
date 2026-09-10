from __future__ import annotations

from pathlib import Path


VIDEO_EXTENSIONS = frozenset({".avi", ".m4v", ".mkv", ".mov", ".mp4", ".ts", ".webm"})


class VideoDiscovery:
    def __init__(self, extensions: frozenset[str] = VIDEO_EXTENSIONS):
        self.extensions = extensions

    def discover(self, root: Path) -> list[Path]:
        root = root.expanduser().resolve()
        if not root.exists():
            raise FileNotFoundError(f"Input directory does not exist: {root}")
        if root.is_file():
            if root.suffix.lower() not in self.extensions:
                raise ValueError(f"Input file is not a supported video: {root}")
            return [root]
        if not root.is_dir():
            raise NotADirectoryError(f"Input path is not a directory: {root}")

        return sorted(
            path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in self.extensions
        )
