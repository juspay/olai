#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${ODU_SHARD_INDEX+x}" && -z "${ODU_SHARD_TOTAL+x}" ]]; then
  exec bun run typecheck
fi

if [[ ! "${ODU_SHARD_INDEX:-}" =~ ^(0|[1-9][0-9]*)$ || ! "${ODU_SHARD_TOTAL:-}" =~ ^[1-9][0-9]*$ ]]; then
  echo "ODU_SHARD_INDEX and ODU_SHARD_TOTAL must be nonnegative index and positive total" >&2
  exit 2
fi

if ((ODU_SHARD_INDEX >= ODU_SHARD_TOTAL)); then
  echo "Odu shard index $ODU_SHARD_INDEX is outside total $ODU_SHARD_TOTAL" >&2
  exit 2
fi

# Reuse the manifest's workspace expansion. Capture before sorting so a failed
# expansion cannot disappear inside process substitution and pass an empty shard.
members=$(sh scripts/workspace-members.sh .)
mapfile -t ordered <<< "$(printf '%s\n' "$members" | LC_ALL=C sort -u)"
filters=()
for position in "${!ordered[@]}"; do
  if ((position % ODU_SHARD_TOTAL == ODU_SHARD_INDEX)); then
    filters+=(--filter "./${ordered[position]}")
  fi
done

echo "typecheck shard $((ODU_SHARD_INDEX + 1))/$ODU_SHARD_TOTAL: $((${#filters[@]} / 2)) packages"
# An empty slice must not fall back to the root script and check everything.
if ((${#filters[@]})); then
  exec bun run "${filters[@]}" typecheck
fi
