# Milestone 5: Windows Portable Release And CUDA Validation

Milestone 5 produces one self-contained Windows 11 x64 portable archive that
bundles a CUDA-capable PyTorch runtime and falls back to CPU automatically when
CUDA is unavailable.

## Status

Complete as of June 3, 2026 on the Windows RTX 5070 Ti validation machine.

The Windows release surface is a single portable zip, not separate CPU and CUDA
downloads. The same extracted app uses NVIDIA CUDA when `device=auto` can see a
compatible GPU and uses CPU otherwise.

## Resource Layout

The portable archive extracts to:

```text
ClearPodcast-0.1.0-windows-x64/
  ClearPodcast.exe
  clearpodcast/
    runtimes/windows-x64/
      python.exe
      Lib/
      Scripts/
    sidecars/resemble/
      clearpodcast_resemble.py
      requirements-windows-x64-cuda.txt
    models/resemble-enhance/enhancer_stage2/
      hparams.yaml
      ds/G/latest
      ds/G/default/mp_rank_00_model_states.pt
    licenses/
      THIRD_PARTY_NOTICES.txt
    manifests/
      artifacts.json
```

The committed manifest is:

```text
packaging/artifacts.windows-x64.json
```

Stage resources into Tauri's resource layout:

```powershell
npm run package:stage:windows-x64
```

Build the app and portable zip:

```powershell
npm run package:windows-x64
```

The build script writes:

```text
localfiles/releases/ClearPodcast-0.1.0-windows-x64.zip
```

Large runtime/model files stay out of git. A clean Windows checkout needs:

- `localfiles/runtime/windows-x64/` built from the documented Windows CUDA
  runtime requirements.
- `localfiles/models/resemble-enhance/enhancer_stage2/` with the expected
  checkpoint.

Optional source overrides:

```powershell
$env:CLEARPODCAST_WINDOWS_RUNTIME_SOURCE = "C:\path\to\runtime"
$env:CLEARPODCAST_RESEMBLE_MODEL_SOURCE = "C:\path\to\enhancer_stage2"
npm run package:windows-x64
```

## Runtime

The validated Windows runtime uses Python 3.12 with `torch==2.12.0+cu130`.
`torch.version.cuda` reports CUDA 13.0. Users do not need the CUDA Toolkit.
CUDA acceleration requires a compatible NVIDIA driver; non-CUDA Windows users
only download the larger runtime files and should run on CPU.

Validated GPU environment:

- NVIDIA GeForce RTX 5070 Ti.
- NVIDIA driver 596.49.
- `nvidia-smi` CUDA version 13.2.
- 16,303 MiB reported VRAM.

The sidecar default is `--device auto`. It emits structured stderr JSON with the
selected device, CUDA availability, PyTorch CUDA version, and CUDA device name.
The desktop job snapshot carries that data to the UI, where the job panel shows
whether the completed enhancement used NVIDIA GPU or CPU.

The desktop also runs a lightweight processing-device preflight against the
packaged Python runtime on app startup and whenever the Python override changes.
That preflight populates a standalone device card in the Job panel before the
first enhancement run; completed jobs replace it with the actual sidecar-reported
device for that run. The preflight runs on a background blocking task because
importing PyTorch can take long enough to make the window appear unresponsive if
it runs on the Tauri IPC path directly.

On Windows, Python sidecar and device-preflight child processes are launched
with `CREATE_NO_WINDOW` so the portable GUI app does not open a separate console
window during detection or enhancement.

## Artifact Sizes

Observed local Milestone 5 sizes:

- Runtime source venv: 3.36 GiB.
- Staged resource tree: 3.85 GiB.
- Portable folder: 3.86 GiB.
- Zip archive: 2.58 GiB.

The Windows archive is larger than the macOS CPU archive because it includes the
CUDA-capable PyTorch runtime even for users who fall back to CPU.

## Verification

Completed local checks:

- `npm run package:stage:windows-x64`
- staged packaged-runtime import check for `torch`, `soundfile`, and
  `resemble_enhance`
- staged-resource CUDA WAV smoke:
  `localfiles/outputs/milestone5-staged-resource-cuda.wav`
- `npm run package:windows-x64`
- fresh zip extraction into
  `localfiles/releases/extracted-windows-x64/ClearPodcast-0.1.0-windows-x64/`
- fresh-extracted CUDA WAV smoke:
  `localfiles/outputs/milestone5-extracted-cuda-wav.wav`
- fresh-extracted CUDA MP3 smoke:
  `localfiles/outputs/milestone5-extracted-cuda-mp3.wav`
- fresh-extracted CUDA M4A smoke:
  `localfiles/outputs/milestone5-extracted-cuda-m4a.wav`
- fresh-extracted CPU fallback WAV smoke with `CUDA_VISIBLE_DEVICES=-1`:
  `localfiles/outputs/milestone5-extracted-cpu-fallback-wav.wav`
- fresh-extracted CPU fallback MP3 smoke with `CUDA_VISIBLE_DEVICES=-1`:
  `localfiles/outputs/milestone5-extracted-cpu-fallback-mp3.wav`
- fresh-extracted CPU fallback M4A smoke with `CUDA_VISIBLE_DEVICES=-1`:
  `localfiles/outputs/milestone5-extracted-cpu-fallback-m4a.wav`
- explicit `--device cuda` with CUDA disabled fails clearly with
  `cuda_unavailable`
- no-network sidecar smoke using a Python socket-blocking `sitecustomize.py`
  because this non-admin shell could not install a Windows Firewall block rule:
  `localfiles/outputs/milestone5-extracted-python-network-blocked.wav`
- output header checks confirmed all fresh-extracted smoke outputs are standard
  PCM16 mono 44.1 kHz WAV files
- portable `ClearPodcast.exe` startup smoke from the fresh-extracted folder
- Windows cancellation smoke through the job-manager fake sidecar test
- packaged resource lookup tests for Windows runtime paths and macOS path
  preservation
- UI layout smoke for the device indicator surface in the Vite app
- device indicator is a standalone Job panel card populated before the first
  enhancement run and refreshed from completed job device metadata
- generated Windows x64 third-party notice review for the staged Windows
  artifact

The CUDA smokes reported:

```text
selected_device: cuda
cuda_available: true
torch_cuda_version: 13.0
cuda_device_name: NVIDIA GeForce RTX 5070 Ti
```

The CPU fallback smokes reported:

```text
selected_device: cpu
cuda_available: false
torch_cuda_version: 13.0
```

## Platform Notes

The artifact was validated on Windows 11 x64. Windows 10 x64 remains outside
the first support guarantee.

The Windows staging script dereferences the uv-created venv base Python runtime
into `runtimes/windows-x64/` and overlays project `site-packages`. This avoids
depending on a hidden base interpreter under `localfiles/` after extraction.

The macOS package path remains `runtimes/macos-arm64-cpu/`; Windows resource
lookup is platform-specific and does not change the Milestone 4 macOS artifact
layout.
