# MAIL'S NIX HALF — the himalaya binary the mail plugin runs, as a knob.
#
# The pinned Himalaya is the binary half of the mail pin, carried as the
# plugin's own knob and packaged derivation rather than a hand-written root
# import (`nix/himalaya.nix` was that file, and it is gone). Composed, not
# described, for the reason `nix/himalaya.nix` gave: `${pin}/default.nix` is
# the recipe Himalaya's own flake runs, and an olai-side re-spelling of its
# Cargo build would be the drift that file's header described. So the pin's
# default.nix is imported and called, and nothing of its build is repeated
# here.
#
# `pins` is the fold's handed-in npins (the same `npins` a plugin is told not
# to reach `../../../npins` for); `npins` below is that same attrset. The pin
# takes `nixpkgs` and (through it) `pimalaya` and `fenix` — all three are
# npins pins here, so the build is a function of `npins/sources.json` and
# nothing else.
{ pkgs, pins, kit, b2n ? null, ... }:
let
  npins = pins;
  himalaya = (import "${npins.himalaya}/default.nix" {
    nixpkgs = "${npins.nixpkgs}";
    inherit pkgs;
    system = pkgs.stdenv.hostPlatform.system;
    pimalaya = import "${npins.pimalaya}";
    fenix = import "${npins.fenix}" {
      inherit pkgs;
      system = pkgs.stdenv.hostPlatform.system;
    };
  }).overrideAttrs (old: {
    # The pin fetches full MIME payloads but drops them while rendering JSON.
    # Upstream: https://github.com/pimalaya/himalaya/issues/750
    # Drop this patch when the pin retains payload; mail-surface checks its schema.
    patches = (old.patches or [ ]) ++ [ ./himalaya-thread-payload.patch ];
  });
in
{
  # THE BINARY THE ROW SPAWNS, as a knob. `file` kind: `OLAI_HIMALAYA` names
  # one FILE — the pinned `himalaya` — and the mail plugin treats an empty
  # value as no binary at all (`src/himalaya/run.ts`). The fold bakes it into
  # the `olai` wrapper as a `--set-default`, so the PIN is the answer for every
  # packaged start while the e2e harness can still hand the row a fake (or
  # nothing) by overriding the variable.
  knobs.OLAI_HIMALAYA = {
    kind = "file";
    path = "${himalaya}/bin/himalaya";
  };
  # The package and the derivation are one: the fold merges this into the
  # flake output so `.#himalaya-bin` (which the `mail-surface` leg shells out
  # to the built binary through) and the knob's path cannot drift.
  packages.himalaya-bin = himalaya;
}
