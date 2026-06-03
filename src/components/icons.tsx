type IconProps = {
  className?: string;
};

export function UploadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 6.5 8.5l1.8 1.8 2.4-2.4V16h2.6V7.9l2.4 2.4 1.8-1.8L12 3Z" />
      <path d="M5 17.5h14V21H5v-3.5Z" />
    </svg>
  );
}

export function RestoreIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 13c2.1-4 4.2-6 6.4-6 3.5 0 4.2 6 7 6 1.3 0 2.5-1 3.6-3v4.8c-1.4 1.6-2.9 2.4-4.5 2.4-3.5 0-4.2-6-7-6-1.3 0-2.5 1-3.6 3H4v-1.2Z" />
      <path d="M5 19h14v2H5v-2Z" />
    </svg>
  );
}

export function StopIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7h10v10H7V7Z" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.7 4h2.6v7.9l2.4-2.4 1.8 1.8L12 16.8l-5.5-5.5 1.8-1.8 2.4 2.4V4Z" />
      <path d="M5 18h14v2.6H5V18Z" />
    </svg>
  );
}

export function ResetIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a7 7 0 1 1-6.3 4H3l3.8-4.4L10.6 9H8.5A4.8 4.8 0 1 0 12 7.2V5Z" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 15.8-6-6 1.8-1.8 4.2 4.2L16.2 8 18 9.8l-6 6Z" />
    </svg>
  );
}

export function WrenchIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.4 4.4a5.2 5.2 0 0 0 .6 5.7L5.4 19.7a1.8 1.8 0 0 0 2.5 2.5l9.6-9.6a5.2 5.2 0 0 0 6.1-6.8l-3.3 3.3-2.6-2.6 3.3-3.3a5.2 5.2 0 0 0-6.6 1.2Z" />
    </svg>
  );
}

export function GaugeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a9 9 0 0 0-9 9c0 2.1.7 4.1 1.9 5.6h14.2A9 9 0 0 0 12 4Zm0 2.5a6.5 6.5 0 0 1 5.8 9.5H6.2A6.5 6.5 0 0 1 12 6.5Z" />
      <path d="m13.1 13.7 3.2-4.2-4.8 2.8a1.5 1.5 0 1 0 1.6 1.4Z" />
    </svg>
  );
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 2.2 6.1L20 10.5l-5.8 2.4L12 19l-2.2-6.1L4 10.5l5.8-2.4L12 2Z" />
      <path d="m19 15 1 2.6 2.5 1-2.5 1-1 2.4-1-2.4-2.5-1 2.5-1 1-2.6Z" />
    </svg>
  );
}
