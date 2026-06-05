import { ArrowLeft, FileText, SlidersHorizontal } from "lucide-react";

import { fileNameFromPath } from "../domain/enhancement";
import type { WorkspaceMode } from "./WorkspaceContent";
import { ButtonHitArea } from "./ButtonHitArea";
import { useI18n } from "../i18n/I18nProvider";

export function ControlsPanel({
  selectedPath,
  mode,
  onOpenModelParameters,
  onOpenLog,
  onBack,
}: {
  selectedPath: string;
  mode: WorkspaceMode;
  onOpenModelParameters: () => void;
  onOpenLog: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const hasSelectedFile = Boolean(selectedPath);
  const sourceFileName = selectedPath
    ? fileNameFromPath(selectedPath)
    : t.controls.emptySource;

  return (
    <div className="panel-section controls-panel" aria-label={t.controls.panelAriaLabel}>
      <div
        className={`source-file-display ${hasSelectedFile ? "has-file" : "empty"}`}
        title={selectedPath || sourceFileName}
      >
        <span>{t.controls.sourceLabel}</span>
        <strong>{sourceFileName}</strong>
      </div>

      <div className="panel-tools" aria-label={t.controls.toolsAriaLabel}>
        {mode === "audio" ? (
          <>
            <ButtonHitArea>
              <button
                type="button"
                className="icon-button tool-action"
                onClick={onOpenModelParameters}
                aria-label={t.controls.openModelParametersAriaLabel}
                title={t.controls.modelParametersTitle}
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
                aria-label={t.controls.openLogAriaLabel}
                title={t.controls.logTitle}
              >
                <FileText className="button-icon lucide-button-icon" strokeWidth={3} />
              </button>
            </ButtonHitArea>
          </>
        ) : (
          <ButtonHitArea>
            <button
              type="button"
              className="icon-button tool-action back-action"
              onClick={onBack}
              aria-label={t.controls.backToAudioWorkspaceAriaLabel}
              title={t.controls.backTitle}
            >
              <ArrowLeft className="button-icon lucide-button-icon" strokeWidth={3} />
              <span>{t.controls.back}</span>
            </button>
          </ButtonHitArea>
        )}
      </div>
    </div>
  );
}
