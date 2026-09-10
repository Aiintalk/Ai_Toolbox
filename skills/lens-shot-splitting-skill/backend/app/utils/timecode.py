from __future__ import annotations

from collections.abc import Iterable
from numbers import Real

from app.models.shot import ShotBoundary


def seconds_to_ms(seconds: float) -> int:
    return max(0, int(round(seconds * 1000)))


def timecode_to_ms(value: object) -> int:
    if hasattr(value, "seconds"):
        seconds = float(value.seconds)
    elif hasattr(value, "get_seconds"):
        seconds = float(value.get_seconds())
    elif isinstance(value, Real):
        seconds = float(value)
    else:
        raise TypeError(f"Unsupported timecode value: {type(value)!r}")
    return seconds_to_ms(seconds)


def normalize_boundaries(
    boundaries: Iterable[ShotBoundary],
    duration_ms: int,
) -> list[ShotBoundary]:
    """Keep detected boundaries inside the source duration and cover its tail."""
    duration_ms = max(0, duration_ms)
    normalized: list[ShotBoundary] = []

    for boundary in boundaries:
        start_ms = min(duration_ms, max(0, boundary.start_ms))
        end_ms = min(duration_ms, max(start_ms, boundary.end_ms))
        if end_ms > start_ms:
            normalized.append(
                ShotBoundary(
                    start_frame=boundary.start_frame,
                    end_frame=boundary.end_frame,
                    start_ms=start_ms,
                    end_ms=end_ms,
                )
            )

    if not normalized:
        return [ShotBoundary(start_frame=0, end_frame=0, start_ms=0, end_ms=duration_ms)] if duration_ms else []

    first = normalized[0]
    normalized[0] = ShotBoundary(
        start_frame=first.start_frame,
        end_frame=first.end_frame,
        start_ms=0,
        end_ms=first.end_ms,
    )
    last = normalized[-1]
    normalized[-1] = ShotBoundary(
        start_frame=last.start_frame,
        end_frame=last.end_frame,
        start_ms=last.start_ms,
        end_ms=duration_ms,
    )
    return normalized
