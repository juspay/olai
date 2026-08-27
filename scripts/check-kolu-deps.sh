#!/usr/bin/env sh
# Every external a hydrated @kolu/* source needs must be a direct dependency of
# the ROOT package.json at kolu's exact version — and no olai package may spell
# one of those externals at a DIFFERENT version.
#
# bunfig.toml has the full argument; the short version is that the isolated
# linker puts only the root package's direct dependencies where those hydrated
# sources resolve from, and a *differing* version there is two copies of
# `effect`, which is worse than none.
#
# ## What this script no longer does, and why
#
# It used to walk the hydrated manifests itself and check two things: that
# every declared dependency is on the root list, and that every `workspace:*`
# sibling is also hydrated. The second half is now structurally impossible to
# get wrong — `nix/kolu.nix` names six SEEDS and kolu's own `consumer.nix`
# computes the closure, so "hydrate a sibling nobody listed" is not a state the
# build can be in. The first half moved to kolu too: `externals` IS the merged
# answer, derived from the same manifests this script used to read.
#
# So what is left is the part that is genuinely olai's: agreeing with that
# answer. Two assertions, and the second one is new.
#
# ## The second assertion is the one that was missing
#
# `effect` is spelled seventeen times across thirteen olai manifests, and until
# now only the ROOT one was checked. What kept the other twelve honest was the
# root `overrides` block — a resolution mechanism, not a check, so a package
# declaring a different version was silently rewritten rather than refused. A
# constraint enforced by a fallback is a constraint nobody is told about when it
# breaks; this is the exact class that broke odu. Now every manifest is read and
# any spelling that disagrees with kolu is named, with both versions.
#
# PEER dependencies count on the root, and are checked the same way. A peer is a
# runtime import like any other — @kolu/surface-app's serving half imports
# `WebSocketServer` from `ws` at the top of the module — and the arrangement a
# peer declares ("the app supplies its Node runtime, the package supplies the
# order") is exactly what this root list IS.
#
# Usage: check-kolu-deps.sh  (the dev shell exports $OLAI_KOLU_EXTERNALS).
set -eu

: "${OLAI_KOLU_EXTERNALS:?the dev shell must export kolu's externals as JSON}"

root="$(dirname "$0")/.."
fail=0

# ── 1. The root manifest carries every external, at kolu's version ───────────
#
# `dependencies` only: the root list is what the isolated linker splices into
# the one node_modules the hydrated sources resolve from, and a devDependency
# is not spliced there.
missing=$(
  printf '%s' "$OLAI_KOLU_EXTERNALS" | jq -r --slurpfile root "$root/package.json" '
    to_entries[]
    | . as $want
    | ($root[0].dependencies[$want.key] // null) as $have
    | if $have == null then
        "\($want.key): kolu needs it at \($want.value); the root package.json does not declare it"
      elif $have != $want.value then
        "\($want.key): kolu needs \($want.value); the root package.json says \($have)"
      else empty end
  '
)
if [ -n "$missing" ]; then
  echo "check-kolu-deps: the root manifest disagrees with kolu's externals:" >&2
  echo "$missing" | sed 's/^/  /' >&2
  fail=1
fi

# ── 2. No olai package spells one of those externals differently ─────────────
#
# The root `overrides` block would paper over a disagreement at install time.
# That is precisely why it has to be checked here instead: an override makes
# the tree work and leaves the manifest lying.
for manifest in "$root"/packages/*/package.json; do
  drift=$(
    printf '%s' "$OLAI_KOLU_EXTERNALS" | jq -r --slurpfile pkg "$manifest" --arg name "$manifest" '
      to_entries[]
      | . as $want
      | ($pkg[0].dependencies // {}) + ($pkg[0].devDependencies // {}) + ($pkg[0].peerDependencies // {})
      | .[$want.key] // null
      | select(. != null and . != $want.value)
      | "\($want.key): \(.) — kolu pins \($want.value)"
    '
  )
  if [ -n "$drift" ]; then
    echo "check-kolu-deps: $(basename "$(dirname "$manifest")") disagrees with kolu:" >&2
    echo "$drift" | sed 's/^/  /' >&2
    fail=1
  fi
done

[ "$fail" -eq 0 ] || exit 1
echo "check-kolu-deps: every external kolu's hydrated sources need is a root dependency at kolu's version, and no olai manifest spells one differently"
