import assert from "node:assert/strict";

import {
  createWaveformColumns,
  normalizeWaveformPeaks,
  waveformBarHalfHeight,
} from "../src/components/audioWaveform.ts";

const peaks = normalizeWaveformPeaks([0, 0, 1, 0.5]);

assert.equal(peaks[0], 0, "silent samples resolve to the waveform baseline");
assert.equal(peaks[1], 0, "silent peaks remain at baseline after normalization");
assert.equal(peaks[2], 1, "audible peaks normalize to full scale");
assert.equal(peaks[3], 0.5, "relative amplitude is preserved");

assert.equal(
  waveformBarHalfHeight(0, 120),
  0,
  "silent waveform bars resolve to the center baseline",
);

assert.equal(
  waveformBarHalfHeight(0.004, 120),
  0,
  "near-silent waveform bars resolve to the center baseline",
);

assert.equal(
  waveformBarHalfHeight(0.01, 120),
  0,
  "the visual silence threshold includes boundary values",
);

assert.equal(
  createWaveformColumns(Array.from({ length: 1024 }, () => 0), 1707, 120)
    .length,
  0,
  "silent waveform columns do not draw phantom bars",
);

for (const width of [720, 1385, 1707, 1964]) {
  const columns = createWaveformColumns(
    Array.from({ length: 1024 }, () => 0.6),
    width,
    120,
  );

  assert.equal(
    columns.length,
    Math.round(width),
    `audible waveform covers every display column at ${width}px`,
  );

  for (const [index, column] of columns.entries()) {
    assert.equal(column.x, index, `waveform column ${index} is not skipped`);
    assert.equal(column.width, 1, `waveform column ${index} keeps unit width`);
  }
}
