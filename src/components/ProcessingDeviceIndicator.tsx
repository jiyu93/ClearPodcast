import type {
  DeviceDetectionStatus,
  EnhancementDeviceInfo,
} from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import { CpuIcon, GaugeIcon, GpuIcon } from "./icons";

export function ProcessingDeviceIndicator({
  deviceInfo,
  status,
}: {
  deviceInfo?: EnhancementDeviceInfo;
  status: DeviceDetectionStatus;
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

  return (
    <span className={`device-indicator ${tone}`}>
      <ModeIcon className="device-mode-icon" />
      <span>{label}</span>
    </span>
  );
}
