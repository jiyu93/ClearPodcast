import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import { formatMetadataShort } from "../domain/enhancement";
import type { AudioMetadata } from "../domain/types";
import {
  MutedIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
} from "./icons";
import {
  resolvePauseAnchor,
  shouldRestorePlaybackTime,
} from "./audioPlaybackTiming";
import {
  createFallbackPeaks,
  createWaveformColumns,
  createPeaksFromAudioBuffer,
} from "./audioWaveform";

const SEEK_MAX = 10000;
const EMPTY_WAVEFORM_PEAKS: number[] = [];

export function AudioPreviewLane({
  title,
  src,
  metadata,
  showHeader = true,
  showMetadata = true,
}: {
  title: string;
  src?: string;
  metadata?: AudioMetadata;
  showHeader?: boolean;
  showMetadata?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const playedWaveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const displayedClockRef = useRef("");
  const pauseAnchorRef = useRef<number | undefined>(undefined);
  const fallbackPeaks = useMemo(() => createFallbackPeaks(title), [title]);
  const [peaks, setPeaks] = useState(fallbackPeaks);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(metadata?.duration_seconds ?? 0);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const durationForDisplay = duration || metadata?.duration_seconds || 0;
  const progress = durationForDisplay
    ? Math.min(currentTime / durationForDisplay, 1)
    : 0;
  const visiblePeaks = src ? peaks : EMPTY_WAVEFORM_PEAKS;

  // Playback animation stays outside React render to keep the waveform smooth.
  const syncPlaybackPosition = (time: number, commitState = false) => {
    const nextDuration = durationRef.current;
    const boundedTime = nextDuration
      ? Math.min(Math.max(time, 0), nextDuration)
      : 0;
    const nextProgress = nextDuration ? boundedTime / nextDuration : 0;

    currentTimeRef.current = boundedTime;

    const nextClock = `${formatClock(boundedTime)} / ${formatClock(
      nextDuration,
    )}`;

    if (clockRef.current && displayedClockRef.current !== nextClock) {
      clockRef.current.textContent = nextClock;
      displayedClockRef.current = nextClock;
    }
    if (playheadRef.current) {
      const scrubberWidth = scrubberRef.current?.clientWidth ?? 0;
      playheadRef.current.style.transform = `translateX(${
        nextProgress * scrubberWidth
      }px) translateX(-50%)`;
    }
    if (playedWaveformCanvasRef.current) {
      playedWaveformCanvasRef.current.style.clipPath = `inset(0 ${
        (1 - nextProgress) * 100
      }% 0 0)`;
    }
    if (rangeRef.current) {
      rangeRef.current.value = String(Math.round(nextProgress * SEEK_MAX));
    }
    if (commitState) {
      setCurrentTime(boundedTime);
    }
  };

  const stopPlaybackAnimation = () => {
    if (animationRef.current !== undefined) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  };

  const setAudioTime = (audio: HTMLAudioElement, time: number) => {
    if (!Number.isFinite(time)) {
      return;
    }

    audio.currentTime = clampPlaybackTime(time, durationRef.current);
  };

  const startPlaybackAnimation = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    syncPlaybackPosition(audio.currentTime);

    if (animationRef.current !== undefined) {
      return;
    }

    const tick = () => {
      const activeAudio = audioRef.current;
      if (!activeAudio || activeAudio.paused || activeAudio.ended) {
        animationRef.current = undefined;
        return;
      }

      syncPlaybackPosition(activeAudio.currentTime);
      animationRef.current = window.requestAnimationFrame(tick);
    };

    animationRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    currentTimeRef.current = 0;
    pauseAnchorRef.current = undefined;
    setCurrentTime(0);
    setDuration(metadata?.duration_seconds ?? 0);
    setIsPlaying(false);
  }, [metadata?.duration_seconds, src]);

  useEffect(() => {
    const scrubber = scrubberRef.current;
    if (!scrubber) {
      return;
    }

    const updateSize = () => {
      const rect = scrubber.getBoundingClientRect();
      setCanvasSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(scrubber);
    updateSize();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!src) {
      setPeaks(EMPTY_WAVEFORM_PEAKS);
      return;
    }

    let cancelled = false;
    setPeaks(fallbackPeaks);

    void buildWaveformPeaks(src)
      .then((nextPeaks) => {
        if (!cancelled) {
          setPeaks(nextPeaks);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPeaks(fallbackPeaks);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackPeaks, src]);

  useEffect(() => {
    drawWaveform({
      canvas: waveformCanvasRef.current,
      duration: durationForDisplay,
      height: canvasSize.height,
      peaks: visiblePeaks,
      waveformColor: "#81c7e8",
      width: canvasSize.width,
    });
    drawWaveform({
      canvas: playedWaveformCanvasRef.current,
      duration: durationForDisplay,
      height: canvasSize.height,
      peaks: visiblePeaks,
      waveformColor: "#0f7664",
      width: canvasSize.width,
    });
    syncPlaybackPosition(currentTimeRef.current);
  }, [canvasSize.height, canvasSize.width, durationForDisplay, visiblePeaks]);

  useEffect(() => {
    durationRef.current = durationForDisplay;
    syncPlaybackPosition(currentTimeRef.current, true);
  }, [durationForDisplay]);

  useEffect(() => stopPlaybackAnimation, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      const resumeTime = pauseAnchorRef.current;
      if (resumeTime !== undefined) {
        if (
          shouldRestorePlaybackTime({
            mediaCurrentTime: audio.currentTime,
            targetTime: resumeTime,
          })
        ) {
          setAudioTime(audio, resumeTime);
        }
        syncPlaybackPosition(resumeTime, true);
      }

      try {
        await audio.play();
        pauseAnchorRef.current = undefined;
        startPlaybackAnimation();
        setIsPlaying(true);
      } catch {
        stopPlaybackAnimation();
        setIsPlaying(false);
      }
    } else {
      const pauseAnchor = resolvePauseAnchor({
        duration: durationRef.current,
        mediaCurrentTime: audio.currentTime,
      });
      pauseAnchorRef.current = pauseAnchor;
      audio.pause();
      syncPlaybackPosition(pauseAnchor, true);
      stopPlaybackAnimation();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
  };

  const updateVolume = (nextVolume: number) => {
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
      audioRef.current.muted = nextVolume === 0;
    }
  };

  const seekToTime = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio || !durationForDisplay) {
      return;
    }

    const boundedTime = Math.min(Math.max(nextTime, 0), durationForDisplay);
    audio.currentTime = boundedTime;
    pauseAnchorRef.current = audio.paused ? boundedTime : undefined;
    syncPlaybackPosition(boundedTime, true);
  };

  const seekTo = (value: number) => {
    seekToTime((value / SEEK_MAX) * durationForDisplay);
  };

  const seekBy = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio || !durationForDisplay) {
      return;
    }

    const nextTime = Math.min(
      Math.max(audio.currentTime + deltaSeconds, 0),
      durationForDisplay,
    );
    seekToTime(nextTime);
  };

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!durationForDisplay) {
      return;
    }

    const scrubber = event.currentTarget;
    const rect = scrubber.getBoundingClientRect();
    const left = rect.left + scrubber.clientLeft;
    const width = scrubber.clientWidth;
    const nextProgress = Math.min(
      Math.max((event.clientX - left) / width, 0),
      1,
    );
    seekToTime(nextProgress * durationForDisplay);
  };

  const PlayPauseIcon = isPlaying ? PauseIcon : PlayIcon;
  const VolumeModeIcon = isMuted ? MutedIcon : VolumeIcon;

  return (
    <div className={`playback-lane ${src ? "has-audio" : "is-empty"}`}>
      {showHeader ? (
        <div className="lane-header">
          <span>{title}</span>
          {showMetadata ? <strong>{formatMetadataShort(metadata)}</strong> : null}
        </div>
      ) : null}
      <div className={`waveform-player ${src ? "has-source" : "no-source"}`}>
        {src ? (
          <audio
            ref={audioRef}
            preload="metadata"
            src={src}
            muted={isMuted}
            onDurationChange={(event) => {
              const nextDuration = event.currentTarget.duration;
              if (Number.isFinite(nextDuration)) {
                setDuration(nextDuration);
              }
            }}
            onLoadedMetadata={(event) => {
              const nextDuration = event.currentTarget.duration;
              if (Number.isFinite(nextDuration)) {
                setDuration(nextDuration);
              }
            }}
            onPause={(event) => {
              stopPlaybackAnimation();
              const pauseAnchor =
                pauseAnchorRef.current ??
                resolvePauseAnchor({
                  duration: durationRef.current,
                  mediaCurrentTime: event.currentTarget.currentTime,
                });
              pauseAnchorRef.current = pauseAnchor;
              syncPlaybackPosition(pauseAnchor, true);
              setIsPlaying(false);
            }}
            onPlay={(event) => {
              syncPlaybackPosition(event.currentTarget.currentTime, true);
              startPlaybackAnimation();
              setIsPlaying(true);
            }}
            onTimeUpdate={(event) => {
              if (
                event.currentTarget.paused &&
                pauseAnchorRef.current !== undefined
              ) {
                return;
              }
              syncPlaybackPosition(event.currentTarget.currentTime);
            }}
            onEnded={() => {
              stopPlaybackAnimation();
              pauseAnchorRef.current = undefined;
              setIsPlaying(false);
              syncPlaybackPosition(0, true);
            }}
          />
        ) : null}
        <div
          className="waveform-scrubber"
          aria-disabled={!src}
          ref={scrubberRef}
          onPointerDown={
            src
              ? (event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  seekFromPointer(event);
                }
              : undefined
          }
          onPointerMove={
            src
              ? (event) => {
                  if (event.buttons === 1) {
                    seekFromPointer(event);
                  }
                }
              : undefined
          }
        >
          <div className="waveform-canvas-frame">
            <canvas
              ref={waveformCanvasRef}
              className="waveform-canvas"
              aria-hidden="true"
            />
            <canvas
              ref={playedWaveformCanvasRef}
              className="waveform-canvas waveform-canvas-played"
              aria-hidden="true"
            />
          </div>
          {src ? (
            <>
              <input
                ref={rangeRef}
                aria-label={`Seek ${title} audio`}
                className="waveform-range"
                max={SEEK_MAX}
                min={0}
                step={1}
                type="range"
                value={Math.round(progress * SEEK_MAX)}
                onChange={(event) => seekTo(Number(event.currentTarget.value))}
              />
              <span
                ref={playheadRef}
                className="waveform-playhead"
                aria-hidden="true"
              />
            </>
          ) : null}
        </div>
        <div className="player-controls">
          <span className="player-clock" aria-label={`${title} playback time`}>
            <span ref={clockRef}>
              {formatClock(currentTime)} / {formatClock(durationForDisplay)}
            </span>
          </span>
          <div
            className="transport-cluster"
            aria-label={`${title} transport controls`}
          >
            <button
              type="button"
              className="icon-button player-icon-button transport-side-button"
              onClick={() => seekBy(-5)}
              aria-label={`Skip back ${title} 5 seconds`}
              title="Back 5 seconds"
              disabled={!src}
            >
              <SkipBackIcon className="button-icon" />
            </button>
            <button
              type="button"
              className="icon-button player-icon-button transport-play-button"
              onClick={() => {
                void togglePlayback();
              }}
              aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
              title={isPlaying ? "Pause" : "Play"}
              disabled={!src}
            >
              <PlayPauseIcon className="button-icon" />
            </button>
            <button
              type="button"
              className="icon-button player-icon-button transport-side-button"
              onClick={() => seekBy(5)}
              aria-label={`Skip forward ${title} 5 seconds`}
              title="Forward 5 seconds"
              disabled={!src}
            >
              <SkipForwardIcon className="button-icon" />
            </button>
          </div>
          <div className="volume-control">
            <button
              type="button"
              className="icon-button player-icon-button"
              onClick={toggleMute}
              aria-label={isMuted ? `Unmute ${title}` : `Mute ${title}`}
              title={isMuted ? "Unmute" : "Mute"}
              disabled={!src}
            >
              <VolumeModeIcon className="button-icon" />
            </button>
            <input
              aria-label={`${title} volume`}
              className="volume-slider"
              disabled={!src}
              max={1}
              min={0}
              step={0.01}
              type="range"
              value={isMuted ? 0 : volume}
              onChange={(event) =>
                updateVolume(Number(event.currentTarget.value))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00.00";
  }

  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const hundredths = Math.floor((seconds % 1) * 100)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${wholeSeconds}.${hundredths}`;
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

async function buildWaveformPeaks(src: string) {
  const response = await fetch(src);
  const audioData = await response.arrayBuffer();
  const windowWithAudio = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor =
    window.AudioContext ?? windowWithAudio.webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("AudioContext unavailable");
  }

  const context = new AudioContextCtor();

  try {
    const buffer = await context.decodeAudioData(audioData.slice(0));
    const peaks = createPeaksFromAudioBuffer(buffer);
    return peaks;
  } finally {
    void context.close();
  }
}

function drawWaveform({
  canvas,
  duration,
  height,
  peaks,
  waveformColor,
  width,
}: {
  canvas: HTMLCanvasElement | null;
  duration: number;
  height: number;
  peaks: number[];
  waveformColor: string;
  width: number;
}) {
  if (!canvas || width <= 0 || height <= 0) {
    return;
  }

  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, height);

  const centerY = height / 2;
  const waveformTop = 18;
  const waveformHeight = Math.max(12, height - waveformTop - 18);
  const halfHeight = waveformHeight / 2;

  context.lineWidth = 1;
  context.strokeStyle = "rgba(20, 33, 31, 0.24)";
  context.beginPath();
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.stroke();

  const tickCount = 8;
  for (let tick = 0; tick <= tickCount; tick += 1) {
    const x = (tick / tickCount) * width;
    context.strokeStyle = tick % 2 === 0 ? "rgba(20, 33, 31, 0.24)" : "rgba(20, 33, 31, 0.13)";
    context.beginPath();
    context.moveTo(x, 8);
    context.lineTo(x, height - 8);
    context.stroke();

    if (duration > 0 && tick % 2 === 0) {
      context.fillStyle = "rgba(66, 83, 79, 0.9)";
      context.font = "700 10px Inter, system-ui, sans-serif";
      context.fillText(formatClock((duration * tick) / tickCount), x + 4, 13);
    }
  }

  context.fillStyle = waveformColor;
  for (const column of createWaveformColumns(peaks, width, halfHeight)) {
    context.fillRect(
      column.x,
      centerY - column.halfHeight,
      column.width,
      column.halfHeight * 2,
    );
  }
}
