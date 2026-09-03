#!/bin/sh
# PROVE THE FENCE — a mutation run, so "the lints are as strong as before" is a
# thing somebody watched happen rather than a sentence in a PR body.
#
# The two standing lints in `@olai/plugin-api` are SWEEPS: they read the
# repository as text and assert equalities over what they found. A sweep's one
# failure mode is going quiet — a pattern that stopped matching, a corpus that
# came back short, a resolver that answered `undefined` and walked one file —
# and every one of those is GREEN. Neither the suite nor a reviewer can tell a
# fence that is holding from a fence that is not running, because both look
# exactly like `0 fail`.
#
# So this script breaks the tree on purpose, once per claim, and asserts the
# lints go RED. It is the falsifier for the falsifiers.
#
#   sh scripts/prove-fence.sh          # run every mutation
#   sh scripts/prove-fence.sh 5 9      # run only these
#
# NOT A `just check` LEG, deliberately. It writes to tracked files (and puts
# each one back), so two of them running at once would fight — and `check` runs
# its legs in parallel. It is a thing a person runs when the fence CHANGES: at
# the packaging move that wrote it, and at any later edit to `fence.test.ts` or
# `mechanics.test.ts` big enough that "the tests still pass" stops being
# evidence.
#
# ## Everything it touches is DERIVED
#
# The three things a packaging move MOVES are derived, and that is what lets the
# same script run against the tree before one and the tree after it and mean the
# same thing — which is the only way its two runs are comparable. The registry is
# the member holding `fence.test.ts`; the plugins are the members the registry
# DECLARES, which is the roster read where the fence itself reads it; the
# container is the directory a tenant lives in. Three paths ARE typed and the
# block that sets them says why each was chosen rather than computed.
#
# ## The restore is the part to be careful about
#
# Each mutation copies the file it will touch, edits it, runs the lints, and
# puts the copy back — with a TRAP, so a `^C` or a failed `bun` does not leave
# somebody's tree mutated. The script refuses to start against a dirty tree for
# the same reason: `git status` is the check that the restore worked, and it
# can only say so if it was clean to begin with.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

if [ -n "$(git status --porcelain)" ]; then
  echo "prove-fence: the working tree is dirty." >&2
  echo "Every mutation below edits a tracked file and puts it back; a clean" >&2
  echo "\`git status\` afterwards is how you know the restore worked." >&2
  exit 1
fi

# ── the tree, derived ────────────────────────────────────────────────────────

# Every workspace member, from the one script that expands the field. This used
# to be its own `jq | while read` loop with no empty-glob guard — the third
# expansion of one fact, and the one that would have reported a short list in
# silence while its two siblings threw. `scripts/workspace-members.sh` is the
# shared rule; what stays independent here is the REGISTRY and the PLUGINS
# below, which are re-derived from different sources than the fence uses on
# purpose, because a harness that re-derived from the fence's own arithmetic
# would prove nothing.
members=$(sh "$root/scripts/workspace-members.sh" "$root")

# THE REGISTRY: the member that owns the fence.
registry=$(for m in $members; do if [ -f "$m/src/fence.test.ts" ]; then echo "$m"; fi; done)

