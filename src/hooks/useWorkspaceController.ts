import { useCallback, useEffect, useMemo, useState } from "react";

import {
  cancelEnhancementJob,
  cleanupAudioPreview,
  detectProcessingDevice,
  exportEnhancedWav,
  getEnhancementJob,
  listenForAudioDrop,
  pickAudioFile,
  pickExportWav,
  prepareAudioPreview,
  startEnhancementJob,
  tauriAvailable,
  toAssetSrc,
} from "../backend/tauriCommands";
import {
  DEFAULT_ENHANCEMENT_SETTINGS,
  DEFAULT_RUNTIME,
  EXPECTED_CHECKPOINT_SHA256,
  TERMINAL_STATES,
  describeError,
  isActiveJob,
  productNoticeForJob,
  runtimeOverrides,
  suggestedExportName,
} from "../domain/enhancement";
import type {
  AudioMetadata,
  DeviceDetectionStatus,
  DisplayError,
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
  EnhancementSettings,
  ErrorContext,
  RuntimeSettings,
} from "../domain/types";
import { readVisualFixture } from "../dev/visualFixtures";

const FIXTURE_AUDIO_SRC =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

export type WorkspaceController = {
  selectedPath: string;
  originalPreviewPath: string;
  metadata?: AudioMetadata;
  enhancementSettings: EnhancementSettings;
  job?: EnhancementJobSnapshot;
  isDragActive: boolean;
  notice: string;
  detectedDeviceInfo?: EnhancementDeviceInfo;
  deviceStatus: DeviceDetectionStatus;
  deviceError: string;
  displayedDeviceInfo?: EnhancementDeviceInfo;
  originalAudioSrc?: string;
  enhancedAudioSrc?: string;
  canRun: boolean;
  canCancel: boolean;
  canExport: boolean;
  settingsLocked: boolean;
  fixtureName?: string;
  chooseAudio: () => Promise<void>;
  runEnhancement: () => Promise<void>;
  cancelJob: () => Promise<void>;
  exportEnhancedWav: () => Promise<void>;
  updateEnhancementField: <K extends keyof EnhancementSettings>(
    field: K,
    value: EnhancementSettings[K],
  ) => void;
  resetEnhancementSettings: () => void;
};

