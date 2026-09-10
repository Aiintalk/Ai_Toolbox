from __future__ import annotations

import os
from collections.abc import Iterable


def qwen_api_key_candidates(
    requested_env: str | None,
    fallback_envs: Iterable[str] = (),
) -> list[str]:
    """Build a deterministic, deduplicated API-key environment candidate list."""
    candidates: list[str] = []
    if requested_env:
        candidates.append(requested_env)
    for env_name in fallback_envs:
        if env_name and env_name not in candidates:
            candidates.append(env_name)
    for env_name in ("QWEN_API_KEY", "DASHSCOPE_API_KEY"):
        if env_name not in candidates:
            candidates.append(env_name)
    return candidates


def resolve_qwen_api_key(
    api_key: str | None,
    requested_env: str | None,
    fallback_envs: Iterable[str] = (),
) -> str | None:
    """Return the first non-empty API key from explicit value or env candidates."""
    if api_key:
        stripped = api_key.strip()
        if stripped:
            return stripped
    for env_name in qwen_api_key_candidates(requested_env, fallback_envs):
        value = os.getenv(env_name)
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned:
                return cleaned
    return None


def qwen_api_key_prompt(requested_env: str | None, fallback_envs: Iterable[str] = ()) -> str:
    """Render user-facing environment variable guidance."""
    names = qwen_api_key_candidates(requested_env, fallback_envs)
    return ", ".join(f"{name}" for name in names)
