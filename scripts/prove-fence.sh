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

# THE PLUGINS: what the registry DECLARES. Not a shape test — `@olai/plugin-api`
# opens `./wire`, `./server` and `./all.css` too, because it MIRRORS the doors
# it composes, so a signature match would have called the interface a tenant and
# quietly aimed half these mutations at the wrong package. The registry is the
# one package allowed to name a plugin, so its dependency list IS the roster.
plugins=$(
  for name in $(jq -r '.dependencies | keys[]' "$registry/package.json"); do
    for m in $members; do
      if [ "$(jq -r .name "$m/package.json")" = "$name" ] && [ "$m" != "$registry" ]; then
        echo "$m"
      fi
    done
  done
)
plugin_a=$(echo "$plugins" | sed -n 1p)
plugin_b=$(echo "$plugins" | sed -n 2p)
name_a=$(jq -r .name "$plugin_a/package.json")
name_b=$(jq -r .name "$plugin_b/package.json")
registry_name=$(jq -r .name "$registry/package.json")

# THE CONTAINER, derived from where a tenant lives rather than typed — so
# mutation 13's impostor lands beside the plugins on this tree and beside the
# packages on a tree from before the fold, which is what "the same script means
# the same thing on both" has to mean for the one mutation that is ABOUT the
# fold.
container=$(dirname "$plugin_a")

# ...and the roster HELD TO IT. The loop above answers "every workspace member
# the registry declares", which is the tenants today and is not the same
# question: the day the registry declares any other workspace sibling, `jq -r
# keys[]` sorts `@olai/…` ahead of `olai-plugin-…` and `plugin_a` silently
# becomes that package, aiming every mutation at the wrong files. The container
# guard below catches that by accident of arithmetic; this catches it on purpose.
plugins=$(for m in $plugins; do if [ "$(dirname "$m")" = "$container" ]; then echo "$m"; fi; done)
plugin_a=$(echo "$plugins" | sed -n 1p)
plugin_b=$(echo "$plugins" | sed -n 2p)

# ...and THREE PATHS THAT ARE TYPED, which the header's "derived" is about the
# registry and the plugins rather than about these. Each is chosen rather than
# computed, on purpose: `packages/server` is the composition root, which is
# where every one of these defects historically WAS; `styles.css` is the app's
# one sheet, which is the grammar a TypeScript reading is blind to; and
# `odu-client` is the SECOND appliance's dial, which is the only way to write
# the cross-tenant mutation. A derived "first member that is neither registry
# nor plugin" would pick alphabetically and mean nothing. The guard below is
# what keeps a typed path from becoming a silent skip.
general=packages/server
general_src=$general/src/main.ts
sheet=packages/web/src/client/styles.css
other_dial=packages/odu-client/src/index.ts

[ -n "$plugin_b" ] || { echo "prove-fence: fewer than two plugins found" >&2; exit 1; }
case "$plugins" in *"$registry"*) echo "prove-fence: the registry came back as a plugin" >&2; exit 1 ;; esac
# EVERY PATH A MUTATION TOUCHES, not just the roots they are derived from. Five
# mutations reach `$plugin_x/src/<file>` and mutation 8 reaches a browser
# directory the architecture explicitly contemplates a tenant not having ("odu
# has no `-ui` sibling and needs none"). Without these, a missing one dies
# mid-run on `cp`/`sed` rather than here, with this block's own diagnostic.
for path in "$registry" "$plugin_a" "$plugin_b" "$general_src" "$sheet" "$other_dial" \
  "$container" "$plugin_a/src/plugin.ts" "$plugin_a/src/wire.ts" "$plugin_b/src/wire.ts" \
  "$plugin_a/src/server.ts" "$plugin_b/src/server.ts" "$plugin_b/src/browser/mount.tsx"; do
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
echo "plugins  : $plugin_a ($name_a), $plugin_b ($name_b)"
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

