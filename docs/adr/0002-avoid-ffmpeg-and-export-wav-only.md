# ADR 0002: Avoid FFmpeg And Export WAV Only In The First Release

## Status

Accepted.

## Context

The app needs to support common podcast source files while keeping licensing and
redistribution simple. MP3 input is important because many users will have MP3
exports from recording tools, meeting software, or prior workflows. M4A input is
important because iPhone and macOS voice workflows commonly produce M4A/AAC
recordings by default.

FFmpeg would solve many codec problems, but it adds licensing and build
configuration complexity. The first release does not need MP3 export.

## Decision

Do not introduce FFmpeg.

Support WAV, MP3, and M4A input. Export WAV only.

Handle audio decoding and WAV writing in Rust, outside the Python model layer.

## Consequences

Positive:

- Avoids FFmpeg licensing and distribution complexity.
- Avoids MP3 encoder licensing in the first release.
- Keeps Resemble Enhance focused on inference instead of file compatibility.
- WAV export avoids a second lossy compression pass.

Negative:

- Users who need MP3 output must convert outside the app until a later release.
- Codec support is intentionally narrow.
- We need to implement and test our own audio I/O boundary.

## Implementation Notes

- Use `symphonia` for MP3, M4A/MP4 container, AAC-LC, and ALAC decoding and
  probing.
- Use `hound` for WAV read/write.
- Convert stereo inputs to mono before inference.
- Prefer standard 44.1 kHz mono PCM16 WAV as the product export format, with
  standard PCM headers for center-routed mono playback.
