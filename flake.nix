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
      devShells = forAllSystems ({ pkgs, system }: {
        default = pkgs.mkShell {
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
            export OLAI_ACP_AGENT="''${OLAI_ACP_AGENT:-${self.packages.${system}.acp-agent}/bin/claude-agent-acp}"
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

          # The build (racket build, TZDIR dance, raco exe stub) lives
          # in nix/olai.nix; src is a flake-level decision, passed in.
          olai = pkgs.callPackage ./nix/olai.nix {
            inherit (racketDepsPkg) racketPkgs racketDeps;
            src = ./.;
          };
        in
        {
          default = olai;
          inherit olai;
          racket-deps = racketDepsPkg.racketDeps;
          acp-agent = acpAgent;
        });

      # `nix run` starts the web view; `nix run .#cli -- check ...` is the CLI.
      # A one-line exec wrapper around the built binary is the boring option:
      # no second closure, nothing to keep in sync, works offline.
      apps = forAllSystems ({ pkgs, system }:
        let
          cli = "${self.packages.${system}.olai}/bin/olai";
          # serve wants an ACP agent and will not start without one, so the app
          # hands it the bundled adapter. Only serve: the bare CLI stays lean
          # and never drags the node closure in. An exported var wins.
          serve = pkgs.writeShellScriptBin "olai-serve" ''
            export OLAI_ACP_AGENT="''${OLAI_ACP_AGENT:-${self.packages.${system}.acp-agent}/bin/claude-agent-acp}"
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
      # user service. The flake fills in the packages for the host platform;
      # the user fills in dataDir. Same output name as kolu.
      homeManagerModules.default = { pkgs, lib, ... }: {
        imports = [ ./nix/home/module.nix ];
        config.services.olai.package =
          lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.olai;
        config.services.olai.acpAgent =
          lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.acp-agent;
      };

      checks = forAllSystems ({ pkgs, system }: {
        build = self.packages.${system}.olai;
        # The runCommand script lives in nix/smoke.nix; the example outline
        # and fake-agent paths are repo-root relative, so the flake passes
        # them in rather than nix/smoke.nix guessing its own location.
        smoke = pkgs.callPackage ./nix/smoke.nix {
          olai = self.packages.${system}.olai;
          exampleOutline = ./examples/Example.rkt;
          fakeAcpAgentSrc = ./olai/tests/fake-acp-agent.rkt;
        };
      });
    };
}
