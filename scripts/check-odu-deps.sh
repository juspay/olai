#!/usr/bin/env sh
# `@odu/run-client` is hydrated as raw TypeScript from the odu pin, exactly as
# the @kolu/* sources are (bunfig.toml has the full argument). Two assertions,
# and they are the two halves of "confined by dep checks":
#
#   1. every external that package DECLARES is a direct dependency of olai's
#      ROOT package.json at the same version — because the isolated linker puts
#      only the root package's direct dependencies where a hydrated source
#      resolves from, and a *differing* version there is two copies of `effect`,
#      which is worse than none;
#   2. nothing outside `packages/odu-client/src` imports it — the package wall,
#      asserted rather than reviewed, which is `check-kolu-deps.sh`'s fourth
#      arm pointed at the second appliance.
#
# WHY IT IS NOT A FIFTH ARM OF `check-kolu-deps.sh`. The two pins are two
# repositories that move independently, so a red leg should already say which
# one it is about before anybody opens the output. The shapes below are
# deliberately that script's, line for line, because they are the same two
# questions.
#
# ## AND WHY IT IS NOT UPSTREAM, which is a fair thing to ask of a second copy
#
# It is: this is kolu's dep-fence pattern, adapted, and the COPIER beside it
# already graduated — `hydrate-kolu-packages.sh` lives in kolu and both pins
# ride it, because its own header made the argument (two consumers kept a
# byte-identical copy in step by a comment, which is not a mechanism). The
# CHECKER is the same shape one step behind: what it needs to be generic is
# three arguments — the pinned manifest as JSON, the one package directory the
# hydrated specifier is allowed in, and the entry that must stay
# schemas-and-types — and every line below is already written against exactly
# those three.
#
# So the honest status is a NAMED CANDIDATE and not a defence. What it wants is
# a `check-hydrated-deps.sh` in kolu taking those arguments, with this file and
# `check-kolu-deps.sh` becoming two `just` legs that call it — and the third and
# fourth assertions of the kolu one (the overrides block, the product-tier
# fence) staying kolu's own, since they are about kolu's tiering rather than
# about hydration. Two consumers is the bar that pattern's own header sets, and
# a second one now exists.
#
# It is NOT opened here, because where a shared script lives is the shape of
# somebody else's repository and that is the human's to rule (the review of
# juspay/olai#433, where this question was asked).
#
# WHAT THIS DOES NOT DO, and the omission is structural rather than lazy: there
# is no sibling-closure walk, because there is no closure. `@odu/run-client`
# names one dependency and nothing of odu's, which is the whole point of the
# package existing (juspay/odu#94's README argues it), so "hydrate a sibling
# nobody listed" is not a state this build can be in.
#
# Usage: check-odu-deps.sh  (the dev shell exports $OLAI_ODU_MANIFEST).
set -eu

: "${OLAI_ODU_MANIFEST:?the dev shell must export the pinned @odu/run-client manifest as JSON}"

root="$(dirname "$0")/.."
fail=0

# ── 1. The root manifest carries every external, at odu's version ────────────
#
# `dependencies` only, for `check-kolu-deps.sh`'s reason: the root list is what
# the isolated linker splices into the one node_modules the hydrated source
# resolves from, and a devDependency is not spliced there.
missing=$(
  printf '%s' "$OLAI_ODU_MANIFEST" | jq -r --slurpfile root "$root/package.json" '
    (.dependencies // {})
    | to_entries[]
    | . as $want
    | ($root[0].dependencies[$want.key] // null) as $have
    | if $have == null then
        "\($want.key): @odu/run-client needs it at \($want.value); the root package.json does not declare it"
      elif $have != $want.value then
        "\($want.key): @odu/run-client needs \($want.value); the root package.json says \($have)"
      else empty end
  '
)
if [ -n "$missing" ]; then
  echo "check-odu-deps: the root manifest disagrees with @odu/run-client:" >&2
  echo "$missing" | sed 's/^/  /' >&2
  fail=1
fi

# ── 2. The package is imported from ONE place ───────────────────────────────
#
# `@olai/odu-client` is the only package that may speak odu, the way
# `@olai/kolu-client` is the only one that may speak padi — and for the same
# ruling: "a directory wall can be broken easily by importing; package walls
# cannot." This is the machine half of that sentence for the second appliance.
#
# ZERO EXCEPTIONS, deliberately — `check-kolu-deps.sh`'s fourth arm carries the
# argument (a file-grained exception in a package-grained fence is discipline
# dressed as physics). A face that wants a run's shape reads olai's own wire
# vocabulary, which is what `@olai/odu-client/wire` is for.
leaked=$(
  rg --no-messages -l \
    '^\s*(import|export)\b.*from "@odu/' \
    "$root"/packages/*/src 2>/dev/null | grep -v '/packages/odu-client/' || true
)
if [ -n "$leaked" ]; then
  echo "check-odu-deps: @odu/* is imported outside @olai/odu-client:" >&2
  echo "$leaked" | sed "s|^$root/||; s|^|  |" >&2
  echo "  → it belongs behind @olai/odu-client. The fence has no exceptions." >&2
  fail=1
fi

# ── 3. The wire entry stays pure, because every listener pulls it in ────────
#
# `@olai/surface` spreads `@olai/odu-client/wire` into its own spec, so that
# module is on the static graph of everything that reads the surface — the
# browser bundle and the server both. It may import `effect`. It may NOT import
# `@odu/*` (which would put odu's dial, and `node:net` with it, on the
# browser's graph), `solid-js` (a UI runtime on the server's), or
# `@olai/format`. Schemas and types only — `check-kolu-deps.sh`'s fifth arm,
# one wire over.
impure=$(
  rg --no-messages -l \
    '^\s*(import|export)\b.*from "(@odu/|solid-js|@olai/format|node:)' \
    "$root/packages/odu-client/src/wire" 2>/dev/null || true
)
if [ -n "$impure" ]; then
  echo "check-odu-deps: the wire entry must stay types-and-schemas only:" >&2
  echo "$impure" | sed "s|^$root/||; s|^|  |" >&2
  fail=1
fi

[ "$fail" -eq 0 ] || exit 1
echo "check-odu-deps: the root manifest agrees with @odu/run-client, odu is confined to @olai/odu-client, and its wire entry is pure"
