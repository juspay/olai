#!/usr/bin/env sh
# Materialize kolu workspace package sources into ./node_modules/@kolu/<name>.
#
# Usage: hydrate-kolu-packages.sh <src1> <dest1> [<src2> <dest2> ...]
#
# Each (src, dest) pair: copy <src> to ./node_modules/<dest>. Callers
# (the justfile install recipe and the build derivation) pass the
# npins-derived /nix/store paths and the @kolu/<name> destination.
#
# cp -rL (not symlink) because TypeScript resolves transitive imports
# from the *real* file location: a symlink whose target sits in /nix/store
# has no adjacent node_modules, so @orpc/contract / zod can't be found
# from surface's source. Copying lets resolution walk up to the consumer's
# own hoisted node_modules where those packages live. (The drishti
# pattern, verbatim — see github.com/srid/drishti.)
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
