import { useEffect, useRef, useState } from "react";

import { markFrontendReady } from "./backend/tauriCommands";
import { ControlsPanel } from "./components/ControlsPanel";
import { WorkspaceContent } from "./components/WorkspaceContent";
import type { WorkspaceMode } from "./components/WorkspaceContent";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { useWorkspaceController } from "./hooks/useWorkspaceController";
import { useI18n } from "./i18n/I18nProvider";

export default function App() {
  const { t } = useI18n();
  const workspace = useWorkspaceController();
  const frontendReadyLogged = useRef(false);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("audio");
  const showAudioWorkspace = () => setWorkspaceMode("audio");
  const toggleWorkspaceMode = (mode: Exclude<WorkspaceMode, "audio">) =>
    setWorkspaceMode((current) => (current === mode ? "audio" : mode));

  useEffect(() => {
    if (frontendReadyLogged.current) {
      return;
    }
    frontendReadyLogged.current = true;

    void markFrontendReady(performance.now()).catch(() => {
      // Startup timing is diagnostic only; rendering should never depend on it.
    });
  }, []);

  return (
    <main className="app-shell">
      <section className="workspace">
        <WorkspaceHeader
          state={workspace.job?.state ?? "idle"}
          deviceInfo={workspace.displayedDeviceInfo}
          deviceStatus={workspace.deviceStatus}
          deviceModeToggleAvailable={workspace.deviceModeToggleAvailable}
          canToggleDeviceMode={workspace.canToggleDeviceMode}
          onToggleDeviceMode={workspace.toggleDeviceMode}
        />

        <div className="workspace-body">
          <section
            className={`workspace-card workspace-panel ${
              workspace.isDragActive ? "drag-active" : ""
            }`}
            aria-label={t.app.workspaceAriaLabel}
          >
            <ControlsPanel
              selectedPath={workspace.selectedPath}
              mode={workspaceMode}
              onOpenModelParameters={() => toggleWorkspaceMode("parameters")}
              onOpenLog={() => toggleWorkspaceMode("log")}
              onBack={showAudioWorkspace}
            />

            <WorkspaceContent
              originalSrc={workspace.originalAudioSrc}
              originalMetadata={workspace.metadata}
              enhancedSrc={workspace.enhancedAudioSrc}
              enhancedMetadata={workspace.job?.output_metadata}
              mode={workspaceMode}
              enhancementParameters={workspace.enhancementParameters}
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
              onUpdateParameters={workspace.updateEnhancementParameter}
              onResetParameters={workspace.resetEnhancementParameters}
            />
          </section>
        </div>
      </section>
    </main>
  );
}
