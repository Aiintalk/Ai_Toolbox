from __future__ import annotations

from pathlib import Path
from typing import Callable, Sequence

from app.models.shot import ShotRecord
from app.utils.commands import run_command


CommandRunner = Callable[[Sequence[str]], str]


class SpeechAudioExtractionError(RuntimeError):
    pass


class CandidateAudioExtractor:
    """Extract a small, normalized audio file for ASR without changing source media."""

    def __init__(self, output_dir: Path, runner: CommandRunner = run_command):
        self.output_dir = output_dir.expanduser().resolve()
        self.runner = runner

    def extract(
        self,
        candidate: ShotRecord,
        source_path: Path | None = None,
        source_offset_ms: int = 0,
    ) -> Path:
        source = (source_path or Path(candidate.source_path)).expanduser().resolve()
        audio_dir = self.output_dir / "speech_audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        audio_path = audio_dir / f"candidate_{candidate.shot_index:04d}.wav"
        relative_start_ms = max(0, candidate.start_ms - source_offset_ms)
        try:
            self.runner(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-i", str(source),
                    "-ss", f"{relative_start_ms / 1000:.3f}",
                    "-t", f"{candidate.duration_ms / 1000:.3f}",
                    "-vn",
                    "-ac", "1",
                    "-ar", "16000",
                    "-c:a", "pcm_s16le",
                    str(audio_path),
                ]
            )
        except Exception as exc:
            raise SpeechAudioExtractionError(str(exc)) from exc
        if not audio_path.exists() or audio_path.stat().st_size <= 44:
            raise SpeechAudioExtractionError(f"FFmpeg did not create usable audio: {audio_path}")
        return audio_path
