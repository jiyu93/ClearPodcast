import { formatDuration } from "../domain/enhancement";
import type { AudioMetadata } from "../domain/types";

export function MetadataGrid({ metadata }: { metadata?: AudioMetadata }) {
  const cells = metadata
    ? [
        metadata.format.toUpperCase(),
        `${metadata.source_sample_rate.toLocaleString()} Hz`,
        `${metadata.channels} ch`,
        formatDuration(metadata.duration_seconds),
      ]
    : ["--", "--", "--", "--"];

  return (
    <dl className="metadata-grid" aria-label="Source audio details">
      {["Format", "Rate", "Channels", "Duration"].map((label, index) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{cells[index]}</dd>
        </div>
      ))}
    </dl>
  );
}
