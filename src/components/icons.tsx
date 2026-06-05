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

export function EnhanceIcon({ className }: IconProps) {
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

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.2 18.4 12 8 18.8V5.2Z" />
    </svg>
  );
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h3.4v14H7V5Zm6.6 0H17v14h-3.4V5Z" />
    </svg>
  );
}

export function SkipBackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h2.4v14H6V5Z" />
      <path d="M18.8 5.4 9.8 12l9 6.6V5.4Z" />
    </svg>
  );
}

export function SkipForwardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.6 5H18v14h-2.4V5Z" />
      <path d="m5.2 5.4 9 6.6-9 6.6V5.4Z" />
    </svg>
  );
}

export function VolumeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path d="M16 8.2a5.2 5.2 0 0 1 0 7.6l-1.6-1.6a3 3 0 0 0 0-4.4L16 8.2Z" />
      <path d="M18.8 5.4a9 9 0 0 1 0 13.2L17.2 17a6.7 6.7 0 0 0 0-10l1.6-1.6Z" />
    </svg>
  );
}

export function MutedIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4V9Z" />
      <path d="m16.2 9 1.8 1.8L19.8 9l1.2 1.2-1.8 1.8 1.8 1.8-1.2 1.2-1.8-1.8-1.8 1.8-1.2-1.2 1.8-1.8-1.8-1.8L16.2 9Z" />
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

export function BackIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m10.4 4.4 1.8 1.8-4.5 4.5H21v2.6H7.7l4.5 4.5-1.8 1.8L2.8 12l7.6-7.6Z" />
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

export function LogIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3h14v18H5V3Zm3 4v2h8V7H8Zm0 4v2h8v-2H8Zm0 4v2h5v-2H8Z" />
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

export function CpuIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 2h2v3h4V2h2v3h1.4A1.6 1.6 0 0 1 19 6.6V8h3v2h-3v4h3v2h-3v1.4a1.6 1.6 0 0 1-1.6 1.6H16v3h-2v-3h-4v3H8v-3H6.6A1.6 1.6 0 0 1 5 17.4V16H2v-2h3v-4H2V8h3V6.6A1.6 1.6 0 0 1 6.6 5H8V2Zm-.4 5.6v8.8h8.8V7.6H7.6Z" />
      <path d="M10 10h4v4h-4v-4Z" />
    </svg>
  );
}

export function GpuIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 17.8v2.7h6v-2.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
      <path
        d="M4 3.5v17M4 7h12.9A3.1 3.1 0 0 1 20 10.1v4.8a3.1 3.1 0 0 1-3.1 3.1H4V7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="M10.1 12.5a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0ZM16.9 12.5a1.9 1.9 0 1 1-3.8 0 1.9 1.9 0 0 1 3.8 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
    </svg>
  );
}
