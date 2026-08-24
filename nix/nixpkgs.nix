# Pinned nixpkgs import — managed by npins (the kolu convention: zero flake
# inputs; sources arrive via fetchTarball). To update: `just update-pins`.
#
# bun is overlaid from NixOS/nixpkgs#556047 (npins pin `nixpkgs-bun`, branch
# `bun-1.4-update`), not from the nixpkgs-unstable pin. That PR is 1.3.13 →
# 1.4.0: the watcher rewrite this repo is waiting on
# (docs/brainstorming/watcher-fd-cost.md). The extra pin records the PR
# branch at its HEAD, so `just update-pins` follows the PR rather than
# silently dropping the bump — the kolu-pin lesson, where `branch: master`
# plus a PR revision meant a later update would jump off the fix.
#
# Overlay, not a retarget of nixpkgs: #556047 also marks kilo broken, limits
# cyberstrike, and retouches anytype's hash, none of which olai's closure
# wants, and the PR sits on weeks of master this pin has not taken.
# callPackage of the PR's bun/package.nix against THIS nixpkgs is the
# smaller thing — a binary zip fetch, no second nixpkgs eval.
#
# When #556047 merges, drop the extra pin and this overlay; bun then comes
# from nixpkgs-unstable at the merge commit. That re-pin is
# bun-nixpkgs-catchup, parked for the human, not this change.
let
  sources = import ../npins;
  nixpkgs = import sources.nixpkgs;
  bunFromPr = final: _prev: {
    bun = final.callPackage (sources.nixpkgs-bun + "/pkgs/by-name/bu/bun/package.nix") { };
  };
in
args: nixpkgs (args // {
  overlays = (args.overlays or [ ]) ++ [ (import ./kolu.nix).overlay bunFromPr ];
})
