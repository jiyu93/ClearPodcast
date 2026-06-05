import assert from "node:assert/strict";

import {
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
