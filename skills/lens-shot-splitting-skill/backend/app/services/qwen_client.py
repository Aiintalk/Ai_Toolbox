from __future__ import annotations

import base64
import json
import logging
import time
from pathlib import Path
from typing import Any, Callable

import httpx
from dotenv import load_dotenv

from app.core.final_shot_config import FinalShotModelConfig
from app.models.shot import ShotRecord
from app.models.speech_evidence import SpeechEvidence
from app.services.candidate_sampling import CandidateSample
from app.utils.qwen_api_key import qwen_api_key_prompt, resolve_qwen_api_key


class QwenClientError(RuntimeError):
    pass


logger = logging.getLogger("uvicorn.error")


class _RetryableQwenError(QwenClientError):
    """An upstream response that is safe to retry without changing the request."""


Sleep = Callable[[float], None]


class QwenVisionClient:
    def __init__(
        self,
        config: FinalShotModelConfig,
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

    def analyze_transition(
        self,
        previous: ShotRecord | None,
        current: ShotRecord,
        samples: list[CandidateSample],
        speech_evidence: list[SpeechEvidence] | None = None,
    ) -> dict[str, Any]:
        if not self.api_key:
            logger.error("qwen vision request skipped: API key is missing (%s)", self._api_key_hint)
            raise QwenClientError(f"Missing Qwen API key. Set one of: {self._api_key_hint}.")
        if not samples:
            logger.error("qwen vision request skipped: no samples for %s", current.shot_id)
            raise QwenClientError(f"No candidate samples available: {current.shot_id}")
        payload = {
            "model": self.config.model_name,
            "messages": [
                {"role": "system", "content": self._system_prompt()},
                {"role": "user", "content": self._user_content(previous, current, samples, speech_evidence or [])},
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
                    "qwen vision request start: model=%s attempt=%s/%s candidate=%s",
                    self.config.model_name,
                    attempt + 1,
                    self.config.max_retries + 1,
                    current.shot_id,
                )
                response = self.client.post(url, headers=headers, json=payload)
                logger.info(
                    "qwen vision response: status=%s candidate=%s",
                    response.status_code,
                    current.shot_id,
                )
                if response.status_code >= 400:
                    detail = response.text[:500]
                    if (
                        response.status_code in {408, 409, 429}
                        or response.status_code >= 500
                        or "Download multimodal file timed out" in detail
                    ):
                        raise _RetryableQwenError(f"Qwen HTTP {response.status_code}: {detail}")
                    raise QwenClientError(f"Qwen HTTP {response.status_code}: {detail}")
                return self._decode_response(response.json())
            except _RetryableQwenError as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    break
                self.sleeper(min(30.0, 2.0**attempt))
            except (httpx.HTTPError, ValueError, KeyError, TypeError, QwenClientError) as exc:
                last_error = exc
                if isinstance(exc, QwenClientError) and not isinstance(exc, _RetryableQwenError):
                    break
                if attempt >= self.config.max_retries:
                    break
                self.sleeper(min(30.0, 2.0**attempt))
        raise QwenClientError(str(last_error or "Qwen request failed")) from last_error

    @staticmethod
    def _system_prompt() -> str:
        return (
            "你是最终语义镜头切分模型。输入是按时间连续排列的两个相邻 candidate_segment 的画面。"
            "现有 candidate_segment 只是候选边界，不是最终镜头。"
            "应根据相邻片段的场景、主体、可观察动作、表达意图和口播连续性判断是否需要切分；分镜阶段不执行 A1–F6 分类，正式分类在 final_shot 合并完成后进行。"
            "连续口播结束后，如果转为画外音、静音展示、效果展示或独立 B-roll，则该后一段是新的表达，应当切开。"
            "同一场景的远近景、特写、手部特写、推拉摇移、轻微抖动和不同机位通常要合并，"
            "这些情况必须将 camera_only_change 设为 true，并将 scene_change 设为 false。"
            "只有地点、室内外、明显时间或环境变化同时导致表达内容或具体意图改变，或主要主体和任务已经变成新的独立表达时，才是 scene_change。"
            "同一任务中的水龙头、固定设备、产品物体、手部、局部脸部或结果特写，如果仍服务同一表达意图，就不能仅因主体短暂变化而拆分。"
            "独立 B-roll 只有在与当前任务无关、无法作为同一表达的一部分时才切分；此时才将 primary_subject_change 和 scene_change 设为 true。"
            "动作必须按一个完整的大动作或完整任务理解，不要把准备、进行、局部特写、手部细节、一个小步骤或一个手势拆成独立动作。"
            "只有当前完整动作已经完成，并开始另一个独立的大动作或任务目标时，才将 action_change 设为 true。"
            "例如展示产品质地 -> 将产品涂到头发 -> 冲洗头发 -> 检查头皮，只有这些阶段分别代表独立任务目标时才切开；同一任务内部的连续步骤必须合并。"
            "如果当前片段和相邻片段处于连续的 on_camera_speech，只要没有 scene_change，就绝不能仅因为动作、动作阶段、手部操作或可观察动作变化而切分；此时 action_change 必须为 false。"
            "连续口播中的动作变化只作为口播画面内容记录，不能成为切点。"
            "对于洗头或护发这一完整任务，洗前、洗中、洗后都属于同一个大动作‘洗头’；梳头、调水温、查看水龙头、冲洗、打泡、按摩和洗后整理都是内部步骤，不能仅因动作变化切分。"
            "洗头任务内部只有表达意图变化才允许切分；场景、机位和动作阶段变化本身不是切点。"
            "camera_only_change 用于记录画面形式变化，不决定是否切分；只要表达意图相同，should_split_before 必须为 false。"
            "无法确认完整动作是否完成时不要仅凭动作阶段切分；但明确表达内容或意图变化必须切开。"
            "speech_type 只描述 current candidate 的时间范围，不能因为 previous candidate 在口播，就把 current candidate 也继承为 on_camera_speech。"
            "请综合 current candidate 的连续画面和音频证据判断 speech_type；如果无法确认同步关系，使用 uncertain。"
            "嘴巴处于张开状态不等于嘴巴在运动。只有相邻连续帧中能看到嘴唇开合或嘴部轮廓发生明确变化，才可以将 mouth_moving 设为 true。"
            "如果嘴部从头到尾保持同一张开或闭合形状，即使 ASR 有语音，也必须标记 voice_over；不要把静态张嘴、嘴唇颜色、字幕或头部移动当作口型运动。"
            "优先比较同一 candidate 内标记为相邻帧对的 full frame 和嘴部局部裁剪图；至少需要一个清晰的时间变化证据才能判定 on_camera_speech。"
            "如果 current candidate 从头到尾都没有人物同步张嘴，只是有旁白，标记 voice_over；如果连语音也没有，标记 no_speech。"
            "画外配音、旁白或人物未同步张嘴时必须判定为 voice_over；voice_over、ambient_sound、no_speech、uncertain 不能仅因自身标签触发口播切分。"
            "连续的 on_camera_speech 不能切开；但从 on_camera_speech 转为 voice_over、ambient_sound 或 no_speech 的独立展示时，必须切开。"
            "只能描述画面中可观察的动作目标，不能猜测人物心理。"
            "scene、main_subject、current_action、observable_goal、split_reason 以及各类 reason 文本字段"
            "必须使用简体中文；画面中确有必要的品牌名、产品型号、技术缩写或代码（如 LED、B-roll）可以原样保留，"
            "但不要输出完整的英文句子或英文解释。只返回合法 JSON，不要 Markdown 或解释。"
        )

    @classmethod
    def _user_content(
        cls,
        previous: ShotRecord | None,
        current: ShotRecord,
        samples: list[CandidateSample],
        speech_evidence: list[SpeechEvidence],
    ) -> list[dict[str, Any]]:
        sequence = [
            {
                "candidate_segment_id": sample.candidate_segment_id,
                "sample_index": sample.sample_index,
                "timestamp_ms": sample.timestamp_ms,
                "relative_ms": sample.relative_ms,
                "mouth_crop_available": sample.mouth_path is not None,
            }
            for sample in samples
        ]
        previous_text = (
            f"previous candidate: {previous.shot_id}, {previous.start_ms}-{previous.end_ms} ms"
            if previous
            else "previous candidate: none; this is the first candidate"
        )
        audio_text = [
            {
                "candidate_segment_id": evidence.candidate_segment_id,
                "has_audio": evidence.has_audio,
                "speech_detected_by_asr": evidence.speech_detected,
                "transcript": evidence.transcript,
                "speech_start_ms": evidence.speech_start_ms,
                "speech_end_ms": evidence.speech_end_ms,
                "asr_confidence": evidence.confidence,
                "error": evidence.error_message,
            }
            for evidence in speech_evidence
        ]
        prompt = f"""
{previous_text}
current candidate: {current.shot_id}, {current.start_ms}-{current.end_ms} ms

所有文本描述字段必须使用简体中文（必要的品牌名、型号和技术缩写可保留原文）。

连续采样帧元数据（同一 candidate 内相邻的 sample 是连续帧对）：
{json.dumps(sequence, ensure_ascii=False, indent=2)}

音频/ASR证据（ASR只能证明音频中是否有语音和转写，不能单独证明画面人物在说话）：
{json.dumps(audio_text, ensure_ascii=False, indent=2)}

只返回以下 JSON 结构，decisions 中必须包含当前 candidate_segment：
{{
  "decisions": [
    {{
      "candidate_segment_id": "{current.shot_id}",
      "scene_continuity": "continuous|discontinuous|unknown",
      "scene_change": false,
      "primary_subject_change": false,
      "camera_only_change": false,
      "action_change": false,
      "scene": "",
      "main_subject": "",
      "current_action": "",
      "observable_goal": "",
      "action_phase": "beginning|ongoing|complete",
      "action_completed": false,
      "should_split_before": false,
      "split_reason": "same_scene_same_action|intent_changed|scene_change|action_completed|observable_goal_changed|uncertain",
      "confidence": 0.0,
      "speech_type": "on_camera_speech|voice_over|ambient_sound|no_speech|uncertain",
      "face_visible": false,
      "mouth_moving": false,
      "speaker_id": "",
      "speech_start_ms": null,
      "speech_end_ms": null,
      "transcript": "",
      "av_sync_confidence": 0.0,
      "speech_boundary_reason": "on_camera_speech_start|on_camera_speech_end|speaker_changed|speech_topic_changed|continuous_speech|voice_over|none"
    }}
  ]
}}

should_split_before 表示是否在当前 candidate 的 start_ms 之前结束上一个 final_shot。
相邻片段如果仍属于同一场景、同一任务或同一表达意图，即使发生硬切、换衣服、换机位、换背景或场景不连续，也不能仅因此拆分；这些情况可将 camera_only_change 或 scene_continuity 作为诊断信息记录。
只有场景、主体任务或具体表达意图已经变成独立事件时，才将 action_change/scene_change 设为 true 并切分；不要因为同一任务内部的准备、进行、局部特写、结果展示而切分。
只有 speech_type 为 on_camera_speech 时，speech_boundary_reason 才能触发口播切分；voice_over 只能被标记，不能仅因语音存在而切分。
current candidate 的 speech_type 必须根据 current candidate 自己的采样帧判断，不能沿用 previous candidate 的标签。
如果 current candidate 内部发生“前半段 on_camera_speech、后半段闭嘴展示”，请返回 speech_boundary_reason=on_camera_speech_end，
speech_end_ms 取口播结束的原视频时间；如果整个 current candidate 都是闭嘴展示，则返回 no_speech 或 voice_over，不能返回 on_camera_speech。
speech_start_ms 和 speech_end_ms 必须使用原视频时间轴；无法确认同步关系时 speech_type 使用 uncertain，should_split_before 使用 false。
如果 speech_boundary_reason=on_camera_speech_end 且 speech_end_ms 落在 current candidate 内部，允许 final_shot 在该原视频时间切开；这是唯一允许在 candidate 内部产生最终边界的情况。不要把 speech_end_ms 填成 candidate.end_ms 来伪造内部边界。
同一段连续出镜口播（speech_boundary_reason=continuous_speech）要合并，哪怕 E1–E5 小类变化；但从 on_camera_speech 转为 voice_over、ambient_sound 或 no_speech 的独立展示时，必须将 should_split_before=true。
""".strip()
        content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
        last_candidate_id: str | None = None
        candidate_position = 0
        for sample_index, sample in enumerate(samples):
            if sample.candidate_segment_id != last_candidate_id:
                last_candidate_id = sample.candidate_segment_id
                candidate_position = 0
            if candidate_position % 2 == 0:
                next_sample = samples[sample_index + 1] if sample_index + 1 < len(samples) else None
                if next_sample is not None and next_sample.candidate_segment_id == sample.candidate_segment_id:
                    content.append(
                        {
                            "type": "text",
                            "text": (
                                f"连续帧对：{sample.candidate_segment_id}，"
                                f"{sample.timestamp_ms}ms -> {next_sample.timestamp_ms}ms；"
                                "请直接比较这两帧的嘴唇形状变化。"
                            ),
                        }
                    )
            content.append(
                {
                    "type": "text",
                    "text": (
                        f"下一张图：candidate={sample.candidate_segment_id}，"
                        f"sample_index={sample.sample_index}，原视频时间={sample.timestamp_ms}ms"
                    ),
                }
            )
            content.append({"type": "image_url", "image_url": {"url": cls._image_data_url(sample.path)}})
            if sample.mouth_path is not None and sample.mouth_path.exists():
                content.append(
                    {
                        "type": "text",
                        "text": (
                            f"嘴部局部裁剪：candidate={sample.candidate_segment_id}，"
                            f"sample_index={sample.sample_index}，原视频时间={sample.timestamp_ms}ms"
                        ),
                    }
                )
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": cls._image_data_url(sample.mouth_path)},
                    }
                )
            candidate_position += 1
        return content

    @staticmethod
    def _image_data_url(path: Path) -> str:
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    @staticmethod
    def _decode_response(payload: Any) -> dict[str, Any]:
        if isinstance(payload, list):
            payload = {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(payload),
                        }
                    }
                ]
            }
        if not isinstance(payload, dict):
            raise _RetryableQwenError(
                "Qwen response payload must be an object "
                f"(got {type(payload).__name__})"
            )
        choices = payload.get("choices") or []
        if not choices:
            raise _RetryableQwenError("Qwen response has no choices")
        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, list):
            content = "".join(item.get("text", "") for item in content if isinstance(item, dict))
        if not isinstance(content, str) or not content.strip():
            raise _RetryableQwenError("Qwen response has no textual JSON content")
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`").removeprefix("json").strip()
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise _RetryableQwenError(
                "Qwen response is not valid JSON; "
                f"content_preview={_preview(cleaned)}"
            ) from exc

        normalized = _normalize_response_shape(parsed)
        if normalized is None:
            raise _RetryableQwenError(
                "Qwen response JSON must contain a non-empty decisions list; "
                f"top_level={type(parsed).__name__}; content_preview={_preview(cleaned)}"
            )
        return normalized

    def close(self) -> None:
        if self._owns_client:
            self.client.close()


def _normalize_response_shape(parsed: Any) -> dict[str, Any] | None:
    """Normalize common Qwen structured-output variants to the expected object."""
    if isinstance(parsed, dict):
        decisions = parsed.get("decisions")
        if isinstance(decisions, list) and any(isinstance(item, dict) for item in decisions):
            return parsed
        if isinstance(decisions, dict):
            return {**parsed, "decisions": [decisions]}
        if isinstance(parsed.get("decision"), dict):
            return {**parsed, "decisions": [parsed["decision"]]}
        if "candidate_segment_id" in parsed:
            return {"decisions": [parsed]}
        return None
    if isinstance(parsed, list) and parsed and all(isinstance(item, dict) for item in parsed):
        return {"decisions": parsed}
    return None


def _preview(value: str, limit: int = 300) -> str:
    compact = " ".join(value.split())
    if len(compact) > limit:
        compact = compact[:limit] + "…"
    return repr(compact)
