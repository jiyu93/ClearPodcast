import { useEffect, useState } from "react";

import { AudioPreviewLane } from "./AudioPreviewLane";
import { ModelSettingsView } from "./ModelSettingsView";
import { readAppLog, tauriAvailable } from "../backend/tauriCommands";
import type {
  AppLogSnapshot,
  AudioMetadata,
  EnhancementSettings,
} from "../domain/types";
import { LogIcon } from "./icons";

export type WorkspaceMode = "audio" | "model" | "log";

export function WorkspaceContent({
  originalSrc,
  originalMetadata,
  enhancedSrc,
  enhancedMetadata,
  mode,
  settings,
  settingsLocked,
  onUpdateSettings,
  onResetSettings,
}: {
  originalSrc?: string;
  originalMetadata?: AudioMetadata;
  enhancedSrc?: string;
  enhancedMetadata?: AudioMetadata;
  mode: WorkspaceMode;
  settings: EnhancementSettings;
  settingsLocked: boolean;
  onUpdateSettings: <K extends keyof EnhancementSettings>(
    field: K,
    value: EnhancementSettings[K],
  ) => void;
  onResetSettings: () => void;
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
          />
          <span className="section-divider" aria-hidden="true" />
          <AudioPreviewLane
            title="Enhanced"
            src={enhancedSrc}
            metadata={enhancedMetadata}
          />
        </div>
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
