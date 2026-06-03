import { DEFAULT_ENHANCEMENT_SETTINGS, DEFAULT_RUNTIME } from "../domain/enhancement";
import type {
  AudioMetadata,
  DeviceDetectionStatus,
  DisplayError,
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
  EnhancementSettings,
  RuntimeSettings,
} from "../domain/types";

export type VisualFixtureName =
  | "empty"
  | "selected"
  | "running"
  | "cancelled"
  | "failed"
  | "completed"
  | "exported"
  | "advanced"
  | "diagnostics";

export type VisualFixtureState = {
  fixtureName: VisualFixtureName;
  selectedPath: string;
  originalPreviewPath: string;
  metadata?: AudioMetadata;
  runtimeSettings: RuntimeSettings;
  enhancementSettings: EnhancementSettings;
  job?: EnhancementJobSnapshot;
  advancedOpen: boolean;
  diagnosticsOpen: boolean;
  notice: string;
  appError?: DisplayError;
  exportMessage: string;
  detectedDeviceInfo?: EnhancementDeviceInfo;
  deviceStatus: DeviceDetectionStatus;
  deviceError: string;
};

const fixtureMetadata: AudioMetadata = {
  format: "m4a",
  source_sample_rate: 48000,
  channels: 2,
  duration_seconds: 582.4,
};

const outputMetadata: AudioMetadata = {
  format: "wav",
  source_sample_rate: 44100,
  channels: 1,
  duration_seconds: 582.4,
};

const basePath = "/Users/creator/Desktop/remote-call-before-edit.m4a";

const cpuDevice: EnhancementDeviceInfo = {
  selected_device: "cpu",
  cuda_available: false,
};

const cudaDevice: EnhancementDeviceInfo = {
  selected_device: "cuda",
  cuda_available: true,
  torch_cuda_version: "13.0",
  cuda_device_name: "NVIDIA GeForce RTX 5070 Ti",
};

export function readVisualFixture(): VisualFixtureState | undefined {
  const params = new URLSearchParams(window.location.search);
  const name = params.get("fixture") as VisualFixtureName | null;

  if (!name || !isFixtureName(name)) {
    return undefined;
  }

  return createVisualFixture(name);
}

function createVisualFixture(name: VisualFixtureName): VisualFixtureState {
  const selectedPath = name === "empty" ? "" : basePath;
  const job = jobForFixture(name);

  return {
    fixtureName: name,
    selectedPath,
    originalPreviewPath: selectedPath,
    metadata: selectedPath ? fixtureMetadata : undefined,
    runtimeSettings: DEFAULT_RUNTIME,
    enhancementSettings: DEFAULT_ENHANCEMENT_SETTINGS,
    job,
    advancedOpen: name === "advanced",
    diagnosticsOpen: name === "diagnostics" || name === "failed",
    notice: selectedPath ? "Ready to restore" : "Choose a WAV, MP3, or M4A file",
    appError:
      name === "failed"
        ? {
            summary: "Restoration failed inside the local AI runtime.",
            detail: "visual_fixture_sidecar_error: model output was not produced",
          }
        : undefined,
    exportMessage: name === "exported" ? "Export complete" : "",
    detectedDeviceInfo: name === "completed" || name === "exported" ? cudaDevice : cpuDevice,
    deviceStatus: "ready",
    deviceError: "",
  };
}

function jobForFixture(
  name: VisualFixtureName,
): EnhancementJobSnapshot | undefined {
  if (name === "empty" || name === "selected" || name === "advanced") {
    return undefined;
  }

  const common = {
    job_id: `visual-${name}`,
    input_audio: basePath,
    input_metadata: fixtureMetadata,
    message: "Visual QA fixture",
    created_at_ms: 1780491000000,
    updated_at_ms: 1780491120000,
  };

  if (name === "running") {
    return {
      ...common,
      state: "running",
      device_info: cpuDevice,
    };
  }

  if (name === "cancelled") {
    return {
      ...common,
      state: "cancelled",
      device_info: cpuDevice,
    };
  }

  if (name === "failed") {
    return {
      ...common,
      state: "failed",
      error: "visual_fixture_sidecar_error: model output was not produced",
      device_info: cpuDevice,
    };
  }

  return {
    ...common,
    state: "completed",
    preview_wav: "/var/folders/clearpodcast/remote-call-before-edit.enhanced.wav",
    exported_wav:
      name === "exported"
        ? "/Users/creator/Desktop/remote-call-before-edit.enhanced.wav"
        : undefined,
    output_metadata: outputMetadata,
    device_info: cudaDevice,
  };
}

function isFixtureName(value: string): value is VisualFixtureName {
  return [
    "empty",
    "selected",
    "running",
    "cancelled",
    "failed",
    "completed",
    "exported",
    "advanced",
    "diagnostics",
  ].includes(value);
}
