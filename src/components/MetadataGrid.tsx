import { formatDuration } from "../domain/enhancement";
import type { AudioMetadata } from "../domain/types";

export function MetadataGrid({ metadata }: { metadata?: AudioMetadata }) {
  const cells = [
    {
      label: "Format",
      value: metadata ? metadata.format.toUpperCase() : "--",
    },
    {
      label: "Rate",
      value: metadata ? `${metadata.source_sample_rate.toLocaleString()} Hz` : "--",
    },
    {
      label: "Channels",
      value: metadata ? `${metadata.channels} ch` : "--",
    },
    {
      label: "Duration",
      value: metadata ? formatDuration(metadata.duration_seconds) : "--",
    },
  ];

  return (
    <dl className="metadata-grid" aria-label="Source audio details">
      {cells.map((cell) => (
        <div key={cell.label}>
          <dt>{cell.label}</dt>
          <dd>{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}
