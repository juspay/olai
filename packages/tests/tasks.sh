#!/usr/bin/env bash
set -euo pipefail

root=${ROOT:-$(cd ../.. && pwd)}
agent=${AGENT:-$(nix build "$root#claude-agent" --no-link --print-out-paths --accept-flake-config)/bin/claude-agent-acp}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"

AGENT="$agent" bun "$root/packages/tests/tasks.ts"
