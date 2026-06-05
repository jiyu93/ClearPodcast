export type PauseAnchorInput = {
  duration: number;
  mediaCurrentTime: number;
};

export function resolvePauseAnchor({
  duration,
  mediaCurrentTime,
}: PauseAnchorInput) {
  return clampPlaybackTime(mediaCurrentTime, duration);
}

export function shouldRestorePlaybackTime({
  mediaCurrentTime,
  targetTime,
  toleranceSeconds = 0.02,
}: {
  mediaCurrentTime: number;
  targetTime: number;
  toleranceSeconds?: number;
}) {
  return Math.abs(mediaCurrentTime - targetTime) > toleranceSeconds;
}

function clampPlaybackTime(time: number, duration: number) {
  if (!Number.isFinite(time)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(time, 0);
  }

  return Math.min(Math.max(time, 0), duration);
}
