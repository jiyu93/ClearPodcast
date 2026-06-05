type IconProps = {
  className?: string;
};

export function OpenIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.25 8.75V6.5c0-.69.56-1.25 1.25-1.25h4.3l1.9 2h6.8c.69 0 1.25.56 1.25 1.25v1.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M3.75 9.75h16.5l-1.35 7.6a1.75 1.75 0 0 1-1.72 1.4H6.82a1.75 1.75 0 0 1-1.72-1.4l-1.35-7.6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export function EnhanceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m17.8 2.8.7 2.2 2.2.8-2.2.8-.7 2.2-.8-2.2-2.2-.8L17 5l.8-2.2Z" />
      <path d="m6.4 5.4.5 1.5 1.5.5-1.5.6-.5 1.5L5.8 8l-1.5-.6 1.5-.5.6-1.5Z" />
      <path
        d="M4 14.4c1.8-3.1 3.6-4.7 5.3-4.7 2.8 0 3.5 4.7 6.1 4.7 1.4 0 2.7-1 4.1-2.9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="M5 19.3h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
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

export function SaveIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 4.75h11.3L19 7.45V19.25H5V4.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M8 4.75h7v5.5H8V4.75Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path
        d="M8.25 14.5h7.5v4.75h-7.5V14.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path d="M13.25 6.75h1.5v1.5h-1.5v-1.5Z" />
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

export function TuningIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 7h15M4.5 12h15M4.5 17h15"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d="M9 9.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM15 14.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5ZM11.5 19.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z"
      />
    </svg>
  );
}

export function LogIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3.5h10.8L19 5.7v14.8H6v-17Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path d="M15.7 3.8V7h3.1" />
      <path
        d="M9 10h6M9 13.8h6M9 17.6h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.1"
      />
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
