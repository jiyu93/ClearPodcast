import {
  ENHANCEMENT_HELP,
  SOLVER_HELP,
} from "../domain/enhancement";
import { RotateCcw } from "lucide-react";
import type {
  EnhancementParameters,
  EnhancementSolver,
} from "../domain/types";
import { ButtonHitArea } from "./ButtonHitArea";

export function ModelParametersView({
  enhancementParameters,
  controlsLocked,
  onUpdate,
  onReset,
}: {
  enhancementParameters: EnhancementParameters;
  controlsLocked: boolean;
  onUpdate: <K extends keyof EnhancementParameters>(
    field: K,
    value: EnhancementParameters[K],
  ) => void;
  onReset: () => void;
}) {
  return (
    <div className="panel-mode parameters-mode">
      <div className="model-copy">
        <strong>Enhancement Model Parameters</strong>
      </div>
      <ButtonHitArea>
        <button
          type="button"
          className="icon-button secondary-action reset-action"
          onClick={onReset}
          disabled={controlsLocked}
        >
          <RotateCcw className="button-icon lucide-button-icon" strokeWidth={3} />
          <span>Reset</span>
        </button>
      </ButtonHitArea>

      <fieldset className="solver-options" title={ENHANCEMENT_HELP.solver}>
        <legend>Solver</legend>
        <SolverOption
          value="midpoint"
          label="Midpoint"
          help={SOLVER_HELP.midpoint}
          selected={enhancementParameters.solver}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("solver", value)}
        />
        <SolverOption
          value="rk4"
          label="RK4"
          help={SOLVER_HELP.rk4}
          selected={enhancementParameters.solver}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("solver", value)}
        />
        <SolverOption
          value="euler"
          label="Euler"
          help={SOLVER_HELP.euler}
          selected={enhancementParameters.solver}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("solver", value)}
        />
      </fieldset>

      <fieldset className="parameter-controls">
        <legend>Enhancement Settings</legend>
        <SliderControl
          label="CFM steps"
          value={enhancementParameters.nfe}
          display={String(enhancementParameters.nfe)}
          min={1}
          max={128}
          step={1}
          hint={ENHANCEMENT_HELP.nfe}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("nfe", value)}
        />
        <SliderControl
          label="Prior temperature"
          value={enhancementParameters.tau}
          display={enhancementParameters.tau.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          hint={ENHANCEMENT_HELP.tau}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("tau", value)}
        />
        <SliderControl
          label="Denoising"
          value={enhancementParameters.lambd}
          display={enhancementParameters.lambd.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          hint={ENHANCEMENT_HELP.lambd}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("lambd", value)}
        />
      </fieldset>
    </div>
  );
}

function SolverOption({
  value,
  label,
  help,
  selected,
  disabled,
  onChange,
}: {
  value: EnhancementSolver;
  label: string;
  help: string;
  selected: EnhancementSolver;
  disabled: boolean;
  onChange: (value: EnhancementSolver) => void;
}) {
  return (
    <label className="solver-option">
      <input
        type="radio"
        name="enhancement-solver"
        value={value}
        checked={selected === value}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span>
        <strong>{label}</strong>
        <small>{help}</small>
      </span>
    </label>
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
