# Dev shell — shared by `nix develop` (via flake.nix) and `nix-shell`.
{ pkgs ? import ./nix/nixpkgs.nix { } }:
pkgs.mkShell {
  name = "olai-shell";

  # The @kolu/* store paths. Hydration itself has exactly one caller, the
  # justfile `install` recipe, so entering the shell stays free.
  env = import ./nix/env.nix { inherit pkgs; };

  packages = with pkgs; [
    bun
    just
    jq
    nixpkgs-fmt
    npins
  ];
}
