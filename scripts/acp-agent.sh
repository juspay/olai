#!/usr/bin/env sh
# Print the ACP agent olai should spawn — the one place the dev loop answers
# that question.
#
# The DEFAULT is the pinned Claude Code adapter (nix/acp-agent.nix), because
# every documented way of starting olai must come with one: the packaged binary
# bakes it into its wrapper with `--set-default` (default.nix), and the justfile
# recipes that run the tree directly — `just serve`, `just run` — call this. A
# person following any of them gets a working chat panel without knowing the
# variable exists.
#
# `OLAI_ACP_AGENT` is the override, and "set" is tested with `${VAR+set}` rather
# than `${VAR:-}` ON PURPOSE: that matches `makeWrapper --set-default`, which
# emits `${VAR-default}` and so substitutes only when the variable is UNSET. So
# the empty string means "deliberately no agent" on every path, and it means the
# same thing here as it does through the packaged binary.
#
# Building on demand rather than in shell.nix is the other half: the dev shell
# is entered by every recipe and its cold `nix develop` is deliberately about a
# second, which an adapter closure in its inputs would end.
set -eu

if [ -n "${OLAI_ACP_AGENT+set}" ]; then
  printf '%s' "$OLAI_ACP_AGENT"
  exit 0
fi

out=$(nix build .#acp-agent --no-link --print-out-paths --accept-flake-config)
printf '%s' "$out/bin/claude-agent-acp"
