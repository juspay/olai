#!/usr/bin/env sh
# Print the ACP adapter olai should spawn FOR PI — the pi leg's half of the
# one pin.
#
# The DEFAULT is the pinned pi-acp (nix/acp-agent.nix, the same derivation
# the Claude Code adapter comes from — one lockfile, one build, both
# wrappers), printed the way `scripts/acp-agent.sh` prints its half; the
# header of that script is the whole argument and is not repeated here.
# `OLAI_ACP_PI` is the override: set (including to the empty string, which is
# "no pi row"), it wins.
#
# THE OTHER HALF OF THE ROW IS NOT HERE: the adapter wraps a `pi`, and which
# one is the roster's probe of the agent search path, handed to the adapter
# at spawn time as `PI_ACP_PI_COMMAND`. A machine with no `pi` gets no pi
# row, however this script answers.
set -eu

if [ -n "${OLAI_ACP_PI+set}" ]; then
  printf '%s' "$OLAI_ACP_PI"
  exit 0
fi

out=$(sh "$(dirname "$0")/nix-out.sh" .#acp-agent)
printf '%s' "$out/bin/pi-acp"
