#!/usr/bin/env sh
# Print the PATH a dev-served olai should run with — the pinned odu's bin
# dir first, the caller's PATH after.
#
# This script composes the WHOLE variable rather than printing the one
# directory: "prepend the pin's bin dir, UNLESS somebody said off" is one
# rule, so it has one home — a consumer exporting the answer can never
# splice it wrongly (an unguarded `PATH="$dir:$PATH"` with an empty $dir is
# a bare `:` prefix, which is the working directory smuggled onto PATH).
# The justfile recipes that run the tree directly — `just serve`, `just
# run` — are one line each, the same shape as the two acp exports beside
# them, and a SECOND baked binary, when one arrives, is prepended here
# rather than teaching every recipe a new guard. The packaged binary's
# wrapper is generated text and cannot compose a variable the way a recipe
# can — default.nix's `--set-default` + `--run` is its spelling of the
# same answer; this is the dev loop's.
#
# The DEFAULT is the pinned odu (nix/odu.nix's `bin`, built the way odu's
# own flake builds it): the odu plugin's probe then answers the pinned
# build rather than whatever a machine happens to have, exactly as the
# probe itself demands — the verbs must take a per-call `checkout`, and
# only the pin is known to carry odu#97's shape.
#
# `OLAI_ODU_BIN` is the override, and "set" is tested with `${VAR+set}`
# rather than `${VAR:-}` for scripts/acp-agent.sh's reason, one knob over:
# set to a DIRECTORY (unlike `OLAI_ACP_AGENT`, which names a file — the
# mistake will be made), it is the prefix instead of the pin; set to the
# EMPTY string, it is the explicit off switch — the ambient PATH answers
# as-is, and a PATH with no odu is then a DRAWN row, by design
# (packages/plugins/odu/src/probe.ts). The packaged wrapper
# reads the same variable in the same three states (default.nix) — one
# knob, both faces.
#
# Building on demand rather than in shell.nix is scripts/acp-agent.sh's
# argument verbatim: entering the dev shell stays a second, and `just
# serve` pays the build on the run rather than `nix develop` paying it on
# every recipe. scripts/nix-out.sh is the one `nix build`: stdout is the
# path, stderr names the attr.
set -eu

if [ -n "${OLAI_ODU_BIN+set}" ]; then
  if [ -z "$OLAI_ODU_BIN" ]; then
    # Off, said out loud: the ambient PATH, unchanged.
    printf '%s' "${PATH:-}"
  elif [ ! -d "$OLAI_ODU_BIN" ]; then
    echo "olai-path: OLAI_ODU_BIN=$OLAI_ODU_BIN is not a directory —" >&2
    echo "olai-path: it names the bin DIRECTORY of the odu to serve with," >&2
    echo "olai-path: or the empty string for none at all." >&2
    exit 1
  else
    printf '%s' "${OLAI_ODU_BIN}${PATH:+:$PATH}"
  fi
  exit 0
fi

out=$(sh "$(dirname "$0")/nix-out.sh" .#odu-bin)
printf '%s' "$out/bin${PATH:+:$PATH}"
