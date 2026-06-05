import {
  ENHANCEMENT_HELP,
  SOLVER_HELP,
} from "../domain/enhancement";
import type {
  EnhancementSettings,
  EnhancementSolver,
} from "../domain/types";
import { ButtonHitArea } from "./ButtonHitArea";
import { ResetIcon } from "./icons";

export function ModelTuningView({
  enhancementSettings,
  controlsLocked,
  onUpdate,
  onReset,
}: {
  enhancementSettings: EnhancementSettings;
  controlsLocked: boolean;
  onUpdate: <K extends keyof EnhancementSettings>(
    field: K,
    value: EnhancementSettings[K],
  ) => void;
  onReset: () => void;
}) {
  return (
    <div className="panel-mode tuning-mode">
      <div className="model-copy">
        <strong>Resemble Enhance controls</strong>
        <span>Defaults are tuned for one-click cleanup.</span>
      </div>
      <ButtonHitArea>
        <button
          type="button"
          className="icon-button secondary-action reset-action"
          onClick={onReset}
          disabled={controlsLocked}
        >
          <ResetIcon className="button-icon" />
          <span>Reset defaults</span>
        </button>
      </ButtonHitArea>

      <label className="solver-select" title={ENHANCEMENT_HELP.solver}>
        <span>Solver</span>
        <select
          value={enhancementSettings.solver}
          onChange={(event) =>
            onUpdate("solver", event.target.value as EnhancementSolver)
          }
          disabled={controlsLocked}
        >
          <option value="midpoint">Midpoint</option>
          <option value="rk4">RK4</option>
          <option value="euler">Euler</option>
        </select>
      </label>

      <dl className="solver-notes" aria-label="Solver differences">
        <div>
          <dt>Midpoint</dt>
          <dd>{SOLVER_HELP.midpoint}</dd>
        </div>
        <div>
          <dt>RK4</dt>
          <dd>{SOLVER_HELP.rk4}</dd>
        </div>
        <div>
          <dt>Euler</dt>
          <dd>{SOLVER_HELP.euler}</dd>
        </div>
      </dl>

      <div className="slider-grid">
        <SliderControl
          label="CFM steps"
          value={enhancementSettings.nfe}
          display={String(enhancementSettings.nfe)}
          min={1}
          max={128}
          step={1}
          hint={ENHANCEMENT_HELP.nfe}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("nfe", value)}
        />
        <SliderControl
          label="Prior temperature"
          value={enhancementSettings.tau}
          display={enhancementSettings.tau.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          hint={ENHANCEMENT_HELP.tau}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("tau", value)}
        />
        <SliderControl
          label="Denoising"
          value={enhancementSettings.lambd}
          display={enhancementSettings.lambd.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          hint={ENHANCEMENT_HELP.lambd}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("lambd", value)}
        />
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  display,
  min,
  max,
  step,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  hint: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-card">
      <label className="slider-control" title={hint}>
        <span>
          <span>{label}</span>
          <strong>{display}</strong>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
        />
      </label>
      <p className="field-hint">{hint}</p>
    </div>
  );
}
