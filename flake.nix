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
# npins-pinned pkgs — no transitive nixpkgs eval. It is forced only when
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
      # One commit for the whole build: the browser shell and the server that
      # serves it are stamped with it, so a tab can tell whether the server it
      # reconnected to still ships the bundle it is running.
      stamp = import ((import ./npins).kolu + "/packages/surface-app/nix/commit-stamp.nix") { };
      rev = stamp.revFromSelf self;
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

      # One `pkgs` (and one bun2nix instantiation) per system, shared by every
      # output that asks for it.
      perSystem = builtins.listToAttrs (map
        (system:
          let pkgs = import ./nix/nixpkgs.nix { inherit system; };
          in {
            name = system;
            value = { inherit pkgs; b2n = bun2nix.lib.mkBun2nix { inherit pkgs; }; };
          })
        systems);
      eachSystem = f: builtins.mapAttrs (_: ctx: f ctx) perSystem;
    in
    {
      packages = eachSystem ({ pkgs, b2n }:
        let olai = import ./default.nix { inherit pkgs b2n rev; };
        in
        kolu.packages pkgs // {
          inherit (olai) olai olai-client;
          default = olai.olai;
          # `nix run .#bun2nix -- -l bun.lock -o bun.nix` regenerates the
          # lockfile-derived nix expression (`just regenerate-bun-nix`).
          bun2nix = b2n.bun2nix;
        });

      # Two shells, and the second is the first plus browsers. Playwright's
      # browser set is ~600ms of cold `nix develop` that every non-e2e leg
      # would pay for nothing, so `just e2e` enters `.#e2e` and everything
      # else stays in `default`.
      devShells = eachSystem ({ pkgs, ... }:
        let default = import ./shell.nix { inherit pkgs; };
        in {
          inherit default;
          e2e = default.overrideAttrs (prev: {
            name = "olai-shell-e2e";
            env = (prev.env or { }) // {
              PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
            };
          });
        });
    };
}
