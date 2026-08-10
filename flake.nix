# IMPORTANT: this flake has ZERO inputs *except* `bun2nix` (the kolu
# convention). nixpkgs and the kolu source are pinned by npins
# (npins/sources.json) and imported via fetchTarball, which keeps `nix
# develop` cold eval near a second instead of the several the flake input
# system costs per input. Add a pin, not an input.
#
# `bun2nix` is the ONE documented exception: nixpkgs has no fetchBunDeps /
# buildBunPackage. Upstream (nix-community/bun2nix) is flake-parts-shaped
# internally, but its consumer API is the package itself: `packages.<system>
# .default` carries `hook`, `fetchBunDeps`, `mkDerivation`, etc. on passthru.
# That is enough without flake-parts on our side and without the
# juspay/bun2nix rawflake fork (`lib.mkBun2nix` was only a thin re-export of
# the same passthru). Forced only when `packages.*` is evaluated, so
# `nix develop` cold eval is unchanged.
{
  # Pin a release tag; do not float on master.
  inputs.bun2nix.url = "github:nix-community/bun2nix/2.1.2";

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

      # One `pkgs` (and one bun2nix package) per system, shared by every
      # output that asks for it. `b2n` is the upstream CLI derivation; hook /
      # fetchBunDeps live on its passthru.
      perSystem = builtins.listToAttrs (map
        (system:
          let pkgs = import ./nix/nixpkgs.nix { inherit system; };
          in {
            name = system;
            value = { inherit pkgs; b2n = bun2nix.packages.${system}.default; };
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
          bun2nix = b2n;
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

      # home-manager module (nix/home/module.nix) for running `olai web` as a
      # user service. The flake fills in package; the user fills in dataDir.
      homeManagerModules.default = { pkgs, lib, ... }: {
        imports = [ ./nix/home/module.nix ];
        config.services.olai.package =
          lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.olai;
      };

      # Pure evaluation of the module under stubbed home-manager options —
      # systemd argv on Linux, launchd argv on Darwin. Wired into `just check`
      # as the `hm-module` recipe; not a full activation test.
      checks = eachSystem ({ pkgs, ... }: {
        hm-module = import ./nix/home/check.nix {
          inherit pkgs;
          module = ./nix/home/module.nix;
        };
      });
    };
}
