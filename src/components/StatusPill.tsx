import { labelForState } from "../domain/enhancement";
import type { EnhancementJobState } from "../domain/types";

export function StatusPill({ state }: { state: EnhancementJobState | "idle" }) {
  return (
    <span className={`status-pill ${state}`}>
      <span className="status-dot" aria-hidden="true" />
      <span>{labelForState(state)}</span>
    </span>
  );
}
