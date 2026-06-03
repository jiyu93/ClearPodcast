import { formatMetadataShort } from "../domain/enhancement";
import type { AudioMetadata } from "../domain/types";
import { DownloadIcon } from "./icons";

export function PlaybackExportPanel({
  originalSrc,
  enhancedSrc,
  originalMetadata,
  enhancedMetadata,
  canExport,
  exportMessage,
  onExport,
}: {
  originalSrc?: string;
  enhancedSrc?: string;
  originalMetadata?: AudioMetadata;
  enhancedMetadata?: AudioMetadata;
  canExport: boolean;
  exportMessage: string;
  onExport: () => void;
}) {
  return (
    <section className="desk-panel compare-panel" aria-labelledby="compare-heading">
      <div className="panel-heading">
        <div>
          <span className="step-kicker">3 Compare</span>
          <h2 id="compare-heading">Listen, then export</h2>
        </div>
      </div>

      <div className="playback-stack">
        <PlaybackLane
          title="Original"
          src={originalSrc}
          metadata={originalMetadata}
          emptyLabel="Source preview appears here"
        />
        <PlaybackLane
          title="Enhanced"
          src={enhancedSrc}
          metadata={enhancedMetadata}
          emptyLabel="Enhanced preview appears after restoration"
        />
      </div>

      <div className="export-strip">
        <button
          type="button"
          className="icon-button primary-action export-action"
          onClick={onExport}
          disabled={!canExport}
        >
          <DownloadIcon className="button-icon" />
          <span>Export WAV</span>
        </button>
        <span>
          {exportMessage ||
            (canExport
              ? "Ready to save a WAV copy."
              : "WAV export unlocks after a restored preview.")}
        </span>
      </div>
    </section>
  );
}

function PlaybackLane({
  title,
  src,
  metadata,
  emptyLabel,
}: {
  title: string;
  src?: string;
  metadata?: AudioMetadata;
  emptyLabel: string;
}) {
  return (
    <div className="playback-lane">
      <div className="lane-header">
        <span>{title}</span>
        <strong>{formatMetadataShort(metadata)}</strong>
      </div>
      {src ? (
        <audio controls preload="metadata" src={src} />
      ) : (
        <div className="audio-placeholder">{emptyLabel}</div>
      )}
    </div>
  );
}
