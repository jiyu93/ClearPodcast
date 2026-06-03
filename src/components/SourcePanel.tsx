import { SourceArtwork } from "./AppMark";
import { MetadataGrid } from "./MetadataGrid";
import { UploadIcon } from "./icons";
import type { AudioMetadata } from "../domain/types";

export function SourcePanel({
  selectedFileName,
  metadata,
  isDragActive,
  onChooseAudio,
}: {
  selectedFileName: string;
  metadata?: AudioMetadata;
  isDragActive: boolean;
  onChooseAudio: () => void;
}) {
  return (
    <section
      className={`desk-panel source-panel ${isDragActive ? "drag-active" : ""}`}
      aria-labelledby="source-heading"
    >
      <div className="panel-heading">
        <div>
          <span className="step-kicker">1 Source</span>
          <h2 id="source-heading">Choose one recording</h2>
        </div>
        <button
          type="button"
          className="icon-button secondary-action"
          onClick={onChooseAudio}
        >
          <UploadIcon className="button-icon" />
          <span>Choose audio</span>
        </button>
      </div>

      <div className="drop-zone">
        <SourceArtwork />
        <div className="drop-copy">
          <strong>{selectedFileName}</strong>
          <span>Drop or choose WAV, MP3, or M4A</span>
        </div>
      </div>

      <MetadataGrid metadata={metadata} />
    </section>
  );
}