# THE PLUGINS: what the registry DECLARES, held to the CONTAINER. Not a shape
# test — `@olai/plugin-api` opens `./wire`, `./server` and `./all.css` too,
# because it MIRRORS the doors it composes, so a signature match would have
# called the interface a tenant and quietly aimed half these mutations at the
# wrong package. The registry is the one package allowed to name a plugin, so
# its dependency list IS the roster; the container filter is what stops that
# roster from meaning something else the day the registry declares any other
# workspace sibling (`jq -r keys[]` sorts `@olai/…` ahead of `olai-plugin-…`,
# so `plugin_a` would silently become that package).
#
# ONE `jq` PER MEMBER rather than one per (dependency x member) pair: the nested
# loop this replaces forked `jq` eighty-eight times, 227ms of a 9.5s run and the
# only super-linear thing in the harness.
#
# AND EVERY NAME IS DERIVED AFTER THE FILTER, which the first draft got wrong:
# `name_a`/`name_b` were read off the pre-filter list and never recomputed, so a
# filter that dropped anything but the first entry left `$plugin_b` and
# `$name_b` naming different packages — and mutations 4, 6 and 8 spend them
# together. The mutation would have imported a non-plugin, the fence would have
# correctly said nothing, and the harness would have scored it
# `GREEN — THE FENCE DID NOT SEE IT`: a false indictment of the lint, from the
# guard written to prevent exactly that.
names=$(for m in $members; do echo "$m $(jq -r .name "$m/package.json")"; done)
declared_deps=$(jq -r '.dependencies | keys[]' "$registry/package.json")
plugins=$(
  for want in $declared_deps; do
    echo "$names" | while read -r m mname; do
      if [ "$mname" = "$want" ] && [ "$m" != "$registry" ]; then echo "$m"; fi
    done
  done
)
# THE CONTAINER: the directory MOST of those declarations sit in, rather than the
# one the first of them sits in.
#
# `dirname` of the first entry is what this was, and the comment above warned
# about exactly the day that would stop working: `jq -r keys[]` sorts
# `@olai/…` ahead of `olai-plugin-…`, so the first entry is whichever `@olai/*`
# sibling the registry declares. It declared none for a while and declares one
# now — `@olai/plugin-api`, the INTERFACE, which is a package the registry
# depends on and is not a tenant — so the first entry's dirname became
# `packages` and the filter below dropped both real plugins, leaving the harness
# to die on "fewer than two plugins found".
#
# The MODE is the derivation that survives that, and it survives it for the
# reason the container exists at all: the tenants are the many and everything
# else the registry declares is the few. It is still derived rather than typed,
# which is the property this whole block is written for — a harness that
# re-derived from the fence's own arithmetic would prove nothing.
container=$(
  for m in $plugins; do dirname "$m"; done | sort | uniq -c | sort -rn | head -n 1 | awk '{print $2}'
)
plugins=$(for m in $plugins; do if [ "$(dirname "$m")" = "$container" ]; then echo "$m"; fi; done)
plugin_a=$(echo "$plugins" | sed -n 1p)
plugin_b=$(echo "$plugins" | sed -n 2p)
# ...AND THE FIRST OF THEM THAT COMPOSES A SIBLING SURFACE, which is what a
# `src/wire.ts` is.
#
# NOT EVERY PLUGIN HAS ONE any more, and that is the agents phase rather than an
# irregularity: an ENGINE contributes a row of the chat panel's picker and the
# readings behind it, all of which already travel on the chat cell, so a second
# surface under `surface/claude/` would be one fact on the wire twice. Mutation 5
# is about what may not ride a `./wire` onto a SERVER's graph, so it needs a
# plugin that has one — and `plugin_a` is now alphabetically an engine.
#
# Derived rather than typed, like everything else in this block: the day the
# tenants are renamed this finds them, and the guard below is what turns "none
# of them has one" into this script's own diagnostic rather than a `cp` failing
# mid-run.
tenant_a=$(for m in $plugins; do if [ -f "$m/src/wire.ts" ]; then echo "$m"; fi; done | sed -n 1p)
[ -n "$tenant_a" ] || { echo "prove-fence: no plugin composes a sibling surface" >&2; exit 1; }
name_a=$(echo "$names" | awk -v p="$plugin_a" '$1 == p { print $2 }')
name_b=$(echo "$names" | awk -v p="$plugin_b" '$1 == p { print $2 }')
registry_name=$(jq -r .name "$registry/package.json")

