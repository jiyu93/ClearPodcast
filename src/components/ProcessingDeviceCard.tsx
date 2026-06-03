import {
  cpuDeviceDetail,
  cudaVersionLabel,
  describeError,
} from "../domain/enhancement";
import type {
  DeviceDetectionStatus,
  EnhancementDeviceInfo,
} from "../domain/types";
import { GaugeIcon } from "./icons";

export function ProcessingDeviceCard({
  deviceInfo,
  status,
  error,
  actual,
}: {
  deviceInfo?: EnhancementDeviceInfo;
  status: DeviceDetectionStatus;
  error?: string;
  actual: boolean;
}) {
  const displayError = error
    ? describeError(error, "device-detection")
    : undefined;

  if (!deviceInfo) {
    if (status === "checking") {
      return (
        <div className="device-card pending">
          <GaugeIcon className="device-icon" />
          <span>Processing device</span>
          <strong>Detecting</strong>
          <small>Checking the packaged runtime</small>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="device-card error">
          <GaugeIcon className="device-icon" />
          <span>Processing device</span>
          <strong>Detection failed</strong>
          <small>{displayError?.summary}</small>
        </div>
      );
    }

    return (
      <div className="device-card muted">
        <GaugeIcon className="device-icon" />
        <span>Processing device</span>
        <strong>Desktop runtime</strong>
        <small>Available in the Tauri app</small>
      </div>
    );
  }

  const isCuda = deviceInfo.selected_device.toLowerCase() === "cuda";
  const detail = isCuda
    ? (deviceInfo.cuda_device_name ?? cudaVersionLabel(deviceInfo))
    : cpuDeviceDetail(deviceInfo);
  const label = actual
    ? isCuda
      ? "Using NVIDIA GPU"
      : "Using CPU"
    : isCuda
      ? "NVIDIA GPU ready"
      : "CPU fallback ready";

  return (
    <div className={`device-card ${isCuda ? "cuda" : "cpu"}`}>
      <GaugeIcon className="device-icon" />
      <span>Processing device</span>
      <strong>{label}</strong>
      <small>{detail}</small>
    </div>
  );
}
