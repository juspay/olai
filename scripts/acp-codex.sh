#!/usr/bin/env sh
# Print the ACP adapter olai should spawn for the Codex row. The default is the
# codex-acp wrapper from the shared pin; a set OLAI_ACP_CODEX, including the
# empty string, is an explicit per-row override.
set -eu

if [ -n "${OLAI_ACP_CODEX+set}" ]; then
  printf '%s' "$OLAI_ACP_CODEX"
  exit 0
fi

out=$(nix build .#acp-agent --no-link --print-out-paths --accept-flake-config)
printf '%s' "$out/bin/codex-acp"
