import type {
  DeviceDetectionStatus,
  EnhancementDeviceInfo,
} from "../domain/types";
import { CpuIcon, GaugeIcon, GpuIcon } from "./icons";

export function ProcessingDeviceIndicator({
  deviceInfo,
  status,
}: {
  deviceInfo?: EnhancementDeviceInfo;
  status: DeviceDetectionStatus;
}) {
  const isDetecting = status === "checking";
  const isGpu = deviceInfo?.selected_device.toLowerCase() === "cuda";
  const label = isDetecting ? "Detecting" : isGpu ? "GPU Mode" : "CPU Mode";
  const tone = isDetecting ? "detecting" : isGpu ? "gpu" : "cpu";
  const ModeIcon = isDetecting ? GaugeIcon : isGpu ? GpuIcon : CpuIcon;

  return (
    <span className={`device-indicator ${tone}`}>
      <ModeIcon className="device-mode-icon" />
      <span>{label}</span>
    </span>
  );
}
