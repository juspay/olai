# olai CI pipeline — consumed by odu (github.com/juspay/odu).
#
# The runner discovers the recipe tagged [metadata("ci")] (exactly one across
# this justfile and its submodules), expands its reachable dependency subgraph,
# and fans every (recipe × platform) pair out as a pipeline node. Local
# equivalent: `just ci`. Full DAG:
#   nix build + binary smoke + unit tests + integration tests + e2e (linux).
#
# build is a single shared node (install + raco setup): concurrent raco pkg
# install races on LOCKpkgs.rktd, and tests need coherent .zo (docs/hacking.md).
# odu runs each node with --no-deps, so bodies below call raco test directly.

set working-directory := '..'

# Re-enter the flake devShell when a remote odu lane lacks racket/just on PATH.
# Skipped when already inside the shell (`just ci` under direnv / nix develop).
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop --accept-flake-config -c' }

# Pipeline root: every recipe listed here becomes a (recipe × platform) node.
# smoke waits on nix; tests wait on build; nix ‖ build, then fan-out.
[linux]
[macos]
[parallel]
[metadata("ci")]
default: smoke test test-integration e2e counters-test counters-nix

# One install + raco setup per lane — funnel every racket test through this.
build:
    {{ nix_shell }} just build

# Package the CLI. Leaves ./result for smoke (gitignored).
nix:
    nix build -L

# Packaged binary can load and check committed outlines.
smoke: nix
    ./result/bin/olai check examples/Example.rkt Roadmap.rkt e2e/fixtures/Tasks.rkt

# Unit tests: in-process (live/tests/ + olai/tests/*.rkt).
test: build
    {{ nix_shell }} raco test -j {{ num_cpus() }} live/tests/*.rkt olai/tests/*.rkt

# Integration tests: subprocess CLI + real servers (olai/tests/integration/).
test-integration: build
    {{ nix_shell }} raco test -j {{ num_cpus() }} olai/tests/integration/

# live/'s example is its own unit, so it gets its own nodes rather than a ride
# in somebody else's. Both bodies are one delegation: the module owns WHAT to
# run (live/examples/counters/mod.just) and this file owns three things that
# are CI's and not the example's — that these are nodes at all, the edge to
# `build` (a body that built for itself would take the package lock while the
# other lanes read .zo), and the devShell a remote lane may lack. `just` is
# also why a body and not a dependency: a module cannot name a sibling
# module's recipe, so the reference has to go back through the root justfile.

# The example's test (live/examples/counters).
counters-test: build
    {{ nix_shell }} just counters::test-run

# The example's derivation: a nix file nobody builds is a nix file that rots.
counters-nix:
    just counters::nix

# Its own devShell (node + the browser), so the prefix here is not nix_shell —
# and its own node in the DAG, never part of `test`. It calls the RUNNER, not
# `just e2e`: that recipe builds first, and a lane body that rebuilt would take
# the pkg lock while the other lanes are reading .zo (see the header).
#
# CUCUMBER_RETRY is the CI-only budget for a browser that lost a frame on a
# loaded runner; a developer sees the first failure instead. CUCUMBER_PARALLEL
# is small on purpose: two racket test lanes are already running beside this
# one, each with -j num_cpus().

# Browser journeys: cucumber + playwright, one `olai serve` per scenario.
[linux]
e2e: build
    CUCUMBER_RETRY=1 CUCUMBER_PARALLEL=4 nix develop .#e2e --accept-flake-config -c just e2e-run

# The browser bundle is nixpkgs' (playwright-driver), and only its Linux one
# is exercised here: a second browser to keep trusting buys no coverage the
# racket lanes do not already have on macOS.
[macos]
e2e:
    @echo "e2e: linux only (see ci/mod.just)"
