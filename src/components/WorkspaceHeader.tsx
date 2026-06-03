import { AppMark } from "./AppMark";
import { StatusPill } from "./StatusPill";
import type { EnhancementJobState } from "../domain/types";

export function WorkspaceHeader({
  state,
  fixtureName,
}: {
  state: EnhancementJobState | "idle";
  fixtureName?: string;
}) {
  return (
    <header className="workspace-header">
      <div className="brand-lockup">
        <AppMark />
        <div>
          <p className="eyebrow">Offline speech restoration</p>
          <h1>ClearPodcast</h1>
        </div>
      </div>
      <div className="header-meta">
        {fixtureName ? (
          <span className="fixture-pill">Visual QA: {fixtureName}</span>
        ) : null}
        <StatusPill state={state} />
      </div>
    </header>
  );
}
