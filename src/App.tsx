import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

type AudioMetadata = {
  format: "wav" | "mp3" | "m4a";
  source_sample_rate: number;
  channels: number;
  frame_count?: number;
  duration_seconds?: number;
};

type EnhancementPreset =
  | "bluetooth_headset"
  | "meeting_recording"
  | "laptop_microphone"
  | "phone_recording";

type EnhancementJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type EnhancementJobSnapshot = {
  job_id: string;
  state: EnhancementJobState;
  preset: EnhancementPreset;
  input_audio: string;
  preview_wav?: string;
  exported_wav?: string;
  input_metadata?: AudioMetadata;
  output_metadata?: AudioMetadata;
  message: string;
  error?: string;
  created_at_ms: number;
  updated_at_ms: number;
};

type ExportResult = {
  exported_wav: string;
  output_metadata: AudioMetadata;
};

type RuntimeSettings = {
  python: string;
  model_dir: string;
};

const PRESETS: Array<{ id: EnhancementPreset; label: string }> = [
  { id: "bluetooth_headset", label: "Bluetooth headset" },
  { id: "meeting_recording", label: "Meeting recording" },
  { id: "laptop_microphone", label: "Laptop microphone" },
  { id: "phone_recording", label: "Phone recording" },
];

const DEFAULT_RUNTIME: RuntimeSettings = {
  python: "localfiles/runtime/macos-arm64/bin/python3",
  model_dir: "localfiles/models/resemble-enhance/enhancer_stage2",
};

const EXPECTED_CHECKPOINT_SHA256 =
  "f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6";

const TERMINAL_STATES: EnhancementJobState[] = [
  "completed",
  "failed",
  "cancelled",
];

