import { FileText, SlidersHorizontal } from "lucide-react";

import { fileNameFromPath } from "../domain/enhancement";
import { ButtonHitArea } from "./ButtonHitArea";

export function ControlsPanel({
  selectedPath,
  onOpenModelParameters,
  onOpenLog,
}: {
  selectedPath: string;
  onOpenModelParameters: () => void;
  onOpenLog: () => void;
}) {
  const hasSelectedFile = Boolean(selectedPath);
  const sourceFileName = selectedPath
    ? fileNameFromPath(selectedPath)
    : "Open or drop a WAV, MP3, or M4A file";

  return (
    <div className="panel-section controls-panel" aria-label="Workspace controls">
      <div
        className={`source-file-display ${hasSelectedFile ? "has-file" : "empty"}`}
        title={selectedPath || sourceFileName}
      >
        <span>FILENAME</span>
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
            <SlidersHorizontal
              className="button-icon lucide-button-icon"
              strokeWidth={3}
            />
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
            <FileText className="button-icon lucide-button-icon" strokeWidth={3} />
          </button>
        </ButtonHitArea>
      </div>
    </div>
  );
}
