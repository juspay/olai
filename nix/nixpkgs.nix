# Pinned nixpkgs import — managed by npins (the kolu convention: zero flake
# inputs; sources arrive via fetchTarball). To update: `just update-pins`.
let
  sources = import ../npins;
  nixpkgs = import sources.nixpkgs;
in
args: nixpkgs (args // {
  overlays = (args.overlays or [ ]) ++ [ (import ./kolu.nix).overlay ];
})
