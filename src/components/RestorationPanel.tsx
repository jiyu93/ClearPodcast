import {
  statusDetail,
  statusTitle,
  workflowSteps,
} from "../domain/enhancement";
import type {
  DeviceDetectionStatus,
  DisplayError,
  EnhancementDeviceInfo,
  EnhancementJobSnapshot,
} from "../domain/types";
import { ProcessingDeviceCard } from "./ProcessingDeviceCard";
import { RestoreIcon, SparkIcon, StopIcon } from "./icons";

export function RestorationPanel({
  selectedPath,
  job,
  notice,
  displayError,
  exportMessage,
  deviceInfo,
  deviceStatus,
  deviceError,
  deviceInfoIsActual,
  canRun,
  canCancel,
  onRun,
  onCancel,
}: {
  selectedPath: string;
  job?: EnhancementJobSnapshot;
  notice: string;
  displayError?: DisplayError;
  exportMessage: string;
  deviceInfo?: EnhancementDeviceInfo;
  deviceStatus: DeviceDetectionStatus;
  deviceError: string;
  deviceInfoIsActual: boolean;
  canRun: boolean;
  canCancel: boolean;
  onRun: () => void;
  onCancel: () => void;
}) {
  const steps = workflowSteps(selectedPath, job);

  return (
    <section className="desk-panel run-panel" aria-labelledby="run-heading">
      <div className="panel-heading">
        <div>
          <span className="step-kicker">2 Current run</span>
          <h2 id="run-heading">Restore locally</h2>
        </div>
        <SparkIcon className="panel-glyph" />
      </div>

      <ol className="workflow-rail" aria-label="Restoration workflow">
        {steps.map((step) => (
          <li key={step.id} className={step.state}>
            <span />
            {step.label}
          </li>
        ))}
      </ol>

      <ProcessingDeviceCard
        deviceInfo={deviceInfo}
        status={deviceStatus}
        error={deviceError}
        actual={deviceInfoIsActual}
      />

      <div className="message-panel" role="status" aria-live="polite">
        <strong>{statusTitle(job, displayError, notice)}</strong>
        <span>{statusDetail(job, displayError, notice)}</span>
        {exportMessage ? <span>{exportMessage}</span> : null}
      </div>

      <div className="action-row split-actions">
        <button
          type="button"
          className="icon-button primary-action"
          onClick={onRun}
          disabled={!canRun}
        >
          <RestoreIcon className="button-icon" />
          <span>Restore speech</span>
        </button>
        <button
          type="button"
          className="icon-button secondary-action"
          onClick={onCancel}
          disabled={!canCancel}
        >
          <StopIcon className="button-icon" />
          <span>Cancel</span>
        </button>
      </div>
    </section>
  );
}
