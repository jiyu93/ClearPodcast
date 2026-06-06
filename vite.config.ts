import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [clearPodcastStartupGate(), react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/**/*.tsx",
        "./src/**/*.ts",
        "./src/**/*.css",
      ],
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});

function clearPodcastStartupGate(): Plugin {
  const firstScreenModules = [
    "/@vite/client",
    "/node_modules/vite/dist/client/env.mjs",
    "/src/main.tsx",
    "/src/styles.css",
    "/src/App.tsx",
    "/src/i18n/I18nProvider.tsx",
    "/src/i18n/translations.ts",
    "/src/components/ControlsPanel.tsx",
    "/src/components/WorkspaceContent.tsx",
    "/src/components/WorkspaceHeader.tsx",
    "/src/hooks/useWorkspaceController.ts",
    "/src/domain/enhancement.ts",
    "/src/components/ButtonHitArea.tsx",
    "/src/components/AppMark.tsx",
    "/src/components/ProcessingDeviceIndicator.tsx",
    "/src/components/StatusPill.tsx",
    "/src/dev/visualFixtures.ts",
    "/src/components/icons.tsx",
    "/src/components/AudioPreviewLane.tsx",
    "/src/components/ModelParametersView.tsx",
    "/src/backend/tauriCommands.ts",
    "/src/components/audioPlaybackTiming.ts",
    "/src/components/audioWaveform.ts",
  ];

  return {
    name: "clearpodcast-startup-gate",
    configureServer(server) {
      let ready = false;
      const warmup = Promise.all(
        firstScreenModules.map((module) => server.warmupRequest(module)),
      )
        .catch(() => undefined)
        .then(() => {
          ready = true;
        });
      const timeout = new Promise<void>((resolve) => {
        setTimeout(resolve, 8000);
      }).then(() => {
        ready = true;
      });
      const startupReady = Promise.race([warmup, timeout]);

      server.middlewares.use(async (request, _response, next) => {
        if (!ready && (request.url === "/" || request.url?.startsWith("/src/"))) {
          await startupReady;
        }
        next();
      });
    },
  };
}