export default function App() {
  const [selectedPath, setSelectedPath] = useState("");
  const [metadata, setMetadata] = useState<AudioMetadata | undefined>();
  const [preset, setPreset] =
    useState<EnhancementPreset>("meeting_recording");
  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettings>(DEFAULT_RUNTIME);
  const [job, setJob] = useState<EnhancementJobSnapshot | undefined>();
  const [isDragActive, setIsDragActive] = useState(false);
  const [notice, setNotice] = useState("Ready");
  const [exportMessage, setExportMessage] = useState("");

  const selectedFileName = useMemo(
    () => (selectedPath ? fileNameFromPath(selectedPath) : "No file"),
    [selectedPath],
  );
  const originalAudioSrc = useMemo(() => toAssetSrc(selectedPath), [selectedPath]);
  const enhancedAudioSrc = useMemo(
    () => toAssetSrc(job?.preview_wav),
    [job?.preview_wav],
  );
  const canRun = Boolean(selectedPath) && !isActiveJob(job);
  const canCancel = job?.state === "queued" || job?.state === "running";
  const canExport = job?.state === "completed" && Boolean(job.preview_wav);

  const refreshJob = useCallback(async (jobId: string) => {
    const snapshot = await invoke<EnhancementJobSnapshot>(
      "get_enhancement_job_command",
      { jobId },
    );
    setJob(snapshot);
    if (snapshot.state === "failed" && snapshot.error) {
      setNotice(snapshot.error);
    } else {
      setNotice(snapshot.message);
    }
  }, []);

  const selectAudioPath = useCallback(async (path: string) => {
    setSelectedPath(path);
    setMetadata(undefined);
    setJob(undefined);
    setExportMessage("");
    setNotice("Reading metadata");

    try {
      const probed = await invoke<AudioMetadata>("probe_audio_command", { path });
      setMetadata(probed);
      setNotice("Ready");
    } catch (error) {
      setNotice(String(error));
    }
  }, []);

  useEffect(() => {
    if (!tauriAvailable()) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragActive(true);
          return;
        }

        if (event.payload.type === "leave") {
          setIsDragActive(false);
          return;
        }

        setIsDragActive(false);
        const path = event.payload.paths.find(isSupportedAudioPath);
        if (path) {
          void selectAudioPath(path);
        } else {
          setNotice("Unsupported file type");
        }
      })
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      })
      .catch((error) => setNotice(String(error)));

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [selectAudioPath]);

  useEffect(() => {
    if (!job || TERMINAL_STATES.includes(job.state)) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshJob(job.job_id);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [job, refreshJob]);

  async function chooseAudio() {
    if (!tauriAvailable()) {
      setNotice("Tauri runtime is not available");
      return;
    }

    const path = await invoke<string | null>("pick_audio_file_command");
    if (path) {
      await selectAudioPath(path);
    }
  }

  async function runEnhancement() {
    if (!selectedPath) {
      setNotice("No input file selected");
      return;
    }

    setExportMessage("");
    setNotice("Queued");

    try {
      const snapshot = await invoke<EnhancementJobSnapshot>(
        "start_enhancement_job_command",
        {
          request: {
            ...runtimeSettings,
            input_audio: selectedPath,
            preset,
            device: "cpu",
            expected_checkpoint_sha256: EXPECTED_CHECKPOINT_SHA256,
          },
        },
      );
      setJob(snapshot);
    } catch (error) {
      setNotice(String(error));
    }
  }

  async function cancelJob() {
    if (!job) {
      return;
    }

    try {
      const snapshot = await invoke<EnhancementJobSnapshot>(
        "cancel_enhancement_job_command",
        { jobId: job.job_id },
      );
      setJob(snapshot);
      setNotice(snapshot.message);
    } catch (error) {
      setNotice(String(error));
    }
  }

  async function exportEnhancedWav() {
    if (!job || !canExport) {
      return;
    }

    const destination = await invoke<string | null>("pick_export_wav_command", {
      suggestedFileName: suggestedExportName(selectedPath),
    });
    if (!destination) {
      return;
    }

    try {
      const result = await invoke<ExportResult>("export_enhanced_wav_command", {
        jobId: job.job_id,
        destination,
      });
      setExportMessage(`Exported ${result.exported_wav}`);
      await refreshJob(job.job_id);
    } catch (error) {
      setNotice(String(error));
    }
  }

  function updateRuntimeField(field: keyof RuntimeSettings, value: string) {
    setRuntimeSettings((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Desktop MVP</p>
            <h1>ClearPodcast</h1>
          </div>
          <StatusPill state={job?.state ?? "idle"} />
        </header>

        <div className="mvp-grid">
          <section
            className={`import-panel ${isDragActive ? "drag-active" : ""}`}
          >
            <div className="section-heading">
              <span>Input</span>
              <button type="button" className="secondary-action" onClick={chooseAudio}>
                Choose audio
              </button>
            </div>

            <div className="drop-zone">
              <strong>{selectedFileName}</strong>
              <span>WAV, MP3, M4A</span>
            </div>

            <MetadataGrid metadata={metadata} />

            <div className="preset-group" role="radiogroup" aria-label="Preset">
              {PRESETS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === preset ? "preset active" : "preset"}
                  onClick={() => setPreset(option.id)}
                  aria-pressed={option.id === preset}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="action-row">
              <button
                type="button"
                className="primary-action"
                onClick={runEnhancement}
                disabled={!canRun}
              >
                Restore speech
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={cancelJob}
                disabled={!canCancel}
              >
                Cancel
              </button>
            </div>
          </section>

          <section className="status-panel">
            <div className="section-heading">
              <span>Job</span>
              <span className="job-id">{job?.job_id ?? "Not started"}</span>
            </div>

            <ol className="state-list">
              {(["queued", "running", "completed"] as EnhancementJobState[]).map(
                (state) => (
                  <li
                    key={state}
                    className={stateClassName(state, job?.state)}
                  >
                    {labelForState(state)}
                  </li>
                ),
              )}
            </ol>

            <div className="message-panel">
              <strong>{job?.message ?? notice}</strong>
              {job?.error ? <span>{job.error}</span> : <span>{notice}</span>}
              {exportMessage ? <span>{exportMessage}</span> : null}
            </div>

            <button
              type="button"
              className="primary-action export-action"
              onClick={exportEnhancedWav}
              disabled={!canExport}
            >
              Export WAV
            </button>
          </section>
        </div>

        <section className="playback-panel">
          <PlaybackColumn
            title="Original"
            src={originalAudioSrc}
            metadata={metadata}
          />
          <PlaybackColumn
            title="Enhanced"
            src={enhancedAudioSrc}
            metadata={job?.output_metadata}
          />
        </section>

        <section className="runtime-panel">
          <label>
            Python runtime
            <input
              value={runtimeSettings.python}
              onChange={(event) => updateRuntimeField("python", event.target.value)}
              spellCheck={false}
            />
          </label>
          <label>
            Model directory
            <input
              value={runtimeSettings.model_dir}
              onChange={(event) =>
                updateRuntimeField("model_dir", event.target.value)
              }
              spellCheck={false}
            />
          </label>
        </section>
      </section>
    </main>
  );
}

function MetadataGrid({ metadata }: { metadata?: AudioMetadata }) {
  const cells = metadata
    ? [
        metadata.format.toUpperCase(),
        `${metadata.source_sample_rate.toLocaleString()} Hz`,
        `${metadata.channels} ch`,
        formatDuration(metadata.duration_seconds),
      ]
    : ["--", "--", "--", "--"];

  return (
    <dl className="metadata-grid">
      {["Format", "Rate", "Channels", "Duration"].map((label, index) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{cells[index]}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlaybackColumn({
  title,
  src,
  metadata,
}: {
  title: string;
  src?: string;
  metadata?: AudioMetadata;
}) {
  return (
    <div className="playback-column">
      <div className="section-heading">
        <span>{title}</span>
        <span>{metadata ? formatMetadataShort(metadata) : "--"}</span>
      </div>
      {src ? (
        <audio controls preload="metadata" src={src} />
      ) : (
        <div className="audio-placeholder">No audio</div>
      )}
    </div>
  );
}

function StatusPill({ state }: { state: EnhancementJobState | "idle" }) {
  return <span className={`status-pill ${state}`}>{labelForState(state)}</span>;
}

function toAssetSrc(path?: string) {
  if (!path || !tauriAvailable()) {
    return undefined;
  }

  try {
    return convertFileSrc(path);
  } catch {
    return undefined;
  }
}

function tauriAvailable() {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

function isActiveJob(job?: EnhancementJobSnapshot) {
  return job?.state === "queued" || job?.state === "running";
}

function isSupportedAudioPath(path: string) {
  return /\.(wav|mp3|m4a)$/i.test(path);
}

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function suggestedExportName(path: string) {
  const fileName = fileNameFromPath(path);
  const stem = fileName.replace(/\.[^.]+$/, "") || "clearpodcast-output";
  return `${stem}.enhanced.wav`;
}

function formatDuration(duration?: number) {
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return "--";
  }

  const minutes = Math.floor(duration / 60);
  const seconds = Math.round(duration % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatMetadataShort(metadata: AudioMetadata) {
  return `${metadata.format.toUpperCase()} | ${metadata.source_sample_rate.toLocaleString()} Hz`;
}

function labelForState(state: EnhancementJobState | "idle") {
  switch (state) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Idle";
  }
}

function stateClassName(state: EnhancementJobState, current?: EnhancementJobState) {
  if (!current) {
    return "";
  }

  if (current === state) {
    return "current";
  }

  const order: EnhancementJobState[] = ["queued", "running", "completed"];
  if (order.indexOf(current) > order.indexOf(state)) {
    return "done";
  }

  if (current === "failed" || current === "cancelled") {
    return "muted";
  }

  return "";
}
