import { DEFAULT_ENHANCEMENT_PARAMETERS, DEFAULT_RUNTIME } from "../domain/enhancement";
import type {
  AudioMetadata,
  DeviceDetectionStatus,
  DisplayError,
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
  EnhancementParameters,
  RuntimeSettings,
} from "../domain/types";

export type VisualFixtureName =
  | "empty"
  | "selected"
  | "running"
  | "cancelled"
  | "failed"
  | "completed"
  | "exported";

export type VisualFixtureState = {
  fixtureName: VisualFixtureName;
  selectedPath: string;
  originalPreviewPath: string;
  metadata?: AudioMetadata;
  runtimeSettings: RuntimeSettings;
  enhancementParameters: EnhancementParameters;
  job?: EnhancementJobSnapshot;
  notice: string;
  appError?: DisplayError;
  detectedDeviceInfo?: EnhancementDeviceInfo;
  deviceStatus: DeviceDetectionStatus;
  deviceError: string;
};

let fixtureAudioSrc: string | undefined;

const fixtureMetadata: AudioMetadata = {
  format: "m4a",
  source_sample_rate: 48000,
  channels: 2,
  duration_seconds: 582.4,
};

export function getFixtureAudioSrc() {
  if (!fixtureAudioSrc) {
    fixtureAudioSrc = createToneWavObjectUrl({
      durationSeconds: 6,
      frequency: 440,
      sampleRate: 16_000,
      silentRanges: [
        [0, 0.7],
        [2.8, 3.4],
        [5.1, 6],
      ],
    });
  }

  return fixtureAudioSrc;
}

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
    enhancementParameters: DEFAULT_ENHANCEMENT_PARAMETERS,
    job,
    notice: selectedPath ? "Ready to enhance" : "Choose a WAV, MP3, or M4A file",
    appError:
      name === "failed"
        ? {
            summary: "Enhancement failed inside the local AI runtime.",
            detail: "visual_fixture_sidecar_error: model output was not produced",
          }
        : undefined,
    detectedDeviceInfo:
      name === "running" || name === "completed" || name === "exported"
        ? cudaDevice
        : cpuDevice,
    deviceStatus: "ready",
    deviceError: "",
  };
}

function jobForFixture(
  name: VisualFixtureName,
): EnhancementJobSnapshot | undefined {
  if (name === "empty" || name === "selected") {
    return undefined;
  }

  const common = {
    job_id: `visual-${name}`,
    input_audio: basePath,
    input_metadata: fixtureMetadata,
    message: "Fixture state loaded",
    created_at_ms: 1780491000000,
    updated_at_ms: 1780491120000,
  };

  if (name === "running") {
    return {
      ...common,
      state: "running",
      device_info: cudaDevice,
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
        ? "/Users/creator/Desktop/enhanced-remote-call-before-edit.wav"
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
  ].includes(value);
}

function createToneWavObjectUrl({
  durationSeconds,
  frequency,
  sampleRate,
  silentRanges = [],
}: {
  durationSeconds: number;
  frequency: number;
  sampleRate: number;
  silentRanges?: Array<[number, number]>;
}) {
  const sampleCount = Math.floor(durationSeconds * sampleRate);
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const isSilent = silentRanges.some(
      ([start, end]) => time >= start && time < end,
    );
    if (isSilent) {
      view.setInt16(44 + index * bytesPerSample, 0, true);
      continue;
    }

    const envelope =
      Math.min(1, index / 500) * Math.min(1, (sampleCount - index) / 500);
    const sample = Math.round(
      Math.sin(2 * Math.PI * frequency * time) * 0.24 * envelope * 32767,
    );
    view.setInt16(44 + index * bytesPerSample, sample, true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
