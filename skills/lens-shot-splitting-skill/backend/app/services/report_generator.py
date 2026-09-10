from __future__ import annotations

from html import escape
from pathlib import Path

from app.models.candidate_decision import CandidateDecision
from app.models.final_shot import FinalShotRecord
from app.models.shot import ShotRecord
from app.models.video import VideoMetadata


def format_ms(value: int | None) -> str:
    if value is None:
        return "-"
    total_seconds, milliseconds = divmod(max(0, value), 1000)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def generate_report(
    output_dir: Path,
    metadata: VideoMetadata | None,
    candidates: list[ShotRecord],
    status: str,
    error_message: str | None = None,
    decisions: list[CandidateDecision] | None = None,
    final_shots: list[FinalShotRecord] | None = None,
) -> str:
    title = metadata.file_name if metadata else "Video processing report"
    decision_by_id = {decision.candidate_segment_id: decision for decision in decisions or []}
    final_by_candidate: dict[str, list[FinalShotRecord]] = {}
    for final_shot in final_shots or []:
        for candidate_id in final_shot.candidate_segment_ids:
            final_by_candidate.setdefault(candidate_id, []).append(final_shot)

    video_info = ""
    if metadata:
        video_info = f"""
        <dl class="metadata">
          <div><dt>Source</dt><dd>{escape(metadata.source_path)}</dd></div>
          <div><dt>Duration</dt><dd>{format_ms(metadata.duration_ms)}</dd></div>
          <div><dt>Resolution</dt><dd>{metadata.width} x {metadata.height}</dd></div>
          <div><dt>FPS</dt><dd>{metadata.source_fps or '-'}</dd></div>
          <div><dt>Codec</dt><dd>{escape(metadata.codec_name or '-')}</dd></div>
          <div><dt>Audio</dt><dd>{'yes' if metadata.has_audio else 'no'}</dd></div>
        </dl>
        """
    error_html = f'<p class="error">{escape(error_message)}</p>' if error_message else ""

    candidate_cards: list[str] = []
    for candidate in candidates:
        decision = decision_by_id.get(candidate.shot_id)
        decision_html = ""
        if decision:
            decision_html = f"""
              <div class="decision">
                <strong>Model decision</strong>
                <span>{escape(decision.scene_continuity)}</span>
                <span>{'scene change' if decision.scene_change else 'same scene'}</span>
                <span>{'camera/framing only' if decision.camera_only_change else 'semantic change check'}</span>
                <span>{'action/goal changed' if decision.action_change else 'action continuous'}</span>
                <span>{'split before' if decision.should_split_before else 'merge with previous'}</span>
                <p>{escape(decision.split_reason)}</p>
                <p>{escape(decision.current_action or 'Unknown')} · confidence {decision.confidence:.2f}</p>
                <p>Speech: {escape(decision.speech_type)} · speaker {escape(decision.speaker_id or '-')} · AV sync {decision.av_sync_confidence:.2f} · mouth motion {f'{decision.mouth_motion_score:.4f}' if decision.mouth_motion_score is not None else '-'}</p>
                <p>Transcript: {escape(decision.transcript or '-')}</p>
                {f'<p class="error">{escape(decision.error_message)}</p>' if decision.error_message else ''}
              </div>
            """
        final_html = "".join(
            f"""
            <div class="final-link">
              <strong>Final shot: {escape(final_shot.final_shot_id)}</strong>
              <span>{format_ms(final_shot.start_ms)} - {format_ms(final_shot.end_ms)}</span>
              <a href="{escape(final_shot.clip_path or '#')}">Open final clip</a>
            </div>
            """
            for final_shot in final_by_candidate.get(candidate.shot_id, [])
        )
        thumbnails = "".join(
            f'<figure><img src="{escape(path)}" alt="{escape(label)} thumbnail"><figcaption>{escape(label)}</figcaption></figure>'
            for label, path in candidate.thumbnails.items()
        )
        candidate_cards.append(
            f"""
            <article class="candidate">
              <div class="card-header"><h2>Candidate {candidate.shot_index:04d}</h2><span>{escape(candidate.shot_id)}</span></div>
              <p>{format_ms(candidate.start_ms)} - {format_ms(candidate.end_ms)} · {format_ms(candidate.duration_ms)}</p>
              <div class="thumbs">{thumbnails}</div>
              {decision_html}
              {final_html}
            </article>
            """
        )

    final_cards: list[str] = []
    for final_shot in final_shots or []:
        clip_html = (
            f'<video controls preload="metadata" src="{escape(final_shot.clip_path)}"></video>'
            if final_shot.clip_path and final_shot.clip_status == "completed"
            else f'<span class="muted">{escape(final_shot.clip_status)}</span>'
        )
        final_cards.append(
            f"""
            <article class="final-shot {'failed' if final_shot.error_message or final_shot.clip_error or final_shot.classification_status == 'error' else ''}">
              <div class="card-header"><h2>{escape(final_shot.final_shot_id)}</h2><span>{escape(final_shot.review_status)}</span></div>
              <p>{format_ms(final_shot.start_ms)} - {format_ms(final_shot.end_ms)} · {format_ms(final_shot.duration_ms)}</p>
              <dl class="final-data">
                <div><dt>Scene</dt><dd>{escape(final_shot.scene or 'Unknown')}</dd></div>
                <div><dt>Main subject</dt><dd>{escape(final_shot.main_subject or 'Unknown')}</dd></div>
                <div><dt>Action</dt><dd>{escape(final_shot.action or 'Unknown')}</dd></div>
                <div><dt>Observable goal</dt><dd>{escape(final_shot.observable_goal or 'Unknown')}</dd></div>
                <div><dt>Confidence</dt><dd>{final_shot.confidence:.2f}</dd></div>
                <div><dt>Candidates</dt><dd>{escape(', '.join(final_shot.candidate_segment_ids))}</dd></div>
                <div><dt>Speech type</dt><dd>{escape(final_shot.speech_type)}</dd></div>
                <div><dt>Speaker</dt><dd>{escape(final_shot.speaker_id or '-')}</dd></div>
                <div><dt>AV sync confidence</dt><dd>{final_shot.av_sync_confidence:.2f}</dd></div>
                <div><dt>Transcript</dt><dd>{escape(final_shot.transcript or '-')}</dd></div>
                <div><dt>Shot category</dt><dd>{escape(final_shot.shot_category or 'Pending prompt')}</dd></div>
                <div><dt>Category confidence</dt><dd>{format_optional_score(final_shot.category_confidence)}</dd></div>
                <div><dt>Quality score</dt><dd>{format_optional_score(final_shot.quality_score)}</dd></div>
                <div><dt>Classification status</dt><dd>{escape(final_shot.classification_status)}</dd></div>
              </dl>
              <p>Scene change reason: {escape(final_shot.scene_change_reason or '-')}</p>
              <p>Action completion reason: {escape(final_shot.action_completion_reason or '-')}</p>
              <p>Speech boundary reason: {escape(final_shot.speech_boundary_reason or '-')}</p>
              <p>Category reason: {escape(final_shot.category_reason or '-')}</p>
              <p>Quality reason: {escape(final_shot.quality_reason or '-')}</p>
              {f'<p class="error">Classification error: {escape(final_shot.classification_error)}</p>' if final_shot.classification_error else ''}
              <div class="video">{clip_html}</div>
              {f'<p class="error">{escape(final_shot.error_message or final_shot.clip_error or "")}</p>' if final_shot.error_message or final_shot.clip_error else ''}
            </article>
            """
        )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} - Lens Analysis</title>
  <style>
    :root {{ color: #18212b; background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    body {{ max-width: 1240px; margin: 0 auto; padding: 32px; }}
    h1 {{ margin-bottom: 8px; }}
    .status {{ color: #166534; font-weight: 700; text-transform: uppercase; }}
    .metadata, .final-data {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; padding: 16px 0; }}
    .metadata div, .final-data div {{ background: #fff; border: 1px solid #d7dde4; padding: 10px; }}
    dt {{ color: #64748b; font-size: 12px; }}
    dd {{ margin: 4px 0 0; overflow-wrap: anywhere; }}
    .candidate, .final-shot {{ margin: 18px 0; padding: 18px; background: #fff; border: 1px solid #d7dde4; }}
    .final-shot {{ border-left: 4px solid #2563eb; }}
    .failed {{ border-color: #dc2626; }}
    .card-header {{ display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }}
    .card-header h2 {{ margin: 0; }}
    .thumbs {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }}
    figure {{ margin: 0; }}
    img {{ display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: #111827; }}
    figcaption {{ padding-top: 6px; color: #64748b; font-size: 12px; }}
    .decision {{ margin-top: 14px; padding: 12px; background: #f8fafc; border: 1px solid #d7dde4; display: flex; gap: 10px; flex-wrap: wrap; }}
    .decision p {{ flex-basis: 100%; margin: 0; }}
    .final-link {{ margin-top: 12px; padding: 10px; background: #eff6ff; display: flex; gap: 12px; flex-wrap: wrap; }}
    .video {{ max-width: 640px; margin-top: 12px; }}
    video {{ display: block; width: 100%; background: #111827; }}
    .muted {{ color: #64748b; }}
    .error {{ color: #b91c1c; white-space: pre-wrap; }}
    details {{ margin-top: 28px; }}
    summary {{ cursor: pointer; font-size: 18px; font-weight: 700; padding: 12px 0; }}
    @media (max-width: 700px) {{ body {{ padding: 18px; }} .thumbs {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <h1>{escape(title)}</h1>
  <p class="status">{escape(status)}</p>
  {error_html}
  {video_info}
  <h2>Final semantic shots ({len(final_shots or [])})</h2>
  {''.join(final_cards) or '<p>No final shots generated.</p>'}
  <details>
    <summary>Candidate segments (diagnostic only, {len(candidates)})</summary>
    {''.join(candidate_cards) or '<p>No candidate segments found.</p>'}
  </details>
</body>
</html>
"""


def format_optional_score(value: float | None) -> str:
    return f"{value:.2f}" if value is not None else "-"
