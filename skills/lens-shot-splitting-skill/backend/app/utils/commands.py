from __future__ import annotations

import os
import platform
import shutil
import subprocess
from collections.abc import Sequence
from pathlib import Path

from app.core.config import settings


def _configured_command_path(command: str) -> str | None:
    if command == "ffmpeg":
        candidates = [settings.ffmpeg_path, os.getenv("FFMPEG_PATH")]
    elif command == "ffprobe":
        candidates = [settings.ffprobe_path, os.getenv("FFPROBE_PATH")]
    else:
        candidates = []

    for raw_value in candidates:
        if not raw_value:
            continue
        for item in str(raw_value).split(os.pathsep):
            direct_path = Path(item.strip()).expanduser()
            if direct_path.exists() and direct_path.is_file():
                return str(direct_path)
            for exe_name in (command, f"{command}.exe"):
                candidate_path = direct_path / exe_name
                if candidate_path.exists():
                    return str(candidate_path)
    return None


def resolve_executable(command: str) -> str:
    """Resolve bundled media tools even when a GUI-launched process has a minimal PATH."""
    configured = _configured_command_path(command)
    if configured:
        return configured

    resolved = shutil.which(command)
    if resolved:
        return resolved

    # GUI/服务环境有时不会继承完整 PATH。
    # 优先使用环境变量显式指向的路径（例如 FFmpeg 安装目录）。
    env_key = f"{command.upper()}_PATH"
    env_override = os.getenv(env_key)
    if env_override:
        for directory in env_override.split(os.pathsep):
            direct_path = Path(directory.strip()).expanduser()
            if direct_path.exists() and direct_path.is_file():
                return str(direct_path)
            for exe_name in (command, f"{command}.exe"):
                candidate_path = direct_path / exe_name
                if candidate_path.exists():
                    return str(candidate_path)

    # Windows installs commonly expose only .exe binaries and some desktop
    # deployments keep them outside PATH for service processes.
    if platform.system() == "Windows" and command in {"ffmpeg", "ffprobe"}:
        for candidate in (f"{command}.exe",):
            resolved = shutil.which(candidate)
            if resolved:
                return resolved
        for directory in (
            r"C:\ffmpeg\bin",
            r"C:\Program Files\ffmpeg\bin",
            r"C:\Program Files (x86)\ffmpeg\bin",
            str(Path.home() / "ffmpeg" / "bin"),
        ):
            candidate_path = Path(directory) / f"{command}.exe"
            if candidate_path.exists():
                return str(candidate_path)
        for directory in (
            os.path.expandvars(r"%ProgramData%\\chocolatey\\bin"),
            os.path.expandvars(r"%ProgramData%\\chocoportable\\bin"),
            os.path.expandvars(r"%ProgramFiles%\\ffmpeg\\bin"),
            os.path.expandvars(r"%LOCALAPPDATA%\\Microsoft\\WinGet\\Packages"),
            os.path.expandvars(r"%USERPROFILE%\\AppData\\Local\\Microsoft\\WinGet\\Packages"),
        ):
            candidate_path = Path(directory) / f"{command}.exe"
            if candidate_path.exists():
                return str(candidate_path)
            if Path(directory).exists():
                matches = list(Path(directory).rglob(f"{command}.exe"))
                if matches:
                    return str(matches[0])

    if command in {"ffmpeg", "ffprobe"}:
        for directory in ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"):
            candidate = f"{directory}/{command}"
            if shutil.which(candidate):
                return candidate
    return command


class ExternalCommandError(RuntimeError):
    def __init__(self, command: Sequence[str], returncode: int, stderr: str):
        self.command = tuple(command)
        self.returncode = returncode
        self.stderr = stderr.strip()
        command_text = " ".join(self.command)
        message = f"Command failed with exit code {returncode}: {command_text}"
        if self.stderr:
            message = f"{message}\n{self.stderr}"
        super().__init__(message)


def run_command(command: Sequence[str]) -> str:
    command = [resolve_executable(str(command[0])), *list(command[1:])]
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            # FFmpeg emits UTF-8 on the Windows build we ship.  Without an
            # explicit codec, Python uses the console code page (usually GBK),
            # which can raise UnicodeDecodeError while reading stderr and abort
            # an otherwise valid analysis job.
            encoding="utf-8",
            errors="replace",
            check=False,
        )
    except FileNotFoundError as exc:
        raise ExternalCommandError(command, -1, str(exc)) from exc
    if result.returncode != 0:
        raise ExternalCommandError(command, result.returncode, result.stderr)
    return result.stdout
