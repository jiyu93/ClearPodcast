import { AppMark } from "./AppMark";
import { ProcessingDeviceIndicator } from "./ProcessingDeviceIndicator";
import { StatusPill } from "./StatusPill";
import type {
  DeviceDetectionStatus,
  EnhancementDeviceInfo,
  EnhancementJobState,
} from "../domain/types";

export function WorkspaceHeader({
  state,
  fixtureName,
  deviceInfo,
  deviceStatus,
}: {
  state: EnhancementJobState | "idle";
  fixtureName?: string;
  deviceInfo?: EnhancementDeviceInfo;
  deviceStatus: DeviceDetectionStatus;
}) {
  return (
    <header className="workspace-header">
      <div className="brand-lockup">
        <AppMark />
        <h1 className="brand-title" aria-label="ClearPodcast">
          <span className="brand-wordmark" aria-hidden="true">
            <span className="brand-wordmark-clear">Clear</span>
            <span className="brand-wordmark-podcast">Podcast</span>
          </span>
        </h1>
      </div>
      <div className="header-meta">
        {fixtureName ? (
          <span className="fixture-pill">Visual QA: {fixtureName}</span>
        ) : null}
        <StatusPill state={state} />
        <ProcessingDeviceIndicator
          deviceInfo={deviceInfo}
          status={deviceStatus}
        />
      </div>
    </header>
  );
}
