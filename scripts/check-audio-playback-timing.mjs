import assert from "node:assert/strict";

import {
  resolvePauseAnchor,
  shouldRestorePlaybackTime,
} from "../src/components/audioPlaybackTiming.ts";

const anchor = resolvePauseAnchor({
  duration: 20,
  mediaCurrentTime: 12.48,
});

assert.equal(
  anchor,
  12.48,
  "pause anchor must use the media clock, not the rendered animation clock",
);

assert.equal(
  shouldRestorePlaybackTime({
    mediaCurrentTime: 12.481,
    targetTime: 12.48,
  }),
  false,
  "resume must not perform a redundant seek when the media clock is already at the pause anchor",
);

assert.equal(
  shouldRestorePlaybackTime({
    mediaCurrentTime: 12.03,
    targetTime: 12.48,
  }),
  true,
  "resume should restore only when the media clock has actually drifted from the pause anchor",
);
