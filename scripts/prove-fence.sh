#!/bin/sh
# NOT A `just check` LEG, deliberately. Its own half writes to tracked files
# (and puts each one back), so two of them running at once would fight — and
# `check` runs its legs in parallel.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

if [ -n "$(git status --porcelain)" ]; then
  echo "prove-fence: the working tree is dirty." >&2
  echo "Every mutation below edits a tracked file and puts it back; a clean" >&2
  echo "\`git status\` afterwards is how you know the restore worked." >&2
  exit 1
fi

members=$(sh "$root/scripts/workspace-members.sh" "$root")

registry=$(
  for m in $members; do
    if [ -f "$m/src/fence.test.ts" ] && jq -r '.dependencies | keys[]' "$m/package.json" | grep -q '^olai-plugin-'; then
      echo "$m"
    fi
  done
)
case "$registry" in
  *"
"*)
    echo "prove-fence: more than one member holds a fence and declares plugins:" >&2
    echo "$registry" | sed 's/^/  /' >&2
    exit 1
    ;;
esac
[ -n "$registry" ] || { echo "prove-fence: no member both holds src/fence.test.ts and declares plugins" >&2; exit 1; }

names=$(for m in $members; do echo "$m $(jq -r .name "$m/package.json")"; done)
declared_deps=$(jq -r '.dependencies | keys[]' "$registry/package.json")
plugins=$(
  for want in $declared_deps; do
    echo "$names" | while read -r m mname; do
      if [ "$mname" = "$want" ] && [ "$m" != "$registry" ]; then echo "$m"; fi
    done
  done
)
container=$(
  for m in $plugins; do dirname "$m"; done | sort | uniq -c | sort -rn | head -n 1 | awk '{print $2}'
)
plugins=$(for m in $plugins; do if [ "$(dirname "$m")" = "$container" ]; then echo "$m"; fi; done)
plugin_cands=$(for m in $plugins; do
  if [ -f "$m/src/server.ts" ] && [ -f "$m/src/browser.tsx" ]; then echo "$m"; fi
done)
plugin_a=$(echo "$plugin_cands" | sed -n 1p)
plugin_b=$(echo "$plugin_cands" | sed -n 2p)
tenant_a=$(for m in $plugins; do if [ -f "$m/src/wire.ts" ]; then echo "$m"; fi; done | sed -n 1p)
[ -n "$tenant_a" ] || { echo "prove-fence: no plugin composes a sibling surface" >&2; exit 1; }
name_a=$(echo "$names" | awk -v p="$plugin_a" '$1 == p { print $2 }')
name_b=$(echo "$names" | awk -v p="$plugin_b" '$1 == p { print $2 }')
registry_name=$(jq -r .name "$registry/package.json")

general=packages/server
general_src=$general/src/main.ts
sheet=packages/web/src/client/styles.css
other_dial=packages/plugins/odu/src/appliance/index.ts
contract_door=packages/plugins/navigation/src/routes.ts
contract_spec=olai-plugin-navigation/routes

shell_door=packages/web/src/client/run.ts

[ -n "$plugin_b" ] || { echo "prove-fence: fewer than two plugins found" >&2; exit 1; }
case "$plugins" in *"$registry"*) echo "prove-fence: the registry came back as a plugin" >&2; exit 1 ;; esac
component_b=$(find "$plugin_b/src" -name '*.tsx' | sort | sed -n 1p)
[ -n "$component_b" ] || { echo "prove-fence: $plugin_b has no component for mutation 8" >&2; exit 1; }
component_b_spec=./$(printf '%s' "${component_b#"$plugin_b/src/"}")

for path in "$registry" "$plugin_a" "$plugin_b" "$general_src" "$sheet" "$other_dial" \
  "$container" "$plugin_a/src/browser.tsx" "$plugin_b/src/browser.tsx" \
  "$tenant_a/src/wire.ts" "$plugin_a/src/server.ts" "$plugin_b/src/server.ts" \
  "$shell_door" "$contract_door" "$component_b" \
  "default.nix" "justfile" "packages/tests/support/hooks.ts"; do
  [ -e "$path" ] || { echo "prove-fence: derived path $path does not exist" >&2; exit 1; }
