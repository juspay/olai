# The live/ framework's worked example (README.md). Everything it is lives in
# this directory — its program, its test, its nix derivation — and the root
# justfile mounts it with one line: `mod counters`.
#
# Recipes run from the repo root (the paths below say so) and inherit
# PLTUSERHOME and PATH from the root justfile's exports, so `install` and
# `build` there are the same ones every other racket recipe uses.

set working-directory := '../../..'

# Run it (http://127.0.0.1:8080; pass --port to move it)
run *args:
    just install
    racket live/examples/counters/app.rkt {{args}}

# The example's own test: boots it on an ephemeral port
test:
    just build
    just counters::test-run

# The runner, without the build — what CI calls, because a lane body that
# rebuilt would take the package lock while the other lanes are reading .zo
# (ci/mod.just). The same split `e2e` and `e2e-run` already make.
test-run:
    raco test live/examples/counters/tests/counters.rkt

# Build the example's own derivation (flake attr .#counters). Unlinked: this
# only has to prove the nix file still builds what it claims to.
nix:
    nix build -L --no-link .#counters
