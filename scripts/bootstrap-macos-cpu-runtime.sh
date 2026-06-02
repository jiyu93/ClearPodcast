#!/usr/bin/env sh
set -eu

PYTHON_BIN="${PYTHON_BIN:-python3.10}"
RUNTIME_DIR="${CLEARPODCAST_RUNTIME_DIR:-localfiles/runtime/macos-arm64}"

"$PYTHON_BIN" - <<'PY'
import sys

if sys.version_info < (3, 10):
    raise SystemExit("ClearPodcast runtime bootstrap requires Python 3.10 or newer.")
PY

"$PYTHON_BIN" -m venv "$RUNTIME_DIR"
"$RUNTIME_DIR/bin/python" -m pip install --upgrade pip
"$RUNTIME_DIR/bin/python" -m pip install -r sidecars/resemble/requirements-macos-cpu.txt
"$RUNTIME_DIR/bin/python" -m pip install --no-deps "resemble-enhance==0.0.1"

echo "ClearPodcast local runtime ready at $RUNTIME_DIR/bin/python3"
