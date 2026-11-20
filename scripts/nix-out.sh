#!/usr/bin/env sh
set -eu
attr=$1
echo >&2 "nix build $attr"
exec nix build "$attr" --no-link --print-out-paths --accept-flake-config --print-build-logs
