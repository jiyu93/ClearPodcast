import { fileNameFromPath } from "../domain/enhancement";
import { ButtonHitArea } from "./ButtonHitArea";
import { LogIcon, ParametersIcon } from "./icons";

export function ControlsPanel({
  selectedPath,
  onOpenModelParameters,
  onOpenLog,
}: {
  selectedPath: string;
  onOpenModelParameters: () => void;
  onOpenLog: () => void;
}) {
  const sourceFileName = selectedPath
    ? fileNameFromPath(selectedPath)
    : "No source open";

  return (
    <div className="panel-section controls-panel" aria-label="Workspace controls">
      <div className="source-file-display" title={selectedPath || sourceFileName}>
        <span>Source</span>
        <strong>{sourceFileName}</strong>
      </div>

      <div className="panel-tools" aria-label="Workspace tools">
        <ButtonHitArea>
          <button
            type="button"
            className="icon-button tool-action"
            onClick={onOpenModelParameters}
            aria-label="Open model parameters"
            title="Model parameters"
          >
            <ParametersIcon className="button-icon" />
          </button>
        </ButtonHitArea>
        <ButtonHitArea>
          <button
            type="button"
            className="icon-button tool-action"
            onClick={onOpenLog}
            aria-label="Open log"
            title="Log"
          >
            <LogIcon className="button-icon" />
          </button>
        </ButtonHitArea>
      </div>
    </div>
  );
}
