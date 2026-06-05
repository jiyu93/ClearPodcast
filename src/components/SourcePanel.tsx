import { AudioPreviewLane } from "./AudioPreviewLane";
import { MetadataGrid } from "./MetadataGrid";
import { UploadIcon } from "./icons";
import type { AudioMetadata } from "../domain/types";

export function SourcePanel({
  originalSrc,
  metadata,
  isDragActive,
  onChooseAudio,
}: {
  originalSrc?: string;
  metadata?: AudioMetadata;
  isDragActive: boolean;
  onChooseAudio: () => void;
}) {
  return (
    <section
      className={`desk-panel source-panel ${isDragActive ? "drag-active" : ""}`}
      aria-label="Source audio"
    >
      <div className="source-file-strip">
        <div className="drop-copy">
          <button
            type="button"
            className="icon-button secondary-action source-choose-action"
            onClick={onChooseAudio}
          >
            <UploadIcon className="button-icon" />
            <span>Choose audio</span>
          </button>
          <span>Drop or choose WAV, MP3, or M4A</span>
        </div>
      </div>

      <div className="source-summary">
        <div className="source-summary-header">
          <span className="source-summary-title">Original</span>
          <MetadataGrid metadata={metadata} />
        </div>
        <AudioPreviewLane
          title="Original"
          src={originalSrc}
          metadata={metadata}
          emptyLabel="Original preview appears here"
          showHeader={false}
          showMetadata={false}
        />
      </div>

    </section>
  );
}
