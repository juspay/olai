# olai CI pipeline — consumed by odu (github.com/juspay/odu).
#
# The runner discovers the recipe tagged [metadata("ci")] (exactly one across
# this justfile and its submodules), expands its reachable dependency subgraph,
# and fans every (recipe × platform) pair out as a pipeline node. Local
# equivalent: `just ci`. Matches .github/workflows/ci.yml:
#   nix build + binary smoke + unit tests + integration tests.
#
# build is a single shared node (install + raco setup): concurrent raco pkg
# install races on LOCKpkgs.rktd, and tests need coherent .zo (docs/hacking.md).
# odu runs each node with --no-deps, so bodies below call raco test directly.

set working-directory := '..'

# Re-enter the flake devShell when a remote odu lane lacks racket/just on PATH.
# Skipped when already inside the shell (GHA `nix develop -c just ci`, direnv).
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop --accept-flake-config -c' }

# Pipeline root: every recipe listed here becomes a (recipe × platform) node.
# smoke waits on nix; tests wait on build; nix ‖ build, then fan-out.
[linux]
[macos]
[parallel]
[metadata("ci")]
default: smoke test test-integration

# One install + raco setup per lane — funnel every racket test through this.
build:
    {{ nix_shell }} just build

# Package the CLI. Leaves ./result for smoke (gitignored).
nix:
    nix build -L

# Packaged binary can load and check committed outlines.
smoke: nix
    ./result/bin/olai check examples/Example.rkt Roadmap.rkt

# Unit tests: in-process (olai/tests/*.rkt).
test: build
    {{ nix_shell }} raco test -j {{ num_cpus() }} olai/tests/*.rkt

# Integration tests: subprocess CLI + real servers (olai/tests/integration/).
test-integration: build
    {{ nix_shell }} raco test -j {{ num_cpus() }} olai/tests/integration/
