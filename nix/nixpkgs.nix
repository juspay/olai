# bun 1.4.1 is overlaid from the official prebuilt zip (`nix/bun.nix`); the
# nixpkgs-unstable pin is still 1.3.13, which has no `bun install --offline`
# (juspay/olai#503). Drop the overlay when NixOS/nixpkgs#556047 reaches the pin.
let
  sources = import ../npins;
  nixpkgs = import sources.nixpkgs;
  bunFromPr = final: _prev: {
    bun = final.callPackage ./bun.nix { };
  };
in
args: nixpkgs (args // {
  overlays = (args.overlays or [ ]) ++ [ bunFromPr ];
})
