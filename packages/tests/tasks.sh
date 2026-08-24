#!/usr/bin/env bash
# Print what the pinned adapter says about a background task — see tasks.ts for
# the two claims this exists to keep honest.
#
#   bash tasks.sh                  # a Monitor that ticks and ends
#   KIND=bash bash tasks.sh        # a background shell that exits 3
#   RAW=1 bash tasks.sh            # every SDK message it forwarded, too
#
# It needs a real, authenticated `claude` (the adapter drives one), so it is a
# thing a person runs and never a lane. The AGENT is the repo's own pin, built
# here rather than taken off PATH: what is being measured is the agent olai
# ships, patch and all.
set -euo pipefail

root=${ROOT:-$(cd ../.. && pwd)}
agent=${AGENT:-$(nix build "$root#acp-agent" --no-link --print-out-paths --accept-flake-config)/bin/claude-agent-acp}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"

AGENT="$agent" bun "$root/packages/tests/tasks.ts"
