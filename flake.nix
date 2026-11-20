{
  # Pin a commit, not master. 2.1.2's cache has tarballs and no npm
  # manifests, so bun 1.4.1 `bun install --offline` dies with "no cached
  # manifest" (juspay/olai#503). nix-community/bun2nix#103 synthesizes those
  # manifests from bun.lock; it is unreleased, so this is the PR head
  # (synapdeck/bun2nix@34894825) until it lands and we retag.
  inputs.bun2nix.url = "github:synapdeck/bun2nix/3489482505adf9eafd4498c8e53015b5da980e13";

  nixConfig = {
    extra-substituters = "https://cache.kolu.dev/kolu-r2";
    extra-trusted-public-keys = "kolu-r2-1:7KmFrK05rVrnxkyZi9hJGnJJmRCpg87u6MUQIk7nokQ=";
  };

  outputs = { self, bun2nix, ... }:
    let
      stamp = import ((import ./npins).kolu + "/packages/surface-app/nix/commit-stamp.nix") { };
      rev = stamp.revFromSelf self;
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];

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
      lib = import ./nix/runtime.nix {
        lib = import ((import ./npins).nixpkgs + "/lib");
      };

      packages = eachSystem ({ pkgs, b2n }:
        let
          olai = import ./default.nix { inherit pkgs b2n rev; };
          website = import ./website { inherit pkgs b2n; };
          bundle = olai.bundle;
          overlap = builtins.attrNames
            (builtins.intersectAttrs bundle.packages
              { inherit (olai) olai olai-client olai-fonts base olai-deps; inherit website; });
          clash = if overlap != [ ] then throw "flake packages: a plugin declares an output the root already names: ${builtins.concatStringsSep ", " overlap}" else null;
        in
        builtins.seq clash (bundle.packages // {
          inherit (olai) olai olai-client olai-fonts base olai-deps;
          inherit website;
          default = olai.olai;
          bun2nix = b2n;
          plugin-env = bundle.devEnv;
        }));

      devShells = eachSystem ({ pkgs, ... }:
        let default = import ./shell.nix { inherit pkgs; };
        in {
          inherit default;
          e2e = default.overrideAttrs (prev: {
            name = "olai-shell-e2e";
            env = (prev.env or { }) // {
              PLAYWRIGHT_BROWSERS_PATH = pkgs.playwright-driver.browsers;
              OLAI_E2E_PLAYWRIGHT_MCP = "${pkgs.playwright-mcp}/bin/playwright-mcp";
            };
          });
        });

      homeManagerModules.default = { pkgs, lib, ... }: {
        imports = [ ./nix/home/module.nix ];
        config.services.olai.package =
          lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.olai;
      };

      checks = eachSystem ({ pkgs, b2n }:
        let
          olai = import ./default.nix { inherit pkgs b2n rev; };
          bundle = olai.bundle;
        in
        {
          hm-module = import ./nix/home/check.nix {
            inherit pkgs;
            module = ./nix/home/module.nix;
          };
          runtime = import ./nix/runtime-check.nix { inherit pkgs; runtime = self.lib; };
          plugin-fold = import ./packages/bundle/nix/fold-check.nix {
            inherit pkgs;
          };
        } // bundle.checks { tree = olai.base; });
    };
}
