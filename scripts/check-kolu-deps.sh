#!/usr/bin/env sh
# Every dependency a hydrated @kolu/* source declares must also be a direct
# dependency of the ROOT package.json, at the same version.
#
# Why the root, and why exact: the isolated linker symlinks only the root
# package's direct dependencies into the root node_modules (bunfig.toml), and
# that is where node_modules/@kolu/<name>/src/*.ts resolves its own imports by
# walking up. A dependency missing there is "Cannot find module" the first
# time a phase-2 import reaches that file; a dependency at a *different*
# version is worse — two copies of `effect`, and Effect's `_tag` narrowing
# stops recognising classes across the two module realms.
#
# Usage: check-kolu-deps.sh <kolu-package-dir>...  (the dev shell exports the
# list as $OLAI_KOLU_DIRS). Workspace siblings (`workspace:*`) are skipped:
# those are other @kolu/* packages, hydrated by name in nix/kolu.nix.
set -eu

root_deps=$(jq -c '.dependencies // {}' package.json)
status=0

for dir in "$@"; do
  name=$(jq -r '.name' "$dir/package.json")
  for spec in $(jq -r '
        (.dependencies // {})
        | to_entries[]
        | select(.value | startswith("workspace:") | not)
        | "\(.key)@\(.value)"' "$dir/package.json"); do
    dep=${spec%@*}
    want=${spec##*@}
    have=$(printf '%s' "$root_deps" | jq -r --arg d "$dep" '.[$d] // ""')
    if [ -z "$have" ]; then
      echo "check-kolu-deps: $name needs \"$dep\": \"$want\", absent from the root package.json dependencies" >&2
      status=1
    elif [ "$have" != "$want" ]; then
      echo "check-kolu-deps: $name needs \"$dep\": \"$want\", root package.json has \"$have\"" >&2
      status=1
    fi
  done
done

if [ "$status" -ne 0 ]; then
  echo "" >&2
  echo "Add or correct those entries in package.json (and in \"overrides\" for" >&2
  echo "anything that must exist exactly once, like effect), then \`bun install\`." >&2
  exit 1
fi

echo "check-kolu-deps: every hydrated @kolu/* dependency is a root dependency at kolu's version"
