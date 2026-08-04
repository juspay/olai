{
  description = "selfflowy — self-hosted outliner (#lang selfflowy + CLI)";

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

      # Racket packages from npins. Monorepos need a subdir; others install at root.
      # Install order is bottom-up. markdown and selfflowy use --deps force because
      # catalog package names (parsack, gregor) differ from the lib package dirs.
      racketPkgs = [
        { name = "memoize-lib"; pin = "memoize"; subdir = "memoize-lib"; }
        { name = "parsack-lib"; pin = "parsack"; subdir = "parsack-lib"; }
        { name = "threading-lib"; pin = "threading"; subdir = "threading-lib"; }
        { name = "cldr-core"; pin = "cldr-core"; subdir = null; }
        { name = "cldr-bcp47"; pin = "cldr-bcp47"; subdir = null; }
        { name = "cldr-dates-modern"; pin = "cldr-dates-modern"; subdir = null; }
        { name = "cldr-localenames-modern"; pin = "cldr-localenames-modern"; subdir = null; }
        { name = "cldr-numbers-modern"; pin = "cldr-numbers-modern"; subdir = null; }
        { name = "tzinfo"; pin = "tzinfo"; subdir = null; }
        { name = "gregor-lib"; pin = "gregor"; subdir = "gregor-lib"; }
        { name = "markdown"; pin = "markdown"; subdir = null; }
      ];
    in
    {
      devShells = forAllSystems ({ pkgs, ... }: {
        default = pkgs.mkShell {
          packages = [
            pkgs.racket
            pkgs.just
            pkgs.watchexec
            pkgs.tzdata
            pkgs.npins
          ];
          shellHook = ''
            export PLTUSERHOME="''${PLTUSERHOME:-$PWD/.plt-user}"
            mkdir -p "$PLTUSERHOME"
            if [ -d "${pkgs.tzdata}/share/zoneinfo" ]; then
              export TZDIR="${pkgs.tzdata}/share/zoneinfo"
            fi
          '';
        };
      });

      packages = forAllSystems ({ pkgs, system }:
        let
          # Stage each npins source into $out/<name> for raco pkg install --copy.
          # Writable copies so we can strip markdown test modules that need
          # optional build-deps (sexp-diff, redex) not required at runtime.
          racketDeps = pkgs.stdenvNoCC.mkDerivation {
            name = "selfflowy-racket-deps";
            dontUnpack = true;
            # npins sources are fixed-output store paths; string context pulls them in.
            buildCommand = ''
              mkdir -p $out
              ${pkgs.lib.concatMapStringsSep "\n" (p:
                let src = sources.${p.pin};
                in ''
                  echo "staging ${p.name} from ${p.pin}"
                  ${if p.subdir == null then ''
                    cp -a "${src}" "$out/${p.name}"
                  '' else ''
                    cp -a "${src}/${p.subdir}" "$out/${p.name}"
                  ''}
                  chmod -R u+w "$out/${p.name}"
                '') racketPkgs}

              # markdown ships test modules that require sexp-diff/redex at compile
              # time; strip them so offline install only needs runtime deps.
              if [ -d "$out/markdown/markdown" ]; then
                rm -f "$out/markdown/markdown/"*test*.rkt \
                      "$out/markdown/markdown/suite-test.rkt" \
                      "$out/markdown/markdown/perf-test.rkt" \
                      "$out/markdown/markdown/random-test.rkt" \
                      "$out/markdown/markdown/redex-test.rkt" \
                      "$out/markdown/markdown/example.rkt"
                rm -rf "$out/markdown/markdown/test" \
                       "$out/markdown/MarkdownTest_1.0.3" \
                       "$out/markdown/markdown/doc"
              fi
            '';
          };

          selfflowy = pkgs.stdenv.mkDerivation {
            pname = "selfflowy";
            version = "0.1.0";
            src = ./.;
            nativeBuildInputs = [ pkgs.racket pkgs.makeWrapper ];
            buildInputs = [ pkgs.tzdata ];

            # Zoneinfo for gregor/tzinfo during build (sandbox has no /usr/share).
            TZDIR = "${pkgs.tzdata}/share/zoneinfo";

            buildPhase = ''
              export PLTUSERHOME="$TMPDIR/plt-user"
              mkdir -p "$PLTUSERHOME"
              export TZDIR="${pkgs.tzdata}/share/zoneinfo"

              # tzinfo searches relative cwd paths and PLTUSERHOME share dirs.
              mkdir -p tzdata
              ln -sfn "${pkgs.tzdata}/share/zoneinfo" tzdata/zoneinfo
              mkdir -p "$PLTUSERHOME/.local/share/racket/9.2/share/tzdata"
              ln -sfn "${pkgs.tzdata}/share/zoneinfo" \
                "$PLTUSERHOME/.local/share/racket/9.2/share/tzdata/zoneinfo"

              cp -a "$src/selfflowy" ./selfflowy-pkg
              chmod -R u+w ./selfflowy-pkg

              # Offline install of npins-vendored deps (order matters).
              # --deps force: markdown wants package name "parsack"; we ship
              # parsack-lib. selfflowy wants "gregor"; we ship gregor-lib.
              ${pkgs.lib.concatMapStringsSep "\n" (p: ''
                echo "raco pkg install ${p.name}"
                raco pkg install --copy --no-docs --deps force --batch "${racketDeps}/${p.name}"
              '') racketPkgs}

              raco pkg install --no-docs --deps force --link ./selfflowy-pkg

              raco exe ++lang selfflowy -o selfflowy-bin \
                "$(racket -e '(display (path->string (collection-file-path "cli.rkt" "selfflowy")))')"
              raco distribute dist selfflowy-bin
            '';

            installPhase = ''
              mkdir -p $out
              cp -a dist/. $out/
              test -x $out/bin/selfflowy-bin
              # Wrap with TZDIR so gregor finds zoneinfo outside /usr/share
              mv $out/bin/selfflowy-bin $out/bin/.selfflowy-wrapped
              makeWrapper $out/bin/.selfflowy-wrapped $out/bin/selfflowy \
                --set TZDIR "${pkgs.tzdata}/share/zoneinfo" \
                --prefix PATH : "${pkgs.tzdata}/bin"
              mkdir -p $out/share/tzdata
              ln -sfn "${pkgs.tzdata}/share/zoneinfo" $out/share/tzdata/zoneinfo
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
          racket-deps = racketDeps;
        });

      # `nix run` starts the web view; `nix run .#cli -- check ...` is the CLI.
      # A one-line exec wrapper around the built binary is the boring option:
      # no second closure, nothing to keep in sync, works offline.
      apps = forAllSystems ({ pkgs, system }:
        let
          cli = "${self.packages.${system}.selfflowy}/bin/selfflowy";
          serve = pkgs.writeShellScriptBin "selfflowy-serve" ''
            exec ${cli} serve "$@"
          '';
          serveApp = {
            type = "app";
            program = "${serve}/bin/selfflowy-serve";
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

      checks = forAllSystems ({ pkgs, system }: {
        build = self.packages.${system}.selfflowy;
        smoke = pkgs.runCommand "selfflowy-smoke"
          {
            nativeBuildInputs = [
              self.packages.${system}.selfflowy
              pkgs.racket
              pkgs.curl
            ];
          }
          ''
            export TZDIR="${pkgs.tzdata}/share/zoneinfo"
            selfflowy check ${./examples/Example.rkt}

            # Parse the JSON; never grep it (key order is not a contract).
            selfflowy tree ${./examples/Example.rkt} > tree.json
            racket -e '(require json)
                       (define j (call-with-input-file "tree.json" read-json))
                       (unless (and (= 1 (hash-ref j (quote version)))
                                    (string? (hash-ref j (quote file)))
                                    (pair? (hash-ref j (quote tasks))))
                         (error (quote smoke) "unexpected tree JSON"))'

            # The server has to work from the packaged binary too: static files
            # and the language readers resolve differently there.
            cp ${./examples/Example.rkt} live.rkt
            chmod u+w live.rkt
            selfflowy serve --port 8099 live.rkt &
            for i in $(seq 1 60); do
              curl -sf -o page.html http://127.0.0.1:8099/ && break
              sleep 1
            done
            grep -qi "<html" page.html
            curl -sf -o api.json http://127.0.0.1:8099/api/tree
            racket -e '(require json)
                       (unless (= 1 (hash-ref (call-with-input-file "api.json" read-json)
                                              (quote version)))
                         (error (quote smoke) "unexpected /api/tree JSON"))'
            curl -sf -o app.css http://127.0.0.1:8099/static/app.css
            test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/nope)" = 404

            # Reload after a save. This is the check that matters in the
            # PACKAGED binary: the store loads outlines in a fresh namespace,
            # which has no collection paths to resolve selfflowy from — it has
            # to work off attached modules.
            ! grep -q "Smoke reload marker" page.html
            printf 'Smoke reload marker\n' >> live.rkt
            curl -sf -o page2.html http://127.0.0.1:8099/
            grep -q "Smoke reload marker" page2.html

            # A broken file keeps the last good page (with an error banner)
            # and fails the JSON route loudly.
            printf '  @date not-a-date\n' >> live.rkt
            curl -sf -o page3.html http://127.0.0.1:8099/
            grep -q "Smoke reload marker" page3.html
            grep -q "sf-error" page3.html
            test "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8099/api/tree)" = 500

            kill %1

            touch $out
          '';
      });
    };
}
