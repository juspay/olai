# Pinned nixpkgs import — managed by npins (the kolu convention: zero flake
# inputs; sources arrive via fetchTarball). To update: `just update-pins`.
#
# bun 1.4.1 is overlaid from the official prebuilt zip (`nix/bun.nix`), not
# from the nixpkgs-unstable pin (still 1.3.13). 1.4.1 is the first bun with
# `bun install --offline`, which olai-base needs so a sandbox install is a
# cache miss rather than DNSResolveFailed (juspay/olai#503). Overlay, not a
# retarget of nixpkgs: NixOS/nixpkgs#556047 also marks kilo broken, limits
# cyberstrike, and retouches anytype's hash, none of which olai's closure
# wants, and that PR sits on weeks of master this pin has not taken.
# callPackage of nixpkgs' bun/package.nix against THIS nixpkgs is a binary
# zip fetch — autoPatchelf, Darwin ICU, completions — not a hand-unzipped
# one-platform derivation.
#
# When #556047 (or a 1.4.1 follow-up) reaches nixpkgs-unstable, drop
# `nix/bun.nix` and this overlay; bun then comes from the pin. That re-pin
# is bun-nixpkgs-catchup, parked for the human, not this change.
let
  sources = import ../npins;
  nixpkgs = import sources.nixpkgs;
  bunFromPr = final: _prev: {
    bun = final.callPackage ./bun.nix { };
  };
in
args: nixpkgs (args // {
  # The kolu sources are NOT an overlay any more. They used to be, so that
  # `pkgs.kolu-src-<x>` resolved anywhere; but `nix/kolu.nix` is a function of
  # `pkgs` now (kolu's `consumer.nix` needs one to build its copies), and an
  # overlay that needs the package set it is extending is a cycle. Consumers
  # take the sources from `(import ./nix/kolu.nix { inherit pkgs; }).packages`
  # instead — already-realized derivations, reached by name rather than by
  # having been spliced into `pkgs`.
  overlays = (args.overlays or [ ]) ++ [ bunFromPr ];
})
