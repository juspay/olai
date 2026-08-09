# olai developer recipes.
#
# `just check` is the gate AND the CI pipeline: it carries the
# [metadata("ci")] tag, so odu (github.com/juspay/odu) discovers it, expands
# its dependency subgraph, and fans every (recipe × platform) pair out as a
# node it runs with `just --no-deps <recipe>`. There is no GitHub Actions
# workflow and no separate CI justfile — one list of legs, run the same way on
# a laptop and on a lane, and no second graph to keep in sync with this one.

# Re-enter the flake devShell unless already inside one. nix resolves a path
# inside a git work tree to a `git+file://` flakeref, which keeps its eval
# cache warm — and means only *tracked* files are visible, so a new .nix file
# must be `git add`ed before `nix develop` sees it.
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + justfile_directory() + ' --accept-flake-config -c' }

# The *.nix files this repo owns — all of them. Generated files are normalized
# by the recipe that generates them (`regenerate-bun-nix`, `update-pins`),
# never exempted here. `git ls-files` rather than `.` so node_modules and
# .direnv stay out.
nix_files := "$(git ls-files '*.nix')"

# List available recipes
default:
    @just --list

# The gate, and the CI pipeline. Bodyless on purpose: odu runs each dependency
# as its own node, so anything written here would run nowhere.
[linux]
[macos]
[parallel]
[metadata("ci")]
check: typecheck test kolu-deps fmt-check nix bun-nix-fresh

# Install deps (bun) and hydrate the @kolu/* sources from the npins kolu pin.
# Every bun leg depends on this one recipe, so concurrent legs share a single
# install rather than racing on node_modules.
#
# The hydrate call is wrapped in `sh -c '...'` so $OLAI_KOLU_HYDRATE expands
# inside the dev shell that exports it, not in just's own shell (which runs
# under `set -u`). It is a whole argv — nix/kolu.nix derives it from one list
# — so the expansion is deliberately unquoted.
install:
    {{ nix_shell }} sh -c 'bun install --frozen-lockfile \
      && sh scripts/hydrate-kolu-packages.sh $OLAI_KOLU_HYDRATE'

# TypeScript type checking — every workspace member, from the glob bun
# installs from
typecheck: install
    {{ nix_shell }} bun run typecheck

# Unit tests
test: install
    {{ nix_shell }} bun test

# Every dependency the hydrated @kolu/* sources declare, checked against the
# root package.json (bunfig.toml explains why they have to be there). Reads
# the pinned sources in the store and this repo's manifests, never
# node_modules — so it does not wait on `install` and fails fast.
kolu-deps:
    {{ nix_shell }} sh -c 'sh scripts/check-kolu-deps.sh $OLAI_KOLU_DIRS'

# Run olai from the working tree — the edit loop. Bun executes the sources you
# are editing, against the dev shell's node_modules. `just nix` is the other
# path: the packaged binary, built from tracked files only. Use this one while
# working; that one is what CI proves.
run *args: install
    {{ nix_shell }} bun packages/core/src/main.ts {{ args }}

# Build the binary with nix, then run it. Both halves earn their place: the
# build is where the hydrated @kolu/* sources and the bun.nix-derived
# node_modules meet outside the dev shell, and running it is what proves that
# tree's module graph resolves — a typecheck cannot, because the dev tree has
# packages the build's does not. The run re-uses the build's output (it
# re-evaluates the flake, which is cheap and warm). No nix_shell prefix: this
# recipe IS the outside-the-shell check.
nix:
    nix build .#olai --no-link --accept-flake-config
    nix run .#olai --accept-flake-config

# Format the *.nix files
fmt:
    {{ nix_shell }} nixpkgs-fmt {{ nix_files }}

# Check formatting without modifying
fmt-check:
    {{ nix_shell }} nixpkgs-fmt --check {{ nix_files }}

# One spelling of "derive bun.nix from bun.lock", so the freshness check below
# and the regeneration cannot drift apart.
[private]
_gen-bun-nix out:
    {{ nix_shell }} sh -c 'nix run .#bun2nix --accept-flake-config -- -l bun.lock -o "{{ out }}" && nixpkgs-fmt "{{ out }}"'

# Regenerate bun.nix from bun.lock. Run after any `bun install` / `bun add`.
regenerate-bun-nix: (_gen-bun-nix "bun.nix")

# bun.nix drives the nix build's dependency fetch and is generated from
# bun.lock, so a lockfile change without a regen makes `nix build` install a
# different tree than `bun install` does — silently. It generates into a
# tmpdir rather than in place because `check` runs its legs in parallel, and a
# leg that rewrote a tracked file would race the ones reading it.
bun-nix-fresh:
    #!/usr/bin/env bash
    set -euo pipefail
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    just _gen-bun-nix "$tmp/bun.nix"
    diff -u bun.nix "$tmp/bun.nix" || {
      echo
      echo "bun.nix is stale relative to bun.lock."
      echo "Run: just regenerate-bun-nix && git add bun.nix"
      exit 1
    }

# Update the kolu / nixpkgs pins. npins rewrites npins/default.nix in its own
# formatter's style, so normalize it here — same rule as bun.nix, and the
# reason fmt-check needs no exception list. `just check` then names anything
# the new kolu revision expects that this repo has not moved with it.
update-pins:
    {{ nix_shell }} sh -c 'npins update && nixpkgs-fmt npins/default.nix'
