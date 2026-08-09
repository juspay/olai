# olai's CI pipeline — consumed by odu (github.com/juspay/odu).
#
# odu discovers the recipe tagged [metadata("ci")] (exactly one across this
# justfile and its submodules), expands its reachable dependency subgraph, and
# fans every (recipe × platform) pair out as a pipeline node run with
# `just --no-deps`. Local equivalent of the whole DAG: `just check`.
#
# Every body here is one line, and deliberately: the commands live in the root
# justfile, and this file adds only what is CI's own — the ordering (one
# install per lane, then the three legs) and the platform matrix. `--no-deps`
# because odu has already run the dependency nodes.

set working-directory := '..'

# Re-enter the flake devShell when a lane lacks bun/just on PATH. Skipped when
# already inside the shell (`just ci` under direnv / nix develop).
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop -c' }

# Pipeline root: every recipe listed here becomes a (recipe × platform) node.
[linux]
[macos]
[parallel]
[metadata("ci")]
default: typecheck test fmt-check

# One bun install + kolu hydrate per lane — the node the two bun legs share,
# so they never race on the same node_modules.
install:
    {{ nix_shell }} just install

typecheck: install
    {{ nix_shell }} just --no-deps typecheck

test: install
    {{ nix_shell }} just --no-deps test

fmt-check:
    {{ nix_shell }} just --no-deps fmt-check
