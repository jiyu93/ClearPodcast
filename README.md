# ClearPodcast

ClearPodcast is an offline desktop audio restoration application for podcasters
who already have low-quality recordings from Bluetooth headsets, meeting apps,
remote calls, or ordinary computer microphones.

The product goal is not generic audio editing. It is a focused one-click workflow
that turns damaged spoken-word recordings into publishable podcast WAV files.

The first supported desktop platforms are Windows and macOS. macOS arm64 is the
daily development baseline; Windows 11 x64 is the NVIDIA CUDA validation and
performance target.

Distribution is portable-first: Windows ships as a self-contained folder
archive, and macOS ships as a self-contained `.app` bundle wrapped in a DMG or
zip.

Start here:

- [Implementation plan](docs/implementation-plan.md)
- [Domain context](CONTEXT.md)
- [Architecture decisions](docs/adr/)
