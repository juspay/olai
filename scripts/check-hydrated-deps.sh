#!/usr/bin/env sh
set -eu

label="${1:?usage: check-hydrated-deps.sh <label> <externals-json>}"
pinned="${2:?usage: check-hydrated-deps.sh <label> <externals-json>}"

if ! command -v jq >/dev/null 2>&1; then
  echo "check-hydrated-deps: jq is not on PATH — run this through \`just\`," >&2
  echo "  which enters the dev shell (\`nix develop\`) that provides it." >&2
  exit 1
fi

root="$(dirname "$0")/.."
fail=0

wanted=$(
  printf '%s' "$pinned" | jq -c '
    if type == "object" and all(.[]; type == "string") then .
    else error("not a {name: version} map") end
  '
) || {
  echo "check-hydrated-deps: $label: the pin must arrive as one {name: version}" >&2
  echo "  map of every external it needs. Look at what nix exported." >&2
  exit 1
}

if [ "$(printf '%s' "$wanted" | jq -r 'length')" -eq 0 ]; then
  echo "check-hydrated-deps: $label declares no externals at all — that is not a" >&2
  echo "  pin this check can be green about. Look at what nix exported." >&2
  exit 1
fi

missing=$(
  printf '%s' "$wanted" | jq -r --slurpfile root "$root/package.json" --arg label "$label" '
    to_entries[]
    | . as $want
    | ($root[0].dependencies[$want.key] // null) as $have
    | if $have == null then
        "\($want.key): \($label) needs it at \($want.value); the root package.json does not declare it"
      elif $have != $want.value then
        "\($want.key): \($label) needs \($want.value); the root package.json says \($have)"
      else empty end
  '
)
if [ -n "$missing" ]; then
  echo "check-hydrated-deps: the root manifest disagrees with $label:" >&2
  echo "$missing" | sed 's/^/  /' >&2
  fail=1
fi

members=$(sh "$root/scripts/workspace-members.sh" "$root")

for member in $members; do
  manifest="$root/$member/package.json"
  drift=$(
    printf '%s' "$wanted" | jq -r --slurpfile pkg "$manifest" --arg label "$label" '
      to_entries[]
      | . as $want
      | ($pkg[0].dependencies // {}) + ($pkg[0].devDependencies // {}) + ($pkg[0].peerDependencies // {})
      | .[$want.key] // null
      | select(. != null and . != $want.value)
      | "\($want.key): \(.) — \($label) pins \($want.value)"
    '
  )
  if [ -n "$drift" ]; then
    echo "check-hydrated-deps: $member disagrees with $label:" >&2
    echo "$drift" | sed 's/^/  /' >&2
    fail=1
  fi
done

overridden=$(
  printf '%s' "$wanted" | jq -r --slurpfile root "$root/package.json" --arg label "$label" '
    to_entries[]
    | . as $want
    | (($root[0].overrides // {})[$want.key] // null) as $have
    | select($have != null and $have != $want.value)
    | "\($want.key): overrides says \($have); \($label) pins \($want.value)"
  '
)
if [ -n "$overridden" ]; then
  echo "check-hydrated-deps: the root overrides block disagrees with $label:" >&2
  echo "$overridden" | sed 's/^/  /' >&2
  fail=1
fi

[ "$fail" -eq 0 ] || exit 1
echo "check-hydrated-deps: the root manifest, every package manifest and the overrides block agree with $label"
