from __future__ import annotations

import base64
import logging
import time
from pathlib import Path
from typing import Callable, Any

import httpx
from dotenv import load_dotenv

from app.core.final_shot_config import FinalShotSpeechConfig
from app.utils.qwen_api_key import qwen_api_key_prompt, resolve_qwen_api_key


class QwenSpeechClientError(RuntimeError):
    pass


logger = logging.getLogger("uvicorn.error")


Sleep = Callable[[float], None]


class QwenSpeechClient:
    """Transcribe candidate audio with Qwen ASR before visual sync classification."""

    def __init__(
        self,
        config: FinalShotSpeechConfig,
        api_key: str | None = None,
        client: httpx.Client | None = None,
        sleeper: Sleep = time.sleep,
    ):
        self.config = config
        load_dotenv(Path(__file__).resolve().parents[2] / ".env")
        self.api_key = resolve_qwen_api_key(api_key, config.api_key_env, ("QWEN_API_KEY",))
        self.client = client or httpx.Client(timeout=config.timeout_seconds)
        self._owns_client = client is None
        self.sleeper = sleeper
        self._api_key_hint = qwen_api_key_prompt(config.api_key_env, ("QWEN_API_KEY", "DASHSCOPE_API_KEY"))

    def transcribe(self, audio_path: Path) -> str:
        if not self.api_key:
            logger.error("qwen speech request skipped: API key is missing (%s)", self._api_key_hint)
            raise QwenSpeechClientError(f"Missing Qwen API key. Set one of: {self._api_key_hint}.")
        audio_path = audio_path.expanduser().resolve()
        encoded = base64.b64encode(audio_path.read_bytes()).decode("ascii")
        payload: dict[str, Any] = {
            "model": self.config.model_name,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {"data": f"data:audio/wav;base64,{encoded}"},
                        }
                    ],
                }
            ],
            "stream": False,
            "extra_body": {
                "asr_options": {
                    "language": self.config.language,
                    "enable_itn": False,
                }
            },
        }
        url = f"{self.config.base_url.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        last_error: Exception | None = None
        for attempt in range(self.config.max_retries + 1):
            try:
                logger.info(
                    "qwen speech request start: model=%s attempt=%s/%s file=%s",
                    self.config.model_name,
                    attempt + 1,
                    self.config.max_retries + 1,
                    audio_path.name,
                )
                response = self.client.post(url, headers=headers, json=payload)
                logger.info("qwen speech response: status=%s file=%s", response.status_code, audio_path.name)
                if response.status_code >= 400:
                    detail = response.text[:500]
                    if response.status_code in {408, 409, 429} or response.status_code >= 500:
                        raise _RetryableSpeechError(f"Qwen ASR HTTP {response.status_code}: {detail}")
                    raise QwenSpeechClientError(f"Qwen ASR HTTP {response.status_code}: {detail}")
                return self._decode_response(response.json())
            except _RetryableSpeechError as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    break
                self.sleeper(min(30.0, 2.0**attempt))
            except (httpx.HTTPError, ValueError, KeyError, TypeError, OSError, QwenSpeechClientError) as exc:
                last_error = exc
                if isinstance(exc, QwenSpeechClientError) and not isinstance(exc, _RetryableSpeechError):
                    break
                if attempt >= self.config.max_retries:
                    break
                self.sleeper(min(30.0, 2.0**attempt))
        raise QwenSpeechClientError(str(last_error or "Qwen ASR request failed")) from last_error

    @staticmethod
    def _decode_response(payload: Any) -> str:
        if isinstance(payload, list):
            payload = {"choices": [{"message": {"content": json.dumps(payload)}}]}
        if not isinstance(payload, dict):
            raise QwenSpeechClientError("Qwen ASR response must be an object")
        choices = payload.get("choices") or []
        if not choices:
            raise QwenSpeechClientError("Qwen ASR response has no choices")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            content = "".join(item.get("text", "") for item in content if isinstance(item, dict))
        if not isinstance(content, str):
            raise QwenSpeechClientError("Qwen ASR response has no textual content")
        return content.strip()

    def close(self) -> None:
        if self._owns_client:
            self.client.close()


class _RetryableSpeechError(QwenSpeechClientError):
    pass
