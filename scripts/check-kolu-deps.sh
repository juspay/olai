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
# list as $OLAI_KOLU_DIRS).
#
# A workspace sibling (`workspace:*`) is the OTHER half of the same invariant,
# and it is checked rather than skipped. Those are @kolu/* packages hydrated by
# name in nix/kolu.nix, so what has to be true is that the list there is CLOSED
# under "is imported by something already on it" — and that list is written by
# hand. A sibling nobody hydrated resolves to nothing at runtime, which is a
# boot failure or, worse, a code path nothing exercises until someone opens the
# page that needs it. (`@kolu/url-shape` was exactly this: `surface-app` grew an
# import of it, and only a test happening to serve a real listener would have
# said so.)
set -eu

# Every hydrated package's own name, so a sibling can be looked up in the set
# actually being hydrated rather than in a second copy of the list.
hydrated=$(for dir in "$@"; do jq -r .name "$dir/package.json"; done)

problems=$(
  for dir in "$@"; do
    jq -r --slurpfile root package.json --arg hydrated "$hydrated" '
      ($root[0].dependencies // {}) as $root
      | ($hydrated | split("\n")) as $hydrated
      | .name as $pkg
      | ((.dependencies // {}) + (.peerDependencies // {}))
      | to_entries[]
      | if (.value | startswith("workspace:")) then
          select(.key as $sibling | $hydrated | index($sibling) | not)
          | "\($pkg) imports its workspace sibling \"\(.key)\", which nix/kolu.nix does not hydrate"
        else
          select(($root[.key] // "") != .value)
          | "\($pkg) needs \"\(.key)\": \"\(.value)\", root package.json has \($root[.key] // "no entry" | tojson)"
        end
    ' "$dir/package.json"
  done
)

if [ -n "$problems" ]; then
  printf 'check-kolu-deps: %s\n' "$problems" >&2
  echo "" >&2
  echo "For a missing @kolu/* sibling, add its name to \`names\` in nix/kolu.nix." >&2
  echo "For anything else, add or correct the entry in package.json (and in" >&2
  echo "\"overrides\" for what must exist exactly once, like effect), then" >&2
  echo "\`bun install\`." >&2
  exit 1
fi

echo "check-kolu-deps: every hydrated @kolu/* dependency is a root dependency at kolu's version, and every @kolu/* sibling they import is hydrated"
