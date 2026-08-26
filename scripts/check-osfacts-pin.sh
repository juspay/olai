#!/usr/bin/env sh
# THE SECOND PIN AND THE FIRST ARE A PAIR, and this is the check that keeps
# them one.
#
# `osfacts-client` is in `@kolu/padi-client`'s hydrate closure — the supervisor
# the dial reaches states its `ReadSocketHolders` seam in that package's
# vocabulary — and it is NOT in the kolu tree: kolu grafts it from its own
# npins pin of `juspay/osfacts` and gitignores it. So a consumer grafts it the
# same way (nix/kolu.nix's `members`, and kolu's `padi-client/README.md` under
# "The second pin"), which leaves this repo holding TWO revisions that have to
# agree and nothing mechanical holding them together.
#
# WHAT GOES WRONG WITHOUT IT is quiet: re-pin kolu, forget osfacts, and olai
# compiles the supervisor's `import type { OsfactsClientError }` against an
# older or newer client than the one kolu was built and tested against. It
# would typecheck right up until a field moved.
#
# The rule: OLAI'S OSFACTS REVISION IS WHATEVER THE PINNED KOLU'S OWN NPINS
# SAYS. kolu is the source of truth because kolu is what pairs them — this is
# the same discipline `check-kolu-deps.sh` keeps for the npm versions, read out
# of the pinned sources rather than remembered by hand.
#
# THIS FILE EXISTS BECAUSE A COMMENT CLAIMED IT DID. `nix/kolu.nix` said the
# pairing was "checked rather than kept by hand" while nothing checked it, and
# a reviewer read the sentence and marked the axis a pass. A comment that
# describes a guard is a guard's worst substitute: it earns the trust without
# doing the work.
set -eu

root=$(git rev-parse --show-toplevel)
cd "$root"

# The pinned kolu's own tree, realized by the same npins expression every other
# consumer of the pin uses — so this reads the kolu that will actually be
# hydrated, never a fresh fetch of a branch.
kolu=$(nix eval --raw --impure --expr '(import ./npins).kolu' --accept-flake-config)

theirs=$(jq -r '.pins.osfacts.revision' "$kolu/npins/sources.json")
ours=$(jq -r '.pins.osfacts.revision' npins/sources.json)

if [ "$theirs" = "null" ] || [ -z "$theirs" ]; then
  echo "check-osfacts-pin: the pinned kolu has no \`osfacts\` pin." >&2
  echo "If padi-client stopped needing osfacts-client, drop olai's pin and the" >&2
  echo "\`osfacts-client\` member in nix/kolu.nix — and delete this check with them." >&2
  exit 1
fi

if [ "$theirs" != "$ours" ]; then
  echo "check-osfacts-pin: the two pins have drifted." >&2
  echo "  kolu pins osfacts at: $theirs" >&2
  echo "  olai pins osfacts at: $ours" >&2
  echo "" >&2
  echo "olai hydrates \`osfacts-client\` from ITS pin and compiles it against the" >&2
  echo "supervisor from KOLU's, so the two must be one revision. Move olai's to" >&2
  echo "match (npins/sources.json's \`osfacts\` entry), which is what re-pinning" >&2
  echo "kolu always owes." >&2
  exit 1
fi

echo "check-osfacts-pin: olai and the pinned kolu agree on osfacts ($ours)"
