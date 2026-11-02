#!/usr/bin/env python3
"""Run the bundled Ark client in the Skill's private virtual environment."""
from pathlib import Path
import os
import subprocess
import sys


def main():
    root = Path(os.environ.get("REFERENCE_VIDEO_RUNTIME_HOME", Path.home() / ".reference-video-production"))
    python = root / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.exists():
        print("先运行 python scripts/setup.py 安装运行依赖。", file=sys.stderr)
        raise SystemExit(2)
    if len(sys.argv) > 1 and sys.argv[1] == "ffmpeg":
        command = [str(python), str(Path(__file__).with_name("ffmpeg.py")), *sys.argv[2:]]
    else:
        command = [str(python), str(Path(__file__).with_name("ark.py")), *sys.argv[1:]]
    raise SystemExit(subprocess.call(command))


if __name__ == "__main__":
    main()
