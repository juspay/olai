#!/usr/bin/env bash
set -euo pipefail

browser_files=(
  ./packages/web/src/client/settled.browsertest.ts
  ./packages/web/src/client/fold/refiling.browsertest.ts
  ./packages/web/src/client/names.browsertest.ts
  ./packages/web/src/client/doors.browsertest.ts
  ./packages/web/src/client/licences.browsertest.ts
  ./packages/web/src/client/Tree.browsertest.ts
  ./packages/web/src/client/directory.browsertest.ts
  ./packages/plugins/chat/src/browser/chat/last.browsertest.ts
  ./packages/plugins/chat/src/browser/chat/attention/asked.browsertest.ts
  ./packages/plugins/chat/src/browser/chat/attention/elsewhere.browsertest.ts
  ./packages/web/src/client/declared.browsertest.ts
  ./packages/plugins/kolu/src/appliance/props/held.browsertest.ts
)

if [[ -z "${ODU_SHARD_INDEX+x}" && -z "${ODU_SHARD_TOTAL+x}" ]]; then
  bun test
  bun test --conditions browser "${browser_files[@]}"
  exit
fi

if [[ -z "${ODU_SHARD_INDEX+x}" || -z "${ODU_SHARD_TOTAL+x}" ]]; then
  echo "ODU_SHARD_INDEX and ODU_SHARD_TOTAL must be set together" >&2
  exit 2
fi

if [[ ! "$ODU_SHARD_INDEX" =~ ^[0-9]+$ || ! "$ODU_SHARD_TOTAL" =~ ^[1-9][0-9]*$ ]]; then
  echo "invalid Odu shard: index=$ODU_SHARD_INDEX total=$ODU_SHARD_TOTAL" >&2
  exit 2
fi

if ((ODU_SHARD_INDEX >= ODU_SHARD_TOTAL)); then
  echo "Odu shard index $ODU_SHARD_INDEX is outside total $ODU_SHARD_TOTAL" >&2
  exit 2
fi

ordinary_files=()
position=0
while IFS= read -r -d '' file; do
  case "$file" in
    *.test.js | *.test.jsx | *.test.ts | *.test.tsx | *_test.js | *_test.jsx | *_test.ts | *_test.tsx | *.spec.js | *.spec.jsx | *.spec.ts | *.spec.tsx | *_spec.js | *_spec.jsx | *_spec.ts | *_spec.tsx)
      if ((position % ODU_SHARD_TOTAL == ODU_SHARD_INDEX)); then
        ordinary_files+=("./$file")
      fi
      ((position += 1))
      ;;
  esac
done < <(LC_ALL=C git ls-files -z | LC_ALL=C sort -z)

selected_browser_files=()
for position in "${!browser_files[@]}"; do
  if ((position % ODU_SHARD_TOTAL == ODU_SHARD_INDEX)); then
    selected_browser_files+=("${browser_files[$position]}")
  fi
done

echo "test shard $((ODU_SHARD_INDEX + 1))/$ODU_SHARD_TOTAL: ${#ordinary_files[@]} ordinary + ${#selected_browser_files[@]} browser-conditioned files"

if ((${#ordinary_files[@]})); then
  bun test "${ordinary_files[@]}"
fi

if ((${#selected_browser_files[@]})); then
  bun test --conditions browser "${selected_browser_files[@]}"
fi
