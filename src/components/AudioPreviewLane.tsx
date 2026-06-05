import { formatMetadataShort } from "../domain/enhancement";
import type { AudioMetadata } from "../domain/types";

export function AudioPreviewLane({
  title,
  src,
  metadata,
  emptyLabel,
  showHeader = true,
  showMetadata = true,
}: {
  title: string;
  src?: string;
  metadata?: AudioMetadata;
  emptyLabel: string;
  showHeader?: boolean;
  showMetadata?: boolean;
}) {
  return (
    <div className="playback-lane">
      {showHeader ? (
        <div className="lane-header">
          <span>{title}</span>
          {showMetadata ? <strong>{formatMetadataShort(metadata)}</strong> : null}
        </div>
      ) : null}
      {src ? (
        <audio controls preload="metadata" src={src} />
      ) : (
        <div className="audio-placeholder">{emptyLabel}</div>
      )}
    </div>
  );
}
