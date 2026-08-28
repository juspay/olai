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
# answer. THREE assertions: the root list, every package manifest, and the root
# `overrides` block — the last two are new, and the third guards the mechanism
# the second one was written because of.
#
# ## The second assertion is the one that was missing
#
# `effect` is spelled fourteen times across thirteen olai manifests, and until
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


# ── 3. The root `overrides` block agrees too ────────────────────────────────
#
# THE ARM THIS SCRIPT WAS MISSING, and it guarded the wrong side of the very
# mechanism its own header names. `overrides` is how bun SILENTLY REWRITES a
# version — it is the reason assertion 2 exists at all — and until now nothing
# read it. Drift `overrides.effect` while `dependencies.effect` sits at kolu's
# pin and the first two assertions stay green while the installed tree is
# rewritten underneath them: the manifest is honest, the node_modules is not,
# and the failure surfaces as two `effect` instances failing to recognise each
# other's classes, which is the thing `//overrides` exists to prevent.
#
# Only overrides that NAME one of kolu's externals are checked. `@types/node` is
# olai's own discipline for a different reason (bun-types nesting 26.x) and kolu
# has no opinion about it; an override kolu does not declare is not drift.
overridden=$(
  printf '%s' "$OLAI_KOLU_EXTERNALS" | jq -r --slurpfile root "$root/package.json" '
    to_entries[]
    | . as $want
    | (($root[0].overrides // {})[$want.key] // null) as $have
    | select($have != null and $have != $want.value)
    | "\($want.key): overrides says \($have); kolu pins \($want.value)"
  '
)
if [ -n "$overridden" ]; then
  echo "check-kolu-deps: the root overrides block disagrees with kolu:" >&2
  echo "$overridden" | sed 's/^/  /' >&2
  fail=1
fi


# ── 4. The PRODUCT tier lives in the two kolu packages, and nowhere else ─────
#
# THE FIRST ASSERTION HERE THAT OPENS A `.ts` FILE. The three above check
# versions — what a manifest SAYS — and a version check cannot see an import.
# So which olai package may reach kolu's product packages was enforced by
# nothing but review, and `docs/architecture.md` said as much in as many words.
#
# The sixth sitting ended that: kolu implementation lives in `@olai/kolu-client`
# and `@olai/kolu-ui`, and the wall is a package wall because — the human's
# ruling — "a directory wall can be broken easily by importing; package walls
# cannot, and are conceptually self-explanatory." This is the machine half of
# that sentence.
#
# ZERO EXCEPTIONS, which was itself a ruling. The design carried a named
# allowlist row for `packages/chat/src/kolu.ts` until the human chose Option B;
# the seat that proposed the row retracted it first, as "a file-grained
# exception in a package-grained fence — discipline dressed as physics." A path
# a reviewer has to remember is weaker than a wall, so chat reaches
# `@kolu/detect` through `@olai/kolu-client/detect` and this list is empty.
#
# THE FRAMEWORK TIER IS OUT OF SCOPE and deliberately unlisted: `@kolu/surface*`
# is olai's foundation, imported anywhere, like `effect`. What is confined is
# the PRODUCT tier — the padi integration — plus the terminal emulator, which is
# `@olai/kolu-ui`'s appliance and no other package's business.
PRODUCT='@kolu/padi-client|@kolu/terminal-vocab|@kolu/solid-dockrow|@kolu/solid-statepip|@kolu/detect|terminal-themes|@xterm/'

# Import statements and CSS `@import`s — the two ways a specifier actually
# enters a build. Prose that merely NAMES a package is not a dependency, and a
# fence that failed on a comment would be a fence people learn to work around.
leaked=$(
  rg --no-messages -l \
    "^\s*(import|export)\b.*from \"($PRODUCT)|^\s*@import \"($PRODUCT)" \
    "$root"/packages/*/src 2>/dev/null | grep -v '/packages/kolu-client/' | grep -v '/packages/kolu-ui/' || true
)
if [ -n "$leaked" ]; then
  echo "check-kolu-deps: kolu's PRODUCT tier is imported outside the two kolu packages:" >&2
  echo "$leaked" | sed "s|^$root/||; s|^|  |" >&2
  echo "  → it belongs behind @olai/kolu-client or @olai/kolu-ui. The fence has no exceptions." >&2
  fail=1
fi

# ── 5. The wire entry stays pure, because every listener pulls it in ─────────
#
# `@olai/surface` spreads `@olai/kolu-client/wire` into its own spec, so that
# module is on the static graph of everything that reads the surface — the
# browser bundle and the server both. It may import `effect` and
# `anyforge/schemas`. It may NOT import padi (which would put the daemon's whole
# contract on the browser's graph), `solid-js` (a UI runtime on the server's),
# or `@olai/format`. Schemas and types only.
impure=$(
  rg --no-messages -l \
    "^\s*(import|export)\b.*from \"(@kolu/padi-client|solid-js|@olai/format|@xterm/)" \
    "$root/packages/kolu-client/src/wire" 2>/dev/null || true
)
if [ -n "$impure" ]; then
  echo "check-kolu-deps: the wire entry must stay types-and-schemas only:" >&2
  echo "$impure" | sed "s|^$root/||; s|^|  |" >&2
  fail=1
fi

[ "$fail" -eq 0 ] || exit 1
echo "check-kolu-deps: versions agree with kolu, the product tier is confined to the two kolu packages, and the wire entry is pure"
