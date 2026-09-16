# The pinned Himalaya the mail plugin runs — the binary half of the pin, and
# the whole of what olai knows about how Himalaya is built.
#
# Composed, not described, for `nix/odu.nix`'s reason: `${npins.himalaya}/
# default.nix` is the recipe Himalaya's own flake runs, and an olai-side
# re-spelling of its Cargo build (src, cargoDeps, features, the postInstall
# that generates completions, man pages and JSON schemas) would be the drift
# that file's header describes, one pin over. So the pin's default.nix is
# imported and called, and nothing of its build is repeated here.
#
# WHAT IT ASKS FOR, and why each is passed rather than defaulted. The pin's
# root default.nix takes `nixpkgs`, `pimalaya` and (through it) `fenix`, and
# every one of those defaults to an UNPINNED `fetchTarball` — which this
# tree's pure flake evaluation refuses outright, and which would in any case
# put a moving `pimalaya/nix` master and a moving `fenix/monthly` into the
# definition of a packaged olai. All three are npins pins here, so the build
# is a function of `npins/sources.json` and nothing else; `just update-pins`
# moves them with the rest.
#
# `pkgs` is THIS tree's nixpkgs (the one `nix/nixpkgs.nix` resolves) and
# `nixpkgs` is its path: the pin's recipe reaches into it for himalaya's own
# `pkgs/by-name/hi/himalaya/package.nix`, which is where the Cargo plumbing
# lives. The version that recipe names is overridden by the pin's default.nix
# with the pin's own `src` and `Cargo.lock` — so what is built is the revision
# in `npins/sources.json`, not the nixpkgs release's.
#
# The `fenix` toolchain is the pin's own choice of Rust, passed in whole. A
# nixpkgs `rustc`/`cargo` would build the same source, but "the way upstream
# builds it" is the only reading of the pin that cannot go quietly wrong on
# the next bump — `rust-version` in the pin's Cargo.toml is a fact only the
# pin's toolchain is guaranteed to satisfy.

{ pkgs }:

let
  npins = import ../npins;
in
{
  # The revision this tree consumes, so a report or a fault can name it
  # without anybody reading JSON. Same fact `npins/sources.json` holds.
  revision = npins.himalaya.revision;

  # THE BINARY — the pin's own `himalaya`, built from the pin with the pin's
  # nixpkgs and toolchain. The import returns the derivation itself (the pin's
  # root default.nix ends in `pimalaya.mkDefault { … }`), which is what the
  # wrapper in `default.nix` bakes as `OLAI_HIMALAYA`.
  bin = (import "${npins.himalaya}/default.nix" {
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
}
