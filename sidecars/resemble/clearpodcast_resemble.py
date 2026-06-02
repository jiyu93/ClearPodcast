#!/usr/bin/env python3
"""ClearPodcast-owned Resemble Enhance sidecar.

This entrypoint intentionally avoids the upstream CLI and demo server. It takes
one WAV file, an explicit local model directory, and writes one enhanced WAV.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import sys
import time
import traceback
import types
from pathlib import Path

EXPECTED_MODEL_FILES = (
    "hparams.yaml",
    "ds/G/latest",
    "ds/G/default/mp_rank_00_model_states.pt",
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run ClearPodcast WAV enhancement through Resemble Enhance."
    )
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--input-wav", required=True, type=Path)
    parser.add_argument("--output-wav", required=True, type=Path)
    parser.add_argument("--device", default="cpu", choices=("auto", "cpu", "cuda"))
    parser.add_argument("--nfe", default=64, type=int)
    parser.add_argument("--solver", default="midpoint", choices=("midpoint", "rk4", "euler"))
    parser.add_argument("--lambd", default=0.1, type=float)
    parser.add_argument("--tau", default=0.5, type=float)
    parser.add_argument("--expected-checkpoint-sha256")
    args = parser.parse_args()

    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    try:
        require_python_version()
        validate_paths(args)
        emit("progress", message="validated local runtime paths")

        torch, soundfile, enhance = import_inference_dependencies()
        device = select_device(args.device, torch)
        emit("progress", message="loaded inference dependencies", device=device)

        start_time = time.perf_counter()
        waveform, sample_rate = load_wav(args.input_wav, torch, soundfile)
        emit("progress", message="loaded input wav", sample_rate=sample_rate)

        enhanced, output_sample_rate = enhance(
            dwav=waveform,
            sr=sample_rate,
            device=device,
            nfe=args.nfe,
            solver=args.solver,
            lambd=args.lambd,
            tau=args.tau,
            run_dir=args.model_dir,
        )

        args.output_wav.parent.mkdir(parents=True, exist_ok=True)
        save_wav(args.output_wav, enhanced, output_sample_rate, soundfile)
        elapsed_seconds = time.perf_counter() - start_time
        emit(
            "complete",
            message="wrote enhanced wav",
            output_wav=str(args.output_wav),
            sample_rate=output_sample_rate,
            elapsed_seconds=round(elapsed_seconds, 3),
        )
        return 0
    except SidecarError as error:
        emit("error", code=error.code, message=str(error))
        return error.exit_code
    except Exception as error:
        emit(
            "error",
            code="unexpected_sidecar_error",
            message=str(error),
            traceback=traceback.format_exc(),
        )
        return 99


class SidecarError(RuntimeError):
    def __init__(self, code: str, message: str, exit_code: int = 2) -> None:
        super().__init__(message)
        self.code = code
        self.exit_code = exit_code


def require_python_version() -> None:
    if sys.version_info < (3, 10):
        raise SidecarError(
            "unsupported_python_version",
            "Resemble Enhance requires Python 3.10 or newer; use a bundled local runtime.",
            3,
        )


def validate_paths(args: argparse.Namespace) -> None:
    if not args.input_wav.is_file():
        raise SidecarError("missing_input_wav", f"input WAV not found: {args.input_wav}")

    if args.input_wav.suffix.lower() != ".wav":
        raise SidecarError("unsupported_input", "milestone 1 sidecar accepts WAV input only")

    if args.output_wav.suffix.lower() != ".wav":
        raise SidecarError("unsupported_output", "ClearPodcast milestone 1 writes WAV output only")

    if not args.model_dir.is_dir():
        raise SidecarError("missing_model_dir", f"model directory not found: {args.model_dir}")

    for relpath in EXPECTED_MODEL_FILES:
        path = args.model_dir / relpath
        if not path.is_file():
            raise SidecarError("missing_model_file", f"required model file not found: {path}")

    latest_path = args.model_dir / "ds/G/latest"
    latest = latest_path.read_text(encoding="utf-8").strip()
    if latest != "default":
        raise SidecarError(
            "model_latest_mismatch",
            f"{latest_path} contained {latest!r}; expected 'default'",
        )

    if args.expected_checkpoint_sha256:
        checkpoint_path = args.model_dir / "ds/G/default/mp_rank_00_model_states.pt"
        actual_sha256 = sha256_file(checkpoint_path)
        if actual_sha256 != args.expected_checkpoint_sha256:
            raise SidecarError(
                "model_checkpoint_mismatch",
                (
                    f"{checkpoint_path} SHA256 was {actual_sha256}; "
                    f"expected {args.expected_checkpoint_sha256}"
                ),
            )


def import_inference_dependencies():
    try:
        import torch
        import soundfile
        install_cross_platform_omegaconf_path_loader()
        install_training_path_stubs(torch)
        from resemble_enhance.enhancer.enhancer import Enhancer
        from resemble_enhance.enhancer.hparams import HParams
        from resemble_enhance.inference import inference
    except ImportError as error:
        raise SidecarError(
            "missing_runtime_dependency",
            f"local Python runtime is missing an inference dependency: {error}",
            4,
        ) from error

    def enhance(*, dwav, sr, device, nfe, solver, lambd, tau, run_dir):
        model = load_enhancer(torch, Enhancer, HParams, run_dir, device)
        model.configurate_(nfe=nfe, solver=solver, lambd=lambd, tau=tau)
        with torch.inference_mode():
            return inference(model=model, dwav=dwav, sr=sr, device=device)

    return torch, soundfile, enhance


def install_cross_platform_omegaconf_path_loader() -> None:
    """Allow model hparams saved on Unix or Windows to load on either platform."""
    try:
        import omegaconf._utils as omegaconf_utils
    except ImportError:
        return

    if getattr(omegaconf_utils.get_yaml_loader, "_clearpodcast_path_patch", False):
        return

    original_get_yaml_loader = omegaconf_utils.get_yaml_loader

    def get_yaml_loader():
        loader = original_get_yaml_loader()

        def construct_native_path(yaml_loader, node):
            return pathlib.Path(*yaml_loader.construct_sequence(node))

        for tag in (
            "tag:yaml.org,2002:python/object/apply:pathlib.Path",
            "tag:yaml.org,2002:python/object/apply:pathlib.PosixPath",
            "tag:yaml.org,2002:python/object/apply:pathlib.WindowsPath",
        ):
            loader.add_constructor(tag, construct_native_path)

        return loader

    get_yaml_loader._clearpodcast_path_patch = True
    omegaconf_utils.get_yaml_loader = get_yaml_loader


def load_wav(path: Path, torch_module, soundfile_module):
    data, sample_rate = soundfile_module.read(path, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    return torch_module.from_numpy(mono), sample_rate


def save_wav(path: Path, waveform, sample_rate: int, soundfile_module) -> None:
    data = waveform.detach().cpu().float().numpy()
    soundfile_module.write(path, data, sample_rate, subtype="PCM_16")


def install_training_path_stubs(torch_module) -> None:
    """Avoid importing upstream training helpers during inference startup."""
    import resemble_enhance
    from resemble_enhance.denoiser.denoiser import Denoiser
    from resemble_enhance.denoiser.hparams import HParams as DenoiserHParams

    package_root = Path(resemble_enhance.__file__).parent
    utils_package = types.ModuleType("resemble_enhance.utils")
    utils_package.__path__ = [str(package_root / "utils")]
    sys.modules["resemble_enhance.utils"] = utils_package

    def leader_only_decorator(fn=None, **_kwargs):
        def decorate(inner):
            return inner

        return decorate if fn is None else fn

    distributed = types.ModuleType("resemble_enhance.utils.distributed")
    distributed.global_leader_only = leader_only_decorator
    distributed.local_leader_only = leader_only_decorator
    distributed.is_global_leader = lambda: True
    distributed.is_local_leader = lambda: True
    sys.modules["resemble_enhance.utils.distributed"] = distributed

    def load_denoiser(run_dir, device):
        if run_dir is None:
            denoiser = Denoiser(DenoiserHParams())
        else:
            hp = DenoiserHParams.load(run_dir)
            denoiser = Denoiser(hp)
            path = Path(run_dir) / "ds/G/default/mp_rank_00_model_states.pt"
            state_dict = torch_module.load(path, map_location="cpu")["module"]
            denoiser.load_state_dict(state_dict)
        denoiser.eval()
        denoiser.to(device)
        return denoiser

    denoiser_inference = types.ModuleType("resemble_enhance.denoiser.inference")
    denoiser_inference.load_denoiser = load_denoiser
    sys.modules["resemble_enhance.denoiser.inference"] = denoiser_inference

    class TrainLoop:
        @classmethod
        def get_running_loop(cls):
            return None

        @classmethod
        def get_running_loop_viz_path(cls, _name, _suffix):
            return None

    train_loop = types.ModuleType("resemble_enhance.utils.train_loop")
    train_loop.TrainLoop = TrainLoop
    sys.modules["resemble_enhance.utils.train_loop"] = train_loop


def load_enhancer(torch_module, enhancer_class, hparams_class, run_dir: Path, device: str):
    hp = hparams_class.load(run_dir)
    model = enhancer_class(hp)
    checkpoint = run_dir / "ds/G/default/mp_rank_00_model_states.pt"
    state_dict = torch_module.load(checkpoint, map_location="cpu")["module"]
    model.load_state_dict(state_dict)
    model.eval()
    model.to(device)
    return model


def select_device(configured_device: str, torch_module) -> str:
    if configured_device == "auto":
        return "cuda" if torch_module.cuda.is_available() else "cpu"

    if configured_device == "cuda" and not torch_module.cuda.is_available():
        raise SidecarError(
            "cuda_unavailable",
            "CUDA was requested, but torch.cuda.is_available() returned false.",
            5,
        )

    return configured_device


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def emit(event: str, **payload: object) -> None:
    print(json.dumps({"event": event, **payload}, sort_keys=True), file=sys.stderr, flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
