import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import appIconUrl from "../../src-tauri/icons/app-icon.svg";

export function AppTitleBar() {
  const appWindow = useMemo(() => getCurrentWindow(), []);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    void appWindow.setDecorations(false);

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const refreshMaximizedState = () => {
      void appWindow.isMaximized().then((maximized) => {
        if (!cancelled) {
          setIsMaximized(maximized);
        }
      });
    };

    refreshMaximizedState();

    void appWindow.onResized(() => {
      refreshMaximizedState();
    }).then((stopListening) => {
      if (cancelled) {
        stopListening();
        return;
      }
      unlisten = stopListening;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [appWindow]);

  const toggleMaximize = () => {
    void appWindow.toggleMaximize().then(() => appWindow.isMaximized()).then(
      setIsMaximized,
    );
  };

  return (
    <div
      className="app-titlebar"
      data-tauri-drag-region
      aria-label="ClearPodcast window title bar"
    >
      <div className="app-titlebar-brand" data-tauri-drag-region>
        <img
          className="app-titlebar-icon"
          src={appIconUrl}
          alt=""
          aria-hidden="true"
          data-tauri-drag-region
        />
        <span data-tauri-drag-region>ClearPodcast</span>
      </div>

      <div className="app-window-controls" role="group" aria-label="Window">
        <button
          type="button"
          className="app-window-control"
          aria-label="Minimize window"
          title="Minimize"
          onClick={() => void appWindow.minimize()}
        >
          <Minus aria-hidden="true" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="app-window-control"
          aria-label={isMaximized ? "Restore window" : "Maximize window"}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={toggleMaximize}
        >
          {isMaximized ? (
            <Copy aria-hidden="true" strokeWidth={2.2} />
          ) : (
            <Square aria-hidden="true" strokeWidth={2.2} />
          )}
        </button>
        <button
          type="button"
          className="app-window-control app-window-control-close"
          aria-label="Close window"
          title="Close"
          onClick={() => void appWindow.close()}
        >
          <X aria-hidden="true" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
