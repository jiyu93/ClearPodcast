import { Languages } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { AppMark } from "./AppMark";
import { ProcessingDeviceIndicator } from "./ProcessingDeviceIndicator";
import { StatusPill } from "./StatusPill";
import type {
  DeviceDetectionStatus,
  EnhancementDeviceInfo,
  EnhancementJobState,
} from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import type { AppLanguage } from "../i18n/translations";

const appVersion = import.meta.env.VITE_APP_VERSION;

export function WorkspaceHeader({
  state,
  deviceInfo,
  deviceStatus,
  deviceModeToggleAvailable,
  canToggleDeviceMode,
  onToggleDeviceMode,
}: {
  state: EnhancementJobState | "idle";
  deviceInfo?: EnhancementDeviceInfo;
  deviceStatus: DeviceDetectionStatus;
  deviceModeToggleAvailable: boolean;
  canToggleDeviceMode: boolean;
  onToggleDeviceMode: () => void;
}) {
  const { language, languages, setLanguage, t } = useI18n();
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!languageMenuOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [languageMenuOpen]);

  return (
    <header className="workspace-header">
      <div className="brand-lockup">
        <AppMark />
        <h1 className="brand-title" aria-label={`ClearPodcast ${appVersion}`}>
          <span className="brand-wordmark" aria-hidden="true">
            <span className="brand-wordmark-clear">Clear</span>
            <span className="brand-wordmark-podcast">Podcast</span>
          </span>
          <span className="brand-version" aria-hidden="true">
            v{appVersion}
          </span>
        </h1>
      </div>
      <div className="header-meta">
        <div
          className="language-selector"
          ref={selectorRef}
          title={t.language.label}
        >
          <button
            type="button"
            className="language-selector-button"
            aria-controls={listboxId}
            aria-expanded={languageMenuOpen}
            aria-haspopup="listbox"
            aria-label={t.language.ariaLabel}
            onClick={() => setLanguageMenuOpen((current) => !current)}
          >
            <Languages
              className="language-selector-icon lucide-button-icon"
              strokeWidth={3}
              aria-hidden="true"
            />
          </button>
          {languageMenuOpen ? (
            <div
              className="language-menu"
              id={listboxId}
              role="listbox"
              aria-label={t.language.label}
            >
              {languages.map((option) => {
                const selected = option.code === language;

                return (
                  <button
                    type="button"
                    className={`language-menu-option ${
                      selected ? "selected" : ""
                    }`}
                    key={option.code}
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setLanguage(option.code as AppLanguage);
                      setLanguageMenuOpen(false);
                    }}
                  >
                    <span>{option.nativeName}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <StatusPill state={state} />
        <ProcessingDeviceIndicator
          deviceInfo={deviceInfo}
          status={deviceStatus}
          toggleAvailable={deviceModeToggleAvailable}
          canToggle={canToggleDeviceMode}
          onToggle={onToggleDeviceMode}
        />
      </div>
    </header>
  );
}
