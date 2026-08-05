# `src = ./.` stays a flake-level decision (that's what makes the whole repo,
# including nix/, the package's source) so the flake passes it in rather than
# this file assuming its own directory.
{ lib, stdenv, racket, makeWrapper, tzdata, racketDeps, racketPkgs, src }:

stdenv.mkDerivation {
  pname = "selfflowy";
  version = "0.1.0";
  inherit src;
  nativeBuildInputs = [ racket makeWrapper ];
  buildInputs = [ tzdata ];

  # Zoneinfo for gregor/tzinfo during build (sandbox has no /usr/share).
  TZDIR = "${tzdata}/share/zoneinfo";

  buildPhase = ''
    export PLTUSERHOME="$TMPDIR/plt-user"
    mkdir -p "$PLTUSERHOME"
    export TZDIR="${tzdata}/share/zoneinfo"

    # tzinfo searches relative cwd paths and PLTUSERHOME share dirs.
    mkdir -p tzdata
    ln -sfn "${tzdata}/share/zoneinfo" tzdata/zoneinfo
    mkdir -p "$PLTUSERHOME/.local/share/racket/9.2/share/tzdata"
    ln -sfn "${tzdata}/share/zoneinfo" \
      "$PLTUSERHOME/.local/share/racket/9.2/share/tzdata/zoneinfo"

    cp -a "$src/selfflowy" ./selfflowy-pkg
    chmod -R u+w ./selfflowy-pkg

    # Offline install of npins-vendored deps (order matters).
    # --deps force: markdown wants package name "parsack"; we ship
    # parsack-lib. selfflowy wants "gregor"; we ship gregor-lib.
    ${lib.concatMapStringsSep "\n" (p: ''
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
      --set TZDIR "${tzdata}/share/zoneinfo" \
      --prefix PATH : "${tzdata}/bin"
    mkdir -p $out/share/tzdata
    ln -sfn "${tzdata}/share/zoneinfo" $out/share/tzdata/zoneinfo
  '';

  meta = with lib; {
    description = "selfflowy CLI — validate and render #lang selfflowy outlines";
    mainProgram = "selfflowy";
    license = licenses.agpl3Plus;
  };
}
