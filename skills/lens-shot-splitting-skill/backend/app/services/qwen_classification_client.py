from __future__ import annotations

import json
import logging
import time
import base64
from pathlib import Path
from typing import Any, Callable

import httpx
from dotenv import load_dotenv

from app.core.final_shot_config import FinalShotClassificationConfig
from app.core.shot_taxonomy import CATEGORY_LABELS, normalize_category_code
from app.models.final_shot import FinalShotRecord
from app.utils.qwen_api_key import qwen_api_key_prompt, resolve_qwen_api_key


class QwenClassificationClientError(RuntimeError):
    pass


logger = logging.getLogger("uvicorn.error")


class _RetryableClassificationError(QwenClassificationClientError):
    pass


Sleep = Callable[[float], None]


class QwenClassificationClient:
    """Single-pass final-shot understanding, taxonomy and quality evaluator.

    The model receives the finished shot's visual samples together with the
    split-stage structured context, then returns one versioned JSON contract.
    The split result is never overwritten; the complete model response is kept
    in the classification record for audit and later re-scoring.
    """

    def __init__(
        self,
        config: FinalShotClassificationConfig,
        api_key: str | None = None,
        client: httpx.Client | None = None,
        sleeper: Sleep = time.sleep,
    ):
        self.config = config
        project_root = Path(__file__).resolve().parents[2]
        load_dotenv(project_root / ".env")
        load_dotenv(project_root / ".env.classification")
        self.api_key = resolve_qwen_api_key(api_key, config.api_key_env, ("QWEN_CLASSIFICATION_API_KEY", "QWEN_API_KEY"))
        self.prompt = self._load_prompt(project_root, config.prompt_path)
        self.client = client or httpx.Client(timeout=config.timeout_seconds)
        self._owns_client = client is None
        self.sleeper = sleeper
        self._api_key_hint = qwen_api_key_prompt(config.api_key_env, ("QWEN_CLASSIFICATION_API_KEY", "QWEN_API_KEY", "DASHSCOPE_API_KEY"))

    @staticmethod
    def _load_prompt(project_root: Path, prompt_path: str | None) -> str | None:
        if not prompt_path:
            return None
        path = Path(prompt_path).expanduser()
        if not path.is_absolute():
            path = project_root.parent / path
        try:
            prompt = path.read_text(encoding="utf-8").strip()
        except OSError as exc:
            raise QwenClassificationClientError(f"Classification prompt cannot be read: {path}") from exc
        return prompt or None

    @property
    def ready(self) -> bool:
        return bool(self.config.enabled and self.prompt)

    def classify(self, final_shot: FinalShotRecord, visual_samples: list[object] | None = None) -> dict[str, Any]:
        if not self.config.enabled:
            logger.error("qwen classification request skipped: classification is disabled")
            raise QwenClassificationClientError("Shot classification is disabled")
        if not self.prompt:
            logger.error("qwen classification request skipped: prompt is not configured")
            raise QwenClassificationClientError("Classification prompt is not configured")
        if not self.api_key:
            logger.error("qwen classification request skipped: API key is missing (%s)", self._api_key_hint)
            raise QwenClassificationClientError(
                f"Missing classification API key. Set one of: {self._api_key_hint}."
            )

        payload = {
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": self.prompt},
                {
                    "role": "user",
                    "content": self._user_content(final_shot, visual_samples or []),
                },
            ],
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
            "response_format": {"type": "json_object"},
            "enable_thinking": self.config.enable_thinking,
        }
        url = f"{self.config.base_url.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        last_error: Exception | None = None
        for attempt in range(self.config.max_retries + 1):
            try:
                logger.info(
                    "qwen classification request start: model=%s attempt=%s/%s video=%s shot=%s",
                    self.config.model_name,
                    attempt + 1,
                    self.config.max_retries + 1,
                    final_shot.video_id,
                    final_shot.final_shot_id,
                )
                response = self.client.post(url, headers=headers, json=payload)
                logger.info(
                    "qwen classification response: status=%s video=%s shot=%s",
                    response.status_code,
                    final_shot.video_id,
                    final_shot.final_shot_id,
                )
                if response.status_code >= 400:
                    detail = response.text[:500]
                    if response.status_code in {408, 409, 429} or response.status_code >= 500:
                        raise _RetryableClassificationError(
                            f"Qwen classification HTTP {response.status_code}: {detail}"
                        )
                    raise QwenClassificationClientError(
                        f"Qwen classification HTTP {response.status_code}: {detail}"
                    )
                result = self._decode_response(response.json())
                if result["classification_status"] == "completed" and not result["shot_category"]:
                    raise QwenClassificationClientError(
                        "Qwen classification returned a category outside the configured taxonomy"
                    )
                return result
            except _RetryableClassificationError as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    break
                self.sleeper(min(30.0, 2.0**attempt))
            except (httpx.HTTPError, OSError, ValueError, KeyError, TypeError, QwenClassificationClientError) as exc:
                last_error = exc
                if isinstance(exc, QwenClassificationClientError) and not isinstance(
                    exc, _RetryableClassificationError
                ):
                    break
                if attempt >= self.config.max_retries:
                    break
                self.sleeper(min(30.0, 2.0**attempt))
        raise QwenClassificationClientError(str(last_error or "Qwen classification request failed")) from last_error

    @classmethod
    def _user_content(cls, final_shot: FinalShotRecord, visual_samples: list[object]) -> str | list[dict[str, Any]]:
        structured = cls._structured_input(final_shot)
        if not visual_samples:
            return json.dumps(structured, ensure_ascii=False, indent=2)
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    "以下是同一最终镜头按时间顺序抽取的候选片段画面；短片段通常为开始、中间、结束三帧，"
                    "长片段或由多个候选片段合并的镜头会提供更密集的完整候选帧序列。"
                    "请以画面主导内容为准；若文字理解与画面冲突，以画面为准。"
                ),
            }
        ]
        for sample in visual_samples:
            path = Path(getattr(sample, "path", sample))
            label = str(getattr(sample, "label", "sample"))
            offset_ms = getattr(sample, "offset_ms", None)
            content.append(
                {
                    "type": "text",
                    "text": f"画面采样：{label}，镜头内偏移 {offset_ms if offset_ms is not None else '未知'} ms",
                }
            )
            content.append({"type": "image_url", "image_url": {"url": cls._image_data_url(path)}})
        content.append(
            {
                "type": "text",
                "text": "已有结构化镜头理解如下：\n" + json.dumps(structured, ensure_ascii=False, indent=2),
            }
        )
        return content

    @staticmethod
    def _image_data_url(path: Path) -> str:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    @staticmethod
    def _structured_input(final_shot: FinalShotRecord) -> dict[str, Any]:
        """Return the stable, model-facing understanding contract.

        Classification output is excluded so a retry cannot accidentally feed
        a previous prediction back into the model.
        """

        return {
            "final_shot_id": final_shot.final_shot_id,
            "video_id": final_shot.video_id,
            "start_ms": final_shot.start_ms,
            "end_ms": final_shot.end_ms,
            "duration_ms": final_shot.duration_ms,
            "candidate_segment_ids": final_shot.candidate_segment_ids,
            "scene": final_shot.scene,
            "main_subject": final_shot.main_subject,
            "action": final_shot.action,
            "observable_goal": final_shot.observable_goal,
            "speech_type": final_shot.speech_type,
            "speaker_id": final_shot.speaker_id,
            "transcript": final_shot.transcript,
            "understanding_confidence": final_shot.confidence,
            "scene_change_reason": final_shot.scene_change_reason,
            "action_completion_reason": final_shot.action_completion_reason,
        }

    @classmethod
    def _decode_response(cls, payload: Any) -> dict[str, Any]:
        if isinstance(payload, list):
            payload = {"choices": [{"message": {"content": json.dumps(payload)}}]}
        if not isinstance(payload, dict):
            raise _RetryableClassificationError("Qwen classification response must be an object")
        choices = payload.get("choices") or []
        if not choices:
            raise _RetryableClassificationError("Qwen classification response has no choices")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            content = "".join(item.get("text", "") for item in content if isinstance(item, dict))
        if not isinstance(content, str) or not content.strip():
            raise _RetryableClassificationError("Qwen classification response has no textual JSON content")
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").removeprefix("json").strip()
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise _RetryableClassificationError("Qwen classification response is not valid JSON") from exc
        return cls._normalize_result(parsed, cleaned)

    @staticmethod
    def _normalize_result(parsed: Any, raw: str = "") -> dict[str, Any]:
        """Normalize the combined understanding/classification/quality contract."""
        if isinstance(parsed, list):
            if not parsed:
                raise QwenClassificationClientError("Qwen classification response JSON list is empty")
            if len(parsed) == 1 and isinstance(parsed[0], dict):
                parsed = parsed[0]
            elif all(isinstance(item, dict) for item in parsed):
                parsed = parsed[0]
            else:
                raise QwenClassificationClientError("Qwen classification response JSON list has unexpected structure")
        nested = parsed.get("classification")
        classification = nested if isinstance(nested, dict) else parsed
        quality = parsed.get("quality") if isinstance(parsed.get("quality"), dict) else {}
        understanding = parsed.get("understanding") if isinstance(parsed.get("understanding"), dict) else {}
        merged = {**parsed, **classification}
        requested_status = str(merged.get("status", "completed") or "completed").strip().lower()
        classification_status = "needs_review" if requested_status in {"needs_review", "need_review", "review"} else (
            "unavailable" if requested_status in {"unavailable", "failed", "error"} else "completed"
        )
        category = merged.get("shot_category", merged.get("category", merged.get("label", "")))
        confidence = merged.get(
            "category_confidence",
            merged.get("classification_confidence", merged.get("confidence")),
        )
        reason = merged.get(
            "category_reason",
            merged.get("classification_reason", merged.get("reason", "")),
        )
        category_code = "" if classification_status in {"needs_review", "unavailable"} else normalize_category_code(category)
        result: dict[str, Any] = {
            "shot_category": category_code,
            "category_label": CATEGORY_LABELS.get(category_code, ""),
            "category_confidence": (
                None if classification_status in {"needs_review", "unavailable"} else _number_or_none(confidence)
            ),
            "category_reason": str(reason or ""),
            "classification_status": classification_status,
            "classification_raw": raw or json.dumps(parsed, ensure_ascii=False),
        }

        # Keep the combined semantic understanding in the normalized result as
        # well as in classification_raw.  These fields are optional for
        # backwards-compatible model responses and are intentionally not used
        # to mutate the immutable split row.
        understanding_aliases = {
            "scene": ("scene", "setting"),
            "main_subject": ("main_subject", "subject"),
            "action": ("action", "current_action"),
            "observable_goal": ("observable_goal", "goal"),
            "scene_change_reason": ("scene_change_reason",),
            "action_completion_reason": ("action_completion_reason",),
            "speech_type": ("speech_type",),
            "transcript": ("transcript",),
        }
        if understanding:
            result["understanding"] = {
                key: str(next((understanding.get(alias) for alias in aliases if understanding.get(alias) is not None), "") or "")
                for key, aliases in understanding_aliases.items()
            }

        # Only add quality keys when the model actually returned a quality
        # object/field.  This preserves compatibility with historical rows and
        # lets pending legacy records remain explicitly unscored.
        quality_present = bool(quality) or any(
            key in parsed for key in ("quality_score", "quality_reason", "quality_level", "dimension_scores")
        )
        if quality_present:
            score = _number_or_none(quality.get("quality_score", parsed.get("quality_score")))
            if score is not None:
                score = max(0.0, min(100.0, score))
            level = str(quality.get("quality_level", parsed.get("quality_level", "")) or "").strip()
            if not level and score is not None:
                level = _quality_level(score)
            dimensions = quality.get("dimension_scores", parsed.get("dimension_scores", {}))
            result.update(
                {
                    "quality_score": None if classification_status != "completed" else score,
                    "quality_level": level,
                    "quality_reason": str(quality.get("quality_reason", parsed.get("quality_reason", "")) or ""),
                    "quality_details": {
                        "applicable_dimensions": quality.get("applicable_dimensions", []),
                        "dimension_scores": dimensions if isinstance(dimensions, dict) else {},
                        "hard_issues": quality.get("hard_issues", []),
                    },
                }
            )
        return result

    def close(self) -> None:
        if self._owns_client:
            self.client.close()


def _number_or_none(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _quality_level(score: float) -> str:
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "usable"
    if score >= 50:
        return "limited"
    return "poor"
