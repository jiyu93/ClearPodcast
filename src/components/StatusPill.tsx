import { labelForState } from "../domain/enhancement";
import type { EnhancementJobState } from "../domain/types";

export function StatusPill({ state }: { state: EnhancementJobState | "idle" }) {
  return <span className={`status-pill ${state}`}>{labelForState(state)}</span>;
}
