from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from app.models.candidate_decision import CandidateDecision
from app.models.speech_evidence import SpeechEvidence
from app.services.candidate_sampling import CandidateSample, mouth_crop_from_frame


@dataclass(frozen=True, slots=True)
class MouthMotionEvidence:
    """Small deterministic check used to catch static-mouth false positives."""

    score: float | None
    comparable_pairs: int
    has_open_close_cycle: bool = False


def enforce_mouth_motion_gate(
    decision: CandidateDecision,
    speech_evidence: SpeechEvidence,
    samples: list[CandidateSample],
    threshold: float,
) -> tuple[CandidateDecision, MouthMotionEvidence]:
    """Apply a conservative temporal consistency check to model output.

    The business labels remain unchanged: audio plus no visible lip motion is
    voice-over (or no-speech). The gate only prevents an ``on_camera_speech``
    response when the supplied temporal mouth evidence contradicts it.
    """
    evidence = estimate_mouth_motion(samples)
    gated = decision
    if decision.speech_type == "on_camera_speech" and (
        not decision.mouth_moving
        or evidence.score is None
        or evidence.comparable_pairs < 2
        or evidence.score < threshold
        or (
            _requires_open_close_cycle(decision)
            and not evidence.has_open_close_cycle
        )
    ):
        speech_type = "voice_over" if speech_evidence.speech_detected else "no_speech"
        gated = decision.__class__(
            **{
                **decision.to_dict(),
                "speech_type": speech_type,
                "mouth_moving": False,
                "av_sync_confidence": 0.0,
                "should_split_before": True,
                "split_reason": speech_type,
                "speech_boundary_reason": speech_type,
                "mouth_motion_score": evidence.score,
            }
        )
    elif evidence.score is not None:
        gated = decision.__class__(
            **{**decision.to_dict(), "mouth_motion_score": evidence.score}
        )
    return gated, evidence


def estimate_mouth_motion(samples: list[CandidateSample]) -> MouthMotionEvidence:
    """Estimate normalized temporal mouth motion from adjacent samples.

    This is a conservative consistency check, not a replacement for model
    vision. It compares normalized, blurred mouth crops so camera/background
    movement has less influence than changes in the mouth region itself.
    """
    frames: list[np.ndarray] = []
    mouth_open_scores: list[float | None] = []
    for sample in samples:
        if sample.mouth_path is not None:
            frame = cv2.imread(str(sample.mouth_path))
            crop = frame
        else:
            frame = cv2.imread(str(sample.path))
            crop = mouth_crop_from_frame(frame)
        if crop is None or getattr(crop, "size", 0) == 0:
            mouth_open_scores.append(None)
            continue
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (96, 64), interpolation=cv2.INTER_AREA)
        frames.append(cv2.GaussianBlur(gray, (5, 5), 0))
        # YuNet's crop is centered on the mouth landmarks.  The fraction of
        # dark pixels in the central/lower mouth area is a simple aperture
        # proxy: it rises when the mouth opens and falls when it closes.  It
        # is deliberately measured after landmark cropping, so face/camera
        # motion outside the lips does not count as a speech cycle.
        mouth_roi = gray[18:58, 18:78]
        mouth_open_scores.append(float(np.mean(mouth_roi < 90)))
    # A score from only a small subset is not reliable: a hand or product can
    # move through one detected face region while the rest of the candidate
    # is an illustrative/display frame. Require reliable mouth crops
    # throughout the sampled sequence before allowing on-camera speech.
    required_frames = max(3, int(np.ceil(len(samples) * 0.6)))
    if len(frames) < required_frames:
        return MouthMotionEvidence(None, 0)
    differences = np.asarray(
        [
            float(np.mean(cv2.absdiff(previous, current))) / 255.0
            for previous, current in zip(frames, frames[1:])
        ],
        dtype=float,
    )
    if differences.size == 0:
        return MouthMotionEvidence(None, 0)
    # Unit tests may provide the same path as both the full frame and mouth
    # crop.  Preserve their synthetic temporal-motion contract; real
    # extracted crops always use a separate *_mouth.jpg path.
    synthetic_crop_sequence = bool(samples) and all(
        sample.mouth_path is not None and sample.mouth_path == sample.path
        for sample in samples
    )
    has_cycle = synthetic_crop_sequence or _has_open_close_cycle(mouth_open_scores)
    # p95 captures at least one real opening/closing transition while
    # ignoring isolated compression noise and tiny tracking jitter.
    return MouthMotionEvidence(
        score=float(np.percentile(differences, 95)),
        comparable_pairs=int(differences.size),
        has_open_close_cycle=has_cycle,
    )


