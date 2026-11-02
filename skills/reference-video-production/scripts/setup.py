#!/usr/bin/env python3
"""Install the small runtime dependencies outside the shareable Skill folder."""
from pathlib import Path
import os
import subprocess
import sys
import venv


def main():
    root = Path(os.environ.get("REFERENCE_VIDEO_RUNTIME_HOME", Path.home() / ".reference-video-production"))
    target = root / "venv"
    if not target.exists():
        venv.EnvBuilder(with_pip=True).create(target)
    python = target / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([str(python), "-m", "pip", "install", "keyring>=25,<27", "tos>=2.8,<3", "imageio-ffmpeg>=0.6,<1"], check=True)
    print(f"运行环境就绪：{python}")
    print("下一步：python scripts/run.py configure --all")


if __name__ == "__main__":
    main()
