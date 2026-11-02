#!/usr/bin/env python3
"""Expose the bundled FFmpeg executable without a separate machine install."""
import subprocess
import sys


def main():
    try:
        import imageio_ffmpeg
    except ImportError as e:
        raise SystemExit("请先运行 python scripts/setup.py 安装视频处理依赖。") from e
    executable = imageio_ffmpeg.get_ffmpeg_exe()
    raise SystemExit(subprocess.call([executable, *sys.argv[1:]]))


if __name__ == "__main__":
    main()
