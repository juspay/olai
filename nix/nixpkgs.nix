# bun 1.4.1 is overlaid from the official prebuilt zip (`nix/bun.nix`), not
# from the nixpkgs-unstable pin (still 1.3.13): 1.4.1 is the first bun with
# `bun install --offline`, which olai-deps needs so a sandbox install is a
# cache miss rather than DNSResolveFailed (juspay/olai#503). Drop the overlay
# when NixOS/nixpkgs#556047 reaches nixpkgs-unstable.
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
