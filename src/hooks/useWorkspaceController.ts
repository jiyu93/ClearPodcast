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
  DEFAULT_ENHANCEMENT_PARAMETERS,
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
  EnhancementParameters,
  ErrorContext,
  RuntimeSettings,
} from "../domain/types";
import { getFixtureAudioSrc, readVisualFixture } from "../dev/visualFixtures";
import { useI18n } from "../i18n/I18nProvider";

export type WorkspaceController = {
  selectedPath: string;
  originalPreviewPath: string;
  metadata?: AudioMetadata;
  enhancementParameters: EnhancementParameters;
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
  enhancementControlsLocked: boolean;
  openAudio: () => Promise<void>;
  runEnhancement: () => Promise<void>;
  cancelJob: () => Promise<void>;
  exportEnhancedWav: () => Promise<void>;
  updateEnhancementParameter: <K extends keyof EnhancementParameters>(
    field: K,
    value: EnhancementParameters[K],
  ) => void;
  resetEnhancementParameters: () => void;
};

export function useWorkspaceController(): WorkspaceController {
  const { t } = useI18n();
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
  const [enhancementParameters, setEnhancementParameters] =
    useState<EnhancementParameters>(
      fixture?.enhancementParameters ?? DEFAULT_ENHANCEMENT_PARAMETERS,
    );
  const [job, setJob] = useState<EnhancementJobSnapshot | undefined>(
    fixture?.job,
  );
  const [isDragActive, setIsDragActive] = useState(false);
  const [notice, setNotice] = useState(
    fixture?.notice ?? t.notices.chooseFile,
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
        ? getFixtureAudioSrc()
        : toAssetSrc(originalPreviewPath || selectedPath),
    [fixtureMode, originalPreviewPath, selectedPath],
  );
  const enhancedAudioSrc = useMemo(
    () =>
      fixtureMode && job?.preview_wav ? getFixtureAudioSrc() : toAssetSrc(job?.preview_wav),
    [fixtureMode, job?.preview_wav],
  );
  const canRun = Boolean(selectedPath) && !isActiveJob(job);
  const canCancel = job?.state === "queued" || job?.state === "running";
  const canExport = job?.state === "completed" && Boolean(job.preview_wav);
  const enhancementControlsLocked = isActiveJob(job);
  const displayedDeviceInfo = job?.device_info ?? detectedDeviceInfo;

  const showError = useCallback((error: unknown, context: ErrorContext) => {
    const display = describeError(error, context, t.errors);
    setAppError(display);
    setNotice(display.summary);
  }, [t.errors]);

  const refreshJob = useCallback(async (jobId: string) => {
    const snapshot = await getEnhancementJob(jobId);
    setJob(snapshot);
    if (snapshot.device_info) {
      setDetectedDeviceInfo(snapshot.device_info);
      setDeviceStatus("ready");
      setDeviceError("");
    }
    if (snapshot.state === "failed" && snapshot.error) {
      const display = describeError(snapshot.error, "enhancement", t.errors);
      setAppError(display);
      setNotice(display.summary);
    } else {
      setNotice(productNoticeForJob(snapshot, t.notices));
    }
  }, [t.errors, t.notices]);

  const selectAudioPath = useCallback(
    async (path: string) => {
      setSelectedPath(path);
      setOriginalPreviewPath("");
      setMetadata(undefined);
      setJob(undefined);
      setAppError(undefined);
      setNotice(t.notices.readingSourceAudio);

      try {
        const prepared = await prepareAudioPreview(path);
        setSelectedPath(prepared.input_audio);
        setOriginalPreviewPath(prepared.preview_audio);
        setMetadata(prepared.metadata);
        setNotice(t.notices.readyToEnhance);
      } catch (error) {
        setSelectedPath("");
        setOriginalPreviewPath("");
        showError(error, "input");
      }
    },
    [showError, t.notices.readingSourceAudio, t.notices.readyToEnhance],
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

  const openAudio = useCallback(async () => {
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
      setNotice(t.notices.chooseAudioFirst);
      return;
    }

    setAppError(undefined);
    setNotice(t.notices.preparingEnhancement);

    try {
      const snapshot = await startEnhancementJob({
        ...runtimeOverrides(runtimeSettings),
        ...enhancementParameters,
        input_audio: selectedPath,
        device: "auto",
        expected_checkpoint_sha256: EXPECTED_CHECKPOINT_SHA256,
      });
      setJob(snapshot);
    } catch (error) {
      showError(error, "enhancement");
    }
  }, [
    enhancementParameters,
    runtimeSettings,
    selectedPath,
    showError,
    t.notices.chooseAudioFirst,
    t.notices.preparingEnhancement,
  ]);

  const cancelJob = useCallback(async () => {
    if (!job) {
      return;
    }

    try {
      const snapshot = await cancelEnhancementJob(job.job_id);
      setJob(snapshot);
      setAppError(undefined);
      setNotice(t.notices.cancellingEnhancement);
    } catch (error) {
      showError(error, "cancellation");
    }
  }, [job, showError, t.notices.cancellingEnhancement]);

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

  const updateEnhancementParameter = useCallback(
    <K extends keyof EnhancementParameters>(
      field: K,
      value: EnhancementParameters[K],
    ) => {
      setEnhancementParameters((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const resetEnhancementParameters = useCallback(() => {
    setEnhancementParameters(DEFAULT_ENHANCEMENT_PARAMETERS);
  }, []);

  return {
    selectedPath,
    originalPreviewPath,
    metadata,
    enhancementParameters,
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
    enhancementControlsLocked,
    openAudio,
    runEnhancement,
    cancelJob,
    exportEnhancedWav: exportCurrentEnhancedWav,
    updateEnhancementParameter,
    resetEnhancementParameters,
  };
}
