import { RotateCcw } from "lucide-react";
import type {
  EnhancementParameters,
  EnhancementSolver,
} from "../domain/types";
import { ButtonHitArea } from "./ButtonHitArea";
import { useI18n } from "../i18n/I18nProvider";

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
  const { t } = useI18n();

  return (
    <div className="panel-mode parameters-mode">
      <div className="model-copy">
        <strong>{t.model.title}</strong>
      </div>
      <ButtonHitArea>
        <button
          type="button"
          className="icon-button secondary-action reset-action"
          onClick={onReset}
          disabled={controlsLocked}
        >
          <RotateCcw className="button-icon lucide-button-icon" strokeWidth={3} />
          <span>{t.model.reset}</span>
        </button>
      </ButtonHitArea>

      <fieldset className="solver-options" title={t.model.solverHelp}>
        <legend>{t.model.solver}</legend>
        <SolverOption
          value="midpoint"
          label={t.model.solverOptions.midpoint.label}
          help={t.model.solverOptions.midpoint.help}
          selected={enhancementParameters.solver}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("solver", value)}
        />
        <SolverOption
          value="rk4"
          label={t.model.solverOptions.rk4.label}
          help={t.model.solverOptions.rk4.help}
          selected={enhancementParameters.solver}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("solver", value)}
        />
        <SolverOption
          value="euler"
          label={t.model.solverOptions.euler.label}
          help={t.model.solverOptions.euler.help}
          selected={enhancementParameters.solver}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("solver", value)}
        />
      </fieldset>

      <fieldset className="parameter-controls">
        <legend>{t.model.settings}</legend>
        <SliderControl
          label={t.model.parameters.nfe.label}
          value={enhancementParameters.nfe}
          display={String(enhancementParameters.nfe)}
          min={1}
          max={128}
          step={1}
          hint={t.model.parameters.nfe.help}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("nfe", value)}
        />
        <SliderControl
          label={t.model.parameters.tau.label}
          value={enhancementParameters.tau}
          display={enhancementParameters.tau.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          hint={t.model.parameters.tau.help}
          disabled={controlsLocked}
          onChange={(value) => onUpdate("tau", value)}
        />
        <SliderControl
          label={t.model.parameters.lambd.label}
          value={enhancementParameters.lambd}
          display={enhancementParameters.lambd.toFixed(2)}
          min={0}
          max={1}
          step={0.01}
          hint={t.model.parameters.lambd.help}
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