# Remember a file, so the trap can put it back however this exits.
# Record a tracked file as one `restore` must put back. It no longer COPIES —
# see `restore` — so this is the whole of the obligation, and `run` discharges
# it rather than each mutation remembering to.
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
declared=""

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
run() {
  n=$1
  what=$2
  shift 2
  declared="$declared $n"
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
    # WHICH claim went red, and a red with no claim behind it is a THIRD verdict
    # rather than a pass. A mutation that broke module RESOLUTION, or a `bun`
    # that is not there, or an OOM, makes the suite exit non-zero having asserted
    # nothing — and counting that as "the fence caught it" is the falsifier
    # reproducing, in itself, the exact failure it was written to detect. A
    # mutation may legitimately trip more than one claim; what it may not do is
    # trip none and still be scored.
    said=$(printf '%s' "$out" | sed -n 's/^(fail) //p' | sed 's/ \[[0-9.]*ms\]$//' | head -4)
    if [ -n "$said" ]; then
      printf '%s\n' "$said" | sed 's/^/      red: /'
      passed=$((passed + 1))
    else
      echo "      RED, BUT NO CLAIM NAMED IT — the suite died rather than refused"
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

run 1 "a general package IMPORTS a plugin" \
  append "$general_src" "import \"$name_a/wire\""

run 2 "a general package DECLARES a plugin in its manifest" \
  declare_dep "$general" "$name_a"

# The two DIRECTION mutations go in the manifest module rather than in `./wire`,
# and the reason is worth reading: `fence.test.ts` IMPORTS `./surfaces.ts`,
# which imports every plugin's `./wire` — so a cycle put there is refused by the
# module loader before a single claim runs, and the proof would read "red"
# without any claim having seen it. `src/plugin.ts` is on the browser graph,
# which no test in the registry imports (that is the whole reason
# `rosters.test.ts` reads its three rosters as TEXT), so a defect there is
# caught by the sweep and NAMED by it.
run 3 "a plugin imports the REGISTRY back (the cycle)" \
  append "$plugin_a/src/plugin.ts" "import \"$registry_name\""

run 4 "a plugin imports ANOTHER plugin" \
  append "$plugin_a/src/plugin.ts" "import \"$name_b/wire\""

run 5 "the WIRE door pulls a UI runtime onto the server's graph" \
  append "$plugin_a/src/wire.ts" 'import "solid-js"'

run 6 "the WIRE door pulls the vault's format" \
  append "$plugin_b/src/wire.ts" 'import "@olai/format"'

run 7 "the SERVER door pulls an emulator" \
  append "$plugin_a/src/server.ts" 'import "@xterm/xterm"'

run 8 "the SERVER door pulls a COMPONENT (the .tsx claim)" \
  append "$plugin_b/src/server.ts" 'import "./browser/mount.tsx"'

run 9 "a general package names an appliance's PRODUCT TIER" \
  append "$general_src" 'import "@kolu/padi-client"'

run 10 "one tenant names the OTHER appliance's tier" \
  append "$other_dial" 'import "@kolu/padi-client"'

run 11 "a general package SPELLS a plugin's name in code" \
  append "$general_src" 'export const koluHalf = () => null'

run 12 "a general package reaches a plugin's SHEET (the CSS grammar)" \
  append "$sheet" "@import \"$name_a/all.css\";"

# ONE DIRECTION of an equality, and the other is not mutated here: moving a
# plugin OUT of the container is a directory move, which breaks module
# resolution before a claim can speak and would read as "red, but no claim
# named it". The assertion is a set equality, so the same line holds both ways;
# what this proves is that the line is not vacuous.
run 13 "a package that is not a plugin sits IN the tenant container" impostor

run 14 "a wire MECHANIC the framework performs comes back" \
  append "$general_src" 'export const again = () => fuseGroups({})'

run 15 "the turnkey SEAM stops being called" unname_the_seam
# A SELECTOR THAT NAMED NO MUTATION IS A REFUSAL, not a quiet run of nothing.
# `sh scripts/prove-fence.sh 16` used to match nothing, skip all fifteen, and
# print `0 of 0 mutations were caught.` with exit 0 — which is this script's own
# indictment of the lints ("a sweep's one failure mode is going quiet") reproduced
# on its one CLI argument.
for want in $only; do
  case " $declared " in
    *" $want "*) ;;
    *) echo "prove-fence: no mutation $want — declared:$declared" >&2; exit 1 ;;
  esac
done

echo
echo "$passed of $((passed + failed + unnamed)) mutations were caught."
[ "$unnamed" -eq 0 ] || echo "$unnamed went red with no claim naming it, which is not a catch." >&2
[ "$failed" -eq 0 ] && [ "$unnamed" -eq 0 ] || exit 1
