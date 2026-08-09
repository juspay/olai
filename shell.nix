# Dev shell — shared by `nix develop` (via flake.nix) and `nix-shell`.
{ pkgs ? import ./nix/nixpkgs.nix { } }:
let
  kolu = import ./nix/kolu.nix;
in
pkgs.mkShell {
  name = "olai-shell";

  # The @kolu/* sources, as the argv the hydrate script and the dependency
  # check take. Both are run by justfile recipes, not by a shellHook: entering
  # the shell realises the sources but copies nothing.
  env = {
    OLAI_KOLU_HYDRATE = kolu.hydrateArgs pkgs;
    OLAI_KOLU_DIRS = kolu.sourceDirs pkgs;

    # The browsers come from nixpkgs, in the `e2e` shell only (flake.nix) — so
    # the npm package must never try to fetch its own. This is set HERE, in the
    # shell that runs `bun install`, rather than there, in the shell that runs
    # the tests.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
  };

  packages = with pkgs; [
    bun
    just
    jq # scripts/check-kolu-deps.sh
    nixpkgs-fmt
    npins
  ];
}
