#!/usr/bin/env bash
# Reproduce the load-perf measurements that back LOAD-PERF-RCA.md.
#
# Requires: nix, the repo's flake, and packages installed (`just install`).
# Playwright browsers come from the e2e shell.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

export OLAI_BIN="${OLAI_BIN:-$(nix build .#olai --no-link --print-out-paths --accept-flake-config)/bin/olai}"
export NO_AGENT="${NO_AGENT:-1}"
export REPS="${REPS:-3}"

run_one() {
  local label="$1"
  shift
  echo ""
  echo "======== $label ========"
  nix develop .#e2e --accept-flake-config -c bun scripts/load-perf/measure.mjs "$@"
}

# 1) Project roadmap via nix-built binary (the CI/e2e artefact).
MODE=nix LEDGER="$ROOT/docs" APP_PATH="/o/roadmap.jsonl" TRACE="${TRACE:-0}" \
  run_one "nix + docs/roadmap"

# 2) Same ledger via bun main.ts (dev path; needs packages/web/dist).
if [[ -f packages/web/dist/index.html ]]; then
  MODE=dev LEDGER="$ROOT/docs" APP_PATH="/o/roadmap.jsonl" \
    run_one "dev + docs/roadmap"
else
  echo "(skip dev: no packages/web/dist — run just build-client)"
fi

# 3) Production ledger if present (systemd unit points here).
if [[ -d "${HOME}/Dropbox/MyOlai" ]]; then
  MODE=nix LEDGER="${HOME}/Dropbox/MyOlai" APP_PATH="/" \
    run_one "nix + MyOlai"
fi

echo ""
echo "JSON + text summaries under scripts/load-perf/out/"
ls -lt scripts/load-perf/out/ | head -20
