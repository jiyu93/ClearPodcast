import { labelForState } from "../domain/enhancement";
import type { EnhancementJobState } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";

export function StatusPill({ state }: { state: EnhancementJobState | "idle" }) {
  const { t } = useI18n();

  return (
    <span className={`status-pill ${state}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{labelForState(state, t.status)}</span>
    </span>
  );
}
