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
          ];
          shellHook = ''
            export PLTUSERHOME="''${PLTUSERHOME:-$PWD/.plt-user}"
            mkdir -p "$PLTUSERHOME"
          '';
        };
      });

      # Runnable CLI: copies package sources and wraps racket -l selfflowy/cli.
      # First run installs the package into a cache PLTUSERHOME if needed.
      packages = forAllSystems ({ pkgs, system }:
        let
          selfflowy = pkgs.stdenvNoCC.mkDerivation {
            pname = "selfflowy";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.makeWrapper ];
            buildInputs = [ pkgs.racket ];
            dontBuild = true;
            installPhase = ''
              mkdir -p $out/share/selfflowy $out/bin
              cp -r selfflowy $out/share/selfflowy/pkg
              makeWrapper ${pkgs.racket}/bin/racket $out/bin/selfflowy \
                --prefix PATH : ${pkgs.racket}/bin \
                --run "export PLTUSERHOME=\"\''${PLTUSERHOME:-\''${XDG_CACHE_HOME:-\$HOME/.cache}/selfflowy-plt}\"; mkdir -p \"\$PLTUSERHOME\"; if ! raco pkg show selfflowy >/dev/null 2>&1; then raco pkg install --auto --no-docs --skip-installed --copy $out/share/selfflowy/pkg; fi" \
                --add-flags "-l" \
                --add-flags "selfflowy/cli" \
                --add-flags "--"
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
    };
}
