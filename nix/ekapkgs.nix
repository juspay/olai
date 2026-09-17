# Pinned ekapkgs import — managed by npins (the kolu convention: zero flake
# inputs; sources arrive via fetchTarball). To update: `just update-pins`.
let
  sources = import ../npins;
  ekapkgs = import sources.ekapkgs;
  olaiOverlay = import ./overlay.nix;
in
args: ekapkgs (args // {
  overlays = (args.overlays or [ ]) ++ [ olaiOverlay ];
})
