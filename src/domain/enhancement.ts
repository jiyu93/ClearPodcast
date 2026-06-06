import type {
  AudioMetadata,
  DisplayError,
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
  EnhancementJobState,
  EnhancementParameters,
  EnhancementSolver,
  ErrorContext,
  RuntimeSettings,
} from "./types";
import type { Translation } from "../i18n/translations";

export const DEFAULT_RUNTIME: RuntimeSettings = {
  python: "",
  model_dir: "",
};

export const DEFAULT_ENHANCEMENT_PARAMETERS: EnhancementParameters = {
  solver: "midpoint",
  nfe: 64,
  lambd: 0.1,
  tau: 0.5,
};

export const ENHANCEMENT_HELP = {
  solver: "Chooses the numerical solver used inside Resemble Enhance.",
  nfe: "CFM means Conditional Flow Matching. Higher steps give the model more chances to refine speech, but going too high can sound overly processed or slightly less natural.",
  tau: "Higher values can add fullness and variation, but may also change the voice more or add an electronic, metallic shimmer.",
  lambd: "Higher values remove more noise before enhancement, but can also thin the voice, dull detail, or create watery or electronic artifacts.",
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
  return `enhanced-${stem}.wav`;
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

  return [
    metadata.format.toUpperCase(),
    `${metadata.source_sample_rate.toLocaleString()} Hz`,
    `${metadata.channels} ch`,
  ].join(" | ");
}

export function formatMetadataShortLocalized(
  metadata: AudioMetadata | undefined,
  copy: Translation["common"],
) {
  if (!metadata) {
    return copy.metadataUnavailable;
  }

  return [
    metadata.format.toUpperCase(),
    `${metadata.source_sample_rate.toLocaleString()} Hz`,
    `${metadata.channels} ${copy.channels}`,
  ].join(" | ");
}

export function productNoticeForJob(
  job: EnhancementJobSnapshot,
  copy?: Translation["notices"],
) {
  switch (job.state) {
    case "queued":
      return copy?.preparingEnhancement ?? "Preparing enhancement";
    case "running":
      return copy?.enhancingSpeech ?? "Enhancing speech";
    case "completed":
      return copy?.enhancedReady ?? "Enhanced WAV is ready";
    case "failed":
      return copy?.enhancementNeedsAttention ?? "Enhancement needs attention";
    case "cancelled":
      return copy?.enhancementCancelled ?? "Enhancement cancelled";
  }
}

export function describeError(
  error: unknown,
  context: ErrorContext,
  copy?: Translation["errors"],
): DisplayError {
  const detail =
    error instanceof Error
      ? error.message
      : String(error ?? copy?.unknown ?? "Unknown error");
  const normalized = detail.toLowerCase();

  if (context === "cancellation" || normalized.includes("cancelled")) {
    return {
      summary: copy?.cancelled ?? "Enhancement was cancelled.",
      detail,
    };
  }

  if (context === "device-detection") {
    return {
      summary:
        copy?.deviceDetection ?? "Processing device could not be checked.",
      detail,
    };
  }

  if (
    normalized.includes("unsupported audio input extension") ||
    normalized.includes("unsupported file type") ||
    normalized.includes("unsupported_input")
  ) {
    return {
      summary: copy?.unsupportedInput ?? "Choose a WAV, MP3, or M4A file.",
      detail,
    };
  }

  if (
    normalized.includes("audio file was not found") ||
    normalized.includes("input audio file was not found") ||
    normalized.includes("missing_input_wav")
  ) {
    return {
      summary:
        copy?.missingInput ?? "The selected audio file could not be found.",
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
      summary:
        copy?.unreadableAudio ??
        "ClearPodcast could not read this audio file.",
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
      summary: copy?.missingRuntime ?? "The local enhancement runtime is missing.",
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
      summary:
        copy?.missingModel ??
        "The bundled speech enhancement model is missing or incomplete.",
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
      summary:
        copy?.sidecarFailure ??
        "Enhancement failed inside the local AI runtime.",
      detail,
    };
  }

  if (
    normalized.includes("export path must end in .wav") ||
    normalized.includes("output path must end in .wav")
  ) {
    return {
      summary: copy?.exportNeedsWav ?? "Choose a .wav export location.",
      detail,
    };
  }

  if (context === "export") {
    return {
      summary:
        copy?.exportFailure ?? "The enhanced WAV could not be exported.",
      detail,
    };
  }

  if (context === "input") {
    return {
      summary: copy?.inputFailure ?? "The selected file could not be imported.",
      detail,
    };
  }

  return {
    summary: copy?.generic ?? "ClearPodcast hit a local processing error.",
    detail,
  };
}

export function labelForState(
  state: EnhancementJobState | "idle",
  copy?: Translation["status"],
) {
  switch (state) {
    case "queued":
      return copy?.queued ?? "Preparing";
    case "running":
      return copy?.running ?? "Enhancing";
    case "completed":
      return copy?.completed ?? "Enhanced";
    case "failed":
      return copy?.failed ?? "Needs attention";
    case "cancelled":
      return copy?.cancelled ?? "Cancelled";
    default:
      return copy?.idle ?? "Ready";
  }
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
