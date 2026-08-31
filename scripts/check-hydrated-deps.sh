#!/usr/bin/env sh
# ONE PIN'S VERSION AGREEMENT — asked the same way of every pin, and asking it
# is the whole of this script's job.
#
# olai consumes two pinned trees as RAW TYPESCRIPT: kolu's thirty-two members
# (nix/kolu.nix) and `@odu/run-client` (nix/odu.nix). Neither is in bun.lock.
# The isolated linker (bunfig.toml has the full argument) puts only the ROOT
# package's direct dependencies into the one node_modules those hydrated
# sources resolve from by walking up — so an external they need is olai's root
# to declare, at the pin's exact version, and a DIFFERING version there is two
# copies of `effect`, which is worse than none.
#
# THREE ASSERTIONS, and the third guards the mechanism the second exists
# because of: the root list, every workspace manifest, and the root `overrides`
# block. An override is how bun SILENTLY REWRITES a version — a constraint
# enforced by a fallback is a constraint nobody is told about when it breaks —
# so an unchecked one makes every other manifest's honesty cosmetic.
#
# ## WHY THIS IS ONE SCRIPT AND NOT TWO
#
# `scripts/check-odu-deps.sh` was a line-for-line copy of `check-kolu-deps.sh`
# with the nouns changed, and its own header said so and asked to be replaced:
# "what it needs to be generic is three arguments — the pinned manifest as
# JSON, the one package directory the hydrated specifier is allowed in, and the
# entry that must stay schemas-and-types — and every line below is already
# written against exactly those three."
#
# It gets TWO of the three, because the third and its neighbour LEFT. Confining
# a hydrated specifier to one package, and keeping a `/wire` entry
# schemas-and-types, are claims about SOURCE TEXT, and both copies made them
# with `rg … 2>/dev/null || true` over `packages/*/src` — a fence that passes
# GREEN on a machine with no ambient ripgrep (it is not in shell.nix's package
# list) and that never saw `packages/tests`, the one member with no `src/`.
# Those two now live in `packages/plugins/src/fence.test.ts`, under the pinned
# bun, walking the PACKAGE, with the allowed set DERIVED from the plugin
# registry rather than typed out twice. What is left here is the half that
# genuinely wants a shell: reading JSON out of the Nix store and comparing it
# to manifests, with NO `install` in front of it, so it fails fast.
#
# ## WHERE IT LIVES, and that is a ruling rather than an oversight
#
# The copier beside it graduated to kolu (`hydrate-kolu-packages.sh`, one script
# both pins ride). The obvious next move is to send this after it. It is NOT
# sent, because where a shared script lives is the shape of somebody else's
# repository and that is the human's to rule — the question asked in the review
# of juspay/olai#433 and not yet answered. Generic AND local is the state that
# costs nothing to reverse; a unilateral move upstream is not.
#
# Usage: check-hydrated-deps.sh <label> <pinned-json>
#
#   <label>       what a failure names — the pin, as a reader would say it.
#   <pinned-json> the pin's OWN answer, either shape:
#                   * a flat {name: version} map — kolu's merged `externals`,
#                     which already folds peer dependencies in;
#                   * a whole package manifest — odu's, whose `dependencies`
#                     and `peerDependencies` are read.
#                 Read out of the store by nix and exported by shell.nix, so
#                 the comparison is against the PIN rather than against a
#                 transcription of it. Both shapes are normalised HERE, once,
#                 rather than by two different jq filters in the justfile.
#
# A PEER counts like any other runtime import — @kolu/surface-app's serving
# half imports `WebSocketServer` from `ws` at the top of the module, and the
# arrangement a peer declares ("the app supplies its Node runtime, the package
# supplies the order") is exactly what this root list IS.
set -eu

label="${1:?usage: check-hydrated-deps.sh <label> <pinned-json>}"
pinned="${2:?usage: check-hydrated-deps.sh <label> <pinned-json>}"

# The dev shell supplies `jq`, and this script has no other way to read JSON.
# Said OUT LOUD rather than left to a `command not found` swallowed by a
# command substitution: the two scripts this replaces would each have died with
# an empty variable and a bare `set -e`, which is the same class of quiet as the
# ripgrep hole. Running outside `nix develop` is the ONE hazard this file cannot
# close on its own — it can only refuse to be mysterious about it.
if ! command -v jq >/dev/null 2>&1; then
  echo "check-hydrated-deps: jq is not on PATH — run this through \`just\`," >&2
  echo "  which enters the dev shell (\`nix develop\`) that provides it." >&2
  exit 1
fi

root="$(dirname "$0")/.."
fail=0

# THE PIN'S ANSWER, one shape. A manifest is recognised by carrying a
# dependency block at all; anything else is already the merged map.
wanted=$(
  printf '%s' "$pinned" | jq -c '
    if (has("dependencies") or has("peerDependencies") or has("name"))
    then (.dependencies // {}) + (.peerDependencies // {})
    else . end
  '
) || {
  echo "check-hydrated-deps: $label: the pinned JSON did not parse" >&2
  exit 1
}

# NOT VACUOUS. An empty map would pass all three assertions below having
# compared nothing — the exact failure mode this whole replacement is about, one
# floor down from the fence it inherits it from.
if [ "$(printf '%s' "$wanted" | jq -r 'length')" -eq 0 ]; then
  echo "check-hydrated-deps: $label declares no externals at all — that is not a" >&2
  echo "  pin this check can be green about. Look at what nix exported." >&2
  exit 1
fi

# ── 1. The root manifest carries every external, at the pin's version ────────
#
# `dependencies` only: the root list is what the isolated linker splices into
# the one node_modules the hydrated sources resolve from, and a devDependency
# is not spliced there.
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

# ── 2. No workspace package spells one of those externals differently ────────
#
# `effect` is spelled a dozen times across olai's manifests, and what kept them
# honest was the root `overrides` block — a resolution mechanism, not a check,
# so a package declaring a different version was silently rewritten rather than
# refused. This assertion was kolu's alone; generic, the second pin gets it too,
# which is not a widening for its own sake: `@odu/run-client` declares `effect`
# at the same version, so a drifting manifest is the same two-instances failure
# read off a different pin.
for manifest in "$root"/packages/*/package.json; do
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
    echo "check-hydrated-deps: $(basename "$(dirname "$manifest")") disagrees with $label:" >&2
    echo "$drift" | sed 's/^/  /' >&2
    fail=1
  fi
done

# ── 3. The root `overrides` block agrees too ─────────────────────────────────
#
# Drift `overrides.effect` while `dependencies.effect` sits at the pin and the
# first two assertions stay green while the INSTALLED TREE is rewritten
# underneath them: the manifest is honest, the node_modules is not, and the
# failure surfaces as two `effect` instances failing to recognise each other's
# classes — the thing the `//overrides` prose exists to prevent.
#
# Only overrides that NAME one of the pin's externals are checked. `@types/node`
# is olai's own discipline for a different reason (bun-types nesting 26.x) and
# no pin has an opinion about it; an override a pin does not declare is not
# drift.
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
