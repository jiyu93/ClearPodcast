import { useState } from "react";

import { ControlsPanel } from "./components/ControlsPanel";
import { WorkspaceContent } from "./components/WorkspaceContent";
import type { WorkspaceMode } from "./components/WorkspaceContent";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { useWorkspaceController } from "./hooks/useWorkspaceController";

export default function App() {
  const workspace = useWorkspaceController();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("audio");
  const showAudioWorkspace = () => setWorkspaceMode("audio");
  const toggleWorkspaceMode = (mode: Exclude<WorkspaceMode, "audio">) =>
    setWorkspaceMode((current) => (current === mode ? "audio" : mode));

  return (
    <main className="app-shell">
      <section className="workspace">
        <WorkspaceHeader
          state={workspace.job?.state ?? "idle"}
          deviceInfo={workspace.displayedDeviceInfo}
          deviceStatus={workspace.deviceStatus}
        />

        <div className="workspace-body">
          <section
            className={`workspace-card workspace-panel ${
              workspace.isDragActive ? "drag-active" : ""
            }`}
            aria-label="ClearPodcast workspace"
          >
            <ControlsPanel
              selectedPath={workspace.selectedPath}
              onOpenModelTuning={() => toggleWorkspaceMode("tuning")}
              onOpenLog={() => toggleWorkspaceMode("log")}
            />

            <WorkspaceContent
              originalSrc={workspace.originalAudioSrc}
              originalMetadata={workspace.metadata}
              enhancedSrc={workspace.enhancedAudioSrc}
              enhancedMetadata={workspace.job?.output_metadata}
              mode={workspaceMode}
              enhancementSettings={workspace.enhancementSettings}
              enhancementControlsLocked={workspace.enhancementControlsLocked}
              canRun={workspace.canRun}
              canCancel={workspace.canCancel}
              canExport={workspace.canExport}
              onOpenAudio={() => {
                showAudioWorkspace();
                void workspace.openAudio();
              }}
              onRun={() => {
                showAudioWorkspace();
                void workspace.runEnhancement();
              }}
              onCancel={() => {
                showAudioWorkspace();
                void workspace.cancelJob();
              }}
              onExport={() => {
                showAudioWorkspace();
                void workspace.exportEnhancedWav();
              }}
              onUpdateTuning={workspace.updateEnhancementField}
              onResetTuning={workspace.resetEnhancementSettings}
            />
          </section>
        </div>
      </section>
    </main>
  );
}