# ...and THREE PATHS THAT ARE TYPED, which the header's "derived" is about the
# registry and the plugins rather than about these. Each is chosen rather than
# computed, on purpose: `packages/server` is the composition root, which is
# where every one of these defects historically WAS; `styles.css` is the app's
# one sheet, which is the grammar a TypeScript reading is blind to; and
# `packages/plugins/odu/src/appliance/index.ts` is the SECOND appliance's
# folded dial, which is the only way to write the cross-tenant mutation. A
# derived "first member that is neither registry nor plugin" would pick
# alphabetically and mean nothing. The guard below is what keeps a typed path
# from becoming a silent skip.
general=packages/server
general_src=$general/src/main.ts
sheet=packages/web/src/client/styles.css
other_dial=packages/plugins/odu/src/appliance/index.ts

[ -n "$plugin_b" ] || { echo "prove-fence: fewer than two plugins found" >&2; exit 1; }
case "$plugins" in *"$registry"*) echo "prove-fence: the registry came back as a plugin" >&2; exit 1 ;; esac
# EVERY PATH A MUTATION TOUCHES, not just the roots they are derived from. Five
# mutations reach `$plugin_x/src/<file>` and mutation 8 reaches a browser
# directory the architecture explicitly contemplates a tenant not having (odu
# has no separate appliance-face directory and needs none). Without these, a missing one dies
# mid-run on `cp`/`sed` rather than here, with this block's own diagnostic.
for path in "$registry" "$plugin_a" "$plugin_b" "$general_src" "$sheet" "$other_dial" \
  "$container" "$plugin_a/src/browser.tsx" "$plugin_b/src/browser.tsx" \
  "$tenant_a/src/wire.ts" "$plugin_a/src/server.ts" "$plugin_b/src/server.ts" \
  "$plugin_b/src/browser/Mark.tsx"; do
  [ -e "$path" ] || { echo "prove-fence: derived path $path does not exist" >&2; exit 1; }
done

