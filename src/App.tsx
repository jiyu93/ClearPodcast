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

type EnhancementJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

type EnhancementJobSnapshot = {
  job_id: string;
  state: EnhancementJobState;
  input_audio: string;
  preview_wav?: string;
  exported_wav?: string;
  input_metadata?: AudioMetadata;
  output_metadata?: AudioMetadata;
  device_info?: EnhancementDeviceInfo;
  message: string;
  error?: string;
  created_at_ms: number;
  updated_at_ms: number;
};

type EnhancementDeviceInfo = {
  selected_device: string;
  cuda_available?: boolean;
  torch_cuda_version?: string;
  cuda_device_name?: string;
};

type DeviceDetectionStatus = "checking" | "ready" | "error" | "unavailable";

type ExportResult = {
  exported_wav: string;
  output_metadata: AudioMetadata;
};

type PreparedAudioPreview = {
  input_audio: string;
  preview_audio: string;
  metadata: AudioMetadata;
};

type RuntimeSettings = {
  python: string;
  model_dir: string;
};

type EnhancementSolver = "midpoint" | "rk4" | "euler";

type EnhancementSettings = {
  solver: EnhancementSolver;
  nfe: number;
  lambd: number;
  tau: number;
};

type DisplayError = {
  summary: string;
  detail: string;
};

type ErrorContext =
  | "input"
  | "enhancement"
  | "device-detection"
  | "backend"
  | "cancellation"
  | "export";

const DEFAULT_RUNTIME: RuntimeSettings = {
  python: "",
  model_dir: "",
};

const DEFAULT_ENHANCEMENT_SETTINGS: EnhancementSettings = {
  solver: "midpoint",
  nfe: 64,
  lambd: 0.1,
  tau: 0.5,
};

const ENHANCEMENT_HELP = {
  solver: "Chooses the numerical solver used inside Resemble Enhance.",
  nfe: "Higher values can improve quality and usually take longer to run.",
  tau: "Higher values can add more variation and fullness, with less stability.",
  lambd: "Higher values apply stronger denoising before enhancement.",
};

