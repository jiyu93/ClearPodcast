import {
  DownloadIcon,
  EnhanceIcon,
  LogIcon,
  StopIcon,
  UploadIcon,
  WrenchIcon,
} from "./icons";

export function ControlsPanel({
  canRun,
  canCancel,
  canExport,
  onChooseAudio,
  onRun,
  onCancel,
  onExport,
  onOpenSettings,
  onOpenLog,
}: {
  canRun: boolean;
  canCancel: boolean;
  canExport: boolean;
  onChooseAudio: () => void;
  onRun: () => void;
  onCancel: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenLog: () => void;
}) {
  const actionIsCancel = canCancel;
  const ActionIcon = actionIsCancel ? StopIcon : EnhanceIcon;
  const actionLabel = actionIsCancel ? "Cancel" : "Enhance";
  const actionClass = actionIsCancel ? "secondary-action" : "primary-action";

  return (
    <div className="panel-section controls-panel" aria-label="Workspace controls">
      <div className="control-drop-zone">
        <div className="drop-copy">
          <button
            type="button"
            className="icon-button secondary-action source-choose-action"
            onClick={onChooseAudio}
          >
            <UploadIcon className="button-icon" />
            <span>Choose audio</span>
          </button>
          <span>Drop or choose WAV, MP3, or M4A</span>
        </div>
      </div>

      <div className="primary-controls">
        <button
          type="button"
          className={`icon-button ${actionClass}`}
          onClick={actionIsCancel ? onCancel : onRun}
          disabled={actionIsCancel ? !canCancel : !canRun}
        >
          <ActionIcon className="button-icon" />
          <span>{actionLabel}</span>
        </button>

        <button
          type="button"
          className="icon-button primary-action export-action"
          onClick={onExport}
          disabled={!canExport}
        >
          <DownloadIcon className="button-icon" />
          <span>Save</span>
        </button>
      </div>

      <div className="panel-tools" aria-label="Workspace tools">
        <button
          type="button"
          className="icon-button tool-action"
          onClick={onOpenSettings}
          aria-label="Open model settings"
          title="Model settings"
        >
          <WrenchIcon className="button-icon" />
        </button>
        <button
          type="button"
          className="icon-button tool-action"
          onClick={onOpenLog}
          aria-label="Open log"
          title="Log"
        >
          <LogIcon className="button-icon" />
        </button>
      </div>
    </div>
  );
}
