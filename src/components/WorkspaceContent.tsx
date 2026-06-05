import { useEffect, useState } from "react";

import { AudioPreviewLane } from "./AudioPreviewLane";
import { ButtonHitArea } from "./ButtonHitArea";
import { ModelTuningView } from "./ModelTuningView";
import { readAppLog, tauriAvailable } from "../backend/tauriCommands";
import type {
  AppLogSnapshot,
  AudioMetadata,
  EnhancementSettings,
} from "../domain/types";
import { EnhanceIcon, LogIcon, OpenIcon, SaveIcon, StopIcon } from "./icons";

export type WorkspaceMode = "audio" | "tuning" | "log";

export function WorkspaceContent({
  originalSrc,
  originalMetadata,
  enhancedSrc,
  enhancedMetadata,
  mode,
  enhancementSettings,
  enhancementControlsLocked,
  canRun,
  canCancel,
  canExport,
  onOpenAudio,
  onRun,
  onCancel,
  onExport,
  onUpdateTuning,
  onResetTuning,
}: {
  originalSrc?: string;
  originalMetadata?: AudioMetadata;
  enhancedSrc?: string;
  enhancedMetadata?: AudioMetadata;
  mode: WorkspaceMode;
  enhancementSettings: EnhancementSettings;
  enhancementControlsLocked: boolean;
  canRun: boolean;
  canCancel: boolean;
  canExport: boolean;
  onOpenAudio: () => void;
  onRun: () => void;
  onCancel: () => void;
  onExport: () => void;
  onUpdateTuning: <K extends keyof EnhancementSettings>(
    field: K,
    value: EnhancementSettings[K],
  ) => void;
  onResetTuning: () => void;
}) {
  const [logSnapshot, setLogSnapshot] = useState<AppLogSnapshot | undefined>();
  const [logError, setLogError] = useState("");

  const showLog = async () => {
    setLogError("");

    if (!tauriAvailable()) {
      setLogSnapshot({
        path: "Tauri runtime unavailable",
        text: "Persistent logs are available in the desktop app.",
      });
      return;
    }

    try {
      setLogSnapshot(await readAppLog());
    } catch (error) {
      setLogError(String(error));
    }
  };

  useEffect(() => {
    if (mode === "log" && !logSnapshot && !logError) {
      void showLog();
    }
  }, [logError, logSnapshot, mode]);

  const actionIsCancel = canCancel;
  const ActionIcon = actionIsCancel ? StopIcon : EnhanceIcon;
  const actionLabel = actionIsCancel ? "Cancel" : "Enhance";
  const actionClass = actionIsCancel ? "secondary-action" : "primary-action";

  return (
    <div
      className={`panel-section workspace-content ${mode}-mode-active`}
      aria-label="Audio workspace"
    >
      <span
        className="section-divider workspace-content-divider"
        aria-hidden="true"
      />

      {mode === "audio" ? (
        <div className="audio-lanes">
          <AudioPreviewLane
            title="Original"
            src={originalSrc}
            metadata={originalMetadata}
            startAction={
              <ButtonHitArea>
                <button
                  type="button"
                  className="icon-button secondary-action source-open-action file-action-button"
                  onClick={onOpenAudio}
                >
                  <OpenIcon className="button-icon" />
                  <span>Open</span>
                </button>
              </ButtonHitArea>
            }
            endAction={
              <ButtonHitArea>
                <button
                  type="button"
                  className={`icon-button lane-action-button ${actionClass}`}
                  onClick={actionIsCancel ? onCancel : onRun}
                  disabled={actionIsCancel ? !canCancel : !canRun}
                >
                  <ActionIcon className="button-icon" />
                  <span>{actionLabel}</span>
                </button>
              </ButtonHitArea>
            }
          />
          <span className="section-divider" aria-hidden="true" />
          <AudioPreviewLane
            title="Enhanced"
            src={enhancedSrc}
            metadata={enhancedMetadata}
            startAction={
              <ButtonHitArea>
                <button
                  type="button"
                  className="icon-button save-action export-action lane-action-button file-action-button"
                  onClick={onExport}
                  disabled={!canExport}
                >
                  <SaveIcon className="button-icon" />
                  <span>Save</span>
                </button>
              </ButtonHitArea>
            }
          />
        </div>
      ) : null}

      {mode === "tuning" ? (
        <ModelTuningView
          enhancementSettings={enhancementSettings}
          controlsLocked={enhancementControlsLocked}
          onUpdate={onUpdateTuning}
          onReset={onResetTuning}
        />
      ) : null}

      {mode === "log" ? (
        <LogView
          snapshot={logSnapshot}
          error={logError}
          onRefresh={() => {
            void showLog();
          }}
        />
      ) : null}
    </div>
  );
}

function LogView({
  snapshot,
  error,
  onRefresh,
}: {
  snapshot?: AppLogSnapshot;
  error: string;
  onRefresh: () => void;
}) {
  return (
    <div className="panel-mode log-mode">
      <div className="log-toolbar">
        <div>
          <span>Log file</span>
          <strong>{snapshot?.path ?? "Loading..."}</strong>
        </div>
        <ButtonHitArea>
          <button
            type="button"
            className="icon-button secondary-action reset-action"
            onClick={onRefresh}
          >
            <LogIcon className="button-icon" />
            <span>Refresh</span>
          </button>
        </ButtonHitArea>
      </div>
      <pre className="log-viewer">
        {error || snapshot?.text || "No log entries yet."}
      </pre>
    </div>
  );
}
