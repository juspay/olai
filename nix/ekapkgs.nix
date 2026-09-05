# Pinned ekapkgs import — managed by npins (the kolu convention: zero flake
# inputs; sources arrive via fetchTarball). To update: `just update-pins`.
#
# bun 1.4.1 is overlaid from the official prebuilt zip (`nix/bun.nix`), not
# from the pin (still 1.3.14). 1.4.1 is the first bun with `bun install
# --offline`, which olai-base needs so a sandbox install is a cache miss
# rather than DNSResolveFailed (juspay/olai#503). Overlay, not a retarget:
# callPackage of this tree's bun/package.nix against THIS package set is a
# binary zip fetch — autoPatchelf, Darwin ICU, completions — not a
# hand-unzipped one-platform derivation.
#
# Drop `nix/bun.nix` when ekapkgs' default bun is >= 1.4.1.
let
  sources = import ../npins;
  ekapkgs = import sources.ekapkgs;
  olaiOverlay = import ./overlay.nix;
in
args: ekapkgs (args // {
  overlays = (args.overlays or [ ]) ++ [ olaiOverlay ];
})
