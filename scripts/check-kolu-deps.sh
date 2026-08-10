#!/usr/bin/env sh
# Every dependency a hydrated @kolu/* source declares must also be a direct
# dependency of the ROOT package.json, at the same version. bunfig.toml has
# the full argument; the short version is that the isolated linker puts only
# the root package's direct dependencies where those sources resolve from, and
# a *differing* version there is two copies of `effect`, which is worse than
# none.
#
# PEER dependencies count, and are checked the same way. A peer is a runtime
# import like any other — @kolu/surface-app's serving half imports
# `WebSocketServer` from `ws` at the top of the module — and the arrangement a
# peer declares ("the app supplies its Node runtime, the package supplies the
# order") is exactly what this root list IS. Optional peers are not exempt:
# optionality is about consumers that never load the module, and a hydrated
# tree resolves from ONE place for all of them. If a future kolu peer is one
# olai genuinely never imports, declaring it costs a line; not declaring one it
# does import costs a boot.
#
# Usage: check-kolu-deps.sh <kolu-package-dir>...  (the dev shell exports the
# list as $OLAI_KOLU_DIRS). Workspace siblings (`workspace:*`) are skipped:
# those are other @kolu/* packages, hydrated by name in nix/kolu.nix.
set -eu

problems=$(
  for dir in "$@"; do
    jq -r --slurpfile root package.json '
      ($root[0].dependencies // {}) as $root
      | .name as $pkg
      | ((.dependencies // {}) + (.peerDependencies // {}))
      | to_entries[]
      | select(.value | startswith("workspace:") | not)
      | select(($root[.key] // "") != .value)
      | "\($pkg) needs \"\(.key)\": \"\(.value)\", root package.json has \($root[.key] // "no entry" | tojson)"
    ' "$dir/package.json"
  done
)

if [ -n "$problems" ]; then
  printf 'check-kolu-deps: %s\n' "$problems" >&2
  echo "" >&2
  echo "Add or correct those entries in package.json (and in \"overrides\" for" >&2
  echo "anything that must exist exactly once, like effect), then \`bun install\`." >&2
  exit 1
fi

echo "check-kolu-deps: every hydrated @kolu/* dependency is a root dependency at kolu's version"
