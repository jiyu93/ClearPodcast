import type {
  DeviceDetectionStatus,
  EnhancementDeviceInfo,
} from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import { CpuIcon, GaugeIcon, GpuIcon } from "./icons";

export function ProcessingDeviceIndicator({
  deviceInfo,
  status,
  toggleAvailable = false,
  canToggle = false,
  onToggle,
}: {
  deviceInfo?: EnhancementDeviceInfo;
  status: DeviceDetectionStatus;
  toggleAvailable?: boolean;
  canToggle?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useI18n();
  const isDetecting = status === "checking";
  const isGpu = deviceInfo?.selected_device.toLowerCase() === "cuda";
  const label = isDetecting
    ? t.device.detecting
    : isGpu
      ? t.device.gpuMode
      : t.device.cpuMode;
  const tone = isDetecting ? "detecting" : isGpu ? "gpu" : "cpu";
  const ModeIcon = isDetecting ? GaugeIcon : isGpu ? GpuIcon : CpuIcon;
  const content = (
    <>
      <ModeIcon className="device-mode-icon" />
      <span>{label}</span>
    </>
  );

  if (toggleAvailable) {
    const switchLabel = isGpu
      ? t.device.switchToCpuMode
      : t.device.switchToGpuMode;

    return (
      <button
        type="button"
        className={`device-indicator device-indicator-button ${tone}`}
        aria-label={switchLabel}
        title={switchLabel}
        disabled={!canToggle}
        onClick={onToggle}
      >
        {content}
      </button>
    );
  }

  return <span className={`device-indicator ${tone}`}>{content}</span>;
}
