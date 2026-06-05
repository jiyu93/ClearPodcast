import { EnhancementPanel } from "./components/EnhancementPanel";
import { SourcePanel } from "./components/SourcePanel";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { useWorkspaceController } from "./hooks/useWorkspaceController";

export default function App() {
  const workspace = useWorkspaceController();

  return (
    <main className="app-shell">
      <section className="workspace">
        <WorkspaceHeader
          state={workspace.job?.state ?? "idle"}
          fixtureName={workspace.fixtureName}
          deviceInfo={workspace.displayedDeviceInfo}
          deviceStatus={workspace.deviceStatus}
        />

        <div className="desk-grid">
          <SourcePanel
            originalSrc={workspace.originalAudioSrc}
            metadata={workspace.metadata}
            isDragActive={workspace.isDragActive}
            onChooseAudio={() => {
              void workspace.chooseAudio();
            }}
          />

          <EnhancementPanel
            job={workspace.job}
            enhancedSrc={workspace.enhancedAudioSrc}
            enhancedMetadata={workspace.job?.output_metadata}
            canRun={workspace.canRun}
            canCancel={workspace.canCancel}
            canExport={workspace.canExport}
            settings={workspace.enhancementSettings}
            settingsLocked={workspace.settingsLocked}
            onRun={() => {
              void workspace.runEnhancement();
            }}
            onCancel={() => {
              void workspace.cancelJob();
            }}
            onExport={() => {
              void workspace.exportEnhancedWav();
            }}
            onUpdateSettings={workspace.updateEnhancementField}
            onResetSettings={workspace.resetEnhancementSettings}
          />
        </div>
      </section>
    </main>
  );
}