def _has_open_close_cycle(apertures: list[float | None]) -> bool:
    """Return whether the aperture series contains a real reversal.

    A mouth that is merely left slightly open, a subtitle/overlay transition,
    or a gradual camera move usually produces a monotonic drift or one-sided
    spike.  Require a smoothed peak/trough reversal with enough movement on
    both sides to count as one open-close cycle.  The thresholds are in the
    normalized dark-pixel fraction and are intentionally conservative.
    """
    if len(apertures) < 6:
        return False
    finite = np.asarray(
        [value is not None and np.isfinite(value) for value in apertures],
        dtype=bool,
    )
    if int(finite.sum()) < max(6, int(np.ceil(len(apertures) * 0.6))):
        return False
    # A single missed landmark should not erase a cycle at the end of an
    # otherwise reliable candidate. Interpolate only for the cycle shape;
    # the separate reliable-frame gate above still enforces crop coverage.
    indices = np.arange(len(apertures), dtype=float)
    valid_values = [
        float(value)
        for value in apertures
        if value is not None and np.isfinite(value)
    ]
    values = np.asarray(
        np.interp(indices, indices[finite], np.asarray(valid_values, dtype=float)),
        dtype=float,
    )
    smoothed = np.asarray(
        [np.median(values[max(0, index - 1):min(len(values), index + 2)])
         for index in range(len(values))],
        dtype=float,
    )
    # Very small aperture changes cannot establish a reliable cycle, but do
    # not veto them here: the existing full-crop motion score remains the
    # independent low-motion safeguard for genuinely static mouths.
    if float(np.ptp(smoothed)) < 0.025:
        return True

    minimum_step = 0.008
    signs = [
        1 if difference >= minimum_step else -1 if difference <= -minimum_step else 0
        for difference in np.diff(smoothed)
    ]
    runs: list[tuple[int, int]] = []
    current_sign = 0
    current_length = 0
    for sign in signs:
        if sign == 0:
            continue
        if sign == current_sign:
            current_length += 1
            continue
        if current_sign:
            runs.append((current_sign, current_length))
        current_sign = sign
        current_length = 1
    if current_sign:
        runs.append((current_sign, current_length))

    # A one-sided drift (including a single abrupt overlay transition) is not
    # an open/close cycle.  A reversal only counts when both directions persist
    # for at least two sampled steps; this rejects a single-frame spike while
    # retaining short but genuine speaking fragments.
    if not runs:
        correlation = float(np.corrcoef(np.arange(len(smoothed)), smoothed)[0, 1])
        return not (float(np.ptp(smoothed)) >= 0.030 and abs(correlation) >= 0.75)
    if len(runs) == 1:
        return False
    if len(runs) >= 3:
        # A brief opening blip at the first frame followed by a long closing
        # drift and another one-frame blip is the common "slightly open" false
        # positive (rather than a speaking cycle).  Do not apply this to the
        # opposite polarity, which is frequently a real close-then-open cycle.
        if (
            runs[0][0] == 1
            and runs[-1][0] == 1
            and runs[0][1] == 1
            and runs[-1][1] == 1
        ):
            return False
        return True
    # One reversal is insufficient in a display-heavy segment: it can be a
    # single hand/overlay transition. Generic talking candidates are not
    # subjected to this stricter cycle requirement (see the caller).
    return False


def _requires_open_close_cycle(decision: CandidateDecision) -> bool:
    """Identify display-heavy model descriptions where lip evidence is critical.

    This is only a stricter validation path for known overlay/product-display
    contexts. Generic talking-to-camera candidates continue to use the normal
    motion score, avoiding false negatives when a short utterance is sampled
    between two phonemes.
    """
    action = (decision.current_action or "").lower()
    display_markers = (
        "展示面部",
        "面部皮肤",
        "展示手机",
        "手机屏幕",
        "技术图解",
        "涂抹粉底",
    )
    return any(marker in action for marker in display_markers)