done

opens_contract=$(git grep -l "$contract_spec" -- "$container" | grep -v "^$(dirname "$(dirname "$contract_door")")/" | head -1)
[ -n "$opens_contract" ] || {
  echo "prove-fence: no plugin outside its own opens $contract_spec — mutation 19 has no subject" >&2
  exit 1
}

case "$container" in
  packages/*) ;;
  *) echo "prove-fence: the container derived to '$container', which is not under packages/" >&2; exit 1 ;;
esac
[ -d "$container" ] || { echo "prove-fence: the container '$container' is not a directory" >&2; exit 1; }

echo "registry : $registry ($registry_name)"
echo "plugins  : $plugin_a ($name_a), $plugin_b ($name_b); wire door: $tenant_a"
echo

touched=""
restore() {
  [ -n "$touched" ] && git checkout -- $touched
  touched=""
  [ -n "$created" ] && rm -f $created
  created=""
  git clean -fdq "$container" 2>/dev/null || true
}
trap 'restore' EXIT
trap 'restore; trap - INT; kill -INT $$' INT
trap 'restore; trap - TERM; kill -TERM $$' TERM

hold() {
  touched="$touched $1"
}

append() {
  hold "$1"
  printf '\n%s\n' "$2" >> "$1"
}

created=""
behind_door() {
  created="$created $2"
  printf '%s\n' 'let heldByProveFence: unknown
export const holdByProveFence = (value: unknown): void => { heldByProveFence = value }
export const provenCurrent = (): unknown => heldByProveFence' > "$2"
  hold "$1"
  printf '\nexport { holdByProveFence, provenCurrent } from "./%s"\n' "$(basename "$2")" >> "$1"
}

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

DECLARED="1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26"
for want in $only; do
  case " $DECLARED " in
    *" $want "*) ;;
    *) echo "prove-fence: no mutation $want — declared: $DECLARED" >&2; exit 1 ;;
  esac
done

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

printf 'the door: %s ... ' "effect-cordis/fence"
if proof=$(bun -e '
import { prove } from "./packages/effect-cordis/src/fence.ts"
import { DECLARATION } from "./packages/bundle/src/fence.testlib.ts"
const proof = prove(DECLARATION)
for (const one of proof.mutations) {
  const verdict = !one.caught
    ? "GREEN — THE FENCE DID NOT SEE IT"
    : one.spill.length > 0
      ? "CAUGHT, BUT SPILLED"
      : "CAUGHT"
  const spill = one.spill.length > 0 ? ` [also red: ${one.spill.join(", ")}]` : ""
  console.log(`${verdict}  ${one.claim}: ${one.what}${one.why === undefined ? "" : ` (${one.why})`}${spill}`)
}
for (const one of proof.baseline) console.error(`  baseline red: ${one.claim}: ${one.said}`)
// `ok` is "red on EXACTLY that claim": a spill means the proof is not clean, so
// this exits non-zero and the run above is not evidence of anything.
if (!proof.ok) {
  console.error("the proof is not clean: a mutation was not seen, or it coloured another claim")
  process.exit(1)
}
' 2>&1); then
  echo "ok"
  printf '%s\n' "$proof" | sed 's/^/  /'
else
  echo "FAILED"
  printf '%s\n' "$proof" | sed 's/^/  /'
  exit 1
fi
echo

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
  if out=$(bun test "$registry" 2>&1); then
    echo "      GREEN — THE FENCE DID NOT SEE IT"
    failed=$((failed + 1))
  else
    said=$(printf '%s' "$out" | sed -n 's/^(fail) //p' | sed 's/ \[[0-9.]*ms\]$//' | head -4)
    if [ -z "$said" ]; then
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

run 1 "a general package IMPORTS a plugin" \
  'general production packages name no plugins' \
  append "$general_src" "import \"$name_a/server\""

run 2 "a general package DECLARES a plugin in its manifest" \
  'plugin dependencies correspond to static contracts' \
  declare_dep "$general" "$name_a"

run 3 "a plugin imports the REGISTRY back (the cycle)" \
  'generic claims > imports' \
  append "$plugin_a/src/browser.tsx" "import \"$registry_name\""

run 4 "a plugin imports ANOTHER plugin" \
  'plugins consume other plugins only through static contract doors' \
  append "$plugin_a/src/browser.tsx" "import \"$name_b/server\""

run 18 "a plugin DECLARES another plugin in its manifest" \
  'plugin dependencies correspond to static contracts' \
  declare_dep "$plugin_a" "$name_b"

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
  append "$plugin_b/src/server.ts" "import \"$component_b_spec\""

run 9 "a general package names an appliance's PRODUCT TIER" \
  'outside a tenant names a hydrated specifier' \
  append "$general_src" 'import "@kolu/padi-client"'

run 10 "one tenant names the OTHER appliance's tier" \
  'no tenant names another appliance' \
  append "$other_dial" 'import "@kolu/padi-client"'

run 11 "a general package SPELLS a plugin's name in code" \
  'generic claims > names' \
  append "$general_src" 'export const koluHalf = () => null'

run 12 "a general package reaches a plugin's SHEET (the CSS grammar)" \
  'generic claims > imports' \
  append "$sheet" "@import \"$name_a/all.css\";"

run 13 "a package that is not a plugin sits IN the tenant container" \
  'lives in it, and nothing else does' \
  impostor

run 14 "a wire MECHANIC the framework performs comes back" \
  'calls a wire mechanic the framework performs' \
  append "$general_src" 'export const again = () => fuseGroups({})'

run 15 "the turnkey SEAM stops being called" \
  'the seam that performs them is called, exactly once' \
  unname_the_seam

run 16 "a plugin imports the ENGINE directly" \
  'an engine nobody outside one package sees' \
  append "$plugin_a/src/server.ts" 'import "cordis"'

run 19 "a plugin's CONTRACT DOOR holds another activation's value" \
  'generic claims > live-state' \
  append "$contract_door" 'let heldByProveFence: unknown
export const provenCurrent = () => heldByProveFence'

run 20 "the SHELL DOOR every browser half opens holds one" \
  'generic claims > live-state' \
  append "$shell_door" 'let heldByProveFence: unknown
export const provenCurrent = () => heldByProveFence'

run 21 "a CONTRACT DOOR exports one of this tree's own holders, under an alias" \
  'generic claims > live-state' \
  append "$contract_door" 'import { heldService as provenSlot } from "@olai/ui-primitives/held.ts"
export const provenHeld = provenSlot<unknown>()'

run 22 "a SHELL DOOR re-exports a holder from a module BEHIND it" \
  'generic claims > live-state' \
  behind_door "$shell_door" packages/web/src/client/proven-fence-leak.ts

run 23 "a bare path reaches into a plugin's directory" \
  "outside packages/plugins contains the path itself" \
  append "default.nix" "container = ./packages/plugins/odu;"

run 24 "a plugin's knob variable is spelled at the root" \
  "spells a plugin's word" \
  append "justfile" 'export OLAI_ODU_BIN="${OLAI_ODU_BIN:-}"'

run 25 "a plugin's word is a tag literal in the e2e harness" \
  "spells a plugin's word" \
  append "packages/tests/support/hooks.ts" 'const PLANTED = "@pi"'

run 17 "a general package SPELLS AN ENGINE'S name in code" \
  'generic claims > names' \
  append "$general_src" 'export const claudeSeat = () => null'

run 26 "the BROWSER REGISTRY's own door pulls the UI runtime" \
  "nothing on it is a UI runtime, an appliance's client, or the format" \
  append "$registry/src/rows.ts" 'import "solid-js"'

echo
echo "$passed of $((passed + failed + unnamed)) mutations were caught."
[ "$unnamed" -eq 0 ] || echo "$unnamed went red without the claim it names, which is not a catch." >&2
[ "$failed" -eq 0 ] && [ "$unnamed" -eq 0 ] || exit 1
