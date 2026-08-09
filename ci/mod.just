# olai's CI pipeline — consumed by odu (github.com/juspay/odu).
#
# odu discovers the recipe tagged [metadata("ci")] (exactly one across this
# justfile and its submodules), expands its reachable dependency subgraph, and
# fans every (recipe × platform) pair out as a pipeline node run with
# `just --no-deps`. The platforms come from odu's own --platform/--host
# arguments (.github/workflows/ci.yml), not from this file.
#
# Every body here is one line, and deliberately: the commands live in the root
# justfile, and this file adds only what is CI's own — the ordering. Today the
# DAG is the same set of legs as `just check`. `--no-deps` because odu has
# already run the dependency nodes.

set working-directory := '..'

# Re-enter the flake devShell when a lane lacks bun/just on PATH. Skipped when
# already inside the shell (`just ci` under direnv / nix develop).
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop --accept-flake-config -c' }

# Pipeline root: every recipe listed here becomes a (recipe × platform) node.
# The OS tags declare the lane set this pipeline is meant to run on; nothing
# below is OS-scoped, so they prune nothing today.
[linux]
[macos]
[parallel]
[metadata("ci")]
default: typecheck test kolu-deps fmt-check nix bun-nix-fresh

# One bun install + kolu hydrate per lane — the node every bun leg depends on,
# so they never race on the same node_modules.
install:
    {{ nix_shell }} just install

typecheck: install
    {{ nix_shell }} just --no-deps typecheck

test: install
    {{ nix_shell }} just --no-deps test

kolu-deps: install
    {{ nix_shell }} just --no-deps kolu-deps

fmt-check:
    {{ nix_shell }} just --no-deps fmt-check

# Builds and runs the binary — needs no node_modules of its own, so it is not
# behind `install`.
nix:
    {{ nix_shell }} just --no-deps nix

bun-nix-fresh:
    {{ nix_shell }} just --no-deps bun-nix-fresh
