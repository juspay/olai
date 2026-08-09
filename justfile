# olai developer recipes. `just check` is the gate; CI (ci/mod.just) runs the
# same legs, fanned out per platform.

# Re-enter the flake devShell unless already inside one. nix resolves a path
# inside a git work tree to a `git+file://` flakeref, which keeps its eval
# cache warm — and means only *tracked* files are visible, so a new .nix file
# must be `git add`ed before `nix develop` sees it.
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + justfile_directory() + ' --accept-flake-config -c' }

# The *.nix files this repo owns: every tracked one except npins/default.nix,
# which npins generates and rewrites on every `npins update`.
nix_files := "$(git ls-files '*.nix' ':!:npins/default.nix')"

mod ci 'ci/mod.just'

# List available recipes
default:
    @just --list

# Install deps (bun) and hydrate the @kolu/* sources from the npins kolu pin.
# The hydrate call is wrapped in `sh -c '...'` so $OLAI_KOLU_HYDRATE expands
# inside the dev shell that exports it, rather than in just's own shell (which
# runs under `set -u` and would error on the unset name outside direnv). It is
# a whole argv (nix/kolu.nix derives it from one list), so the expansion is
# deliberately unquoted.
install:
    {{ nix_shell }} bun install --frozen-lockfile
    {{ nix_shell }} sh -c 'sh scripts/hydrate-kolu-packages.sh $OLAI_KOLU_HYDRATE'

# TypeScript type checking — every workspace member, from the same glob bun
# installs from
typecheck: install
    {{ nix_shell }} bun run typecheck

# Unit tests
test: install
    {{ nix_shell }} bun test

# Build the binary with nix, then run it. Both halves earn their place: the
# build is where the hydrated @kolu/* sources and the bun.nix-derived
# node_modules meet outside the dev shell, and running it is what proves that
# tree's module graph resolves — a typecheck cannot, because the dev tree has
# packages the build's does not. The run re-uses the build's output, so it
# costs nothing. No nix_shell prefix: this recipe IS the outside-the-shell
# check, and every lane has nix or it could not have got here.
nix:
    nix build .#olai --no-link --accept-flake-config
    nix run .#olai --accept-flake-config

# Every dependency the hydrated @kolu/* sources declare, checked against the
# root package.json (see that file's "//dependencies" note)
kolu-deps: install
    {{ nix_shell }} sh -c 'sh scripts/check-kolu-deps.sh $OLAI_KOLU_DIRS'

# Format the *.nix files
fmt:
    {{ nix_shell }} nixpkgs-fmt {{ nix_files }}

# Check formatting without modifying
fmt-check:
    {{ nix_shell }} nixpkgs-fmt --check {{ nix_files }}

# The gate: everything CI runs, in one command
check: typecheck test kolu-deps fmt-check nix bun-nix-fresh

# Regenerate bun.nix from bun.lock. Run after any `bun install` / `bun add`.
regenerate-bun-nix:
    {{ nix_shell }} sh -c 'nix run .#bun2nix --accept-flake-config -- -l bun.lock -o bun.nix && nixpkgs-fmt bun.nix'

# bun.nix drives the nix build's dependency fetch and is generated from
# bun.lock, so a lockfile change without a regen makes `nix build` install a
# different tree than `bun install` does — silently.
bun-nix-fresh:
    {{ nix_shell }} sh -c '\
      set -eu; \
      tmp=$(mktemp -d); \
      trap "rm -rf $tmp" EXIT; \
      nix run .#bun2nix --accept-flake-config -- -l bun.lock -o "$tmp/bun.nix"; \
      nixpkgs-fmt "$tmp/bun.nix" >/dev/null; \
      diff -u bun.nix "$tmp/bun.nix" || { \
        echo; \
        echo "bun.nix is stale relative to bun.lock."; \
        echo "Run: just regenerate-bun-nix && git add bun.nix"; \
        exit 1; \
      }'

# Update the kolu / nixpkgs pins. `just check` then names anything the new
# kolu revision expects that this repo has not moved with it.
update-pins:
    {{ nix_shell }} npins update
