#!/usr/bin/env sh
# Materialize kolu workspace package sources into ./node_modules/@kolu/<name>.
#
# Copied from juspay/odu's scripts/hydrate-kolu-packages.sh; the body below
# `set -eu` is byte-identical, so fixes can travel between the two repos.
#
# Usage: hydrate-kolu-packages.sh <src1> <dest1> [<src2> <dest2> ...]
#
# Each (src, dest) pair: copy <src> to ./node_modules/<dest>. Two callers, and
# both pass the same argv, derived once in nix/kolu.nix: the justfile `install`
# recipe (as $OLAI_KOLU_HYDRATE) and the build derivation (default.nix).
#
# cp -rL (not symlink) because TypeScript and Bun both resolve transitive
# imports from the *real* file location: a symlink whose target sits in
# /nix/store has no adjacent node_modules, so `effect` and
# @effect/platform-node can't be found from surface's source. Copying lets
# resolution walk up to the consumer's own root node_modules where those
# packages live. (The drishti pattern — see github.com/srid/drishti.)
set -eu

if [ $(( $# % 2 )) -ne 0 ] || [ $# -eq 0 ]; then
  echo "usage: hydrate-kolu-packages.sh <src> <dest> [<src> <dest> ...]" >&2
  exit 1
fi

while [ $# -gt 0 ]; do
  src=$1
  dest=$2
  shift 2
  if [ ! -d "$src" ]; then
    echo "hydrate-kolu-packages.sh: source is not a directory: $src" >&2
    exit 1
  fi
  mkdir -p "node_modules/$(dirname "$dest")"
  if [ -d "node_modules/$dest" ]; then
    chmod -R u+w "node_modules/$dest" 2>/dev/null || true
  fi
  rm -rf "node_modules/$dest"
  cp -rL "$src" "node_modules/$dest"
  chmod -R u+w "node_modules/$dest"
done