# THE CONTAINER GETS ITS OWN GUARD, because `restore` hands it to `git clean`
# and a derivation that came back empty would hand over `.` — `dirname ""` is
# `.`, `[ -e "." ]` is true, and the sweep would then be the whole worktree
# rather than one directory. Nothing reachable produces that today (an empty
# `plugin_a` means an empty `plugin_b`, which the line above already refuses),
# but "unreachable by the order the guards happen to run in" is not the property
# a `git clean` should rest on.
case "$container" in
  packages/*) ;;
  *) echo "prove-fence: the container derived to '$container', which is not under packages/" >&2; exit 1 ;;
esac
[ -d "$container" ] || { echo "prove-fence: the container '$container' is not a directory" >&2; exit 1; }

echo "registry : $registry ($registry_name)"
echo "plugins  : $plugin_a ($name_a), $plugin_b ($name_b); wire door: $tenant_a"
echo

# ── the harness ──────────────────────────────────────────────────────────────

touched=""
restore() {
  # `git checkout --` RATHER THAN A `.bak` COPY, and it is the shorter of two
  # correct answers rather than a preference. The precondition at the top is a
  # clean tree, so HEAD IS the pristine content of every tracked file this
  # script touches — the tool that already knows it is the one already in use
  # two lines down. The copy was also strictly worse on the failure path the
  # header cares about: a `SIGKILL`, which no trap catches, left both a mutated
  # tracked file AND a stray `.prove-fence.bak` outside `$container`, which the
  # `git clean` below would not remove.
  [ -n "$touched" ] && git checkout -- $touched
  touched=""
  # ...and anything a mutation CREATED. `-fd` and never `-x`: an ignored path
  # (every `node_modules`, the generated mark) is left alone, and the clean-tree
  # precondition at the top is what makes "untracked in here" mean "this script
  # put it there".
  git clean -fdq "$container" 2>/dev/null || true
}
# THE EXIT TRAP PUTS THE TREE BACK; THE SIGNAL TRAPS ALSO STOP.
#
# A POSIX handler that does not exit returns control to the point after the
# interrupted command — so a `^C` during `bun test` used to restore the tree
# (which the header promised) and then run the remaining fourteen mutations,
# scoring the interrupted one as CAUGHT, and print `15 of 15 mutations were
# caught.` A person who pressed `^C` once got a clean bill of health. Re-raising
# with the default disposition is what makes the exit status honest and the
# summary unreachable.
trap 'restore' EXIT
trap 'restore; trap - INT; kill -INT $$' INT
trap 'restore; trap - TERM; kill -TERM $$' TERM

# THE MUTATION ITSELF, as arguments rather than as a heredoc. It was a heredoc
# read into `body=$(cat)` and run through `eval`, and the cost was double
# expansion: every `$` a mutation wanted at RUN time had to be escaped against
# the here-document's own pass, which is a trap laid for whoever writes the
# sixteenth. Arguments are expanded once, by the shell, where they are written.
#
# Run in THIS shell rather than a subshell: `hold` records what to put back in a
# variable, and a subshell would take that record with it — leaving every
# mutation applied and every later one reading a tree several defects deep.

# Record a tracked file as one `restore` must put back. It no longer COPIES —
# see `restore` — so this is the whole of the obligation. Each mutation helper
# discharges it; `impostor` is the one that does not, because it CREATES rather
# than edits and the `git clean` in `restore` is what takes that back.
hold() {
  touched="$touched $1"
}

# APPEND ONE LINE to a tracked file — which is what twelve of the fifteen
# mutations are, because an import is a line and that is the whole of how these
# defects get in.
append() {
  hold "$1"
  printf '\n%s\n' "$2" >> "$1"
}

# ...and the three that are not an appended line.
declare_dep() {
  hold "$1/package.json"
  jq --arg n "$2" '.dependencies[$n] = "workspace:*"' "$1/package.json" > "$1/package.json.tmp"
  mv "$1/package.json.tmp" "$1/package.json"
}

impostor() {
  mkdir -p "$container/impostor"
  echo '{ "name": "@olai/impostor", "version": "0.1.0", "private": true }' \
    > "$container/impostor/package.json"
}

unname_the_seam() {
  seam=$(grep -rl 'connectSurfaces(' --include='*.ts' packages | sort | head -1)
  # A DISCOVERY STEP NEEDS A FAILURE ARM. `grep` matching nothing is exactly the
  # event this mutation exists to detect, and the pipeline's status is `head`'s,
  # so `set -e` does not see it: `seam=""` would reach `git checkout -- ""` and
  # die mid-run with a git error rather than this script's own words.
  [ -n "$seam" ] || {
    echo "prove-fence: nothing calls connectSurfaces( — mutation 15 has no subject" >&2
    exit 1
  }
  hold "$seam"
  sed -i 's/connectSurfaces(/connectSurfacesByHand(/' "$seam"
}

only=${*:-}
passed=0
failed=0
unnamed=0

# THE MUTATION NUMBERS, spelled once, and checked BEFORE anything runs. It used
# to accumulate as `run` executed and be checked at the END, so
# `prove-fence.sh 5 99` paid a baseline and a mutation before saying the 99 was
# a typo. The set is static; the check can be too. And a selector that named no
# mutation used to print `0 of 0 mutations were caught.` and exit 0, which is
# this script's own indictment of the lints reproduced on its one argument.
#
# FOUR IS NOT IN IT, and its absence is the same argument one step on. Mutation
# 4 was retired with the claim it was about (a plugin importing another plugin),
# and it was dropped from the `run` calls below — but not from here, so
# `prove-fence.sh 4` selected a mutation that does not exist, ran nothing, and
# exited 0. A selector that names no mutation printing a clean pass is exactly
# the failure this list was made static to prevent, and it was doing it for one
# number.
DECLARED="1 2 3 5 6 7 8 9 10 11 12 13 14 15 16 17"
for want in $only; do
  case " $DECLARED " in
    *" $want "*) ;;
    *) echo "prove-fence: no mutation $want — declared: $DECLARED" >&2; exit 1 ;;
  esac
done

# THE BASELINE, and the whole verdict rests on it. Every judgement below is
# "the suite went red when I broke the tree" — which says nothing unless the
# suite was GREEN before. Without this, a package that is already failing (a
# stale `node_modules`, a half-finished edit, an unrelated red test) makes all
# fifteen mutations look caught, and the falsifier reports a fence that is
# holding while nothing at all is being tested. It is the same defect the script
# exists to find in the lints, read from the other side: red by not running.
printf 'baseline: %s ... ' "$registry"
if bun test "$registry" >/dev/null 2>&1; then
  echo "green"
  echo
else
  echo "RED"
  echo "prove-fence: the suite is not green on an unmutated tree, so nothing below" >&2
  echo "  would mean anything. Fix that first:  bun test $registry" >&2
  exit 1
fi

# run <n> <what should go red> <command…> — the mutation is the rest of the argv.
# run <n> <what should go red> <the claim that must say so> <command…>
#
# THE THIRD ARGUMENT IS THE POINT. A mutation is not "caught" because the suite
# went red — it is caught because THE CLAIM IT NAMES refused it. Counting any
# `(fail)` line was the scorer's last hole and both reviewers found it: mutation
# 7, 8 and 10 evaluate a plugin's `./server` live through `kinds.test.ts`, so a
# load error there that happened to print some other claim's failure would have
# minted a catch, and the attribution was left for a human to read off `head -4`.
#
# The expectation is a `grep -E` alternation, so a mutation that legitimately
# trips more than one claim can name the ones it is ABOUT. What it may not do is
# trip a different claim and still count.
#
# This also subsumes the old third verdict rather than sitting beside it: "no
# claim named it at all" is the case where the expectation matched nothing,
# which is the same question asked once. The two are still REPORTED apart,
# because "the suite died" and "a different claim refused it" send a reader to
# different places.
run() {
  n=$1
  what=$2
  expect=$3
  shift 3
  if [ -n "$only" ]; then
    case " $only " in *" $n "*) ;; *) return 0 ;; esac
  fi
  printf '%2s. %s\n' "$n" "$what"
  "$@"
  # The WHOLE package, not one file: a mutation that took a claim red by taking
  # the module out of the corpus would be a false pass, and the other tests in
  # there are what notices.
  if out=$(bun test "$registry" 2>&1); then
    echo "      GREEN — THE FENCE DID NOT SEE IT"
    failed=$((failed + 1))
  else
    said=$(printf '%s' "$out" | sed -n 's/^(fail) //p' | sed 's/ \[[0-9.]*ms\]$//' | head -4)
    if [ -z "$said" ]; then
      # A mutation that broke module RESOLUTION, or a `bun` that is not there,
      # or an OOM: the suite exited non-zero having asserted nothing, which is
      # the falsifier reproducing the exact failure it was written to detect.
      echo "      RED, BUT NO CLAIM NAMED IT — the suite died rather than refused"
      unnamed=$((unnamed + 1))
    elif printf '%s\n' "$said" | grep -Eq "$expect"; then
      printf '%s\n' "$said" | sed 's/^/      red: /'
      passed=$((passed + 1))
    else
      echo "      RED, BUT NOT BY THE CLAIM IT NAMES — expected /$expect/, got:"
      printf '%s\n' "$said" | sed 's/^/            /'
      unnamed=$((unnamed + 1))
    fi
  fi
  restore
}

# ── the mutations ────────────────────────────────────────────────────────────
#
# One per claim the two lints make, each written as the defect it is about —
# the shape that was actually in this tree before the extraction, or the shape
# the door split exists to prevent.

# A SUBPATH rather than the bare name, deliberately: a claim that matched only
# `olai-plugin-<name>` would be green under the door a consumer would actually
# reach for. `./server` rather than `./wire`, because every plugin has one and
# an ENGINE has no `./wire` at all — `plugin_a` is alphabetically an engine now.
run 1 "a general package IMPORTS a plugin" \
  'outside the registry imports a plugin' \
  append "$general_src" "import \"$name_a/server\""

run 2 "a general package DECLARES a plugin in its manifest" \
  'declares a plugin in its manifest' \
  declare_dep "$general" "$name_a"

# THE DIRECTION MUTATION goes in the BROWSER half rather than in `./wire`, and
# the reason has changed with the doors. It used to be that `fence.test.ts`
# imported `./surfaces.ts`, which imported every plugin's `./wire`, so a cycle
# put there was refused by the module loader before a single claim ran and the
# proof read "red" without any claim having seen it. There is no `surfaces.ts`
# — but the suite still LOADS each plugin's server half (`serverHalves`, which
# imports by the row's own name), and a server half re-exports its `./wire`.
# `src/browser.tsx` is on the browser graph, which nothing in the registry
# imports at all now: the root door names that module in a dynamic `import()`
# and the walk records it without following it. So a defect there is caught by
# the sweep and NAMED by it, which is exactly what this mutation has to prove.
run 3 "a plugin imports the REGISTRY back (the cycle)" \
  'a plugin does not import the registry' \
  append "$plugin_a/src/browser.tsx" "import \"$registry_name\""

# MUTATION 4 IS GONE, and its absence is a ruling rather than a gap. It was "a
# plugin imports ANOTHER plugin", aimed at a claim the Cordis proposal
# overturned: `needs` is the dependency arm and it is REACTIVE, so the
# half-wired state the ban feared is `waiting` — a legitimate, inspectable state
# the runtime resolves or reports. A mutation kept against a retired claim would
# score `GREEN — THE FENCE DID NOT SEE IT` for ever, which is a harness accusing
# a lint of missing something nobody asked it to look for.
#
# What the ban PROTECTED is mutation 10's: an appliance's TIER stays inside its
# tenant, so a plugin that reached into another's `./server` drags that
# appliance's client onto its own graph and goes red there. The protection
# moved; it did not leave.

# MUTATIONS 5 AND 6 WERE ONE DOOR AND ARE NOW TWO, and the split is the whole
# story of what this PR did to the fence.
#
# There used to be a `./wire` door: `@olai/bundle` exported a subpath that
# statically imported every plugin's own `./wire`, and one confinement list was
# walked over it. That list forbade five things for TWO different reasons held
# in one place — `solid-js` because a SERVER read that door, and `@olai/format`,
# `node:` builtins and every appliance's client because a BROWSER read it too.
# One graph, two audiences, one list; which entry was there for which reader was
# a thing you had to know rather than a thing the file said.
#
# The door is gone. The browser now fetches each plugin's `./browser` as its own
# dynamic-import chunk, so the two audiences no longer share a graph — and the
# old list came apart along the seam it always had:
#
#   - THE SERVER HALF SURVIVED WHERE IT STOOD. A plugin's `./server` re-exports
#     its own `./wire`, so `./wire` is still on the server's graph and a UI
#     runtime put there is still refused — by `NOT_ON_A_SERVER`, through the
#     server door, rather than by a wire door that no longer exists. Mutation 5
#     keeps its edit unchanged for exactly that reason: the DEFECT is the same
#     defect, reached by the same line; only the claim that answers it has a new
#     address, and a mutation that named the old one scored
#     `RED, BUT NOT BY THE CLAIM IT NAMES` — red for the right reason, counted
#     as a miss, which is the harness accusing a lint that was doing its job.
#
#   - THE BROWSER HALF MOVED TO THE CHUNK. What a tab may not carry is now held
#     over each plugin's `./browser` by `NOT_IN_A_TAB`, and mutation 6 follows
#     it there. Its old subject stopped being a defect: `@olai/format` on a
#     plugin's `./wire` is legal twice over — the server may read the vault's
#     format, and the tab may too, because odu's chip spends those file-kind
#     words to say what a run is about. So the mutation is re-aimed at the entry
#     that DID survive and is sharpest: a `node:` builtin, which no bundler can
#     satisfy for a browser and which fails in the reader's tab rather than at
#     any build step. This mutation is also why that list exists at all — it
#     went GREEN against the tree that had no browser-chunk claim, which is the
#     second time this harness has written a line of `fence.test.ts`.

run 5 "a plugin's WIRE pulls a UI runtime, and its SERVER re-exports it" \
  'UI runtime or a component library' \
  append "$tenant_a/src/wire.ts" 'import "solid-js"'

run 6 "a plugin's BROWSER CHUNK pulls a node: builtin" \
  'builtin or an appliance' \
  append "$plugin_b/src/browser.tsx" 'import "node:fs"'

run 7 "the SERVER door pulls an emulator" \
  'UI runtime or a component library' \
  append "$plugin_a/src/server.ts" 'import "@xterm/xterm"'

run 8 "the SERVER door pulls a COMPONENT (the .tsx claim)" \
  'no file on it is a component at all' \
  append "$plugin_b/src/server.ts" 'import "./browser/Mark.tsx"'

run 9 "a general package names an appliance's PRODUCT TIER" \
  'outside a tenant names a hydrated specifier' \
  append "$general_src" 'import "@kolu/padi-client"'

run 10 "one tenant names the OTHER appliance's tier" \
  'no tenant names another appliance' \
  append "$other_dial" 'import "@kolu/padi-client"'

run 11 "a general package SPELLS a plugin's name in code" \
  "outside the registry and the plugin's own tenant spells it" \
  append "$general_src" 'export const koluHalf = () => null'

run 12 "a general package reaches a plugin's SHEET (the CSS grammar)" \
  'outside the registry imports a plugin' \
  append "$sheet" "@import \"$name_a/all.css\";"

# ONE DIRECTION of an equality, and the other is not mutated here: moving a
# plugin OUT of the container is a directory move, which breaks module
# resolution before a claim can speak and would read as "red, but no claim
# named it". The assertion is a set equality, so the same line holds both ways;
# what this proves is that the line is not vacuous.
run 13 "a package that is not a plugin sits IN the tenant container" \
  'lives in it, and nothing else does' \
  impostor

run 14 "a wire MECHANIC the framework performs comes back" \
  'calls a wire mechanic the framework performs' \
  append "$general_src" 'export const again = () => fuseGroups({})'

run 15 "the turnkey SEAM stops being called" \
  'the seam that performs them is called, exactly once' \
  unname_the_seam

# THE ENGINE, REACHED DIRECTLY. The human's ruling is that Cordis is an engine
# nobody outside one package sees, and the whole of phase 4 rests on it: a plugin
# is an Effect, `needs` is the requirement channel, and the translation lives in
# one package. A plugin that imports `cordis` to type its own `apply` again is
# exactly the shape that ruling forbids, and it is the shape the tree HAD.
#
# The SERVER half rather than the browser one, because that is where the import
# was: `import type { Context } from "cordis"` above every plugin's `apply`.
run 16 "a plugin imports the ENGINE directly" \
  'an engine nobody outside one package sees' \
  append "$plugin_a/src/server.ts" 'import "cordis"'

# AN ACP ENGINE'S NAME, SPELLED IN A GENERAL PACKAGE. The agents phase turned
# `claude`, `opencode` and `pi` into plugins, and claim 8 covers them the way it
# covers a tenant — but the ENGINE names are the ones with collisions in
# ordinary English, so the claim carries two recorded exceptions
# (`fence.test.ts`'s `NOT_A_PLUGIN`: the vault's own `prop:agent=claude-opus`
# worked example, and `Math.PI`). A recorded exception is a place a claim can
# quietly widen, so the engine gets its own mutation rather than resting on
# mutation 11's tenant.
#
# `packages/server` is where this defect historically WAS in its other form: the
# composition root held the roster and the composition root named the agents.
run 17 "a general package SPELLS AN ENGINE'S name in code" \
  "outside the registry and the plugin's own tenant spells it" \
  append "$general_src" 'export const claudeSeat = () => null'

echo
echo "$passed of $((passed + failed + unnamed)) mutations were caught."
[ "$unnamed" -eq 0 ] || echo "$unnamed went red without the claim it names, which is not a catch." >&2
[ "$failed" -eq 0 ] && [ "$unnamed" -eq 0 ] || exit 1
