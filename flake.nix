# IMPORTANT: this flake has ZERO inputs *except* `bun2nix` (the kolu
# convention). nixpkgs and the kolu source are pinned by npins
# (npins/sources.json) and imported via fetchTarball, which keeps `nix
# develop` cold eval near a second instead of the several the flake input
# system costs per input. Add a pin, not an input.
#
# `bun2nix` is the ONE documented exception: nixpkgs has no fetchBunDeps /
# buildBunPackage, and bun2nix's nix layer is flake-parts-shaped, so it cannot
# be imported cleanly from a non-flake-parts context. juspay/bun2nix's
# `rawflake` branch exposes `lib.mkBun2nix { pkgs }`, which lets us feed it OUR
# npins-pinned pkgs — no transitive nixpkgs eval. The input is forced only when
# `packages.*` is evaluated, so `nix develop` cold eval is unchanged.
{
  inputs.bun2nix.url = "github:juspay/bun2nix/rawflake";

  # Juspay's shared OSS cache, so `nix run .#bun2nix` and the kolu sources come
  # down prebuilt instead of being compiled on every lane.
  nixConfig = {
    extra-substituters = "https://cache.nixos.asia/oss";
    extra-trusted-public-keys = "oss:KO872wNJkCDgmGN3xy9dT89WAhvv13EiKncTtHDItVU=";
  };

  outputs = { self, bun2nix, ... }:
    let
      kolu = import ./nix/kolu.nix;
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      eachSystem = f: builtins.listToAttrs (map
        (system:
          let pkgs = import ./nix/nixpkgs.nix { inherit system; };
          in {
            name = system;
            value = f {
              inherit pkgs;
              b2n = bun2nix.lib.mkBun2nix { inherit pkgs; };
            };
          })
        systems);
    in
    {
      packages = eachSystem ({ pkgs, b2n }:
        let olai = import ./default.nix { inherit pkgs b2n; };
        in
        kolu.packages pkgs // {
          inherit (olai) olai;
          default = olai.olai;
          # `nix run .#bun2nix -- -l bun.lock -o bun.nix` regenerates the
          # lockfile-derived nix expression (`just regenerate-bun-nix`).
          bun2nix = b2n.bun2nix;
        });

      devShells = eachSystem ({ pkgs, ... }: { default = import ./shell.nix { inherit pkgs; }; });
    };
}
