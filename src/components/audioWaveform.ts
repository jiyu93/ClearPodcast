export const WAVEFORM_PEAK_COUNT = 1024;
const VISUAL_SILENCE_THRESHOLD = 0.01;

export type WaveformColumn = {
  halfHeight: number;
  width: number;
  x: number;
};

export function createFallbackPeaks(seed: string) {
  const seedValue = Array.from(seed).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );

  return Array.from({ length: WAVEFORM_PEAK_COUNT }, (_, index) => {
    const slow = Math.sin((index + seedValue) * 0.031) * 0.32;
    const mid = Math.sin((index + seedValue) * 0.097) * 0.16;
    const fast = Math.sin((index + seedValue) * 0.31) * 0.08;
    const lift = index % 73 === 0 ? 0.14 : 0;
    return Math.min(Math.max(0.34 + slow + mid + fast + lift, 0.08), 1);
  });
}

export function createPeaksFromAudioBuffer(buffer: AudioBuffer) {
  const samplesPerPeak = Math.max(
    1,
    Math.floor(buffer.length / WAVEFORM_PEAK_COUNT),
  );
  const peaks = Array.from({ length: WAVEFORM_PEAK_COUNT }, (_, peakIndex) => {
    let peak = 0;
    const start = peakIndex * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, buffer.length);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = start; index < end; index += 1) {
        peak = Math.max(peak, Math.abs(data[index] ?? 0));
      }
    }

    return peak;
  });

  return normalizeWaveformPeaks(peaks);
}

export function normalizeWaveformPeaks(peaks: number[]) {
  const maxPeak = Math.max(...peaks, 0.001);

  return peaks.map((peak) => peak / maxPeak);
}

export function waveformBarHalfHeight(peak: number, halfHeight: number) {
  if (peak <= VISUAL_SILENCE_THRESHOLD) {
    return 0;
  }

  return Math.max(1, peak * halfHeight);
}

export function createWaveformColumns(
  peaks: number[],
  width: number,
  halfHeight: number,
): WaveformColumn[] {
  if (peaks.length === 0 || width <= 0 || halfHeight <= 0) {
    return [];
  }

  const columnCount = Math.max(1, Math.round(width));
  const peakCount = peaks.length;
  const columns: WaveformColumn[] = [];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const startPeak = Math.floor((columnIndex / columnCount) * peakCount);
    const endPeak = Math.min(
      peakCount,
      Math.max(
        startPeak + 1,
        Math.ceil(((columnIndex + 1) / columnCount) * peakCount),
      ),
    );
    let peak = 0;

    for (let peakIndex = startPeak; peakIndex < endPeak; peakIndex += 1) {
      peak = Math.max(peak, peaks[peakIndex] ?? 0);
    }

    const columnHalfHeight = waveformBarHalfHeight(peak, halfHeight);
    if (columnHalfHeight <= 0) {
      continue;
    }

    columns.push({
      halfHeight: columnHalfHeight,
      width: 1,
      x: columnIndex,
    });
  }

  return columns;
}
