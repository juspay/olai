# olai developer recipes. `just check` is the gate; CI (ci/mod.just) runs the
# same legs, fanned out per platform.

# Re-enter the flake devShell unless already inside one. git+file:// (just's
# default for a path) keeps nix's eval cache warm — new .nix files must be
# `git add`ed before nix develop sees them.
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop ' + justfile_directory() + ' -c' }

mod ci 'ci/mod.just'

# List available recipes
default:
    @just --list

# Install deps (bun) and hydrate the @kolu/* sources from the npins kolu pin.
# The hydrate call is wrapped in `sh -c '...'` so $OLAI_KOLU_* expand inside
# the dev shell that exports them, rather than in just's own shell (which
# runs under `set -u` and would error on the unset names outside direnv).
install:
    {{ nix_shell }} bun install --frozen-lockfile
    {{ nix_shell }} sh -c 'sh scripts/hydrate-kolu-packages.sh \
      "$OLAI_KOLU_SURFACE" @kolu/surface \
      "$OLAI_KOLU_LOG" @kolu/log'

# TypeScript type checking (every workspace member)
typecheck: install
    {{ nix_shell }} bun run typecheck

# Unit tests
test: install
    {{ nix_shell }} bun test

# The *.nix files this repo owns: every tracked one except npins/default.nix,
# which npins generates and rewrites on every `npins update`.
nix_files := "$(git ls-files '*.nix' ':!:npins/default.nix')"

# Format the *.nix files
fmt:
    {{ nix_shell }} nixpkgs-fmt {{ nix_files }}

# Check formatting without modifying
fmt-check:
    {{ nix_shell }} nixpkgs-fmt --check {{ nix_files }}

# The gate: everything CI runs, in one command
check: typecheck test fmt-check

# Update the kolu / nixpkgs pins. Re-pinning kolu means re-reading its
# `effect` version into package.json's overrides (see the note there).
update-pins:
    {{ nix_shell }} npins update
