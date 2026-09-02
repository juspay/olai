#!/usr/bin/env sh
# Print the bin directory of the odu a served olai should carry on PATH —
# the one place the dev loop answers that question.
#
# The DEFAULT is the pinned odu (nix/odu.nix's `bin`, built the way odu's
# own flake builds it), because every documented way of starting olai must
# resolve it: the packaged binary bakes it into its wrapper with
# `--prefix PATH` (default.nix), and the justfile recipes that run the tree
# directly — `just serve`, `just run` — prepend what this prints. The odu
# plugin's probe then answers the pinned build rather than whatever a
# machine happens to have, exactly as the probe itself demands: the verbs
# must take a per-call `checkout`, and only the pin is known to carry
# odu#97's shape.
#
# `OLAI_ODU_BIN` is the override, and "set" is tested with `${VAR+set}`
# rather than `${VAR:-}` for scripts/acp-agent.sh's reason, one knob over:
# the empty string is the explicit off switch — nothing is prepended, the
# probe answers from the ambient PATH, and a PATH with no odu is then a
# DRAWN row, by design (packages/plugins/olai-plugin-odu/src/probe.ts).
#
# Building on demand rather than in shell.nix is scripts/acp-agent.sh's
# argument verbatim: entering the dev shell stays a second, and `just
# serve` pays the build on the run rather than `nix develop` paying it on
# every recipe.
set -eu

if [ -n "${OLAI_ODU_BIN+set}" ]; then
  printf '%s' "$OLAI_ODU_BIN"
  exit 0
fi

out=$(nix build .#odu-bin --no-link --print-out-paths --accept-flake-config)
printf '%s/bin' "$out"
