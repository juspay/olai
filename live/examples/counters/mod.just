# What CI runs against the example, in the example's own words. One command,
# because the example is one artifact: its derivation builds the program and
# runs its test (default.nix), so there is nothing here to sequence and
# nothing to keep in step.
#
# Mounted by ci/mod.just, which is the only caller — a human runs the example
# with `nix run .#counters` and needs no recipe at all.

set working-directory := '../../..'

# Build the example and run its test (flake attr .#counters). Unlinked: the
# artifact is not wanted here, only the fact that it builds and passes.
check:
    nix build -L --no-link .#counters
