import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { isSupportedAudioPath } from "../domain/enhancement";
import type {
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
  ExportResult,
  PreparedAudioPreview,
  RuntimeSettings,
} from "../domain/types";

export function tauriAvailable() {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export function toAssetSrc(path?: string) {
  if (!path || !tauriAvailable()) {
    return undefined;
  }

  try {
    return convertFileSrc(path);
  } catch {
    return undefined;
  }
}

export async function prepareAudioPreview(path: string) {
  return invoke<PreparedAudioPreview>("prepare_audio_preview_command", { path });
}

export async function cleanupAudioPreview(previewPath: string) {
  if (!previewPath || !tauriAvailable()) {
    return;
  }

  await invoke("cleanup_audio_preview_command", { previewAudio: previewPath });
}

export async function detectProcessingDevice(request: Partial<RuntimeSettings>) {
  return invoke<EnhancementDeviceInfo>("detect_processing_device_command", {
    request,
  });
}

export async function pickAudioFile() {
  return invoke<string | null>("pick_audio_file_command");
}

export async function startEnhancementJob(request: Record<string, unknown>) {
  return invoke<EnhancementJobSnapshot>("start_enhancement_job_command", {
    request,
  });
}

export async function getEnhancementJob(jobId: string) {
  return invoke<EnhancementJobSnapshot>("get_enhancement_job_command", {
    jobId,
  });
}

export async function cancelEnhancementJob(jobId: string) {
  return invoke<EnhancementJobSnapshot>("cancel_enhancement_job_command", {
    jobId,
  });
}

export async function pickExportWav(suggestedFileName: string) {
  return invoke<string | null>("pick_export_wav_command", {
    suggestedFileName,
  });
}

export async function exportEnhancedWav(jobId: string, destination: string) {
  return invoke<ExportResult>("export_enhanced_wav_command", {
    jobId,
    destination,
  });
}

export async function listenForAudioDrop(callbacks: {
  onEnter: () => void;
  onLeave: () => void;
  onAudioPath: (path: string) => void;
  onUnsupported: () => void;
}) {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "enter" || event.payload.type === "over") {
      callbacks.onEnter();
      return;
    }

    if (event.payload.type === "leave") {
      callbacks.onLeave();
      return;
    }

    callbacks.onLeave();
    const path = event.payload.paths.find(isSupportedAudioPath);
    if (path) {
      callbacks.onAudioPath(path);
    } else {
      callbacks.onUnsupported();
    }
  });
}
