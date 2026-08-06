{
  description = "olai — self-hosted outliner (#lang olai + CLI)";

  # Sources (nixpkgs + Racket package git revs) are pinned via npins.
  # See npins/sources.json; update with: npins update / npins add ...
  outputs = { self }:
    let
      sources = import ./npins;

      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: builtins.listToAttrs (map (system: {
        name = system;
        value = f {
          inherit system;
          pkgs = import sources.nixpkgs {
            inherit system;
            config = { };
            overlays = [ ];
          };
        };
      }) systems);
    in
    {
      devShells = forAllSystems ({ pkgs, system }:
        let
          racketShell = {
            packages = [
              pkgs.racket
              pkgs.just
              pkgs.watchexec
              pkgs.tzdata
              pkgs.npins
              self.packages.${system}.acp-agent
            ];
            shellHook = ''
              export PLTUSERHOME="''${PLTUSERHOME:-$PWD/.plt-user}"
              mkdir -p "$PLTUSERHOME"
              if [ -d "${pkgs.tzdata}/share/zoneinfo" ]; then
                export TZDIR="${pkgs.tzdata}/share/zoneinfo"
              fi
              # `serve` refuses to start without an ACP agent; hand it the
              # bundled one so `just serve` works out of the box. Set the var
              # yourself to point at a different agent.
              export OLAI_ACP_AGENT="''${OLAI_ACP_AGENT:-${pkgs.lib.getExe self.packages.${system}.acp-agent}}"
              # The vendored browser runtime, pinned and built (live/default.nix).
              # `just` stages it into live/static/ where the collection's own
              # define-runtime-path expects it; the files are gitignored.
              export OLAI_LIVE_ASSETS="${self.packages.${system}.live}/static"
            '';
          };
        in
        {
          default = pkgs.mkShell racketShell;

          # The browser lane, and only it: node, a pinned chromium, and the
          # harness's node_modules. Kept OUT of the default shell because
          # nothing else here has any use for a 500M browser — `just e2e`
          # enters this one itself (OLAI_E2E_SHELL says it is already in).
          # The racket side comes along whole: e2e boots the `olai` the dev
          # shell builds, against the repo's own fake ACP agent (racket).
          e2e = pkgs.mkShell {
            packages = racketShell.packages ++ [ pkgs.nodejs ];
            shellHook = racketShell.shellHook + ''
              export OLAI_E2E_SHELL=1
              export OLAI_E2E_NODE_MODULES="${self.packages.${system}.e2e-node-modules}/node_modules"
              # playwright the npm package and playwright-driver the browser
              # bundle are ONE version (e2e/package.json pins the same
              # ${pkgs.playwright-driver.version}); a drift is "Executable
              # doesn't exist" at scenario one.
              export PLAYWRIGHT_BROWSERS_PATH="${pkgs.playwright-driver.browsers}"
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
            '';
          };
        });

      packages = forAllSystems ({ pkgs, system }:
        let
          # racketPkgs list + the staging derivation live in nix/racket-deps.nix.
          racketDepsPkg = pkgs.callPackage ./nix/racket-deps.nix { inherit sources; };

          # Packaging lives in acp/default.nix, next to the package.json +
          # package-lock.json it builds from.
          acpAgent = pkgs.callPackage ./acp { };

          # The live-view collection with its vendored browser runtime staged
          # in. Which upstream, which artifact, which name lives in
          # live/default.nix, next to the collection it is about.
          live = pkgs.callPackage ./live { inherit sources; };

          # The framework's worked example, as its own artifact: it consumes
          # `live` and is not part of it. Its nix, its just module and its
          # test all live in that directory — this line is the mount.
          counters = pkgs.callPackage ./live/examples/counters { inherit live; };

          # The build (racket build, TZDIR dance, raco exe stub, ACP
          # default) lives in nix/olai.nix; src is a flake-level decision.
          olai = pkgs.callPackage ./nix/olai.nix {
            inherit (racketDepsPkg) racketPkgs racketDeps;
            inherit acpAgent live;
            src = ./.;
          };
        in
        {
          default = olai;
          inherit olai live counters;
          racket-deps = racketDepsPkg.racketDeps;
          acp-agent = acpAgent;
          # cucumber + playwright for the browser journeys (e2e/default.nix).
          # Nothing in the olai package or its checks depends on it: `nix
          # build` stays what it was.
          e2e-node-modules = pkgs.callPackage ./e2e { };
        });

      # `nix run` starts the web view; `nix run .#cli -- check ...` is the CLI.
      # The package already defaults OLAI_ACP_AGENT; serve is just argv.
      apps = forAllSystems ({ pkgs, system }:
        let
          cli = pkgs.lib.getExe self.packages.${system}.olai;
          serve = pkgs.writeShellScriptBin "olai-serve" ''
            exec ${cli} serve "$@"
          '';
          serveApp = {
            type = "app";
            program = "${serve}/bin/olai-serve";
          };
        in
        {
          default = serveApp;
          serve = serveApp;
          cli = {
            type = "app";
            program = cli;
          };
        });

      # home-manager module (nix/home/module.nix) for running `serve` as a
      # user service. The flake fills in package; the user fills in dataDir.
      homeManagerModules.default = { pkgs, lib, ... }: {
        imports = [ ./nix/home/module.nix ];
        config.services.olai.package =
          lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.olai;
      };

      checks = forAllSystems ({ pkgs, system }: {
        build = self.packages.${system}.olai;
        # The runCommand script lives in nix/smoke.nix; example + fake-agent
        # paths are repo-root relative, so the flake passes them in rather
        # than nix/smoke.nix guessing its own location.
        smoke = pkgs.callPackage ./nix/smoke.nix {
          olai = self.packages.${system}.olai;
          exampleOutline = ./examples/Example.rkt;
          exampleSexpOutline = ./examples/Example.sexp.rkt;
          fakeAcpAgentSrc = ./olai/tests/integration/fake-acp-agent.rkt;
        };
      });
    };
}
