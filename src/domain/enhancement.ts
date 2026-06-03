import type {
  AudioMetadata,
  DisplayError,
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
  EnhancementJobState,
  EnhancementSettings,
  EnhancementSolver,
  ErrorContext,
  RuntimeSettings,
} from "./types";

export const DEFAULT_RUNTIME: RuntimeSettings = {
  python: "",
  model_dir: "",
};

export const DEFAULT_ENHANCEMENT_SETTINGS: EnhancementSettings = {
  solver: "midpoint",
  nfe: 64,
  lambd: 0.1,
  tau: 0.5,
};

export const ENHANCEMENT_HELP = {
  solver: "Chooses the numerical solver used inside Resemble Enhance.",
  nfe: "Higher values can improve quality and usually take longer to run.",
  tau: "Higher values can add more variation and fullness, with less stability.",
  lambd: "Higher values apply stronger denoising before enhancement.",
};

export const SOLVER_HELP: Record<EnhancementSolver, string> = {
  midpoint: "Recommended balance for most files.",
  rk4: "More cautious solver; can be slower on CPU.",
  euler: "Simpler and often faster; less refinement.",
};

export const EXPECTED_CHECKPOINT_SHA256 =
  "f9d035f318de3e6d919bc70cf7ad7d32b4fe92ec5cbe0b30029a27f5db07d9d6";

export const TERMINAL_STATES: EnhancementJobState[] = [
  "completed",
  "failed",
  "cancelled",
];

export type WorkflowStep = {
  id: "source" | "prepare" | "restore" | "compare" | "export";
  label: string;
  state: "idle" | "current" | "done" | "muted" | "blocked";
};

export function isActiveJob(job?: EnhancementJobSnapshot) {
  return job?.state === "queued" || job?.state === "running";
}

export function runtimeOverrides(settings: RuntimeSettings) {
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

export function isSupportedAudioPath(path: string) {
  return /\.(wav|mp3|m4a)$/i.test(path);
}

export function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

export function suggestedExportName(path: string) {
  const fileName = fileNameFromPath(path);
  const stem = fileName.replace(/\.[^.]+$/, "") || "clearpodcast-output";
  return `${stem}.enhanced.wav`;
}

export function formatDuration(duration?: number) {
  if (typeof duration !== "number" || !Number.isFinite(duration)) {
    return "--";
  }

  const minutes = Math.floor(duration / 60);
  const seconds = Math.round(duration % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatMetadataShort(metadata?: AudioMetadata) {
  if (!metadata) {
    return "--";
  }

  return `${metadata.format.toUpperCase()} | ${metadata.source_sample_rate.toLocaleString()} Hz`;
}

export function productNoticeForJob(job: EnhancementJobSnapshot) {
  switch (job.state) {
    case "queued":
      return "Preparing restoration";
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

export function statusTitle(
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

export function statusDetail(
  job: EnhancementJobSnapshot | undefined,
  error: DisplayError | undefined,
  notice: string,
) {
  if (error) {
    return "Open Diagnostics for technical details.";
  }

  if (!job) {
    return notice === "Ready to restore"
      ? "Restore the source locally, then compare the original and enhanced audio."
      : "Choose a supported spoken-word recording to begin.";
  }

  switch (job.state) {
    case "queued":
      return "ClearPodcast is preparing the local restoration run.";
    case "running":
      return "Processing stays on this machine and can take a while on CPU.";
    case "completed":
      return "Listen to the result, then export the enhanced WAV.";
    case "failed":
      return "The run stopped before producing a preview WAV.";
    case "cancelled":
      return "No partial enhanced output was kept.";
  }
}

export function describeError(
  error: unknown,
  context: ErrorContext,
): DisplayError {
  const detail =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
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

export function labelForState(state: EnhancementJobState | "idle") {
  switch (state) {
    case "queued":
      return "Preparing";
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

export function workflowSteps(
  selectedPath: string,
  job?: EnhancementJobSnapshot,
): WorkflowStep[] {
  const hasSource = Boolean(selectedPath);
  const state = job?.state;
  const exported = Boolean(job?.exported_wav);

  return [
    {
      id: "source",
      label: "Source",
      state: hasSource ? "done" : "current",
    },
    {
      id: "prepare",
      label: "Prepare",
      state:
        state === "queued"
          ? "current"
          : state === "running" || state === "completed"
            ? "done"
            : hasSource
              ? "idle"
              : "blocked",
    },
    {
      id: "restore",
      label: "Restore",
      state:
        state === "running"
          ? "current"
          : state === "completed"
            ? "done"
            : state === "failed" || state === "cancelled"
              ? "muted"
              : hasSource
                ? "idle"
                : "blocked",
    },
    {
      id: "compare",
      label: "Compare",
      state:
        state === "completed"
          ? exported
            ? "done"
            : "current"
          : state === "failed" || state === "cancelled"
            ? "muted"
            : "blocked",
    },
    {
      id: "export",
      label: "Export",
      state: exported
        ? "done"
        : state === "completed"
          ? "idle"
          : state === "failed" || state === "cancelled"
            ? "muted"
            : "blocked",
    },
  ];
}

export function cudaVersionLabel(deviceInfo: EnhancementDeviceInfo) {
  return deviceInfo.torch_cuda_version
    ? `CUDA ${deviceInfo.torch_cuda_version}`
    : "CUDA available";
}

export function cpuDeviceDetail(deviceInfo: EnhancementDeviceInfo) {
  if (deviceInfo.cuda_available) {
    return "CUDA available; CPU selected";
  }

  return deviceInfo.torch_cuda_version
    ? `CUDA ${deviceInfo.torch_cuda_version} unavailable`
    : "CUDA unavailable";
}
