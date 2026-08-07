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

# live/'s worked example is CI's to run and nobody else's, so it is mounted
# HERE and not in the root justfile. This line is all that is known about it
# outside its own directory: where it lives, never what it runs.
mod counters '../live/examples/counters/mod.just'

# Re-enter the flake devShell when a remote odu lane lacks racket/just on PATH.
# Skipped when already inside the shell (`just ci` under direnv / nix develop).
nix_shell := if env('IN_NIX_SHELL', '') != '' { '' } else { 'nix develop --accept-flake-config -c' }

# Pipeline root: every recipe listed here becomes a (recipe × platform) node.
# smoke waits on nix; tests wait on build; nix ‖ build, then fan-out.
[linux]
[macos]
[parallel]
[metadata("ci")]
default: smoke arch test test-integration e2e counters::check

# One install + raco setup per lane — funnel every racket test through this.
build:
    {{ nix_shell }} just build

# Package the CLI. Leaves ./result for smoke (gitignored).
nix:
    nix build -L

# Packaged binary can load and check committed outlines. One command, so one
# SET: examples/Week.rkt mirrors an anchor examples/Example.rkt declares, and
# that only resolves when both are named (docs/syntax.md, Mirrors).
smoke: nix
    ./result/bin/olai check examples/Example.rkt examples/Week.rkt examples/Kitchen.rkt examples/Notes.jsonl docs/olai/Roadmap.jsonl docs/olai/Archive.rkt e2e/fixtures/Tasks.rkt e2e/fixtures/Archive.rkt

# The declared architecture, checked against the code (arch/README.md). Its own
# node and not part of `test`: a layering violation and a failing test are
# different failure classes, and a lane that reported them together would make
# a red build say less than it does now. It reads `git log`, so it needs the
# history — a lane that fetched only one commit gets the audit's "no history
# here" note and the other three checks.
arch: build
    {{ nix_shell }} racket arch/main.rkt .

# Unit tests: in-process (arch/tests/ + live/tests/ + olai/tests/*.rkt).
test: build
    {{ nix_shell }} raco test -j {{ num_cpus() }} arch/tests/*.rkt live/tests/*.rkt olai/tests/*.rkt

# Integration tests: subprocess CLI + real servers (olai/tests/integration/).
test-integration: build
    {{ nix_shell }} raco test -j {{ num_cpus() }} olai/tests/integration/

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
