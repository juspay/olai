{
  description = "selfflowy — self-hosted outliner (#lang selfflowy + CLI)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f {
        pkgs = nixpkgs.legacyPackages.${system};
        system = system;
      });
    in
    {
      devShells = forAllSystems ({ pkgs, ... }: {
        default = pkgs.mkShell {
          packages = [
            pkgs.racket
            pkgs.just
            pkgs.watchexec
          ];
          shellHook = ''
            export PLTUSERHOME="''${PLTUSERHOME:-$PWD/.plt-user}"
            mkdir -p "$PLTUSERHOME"
          '';
        };
      });

      # Self-contained CLI via raco exe + raco distribute (no racket install needed to run).
      packages = forAllSystems ({ pkgs, system }:
        let
          selfflowy = pkgs.stdenv.mkDerivation {
            pname = "selfflowy";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.racket ];
            # Writable PLT tree inside the sandbox.
            # Copy sources out of the read-only store so raco can write compiled/.
            # Dependencies: gregor + ansi-color (network install fails in pure
            # sandbox). Prefer a prior `raco pkg install` into a fixed PLT tree,
            # or run builds with network (impure). Dev shell uses PLTUSERHOME.
            buildPhase = ''
              export PLTUSERHOME="$TMPDIR/plt-user"
              mkdir -p "$PLTUSERHOME"
              cp -a "$src/selfflowy" ./selfflowy-pkg
              chmod -R u+w ./selfflowy-pkg
              # Install declared deps when network is available (CI impure / local).
              raco pkg install --auto --no-docs --skip-installed gregor ansi-color || true
              raco pkg install --auto --no-docs --link ./selfflowy-pkg
              raco exe ++lang selfflowy -o selfflowy-bin \
                "$(racket -e '(display (path->string (collection-file-path "cli.rkt" "selfflowy")))')"
              raco distribute dist selfflowy-bin
            '';
            installPhase = ''
              mkdir -p $out
              cp -a dist/. $out/
              # raco distribute puts the binary under bin/<name>
              test -x $out/bin/selfflowy-bin
              mv $out/bin/selfflowy-bin $out/bin/selfflowy
            '';
            meta = with pkgs.lib; {
              description = "selfflowy CLI — validate and render #lang selfflowy outlines";
              mainProgram = "selfflowy";
              license = licenses.agpl3Plus;
            };
          };
        in
        {
          default = selfflowy;
          inherit selfflowy;
        });

      apps = forAllSystems ({ pkgs, system }: {
        default = {
          type = "app";
          program = "${self.packages.${system}.selfflowy}/bin/selfflowy";
        };
      });

      checks = forAllSystems ({ pkgs, system }: {
        build = self.packages.${system}.selfflowy;
        test = pkgs.runCommand "selfflowy-test"
          {
            nativeBuildInputs = [ pkgs.racket pkgs.just ];
            src = ./.;
          }
          ''
            export PLTUSERHOME="$TMPDIR/plt-user"
            mkdir -p "$PLTUSERHOME"
            cd $src
            raco pkg install --auto --no-docs --skip-installed gregor ansi-color || true
            raco pkg install --auto --no-docs --link "$src/selfflowy"
            raco test -p selfflowy
            touch $out
          '';
      });
    };
}
