{ pkgs, extraSeeds ? [ ], pinnedSources ? { } }:

let
  npins = import ../npins;

  frameworkSeeds = [
    "@kolu/acp"
    "@kolu/acp-claude"
    "@kolu/acp-client"
    "@kolu/acp-harness"
    "@kolu/child"
    "@kolu/surface-app"
    "@kolu/surface-cli"
    "@kolu/surface-mcp"
  ];

  consumer = import "${npins.kolu}/nix/consumer.nix" {
    inherit pkgs;
    src = npins.kolu;

    seeds = frameworkSeeds ++ extraSeeds;

    inherit pinnedSources;
  };
in
consumer
