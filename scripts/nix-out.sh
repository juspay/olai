#!/usr/bin/env sh
# Build a flake output and print its store path on stdout. Callers capture
# that path (`just run`, `just serve`, `just nix`); this names the build on
# stderr first, so a cold fetch is not a spinner with no subject.
#
# The flags are the ones every on-demand pin already used: `--no-link` so
# nothing is planted in ./result, `--print-out-paths` so the path is the
# whole of stdout, `--accept-flake-config` so the repo's own allow-unfree
# (the Claude adapter) is honoured without a prompt.
set -eu
attr=$1
echo >&2 "nix build $attr"
exec nix build "$attr" --no-link --print-out-paths --accept-flake-config
