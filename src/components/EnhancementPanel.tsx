import { useState } from "react";

import { AudioPreviewLane } from "./AudioPreviewLane";
import { ModelSettingsView } from "./ModelSettingsView";
import { readAppLog, tauriAvailable } from "../backend/tauriCommands";
import type {
  AppLogSnapshot,
  AudioMetadata,
  EnhancementSettings,
  EnhancementJobSnapshot,
} from "../domain/types";
import {
  BackIcon,
  DownloadIcon,
  LogIcon,
  EnhanceIcon,
  StopIcon,
  WrenchIcon,
} from "./icons";

type RunPanelMode = "run" | "model" | "log";

export function EnhancementPanel({
  job,
  enhancedSrc,
  enhancedMetadata,
  canRun,
  canCancel,
  canExport,
  settings,
  settingsLocked,
  onRun,
  onCancel,
  onExport,
  onUpdateSettings,
  onResetSettings,
}: {
  job?: EnhancementJobSnapshot;
  enhancedSrc?: string;
  enhancedMetadata?: AudioMetadata;
  canRun: boolean;
  canCancel: boolean;
  canExport: boolean;
  settings: EnhancementSettings;
  settingsLocked: boolean;
  onRun: () => void;
  onCancel: () => void;
  onExport: () => void;
  onUpdateSettings: <K extends keyof EnhancementSettings>(
    field: K,
    value: EnhancementSettings[K],
  ) => void;
  onResetSettings: () => void;
}) {
  const [mode, setMode] = useState<RunPanelMode>("run");
  const [logSnapshot, setLogSnapshot] = useState<AppLogSnapshot | undefined>();
  const [logError, setLogError] = useState("");
  const actionIsCancel = canCancel;
  const ActionIcon = actionIsCancel ? StopIcon : EnhanceIcon;
  const actionLabel = actionIsCancel ? "Cancel" : "Enhance speech";
  const actionClass = actionIsCancel ? "secondary-action" : "primary-action";

  const showLog = async () => {
    setMode("log");
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

  return (
    <section
      className={`desk-panel run-panel ${mode}-mode-active`}
      aria-label="Enhancement workspace"
    >
      <div className="panel-tools" aria-label="Enhancement workspace tools">
        {mode === "run" ? (
          <>
            <button
              type="button"
              className="icon-button tool-action"
              onClick={() => setMode("model")}
              aria-label="Open model settings"
              title="Model settings"
            >
              <WrenchIcon className="button-icon" />
            </button>
            <button
              type="button"
              className="icon-button tool-action"
              onClick={() => {
                void showLog();
              }}
              aria-label="Open log"
              title="Log"
            >
              <LogIcon className="button-icon" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="icon-button tool-action"
            onClick={() => setMode("run")}
            aria-label="Back to run"
            title="Back to run"
          >
            <BackIcon className="button-icon" />
          </button>
        )}
      </div>

      {mode === "run" ? (
        <>
          <AudioPreviewLane
            title="Enhanced"
            src={enhancedSrc}
            metadata={enhancedMetadata}
            emptyLabel={
              job?.state === "running" || job?.state === "queued"
                ? "Enhanced preview appears when enhancement finishes"
                : "Enhanced preview appears here"
            }
          />

          <div className="run-controls">
            <div className="action-row">
              <button
                type="button"
                className={`icon-button ${actionClass}`}
                onClick={actionIsCancel ? onCancel : onRun}
                disabled={actionIsCancel ? !canCancel : !canRun}
              >
                <ActionIcon className="button-icon" />
                <span>{actionLabel}</span>
              </button>
            </div>

            <button
              type="button"
              className="icon-button primary-action export-action"
              onClick={onExport}
              disabled={!canExport}
            >
              <DownloadIcon className="button-icon" />
              <span>Export WAV</span>
            </button>
          </div>
        </>
      ) : null}

      {mode === "model" ? (
        <ModelSettingsView
          settings={settings}
          settingsLocked={settingsLocked}
          onUpdate={onUpdateSettings}
          onReset={onResetSettings}
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
    </section>
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
        <button
          type="button"
          className="icon-button secondary-action reset-action"
          onClick={onRefresh}
        >
          <LogIcon className="button-icon" />
          <span>Refresh</span>
        </button>
      </div>
      <pre className="log-viewer">
        {error || snapshot?.text || "No log entries yet."}
      </pre>
    </div>
  );
}
