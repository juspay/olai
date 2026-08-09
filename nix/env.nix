# Env vars whose values are Nix-store paths — consumed by the dev shell and
# hydrated into node_modules/@kolu/* by scripts/hydrate-kolu-packages.sh.
{ pkgs }:
{
  OLAI_KOLU_SURFACE = pkgs.kolu-surface;
  OLAI_KOLU_LOG = pkgs.kolu-log;
}
