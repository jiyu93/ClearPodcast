import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, RotateCw, Save, WandSparkles } from "lucide-react";

import { AudioPreviewLane } from "./AudioPreviewLane";
import { ButtonHitArea } from "./ButtonHitArea";
import { ModelParametersView } from "./ModelParametersView";
import { readAppLog, tauriAvailable } from "../backend/tauriCommands";
import type {
  AppLogSnapshot,
  AudioMetadata,
  EnhancementParameters,
} from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import { StopIcon } from "./icons";

export type WorkspaceMode = "audio" | "parameters" | "log";
type AudioLaneId = "original" | "enhanced";

export function WorkspaceContent({
  originalSrc,
  originalMetadata,
  enhancedSrc,
  enhancedMetadata,
  mode,
  enhancementParameters,
  enhancementControlsLocked,
  canRun,
  canCancel,
  canExport,
  onOpenAudio,
  onRun,
  onCancel,
  onExport,
  onUpdateParameters,
  onResetParameters,
}: {
  originalSrc?: string;
  originalMetadata?: AudioMetadata;
  enhancedSrc?: string;
  enhancedMetadata?: AudioMetadata;
  mode: WorkspaceMode;
  enhancementParameters: EnhancementParameters;
  enhancementControlsLocked: boolean;
  canRun: boolean;
  canCancel: boolean;
  canExport: boolean;
  onOpenAudio: () => void;
  onRun: () => void;
  onCancel: () => void;
  onExport: () => void;
  onUpdateParameters: <K extends keyof EnhancementParameters>(
    field: K,
    value: EnhancementParameters[K],
  ) => void;
  onResetParameters: () => void;
}) {
  const { t } = useI18n();
  const [logSnapshot, setLogSnapshot] = useState<AppLogSnapshot | undefined>();
  const [logError, setLogError] = useState("");
  const [activeAudioLane, setActiveAudioLane] =
    useState<AudioLaneId>("original");

  const showLog = useCallback(async () => {
    setLogError("");

    if (!tauriAvailable()) {
      setLogSnapshot({
        path: t.log.tauriUnavailablePath,
        text: t.log.tauriUnavailableText,
      });
      return;
    }

    try {
      setLogSnapshot(await readAppLog());
    } catch (error) {
      setLogError(String(error));
    }
  }, [t.log.tauriUnavailablePath, t.log.tauriUnavailableText]);

  useEffect(() => {
    if (mode !== "log") {
      return;
    }

    let cancelled = false;
    const loadLog = async () => {
      if (cancelled) {
        return;
      }
      await showLog();
    };

    void loadLog();
    const intervalId = window.setInterval(() => {
      void loadLog();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [mode, showLog]);

  useEffect(() => {
    if (mode !== "audio") {
      return;
    }

    if (activeAudioLane === "enhanced" && enhancedSrc) {
      return;
    }

    if (activeAudioLane === "original" && originalSrc) {
      return;
    }

    if (enhancedSrc) {
      setActiveAudioLane("enhanced");
      return;
    }

    setActiveAudioLane("original");
  }, [activeAudioLane, enhancedSrc, mode, originalSrc]);

  const actionIsCancel = canCancel;
  const actionLabel = actionIsCancel ? t.workspace.cancel : t.workspace.enhance;
  const actionClass = actionIsCancel ? "secondary-action" : "primary-action";

  return (
    <div
      className={`panel-section workspace-content ${mode}-mode-active`}
      aria-label={t.workspace.audioAriaLabel}
    >
      <span
        className="section-divider workspace-content-divider"
        aria-hidden="true"
      />

      {mode === "audio" ? (
        <div className="audio-lanes">
          <AudioPreviewLane
            title={t.workspace.original}
            src={originalSrc}
            metadata={originalMetadata}
            spacePlaybackActive={activeAudioLane === "original"}
            onActivate={() => setActiveAudioLane("original")}
            startAction={
              <ButtonHitArea>
                <button
                  type="button"
                  className="icon-button secondary-action source-open-action file-action-button"
                  onClick={onOpenAudio}
                >
                  <FolderOpen className="button-icon lucide-button-icon" strokeWidth={3} />
                  <span>{t.workspace.open}</span>
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
                  {actionIsCancel ? (
                    <StopIcon className="button-icon" />
                  ) : (
                    <WandSparkles
                      className="button-icon lucide-button-icon"
                      strokeWidth={3}
                    />
                  )}
                  <span>{actionLabel}</span>
                </button>
              </ButtonHitArea>
            }
          />
          <span className="section-divider" aria-hidden="true" />
          <AudioPreviewLane
            title={t.workspace.enhanced}
            src={enhancedSrc}
            metadata={enhancedMetadata}
            spacePlaybackActive={activeAudioLane === "enhanced"}
            onActivate={() => setActiveAudioLane("enhanced")}
            startAction={
              <ButtonHitArea>
                <button
                  type="button"
                  className="icon-button save-action export-action lane-action-button file-action-button"
                  onClick={onExport}
                  disabled={!canExport}
                >
                  <Save className="button-icon lucide-button-icon" strokeWidth={3} />
                  <span>{t.workspace.save}</span>
                </button>
              </ButtonHitArea>
            }
          />
        </div>
      ) : null}

      {mode === "parameters" ? (
        <ModelParametersView
          enhancementParameters={enhancementParameters}
          controlsLocked={enhancementControlsLocked}
          onUpdate={onUpdateParameters}
          onReset={onResetParameters}
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
  const { t } = useI18n();
  const viewerRef = useRef<HTMLDivElement>(null);
  const text = error || snapshot?.text || "";

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }
    viewer.scrollTop = viewer.scrollHeight;
  }, [text]);

  return (
    <div className="panel-mode log-mode">
      <div className="log-toolbar">
        <div>
          <span>{t.log.fileLabel}</span>
          <strong>{snapshot?.path ?? t.common.loading}</strong>
        </div>
        <ButtonHitArea>
          <button
            type="button"
            className="icon-button secondary-action reset-action"
            onClick={onRefresh}
          >
            <RotateCw className="button-icon lucide-button-icon" strokeWidth={3} />
            <span>{t.log.refresh}</span>
          </button>
        </ButtonHitArea>
      </div>
      <div className="log-viewer" ref={viewerRef} role="log" aria-live="polite">
        {text ? renderLogLines(text, Boolean(error)) : t.log.noEntries}
      </div>
    </div>
  );
}

function renderLogLines(text: string, error: boolean) {
  if (error) {
    return <span className="log-line log-line-error">{text}</span>;
  }

  return text.split("\n").map((line, index, lines) => {
    if (!line && index === lines.length - 1) {
      return null;
    }

    const level = line.match(/\blevel=(INFO|WARN|ERROR)\b/)?.[1].toLowerCase();
    const event = line.match(/\bevent=([^\s]+)/)?.[1];
    const className = `log-line ${level ? `log-line-${level}` : ""}`;

    return (
      <span className={className} key={`${index}-${line}`}>
        {renderLogLineTokens(line, event)}
        {index < lines.length - 1 ? "\n" : null}
      </span>
    );
  });
}

function renderLogLineTokens(line: string, event?: string) {
  const parts = line.match(/(?:[^\s"]+|"[^"\\]*(?:\\.[^"\\]*)*")+/g) ?? [line];
  return parts.map((part, index) => {
    const [key] = part.split("=", 1);
    const isEvent = key === "event";
    const isLevel = key === "level";
    const className = [
      "log-token",
      isEvent ? "log-token-event" : "",
      isLevel ? "log-token-level" : "",
      event && part === `event=${event}` ? `log-event-${event}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <span className={className} key={`${index}-${part}`}>
        {part}
        {index < parts.length - 1 ? " " : null}
      </span>
    );
  });
}
