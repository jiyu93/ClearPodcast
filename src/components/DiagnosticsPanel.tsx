import { describeError } from "../domain/enhancement";
import type {
  DisplayError,
  EnhancementJobSnapshot,
  RuntimeSettings,
} from "../domain/types";
import { ChevronIcon, WrenchIcon } from "./icons";

export function DiagnosticsPanel({
  open,
  onToggle,
  runtimeSettings,
  updateRuntimeField,
  selectedPath,
  originalPreviewPath,
  job,
  displayError,
  deviceError,
}: {
  open: boolean;
  onToggle: () => void;
  runtimeSettings: RuntimeSettings;
  updateRuntimeField: (field: keyof RuntimeSettings, value: string) => void;
  selectedPath: string;
  originalPreviewPath: string;
  job?: EnhancementJobSnapshot;
  displayError?: DisplayError;
  deviceError?: string;
}) {
  const deviceDisplayError = deviceError
    ? describeError(deviceError, "device-detection")
    : undefined;

  return (
    <section className="drawer-panel diagnostics-panel">
      <button
        type="button"
        className="drawer-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="diagnostics-content"
      >
        <span className="drawer-title">
          <WrenchIcon className="drawer-icon" />
          <span>Diagnostics</span>
        </span>
        <span className="drawer-state">
          {open ? "Hide" : "Show"}
          <ChevronIcon className={`chevron ${open ? "open" : ""}`} />
        </span>
      </button>

      {open ? (
        <div id="diagnostics-content" className="drawer-content diagnostics-content">
          <div className="runtime-fields">
            <label>
              Python runtime override
              <input
                value={runtimeSettings.python}
                onChange={(event) => updateRuntimeField("python", event.target.value)}
                placeholder="Packaged runtime"
                spellCheck={false}
              />
            </label>
            <label>
              Model directory override
              <input
                value={runtimeSettings.model_dir}
                onChange={(event) =>
                  updateRuntimeField("model_dir", event.target.value)
                }
                placeholder="Packaged model"
                spellCheck={false}
              />
            </label>
          </div>

          <dl className="diagnostic-list">
            <DiagnosticRow label="Input path" value={selectedPath} />
            <DiagnosticRow label="Preview copy" value={originalPreviewPath} />
            <DiagnosticRow label="Job id" value={job?.job_id} />
            <DiagnosticRow label="Preview WAV" value={job?.preview_wav} />
            <DiagnosticRow label="Exported WAV" value={job?.exported_wav} />
            <DiagnosticRow label="Runtime detail" value={displayError?.detail} />
            <DiagnosticRow
              label="Device detail"
              value={deviceDisplayError?.detail}
            />
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function DiagnosticRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || "--"}</dd>
    </div>
  );
}