export function useWorkspaceController(): WorkspaceController {
  const fixture = useMemo(() => readVisualFixture(), []);
  const fixtureMode = Boolean(fixture);

  const [selectedPath, setSelectedPath] = useState(fixture?.selectedPath ?? "");
  const [originalPreviewPath, setOriginalPreviewPath] = useState(
    fixture?.originalPreviewPath ?? "",
  );
  const [metadata, setMetadata] = useState<AudioMetadata | undefined>(
    fixture?.metadata,
  );
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>(
    fixture?.runtimeSettings ?? DEFAULT_RUNTIME,
  );
  const [enhancementSettings, setEnhancementSettings] =
    useState<EnhancementSettings>(
      fixture?.enhancementSettings ?? DEFAULT_ENHANCEMENT_SETTINGS,
    );
  const [job, setJob] = useState<EnhancementJobSnapshot | undefined>(
    fixture?.job,
  );
  const [isDragActive, setIsDragActive] = useState(false);
  const [notice, setNotice] = useState(
    fixture?.notice ?? "Choose a WAV, MP3, or M4A file",
  );
  const [, setAppError] = useState<DisplayError | undefined>(
    fixture?.appError,
  );
  const [detectedDeviceInfo, setDetectedDeviceInfo] = useState<
    EnhancementDeviceInfo | undefined
  >(fixture?.detectedDeviceInfo);
  const [deviceStatus, setDeviceStatus] = useState<DeviceDetectionStatus>(
    fixture?.deviceStatus ?? "checking",
  );
  const [deviceError, setDeviceError] = useState(fixture?.deviceError ?? "");

  const originalAudioSrc = useMemo(
    () =>
      fixtureMode && selectedPath
        ? FIXTURE_AUDIO_SRC
        : toAssetSrc(originalPreviewPath || selectedPath),
    [fixtureMode, originalPreviewPath, selectedPath],
  );
  const enhancedAudioSrc = useMemo(
    () =>
      fixtureMode && job?.preview_wav ? FIXTURE_AUDIO_SRC : toAssetSrc(job?.preview_wav),
    [fixtureMode, job?.preview_wav],
  );
  const canRun = Boolean(selectedPath) && !isActiveJob(job);
  const canCancel = job?.state === "queued" || job?.state === "running";
  const canExport = job?.state === "completed" && Boolean(job.preview_wav);
  const settingsLocked = isActiveJob(job);
  const displayedDeviceInfo = job?.device_info ?? detectedDeviceInfo;

  const showError = useCallback((error: unknown, context: ErrorContext) => {
    const display = describeError(error, context);
    setAppError(display);
    setNotice(display.summary);
  }, []);

  const refreshJob = useCallback(async (jobId: string) => {
    const snapshot = await getEnhancementJob(jobId);
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

  const selectAudioPath = useCallback(
    async (path: string) => {
      setSelectedPath(path);
      setOriginalPreviewPath("");
      setMetadata(undefined);
      setJob(undefined);
      setAppError(undefined);
      setNotice("Reading source audio");

      try {
        const prepared = await prepareAudioPreview(path);
        setSelectedPath(prepared.input_audio);
        setOriginalPreviewPath(prepared.preview_audio);
        setMetadata(prepared.metadata);
        setNotice("Ready to enhance");
      } catch (error) {
        setSelectedPath("");
        setOriginalPreviewPath("");
        showError(error, "input");
      }
    },
    [showError],
  );

  useEffect(() => {
    if (fixtureMode) {
      return;
    }

    return () => {
      if (originalPreviewPath) {
        void cleanupAudioPreview(originalPreviewPath).catch(() => {
          // Preview cleanup is best-effort; stale files remain under app temp.
        });
      }
    };
  }, [fixtureMode, originalPreviewPath]);

  useEffect(() => {
    if (fixtureMode || !tauriAvailable()) {
      return;
    }

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    listenForAudioDrop({
      onEnter: () => setIsDragActive(true),
      onLeave: () => setIsDragActive(false),
      onAudioPath: (path) => {
        void selectAudioPath(path);
      },
      onUnsupported: () => showError("Unsupported file type", "input"),
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
  }, [fixtureMode, selectAudioPath, showError]);

  useEffect(() => {
    if (fixtureMode) {
      return;
    }

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
        const info = await detectProcessingDevice(request);
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
  }, [fixtureMode, runtimeSettings.python]);

  useEffect(() => {
    if (fixtureMode || !job || TERMINAL_STATES.includes(job.state)) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshJob(job.job_id);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [fixtureMode, job, refreshJob]);

  const chooseAudio = useCallback(async () => {
    if (!tauriAvailable()) {
      showError("Tauri runtime is not available", "backend");
      return;
    }

    const path = await pickAudioFile();
    if (path) {
      await selectAudioPath(path);
    }
  }, [selectAudioPath, showError]);

  const runEnhancement = useCallback(async () => {
    if (!selectedPath) {
      setNotice("Choose an audio file first");
      return;
    }

    setAppError(undefined);
    setNotice("Preparing enhancement");

    try {
      const snapshot = await startEnhancementJob({
        ...runtimeOverrides(runtimeSettings),
        ...enhancementSettings,
        input_audio: selectedPath,
        device: "auto",
        expected_checkpoint_sha256: EXPECTED_CHECKPOINT_SHA256,
      });
      setJob(snapshot);
    } catch (error) {
      showError(error, "enhancement");
    }
  }, [enhancementSettings, runtimeSettings, selectedPath, showError]);

  const cancelJob = useCallback(async () => {
    if (!job) {
      return;
    }

    try {
      const snapshot = await cancelEnhancementJob(job.job_id);
      setJob(snapshot);
      setAppError(undefined);
      setNotice("Cancelling enhancement");
    } catch (error) {
      showError(error, "cancellation");
    }
  }, [job, showError]);

  const exportCurrentEnhancedWav = useCallback(async () => {
    if (!job || !canExport) {
      return;
    }

    const destination = await pickExportWav(suggestedExportName(selectedPath));
    if (!destination) {
      return;
    }

    try {
      await exportEnhancedWav(job.job_id, destination);
      await refreshJob(job.job_id);
    } catch (error) {
      showError(error, "export");
    }
  }, [canExport, job, refreshJob, selectedPath, showError]);

  const updateEnhancementField = useCallback(
    <K extends keyof EnhancementSettings>(
      field: K,
      value: EnhancementSettings[K],
    ) => {
      setEnhancementSettings((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const resetEnhancementSettings = useCallback(() => {
    setEnhancementSettings(DEFAULT_ENHANCEMENT_SETTINGS);
  }, []);

  return {
    selectedPath,
    originalPreviewPath,
    metadata,
    enhancementSettings,
    job,
    isDragActive,
    notice,
    detectedDeviceInfo,
    deviceStatus,
    deviceError,
    displayedDeviceInfo,
    originalAudioSrc,
    enhancedAudioSrc,
    canRun,
    canCancel,
    canExport,
    settingsLocked,
    fixtureName: fixture?.fixtureName,
    chooseAudio,
    runEnhancement,
    cancelJob,
    exportEnhancedWav: exportCurrentEnhancedWav,
    updateEnhancementField,
    resetEnhancementSettings,
  };
}
