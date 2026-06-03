import { AdvancedSettingsPanel } from "./components/AdvancedSettingsPanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { PlaybackExportPanel } from "./components/PlaybackExportPanel";
import { RestorationPanel } from "./components/RestorationPanel";
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
        />

        <div className="desk-grid">
          <SourcePanel
            selectedFileName={workspace.selectedFileName}
            metadata={workspace.metadata}
            isDragActive={workspace.isDragActive}
            onChooseAudio={() => {
              void workspace.chooseAudio();
            }}
          />

          <RestorationPanel
            selectedPath={workspace.selectedPath}
            job={workspace.job}
            notice={workspace.notice}
            displayError={workspace.displayError}
            exportMessage={workspace.exportMessage}
            deviceInfo={workspace.displayedDeviceInfo}
            deviceStatus={workspace.deviceStatus}
            deviceError={workspace.deviceError}
            deviceInfoIsActual={workspace.deviceInfoIsActual}
            canRun={workspace.canRun}
            canCancel={workspace.canCancel}
            onRun={() => {
              void workspace.runEnhancement();
            }}
            onCancel={() => {
              void workspace.cancelJob();
            }}
          />

          <PlaybackExportPanel
            originalSrc={workspace.originalAudioSrc}
            enhancedSrc={workspace.enhancedAudioSrc}
            originalMetadata={workspace.metadata}
            enhancedMetadata={workspace.job?.output_metadata}
            canExport={workspace.canExport}
            exportMessage={workspace.exportMessage}
            onExport={() => {
              void workspace.exportEnhancedWav();
            }}
          />
        </div>

        <div className="secondary-drawers">
          <AdvancedSettingsPanel
            open={workspace.advancedOpen}
            onToggle={() => workspace.setAdvancedOpen((open) => !open)}
            settings={workspace.enhancementSettings}
            settingsLocked={workspace.settingsLocked}
            onUpdate={workspace.updateEnhancementField}
            onReset={workspace.resetEnhancementSettings}
          />

          <DiagnosticsPanel
            open={workspace.diagnosticsOpen}
            onToggle={() => workspace.setDiagnosticsOpen((open) => !open)}
            runtimeSettings={workspace.runtimeSettings}
            updateRuntimeField={workspace.updateRuntimeField}
            selectedPath={workspace.selectedPath}
            originalPreviewPath={workspace.originalPreviewPath}
            job={workspace.job}
            displayError={workspace.displayError}
            deviceError={workspace.deviceError}
          />
        </div>
      </section>
    </main>
  );
}