const SOLVER_HELP: Record<EnhancementSolver, string> = {
  midpoint: "Recommended balance for most files.",
  rk4: "More cautious solver; can be slower on CPU.",
  euler: "Simpler and often faster; less refinement.",
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
  const [originalPreviewPath, setOriginalPreviewPath] = useState("");
  const [metadata, setMetadata] = useState<AudioMetadata | undefined>();
  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettings>(DEFAULT_RUNTIME);
  const [enhancementSettings, setEnhancementSettings] =
    useState<EnhancementSettings>(DEFAULT_ENHANCEMENT_SETTINGS);
  const [job, setJob] = useState<EnhancementJobSnapshot | undefined>();
  const [isDragActive, setIsDragActive] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [notice, setNotice] = useState("Choose a WAV, MP3, or M4A file");
  const [appError, setAppError] = useState<DisplayError>();
  const [exportMessage, setExportMessage] = useState("");
  const [detectedDeviceInfo, setDetectedDeviceInfo] =
    useState<EnhancementDeviceInfo>();
  const [deviceStatus, setDeviceStatus] =
    useState<DeviceDetectionStatus>("checking");
  const [deviceError, setDeviceError] = useState("");

  const selectedFileName = useMemo(
    () => (selectedPath ? fileNameFromPath(selectedPath) : "No file"),
    [selectedPath],
  );
  const originalAudioSrc = useMemo(
    () => toAssetSrc(originalPreviewPath || selectedPath),
    [originalPreviewPath, selectedPath],
  );
  const enhancedAudioSrc = useMemo(
    () => toAssetSrc(job?.preview_wav),
    [job?.preview_wav],
  );
  const canRun = Boolean(selectedPath) && !isActiveJob(job);
  const canCancel = job?.state === "queued" || job?.state === "running";
  const canExport = job?.state === "completed" && Boolean(job.preview_wav);
  const settingsLocked = isActiveJob(job);
  const displayedDeviceInfo = job?.device_info ?? detectedDeviceInfo;
  const deviceInfoIsActual = Boolean(job?.device_info);
  const displayError =
    job?.state === "failed" && job.error
      ? describeError(job.error, "enhancement")
      : appError;

  const showError = useCallback((error: unknown, context: ErrorContext) => {
    const display = describeError(error, context);
    setAppError(display);
    setNotice(display.summary);
  }, []);

  const cleanupPreview = useCallback(async (previewPath: string) => {
    if (!previewPath || !tauriAvailable()) {
      return;
    }

    try {
      await invoke("cleanup_audio_preview_command", { previewAudio: previewPath });
    } catch {
      // Preview cleanup is best-effort; stale files remain under the app temp root.
    }
  }, []);

  const refreshJob = useCallback(async (jobId: string) => {
    const snapshot = await invoke<EnhancementJobSnapshot>(
      "get_enhancement_job_command",
      { jobId },
    );
    setJob(snapshot);
    if (snapshot.device_info) {
      setDetectedDeviceInfo(snapshot.device_info);
      setDeviceStatus("ready");
      setDeviceError("");
    }
    if (snapshot.state === "failed" && snapshot.error) {
      const display = describeError(snapshot.error, "enhancement");
      setAppError(display);
      setNotice(display.summary);
    } else {
      setNotice(productNoticeForJob(snapshot));
    }
  }, []);

  const selectAudioPath = useCallback(async (path: string) => {
    setSelectedPath(path);
    setOriginalPreviewPath("");
    setMetadata(undefined);
    setJob(undefined);
    setExportMessage("");
    setAppError(undefined);
    setNotice("Reading source audio");

    try {
      const prepared = await invoke<PreparedAudioPreview>(
        "prepare_audio_preview_command",
        { path },
      );
      setSelectedPath(prepared.input_audio);
      setOriginalPreviewPath(prepared.preview_audio);
      setMetadata(prepared.metadata);
      setNotice("Ready to restore");
    } catch (error) {
      setSelectedPath("");
      setOriginalPreviewPath("");
      showError(error, "input");
    }
  }, [showError]);

  useEffect(() => {
    return () => {
      if (originalPreviewPath) {
        void cleanupPreview(originalPreviewPath);
      }
    };
  }, [cleanupPreview, originalPreviewPath]);

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
          showError("Unsupported file type", "input");
        }
      })
      .then((unlisten) => {
        if (cancelled) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      })
      .catch((error) => showError(error, "backend"));

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [selectAudioPath, showError]);

  useEffect(() => {
    if (!tauriAvailable()) {
      setDeviceStatus("unavailable");
      return;
    }

    let cancelled = false;
    const python = runtimeSettings.python.trim();
    setDeviceStatus("checking");
    setDeviceError("");

    const timeout = window.setTimeout(async () => {
      try {
        const request = python ? { python } : {};
        const info = await invoke<EnhancementDeviceInfo>(
          "detect_processing_device_command",
          { request },
        );
        if (!cancelled) {
          setDetectedDeviceInfo(info);
          setDeviceStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setDetectedDeviceInfo(undefined);
          setDeviceStatus("error");
          setDeviceError(String(error));
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [runtimeSettings.python]);

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
      showError("Tauri runtime is not available", "backend");
      return;
    }

    const path = await invoke<string | null>("pick_audio_file_command");
    if (path) {
      await selectAudioPath(path);
    }
  }

  async function runEnhancement() {
    if (!selectedPath) {
      setNotice("Choose an audio file first");
      return;
    }

    setExportMessage("");
    setAppError(undefined);
    setNotice("Restoration queued");

    try {
      const snapshot = await invoke<EnhancementJobSnapshot>(
        "start_enhancement_job_command",
        {
          request: {
            ...runtimeOverrides(runtimeSettings),
            ...enhancementSettings,
            input_audio: selectedPath,
            device: "auto",
            expected_checkpoint_sha256: EXPECTED_CHECKPOINT_SHA256,
          },
        },
      );
      setJob(snapshot);
    } catch (error) {
      showError(error, "enhancement");
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
      setAppError(undefined);
      setNotice("Cancelling restoration");
    } catch (error) {
      showError(error, "cancellation");
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
      await invoke<ExportResult>("export_enhanced_wav_command", {
        jobId: job.job_id,
        destination,
      });
      setExportMessage("Export complete");
      await refreshJob(job.job_id);
    } catch (error) {
      showError(error, "export");
    }
  }

  function updateRuntimeField(field: keyof RuntimeSettings, value: string) {
    setRuntimeSettings((current) => ({ ...current, [field]: value }));
  }

  function updateEnhancementField<K extends keyof EnhancementSettings>(
    field: K,
    value: EnhancementSettings[K],
  ) {
    setEnhancementSettings((current) => ({ ...current, [field]: value }));
  }

  function resetEnhancementSettings() {
    setEnhancementSettings(DEFAULT_ENHANCEMENT_SETTINGS);
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="app-header">
          <div>
            <p className="eyebrow">Offline speech restoration</p>
            <h1>ClearPodcast</h1>
          </div>
          <StatusPill state={job?.state ?? "idle"} />
        </header>

        <div className="app-content">
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

              <div className="advanced-settings">
                <button
                  type="button"
                  className="advanced-toggle secondary-action"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  aria-expanded={advancedOpen}
                  aria-controls="enhancement-settings"
                >
                  <span>Advanced settings</span>
                  <span className="advanced-toggle-state">
                    {advancedOpen ? "Hide" : "Show"}
                  </span>
                </button>

                {advancedOpen ? (
                  <div id="enhancement-settings" className="enhancement-controls">
                    <div className="section-heading compact-heading">
                      <span>Enhancement</span>
                      <button
                        type="button"
                        className="secondary-action reset-action"
                        onClick={resetEnhancementSettings}
                        disabled={settingsLocked}
                      >
                        Reset defaults
                      </button>
                    </div>

                    <div className="solver-panel">
                      <label
                        className="solver-select"
                        title={ENHANCEMENT_HELP.solver}
                      >
                        <span>Solver</span>
                        <select
                          value={enhancementSettings.solver}
                          onChange={(event) =>
                            updateEnhancementField(
                              "solver",
                              event.target.value as EnhancementSolver,
                            )
                          }
                          disabled={settingsLocked}
                        >
                          <option value="midpoint">Midpoint</option>
                          <option value="rk4">RK4</option>
                          <option value="euler">Euler</option>
                        </select>
                      </label>
                      <div className="solver-guide">
                        <span className="solver-guide-title">Solver guide</span>
                        <dl className="solver-notes" aria-label="Solver differences">
                          <div>
                            <dt>Midpoint</dt>
                            <dd>{SOLVER_HELP.midpoint}</dd>
                          </div>
                          <div>
                            <dt>RK4</dt>
                            <dd>{SOLVER_HELP.rk4}</dd>
                          </div>
                          <div>
                            <dt>Euler</dt>
                            <dd>{SOLVER_HELP.euler}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div className="slider-grid">
                      <div className="slider-card">
                        <label className="slider-control" title={ENHANCEMENT_HELP.nfe}>
                          <span>
                            <span>CFM steps</span>
                            <strong>{enhancementSettings.nfe}</strong>
                          </span>
                          <input
                            type="range"
                            min="1"
                            max="128"
                            step="1"
                            value={enhancementSettings.nfe}
                            onChange={(event) =>
                              updateEnhancementField(
                                "nfe",
                                Number(event.target.value),
                              )
                            }
                            disabled={settingsLocked}
                          />
                        </label>
                        <p className="field-hint">{ENHANCEMENT_HELP.nfe}</p>
                      </div>

                      <div className="slider-card">
                        <label className="slider-control" title={ENHANCEMENT_HELP.tau}>
                          <span>
                            <span>Prior temperature</span>
                            <strong>{enhancementSettings.tau.toFixed(2)}</strong>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={enhancementSettings.tau}
                            onChange={(event) =>
                              updateEnhancementField(
                                "tau",
                                Number(event.target.value),
                              )
                            }
                            disabled={settingsLocked}
                          />
                        </label>
                        <p className="field-hint">{ENHANCEMENT_HELP.tau}</p>
                      </div>

                      <div className="slider-card">
                        <label
                          className="slider-control"
                          title={ENHANCEMENT_HELP.lambd}
                        >
                          <span>
                            <span>Denoising</span>
                            <strong>{enhancementSettings.lambd.toFixed(2)}</strong>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={enhancementSettings.lambd}
                            onChange={(event) =>
                              updateEnhancementField(
                                "lambd",
                                Number(event.target.value),
                              )
                            }
                            disabled={settingsLocked}
                          />
                        </label>
                        <p className="field-hint">{ENHANCEMENT_HELP.lambd}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
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
                <span>Restoration</span>
                <span className="job-id">{job ? labelForState(job.state) : "Not started"}</span>
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

              <DeviceNotice
                deviceInfo={displayedDeviceInfo}
                status={deviceStatus}
                error={deviceError}
                actual={deviceInfoIsActual}
              />

              <div className="message-panel">
                <strong>{statusTitle(job, displayError, notice)}</strong>
                <span>{statusDetail(job, displayError, notice)}</span>
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

          <DiagnosticsPanel
            open={diagnosticsOpen}
            onToggle={() => setDiagnosticsOpen((open) => !open)}
            runtimeSettings={runtimeSettings}
            updateRuntimeField={updateRuntimeField}
            selectedPath={selectedPath}
            originalPreviewPath={originalPreviewPath}
            job={job}
            displayError={displayError}
            deviceError={deviceError}
          />
        </div>
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

function DiagnosticsPanel({
  open,
  onToggle,
  runtimeSettings,
  updateRuntimeField,
  selectedPath,
  originalPreviewPath,
  job,
  displayError,
  deviceError,
}: {
  open: boolean;
  onToggle: () => void;
  runtimeSettings: RuntimeSettings;
  updateRuntimeField: (field: keyof RuntimeSettings, value: string) => void;
  selectedPath: string;
  originalPreviewPath: string;
  job?: EnhancementJobSnapshot;
  displayError?: DisplayError;
  deviceError?: string;
}) {
  const deviceDisplayError = deviceError
    ? describeError(deviceError, "device-detection")
    : undefined;

  return (
    <section className="diagnostics-panel">
      <button
        type="button"
        className="advanced-toggle secondary-action"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="diagnostics-content"
      >
        <span>Diagnostics</span>
        <span className="advanced-toggle-state">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div id="diagnostics-content" className="diagnostics-content">
          <div className="runtime-fields">
            <label>
              Python runtime override
              <input
                value={runtimeSettings.python}
                onChange={(event) => updateRuntimeField("python", event.target.value)}
                placeholder="Packaged runtime"
                spellCheck={false}
              />
            </label>
            <label>
              Model directory override
              <input
                value={runtimeSettings.model_dir}
                onChange={(event) =>
                  updateRuntimeField("model_dir", event.target.value)
                }
                placeholder="Packaged model"
                spellCheck={false}
              />
            </label>
          </div>

          <dl className="diagnostic-list">
            <DiagnosticRow label="Input path" value={selectedPath} />
            <DiagnosticRow label="Preview copy" value={originalPreviewPath} />
            <DiagnosticRow label="Job id" value={job?.job_id} />
            <DiagnosticRow label="Preview WAV" value={job?.preview_wav} />
            <DiagnosticRow label="Exported WAV" value={job?.exported_wav} />
            <DiagnosticRow label="Runtime detail" value={displayError?.detail} />
            <DiagnosticRow
              label="Device detail"
              value={deviceDisplayError?.detail}
            />
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function DiagnosticRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "--"}</dd>
    </div>
  );
}

function StatusPill({ state }: { state: EnhancementJobState | "idle" }) {
  return <span className={`status-pill ${state}`}>{labelForState(state)}</span>;
}

function DeviceNotice({
  deviceInfo,
  status,
  error,
  actual,
}: {
  deviceInfo?: EnhancementDeviceInfo;
  status: DeviceDetectionStatus;
  error?: string;
  actual: boolean;
}) {
  const displayError = error
    ? describeError(error, "device-detection")
    : undefined;

  if (!deviceInfo) {
    if (status === "checking") {
      return (
        <div className="device-notice pending">
          <span>Processing device</span>
          <strong>Detecting</strong>
          <small>Checking runtime</small>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="device-notice error">
          <span>Processing device</span>
          <strong>Detection failed</strong>
          <small>{displayError?.summary}</small>
        </div>
      );
    }

    return null;
  }

  const isCuda = deviceInfo.selected_device.toLowerCase() === "cuda";
  const detail = isCuda
    ? (deviceInfo.cuda_device_name ?? cudaVersionLabel(deviceInfo))
    : cpuDeviceDetail(deviceInfo);
  const label = actual
    ? isCuda
      ? "Using NVIDIA GPU"
      : "Using CPU"
    : isCuda
      ? "NVIDIA GPU ready"
      : "CPU fallback ready";

  return (
    <div className={`device-notice ${isCuda ? "cuda" : "cpu"}`}>
      <span>Processing device</span>
      <strong>{label}</strong>
      <small>{detail}</small>
    </div>
  );
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

function runtimeOverrides(settings: RuntimeSettings) {
  const overrides: Partial<RuntimeSettings> = {};
  const python = settings.python.trim();
  const modelDir = settings.model_dir.trim();

  if (python) {
    overrides.python = python;
  }

  if (modelDir) {
    overrides.model_dir = modelDir;
  }

  return overrides;
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

function cudaVersionLabel(deviceInfo: EnhancementDeviceInfo) {
  return deviceInfo.torch_cuda_version
    ? `CUDA ${deviceInfo.torch_cuda_version}`
    : "CUDA available";
}

function cpuDeviceDetail(deviceInfo: EnhancementDeviceInfo) {
  if (deviceInfo.cuda_available) {
    return "CUDA available; CPU selected";
  }

  return deviceInfo.torch_cuda_version
    ? `CUDA ${deviceInfo.torch_cuda_version} unavailable`
    : "CUDA unavailable";
}

function productNoticeForJob(job: EnhancementJobSnapshot) {
  switch (job.state) {
    case "queued":
      return "Restoration queued";
    case "running":
      return "Restoring speech";
    case "completed":
      return "Enhanced WAV is ready";
    case "failed":
      return "Restoration needs attention";
    case "cancelled":
      return "Restoration cancelled";
  }
}

function statusTitle(
  job: EnhancementJobSnapshot | undefined,
  error: DisplayError | undefined,
  notice: string,
) {
  if (error) {
    return error.summary;
  }

  if (job) {
    return productNoticeForJob(job);
  }

  return notice;
}

function statusDetail(
  job: EnhancementJobSnapshot | undefined,
  error: DisplayError | undefined,
  notice: string,
) {
  if (error) {
    return "Open Diagnostics for technical details.";
  }

  if (!job) {
    return notice === "Ready to restore"
      ? "Run restoration locally, then compare the original and enhanced audio."
      : "Choose a supported spoken-word recording to begin.";
  }

  switch (job.state) {
    case "queued":
      return "The local restoration job is waiting to start.";
    case "running":
      return "Processing stays on this machine and can take a while on CPU.";
    case "completed":
      return "Listen to the result, then export the enhanced WAV when it is ready.";
    case "failed":
      return "The job stopped before producing a preview WAV.";
    case "cancelled":
      return "No partial enhanced output was kept.";
  }
}

function describeError(error: unknown, context: ErrorContext): DisplayError {
  const detail = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const normalized = detail.toLowerCase();

  if (context === "cancellation" || normalized.includes("cancelled")) {
    return {
      summary: "Restoration was cancelled.",
      detail,
    };
  }

  if (context === "device-detection") {
    return {
      summary: "Processing device could not be checked.",
      detail,
    };
  }

  if (
    normalized.includes("unsupported audio input extension") ||
    normalized.includes("unsupported file type") ||
    normalized.includes("unsupported_input")
  ) {
    return {
      summary: "Choose a WAV, MP3, or M4A file.",
      detail,
    };
  }

  if (
    normalized.includes("audio file was not found") ||
    normalized.includes("input audio file was not found") ||
    normalized.includes("missing_input_wav")
  ) {
    return {
      summary: "The selected audio file could not be found.",
      detail,
    };
  }

  if (
    normalized.includes("failed to probe audio") ||
    normalized.includes("failed to decode audio") ||
    normalized.includes("failed to read wav") ||
    normalized.includes("failed to open audio") ||
    normalized.includes("no default audio track") ||
    normalized.includes("no usable sample-rate") ||
    normalized.includes("no usable channel") ||
    normalized.includes("decoded to no samples")
  ) {
    return {
      summary: "ClearPodcast could not read this audio file.",
      detail,
    };
  }

  if (
    normalized.includes("python runtime was not found") ||
    normalized.includes("packaged python runtime was not found") ||
    normalized.includes("local python runtime was not found") ||
    normalized.includes("tauri runtime is not available")
  ) {
    return {
      summary: "The local restoration runtime is missing.",
      detail,
    };
  }

  if (
    normalized.includes("model directory was not found") ||
    normalized.includes("required model file") ||
    normalized.includes("missing_model") ||
    normalized.includes("model_checkpoint_mismatch") ||
    normalized.includes("model latest")
  ) {
    return {
      summary: "The bundled speech restoration model is missing or incomplete.",
      detail,
    };
  }

  if (
    normalized.includes("sidecar failed") ||
    normalized.includes("sidecar did not write") ||
    normalized.includes("failed to launch sidecar") ||
    normalized.includes("missing_runtime_dependency") ||
    normalized.includes("unexpected_sidecar_error")
  ) {
    return {
      summary: "Restoration failed inside the local AI runtime.",
      detail,
    };
  }

  if (
    normalized.includes("export path must end in .wav") ||
    normalized.includes("output path must end in .wav")
  ) {
    return {
      summary: "Choose a .wav export location.",
      detail,
    };
  }

  if (context === "export") {
    return {
      summary: "The enhanced WAV could not be exported.",
      detail,
    };
  }

  if (context === "input") {
    return {
      summary: "The selected file could not be imported.",
      detail,
    };
  }

  return {
    summary: "ClearPodcast hit a local processing error.",
    detail,
  };
}

function labelForState(state: EnhancementJobState | "idle") {
  switch (state) {
    case "queued":
      return "Queued";
    case "running":
      return "Restoring";
    case "completed":
      return "Restored";
    case "failed":
      return "Needs attention";
    case "cancelled":
      return "Cancelled";
    default:
      return "Ready";
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
