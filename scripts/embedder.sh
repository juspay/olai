#!/usr/bin/env sh
# Print one half of the embedder olai should spawn for search-by-meaning — the
# one place the dev loop answers that question.
#
#   sh scripts/embedder.sh server   # the llama-server binary
#   sh scripts/embedder.sh model    # the .gguf weights
#
# The same argument as scripts/acp-agent.sh, for the same reason: the packaged
# binary bakes both paths into its wrapper with `--set-default` (default.nix),
# and the justfile recipes that run the tree directly — `just serve`, `just
# run` — call this, so a person following any documented way of starting olai
# gets recall without knowing the variables exist.
#
# `OLAI_EMBED_SERVER` / `OLAI_EMBED_MODEL` are the overrides, and "set" is
# tested with `${VAR+set}` rather than `${VAR:-}` ON PURPOSE: that matches
# `makeWrapper --set-default`, which emits `${VAR-default}` and so substitutes
# only when the variable is UNSET. So the empty string means "deliberately no
# embedder" on every path — substring search, and nothing anywhere calls that
# an error.
#
# Building on demand rather than in shell.nix is the other half: the dev shell
# is entered by every recipe and its cold `nix develop` is deliberately about a
# second, which a llama.cpp closure in its inputs would end.
set -eu

case "${1:-}" in
  server)
    if [ -n "${OLAI_EMBED_SERVER+set}" ]; then
      printf '%s' "$OLAI_EMBED_SERVER"
      exit 0
    fi
    out=$(nix build .#olai-embed-server --no-link --print-out-paths --accept-flake-config)
    printf '%s' "$out/bin/llama-server"
    ;;
  model)
    if [ -n "${OLAI_EMBED_MODEL+set}" ]; then
      printf '%s' "$OLAI_EMBED_MODEL"
      exit 0
    fi
    nix build .#olai-embed-model --no-link --print-out-paths --accept-flake-config | tr -d '\n'
    ;;
  *)
    echo "usage: $0 server|model" >&2
    exit 2
    ;;
esac
