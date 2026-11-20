# `AGENT_ENV` moved to `@kolu/acp`, which respelled olai's old
# `OLAI_ACP_AGENT` to `KOLU_ACP_AGENT`. That old name is history and this line
# is the only place left that says it: a person with it still exported in a
# shell profile is pointing at nothing.
# https://github.com/juspay/kolu/pull/2350
{ pkgs, extraSeeds ? [ ], pinnedSources ? { } }:

let
  npins = import ../npins;

  consumer = import "${npins.kolu}/nix/consumer.nix" {
    inherit pkgs;
    src = npins.kolu;

    seeds = [
      "@kolu/acp"
      "@kolu/acp-claude"
      "@kolu/acp-client"
      "@kolu/acp-harness"
      "@kolu/child"
      "@kolu/surface-app"
      "@kolu/surface-cli"
      "@kolu/surface-mcp"
    ] ++ extraSeeds;

    inherit pinnedSources;
  };
in
consumer
