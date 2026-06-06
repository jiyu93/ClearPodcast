export type AudioMetadata = {
  format: "wav" | "mp3" | "m4a";
  source_sample_rate: number;
  channels: number;
  frame_count?: number;
  duration_seconds?: number;
};

export type EnhancementJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EnhancementDeviceInfo = {
  selected_device: string;
  cuda_available?: boolean;
  torch_cuda_version?: string;
  cuda_device_name?: string;
};

export type ProcessingDeviceMode = "cpu" | "cuda";

export type EnhancementJobSnapshot = {
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

export type DeviceDetectionStatus =
  | "checking"
  | "ready"
  | "error"
  | "unavailable";

export type ExportResult = {
  exported_wav: string;
  output_metadata: AudioMetadata;
};

export type PreparedAudioPreview = {
  input_audio: string;
  preview_audio: string;
  metadata: AudioMetadata;
};

export type RuntimeSettings = {
  python: string;
  model_dir: string;
};

export type AppLogSnapshot = {
  path: string;
  text: string;
};

export type EnhancementSolver = "midpoint" | "rk4" | "euler";

export type EnhancementParameters = {
  solver: EnhancementSolver;
  nfe: number;
  lambd: number;
  tau: number;
};

export type DisplayError = {
  summary: string;
  detail: string;
};

export type ErrorContext =
  | "input"
  | "enhancement"
  | "device-detection"
  | "backend"
  | "cancellation"
  | "export";
