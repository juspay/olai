#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${ODU_SHARD_INDEX+x}" && -z "${ODU_SHARD_TOTAL+x}" ]]; then
  bun test
  # Browser-conditioned tests follow their owners; fail if discovery fails.
  browser_paths=$(git ls-files '*.browsertest.ts')
  if [[ -n "$browser_paths" ]]; then
    mapfile -t browser_files <<< "$(printf '%s\n' "$browser_paths" | LC_ALL=C sort | sed 's|^|./|')"
    bun test --conditions browser "${browser_files[@]}"
  fi
  exit
fi

exec bun scripts/test-shards.mjs
