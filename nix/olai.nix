# `src = ./.` stays a flake-level decision (that's what makes the whole repo,
# including nix/, the package's source) so the flake passes it in rather than
# this file assuming its own directory.
#
# Packaging model (Nix, not raco distribute):
#   * Install collections under $out so absolute data-file paths that
#     `raco exe` embeds stay live at runtime (cldr xml, web/static, …).
#   * Emit a `raco exe` stub that re-execs the store racket (marker "e…");
#     the scanner keeps racket in the closure via that path string.
#   * Never `raco distribute`: it is for relocatable non-Nix bundles, and
#     on Darwin it is broken for us — nixpkgs builds racket with
#     `--enable-xonx`, so `cross-system-type` is `unix` and distribute's
#     ELF patcher arity-mismatches (compiler/private/elf.rkt).
{ lib, stdenv, racket, makeWrapper, tzdata, racketDeps, racketPkgs, src
, acpAgent
}:

stdenv.mkDerivation {
  pname = "olai";
  version = "0.1.0";
  inherit src;
  nativeBuildInputs = [ racket makeWrapper ];
  # racket is a true runtime dep: the exe is a stub over store racket.
  # acpAgent is too: serve needs it, and the wrapper defaults OLAI_ACP_AGENT
  # so the binary is self-sufficient (exported var still wins).
  buildInputs = [ racket tzdata acpAgent ];

  # Zoneinfo for gregor/tzinfo during the install-time raco setup.
  TZDIR = "${tzdata}/share/zoneinfo";

  # All install work writes under $out so embedded paths remain valid.
  # buildPhase is a no-op; the derivation is pure install.
  dontBuild = true;

  installPhase = ''
    runHook preInstall

    export PLTUSERHOME="$out/share/olai-plt"
    mkdir -p "$PLTUSERHOME"
    export TZDIR="${tzdata}/share/zoneinfo"

    # tzinfo searches relative cwd paths and PLTUSERHOME share dirs.
    mkdir -p tzdata
    ln -sfn "${tzdata}/share/zoneinfo" tzdata/zoneinfo
    mkdir -p "$PLTUSERHOME/.local/share/racket/9.2/share/tzdata"
    ln -sfn "${tzdata}/share/zoneinfo" \
      "$PLTUSERHOME/.local/share/racket/9.2/share/tzdata/zoneinfo"

    cp -a "$src/olai" ./olai-pkg
    chmod -R u+w ./olai-pkg

    # Offline install of npins-vendored deps (order matters).
    # --deps force: markdown wants package name "parsack"; we ship
    # parsack-lib. olai wants "gregor"; we ship gregor-lib.
    # --copy so each package lands under $PLTUSERHOME (i.e. $out).
    ${lib.concatMapStringsSep "\n" (p: ''
      echo "raco pkg install ${p.name}"
      raco pkg install --copy --no-docs --deps force --batch "${racketDeps}/${p.name}"
    '') racketPkgs}

    # --copy, not --link: a link would keep $src (or /build) paths in the
    # package catalog and raco exe would bake those into the stub.
    raco pkg install --copy --no-docs --deps force ./olai-pkg

    mkdir -p $out/bin
    # Embed language readers so #lang modules resolve with no collection
    # paths at runtime. ++lang olai is enough for the outline reader.
    # ++lang olai/sexp is NOT: raco maps multi-segment langs via
    # (lib "…/sexp.rkt") + relative "lang/reader.rkt", which collapses
    # to olai/lang/reader — the wrong module, declared, so the flag
    # silently no-ops. ++lib names the real reader path.
    raco exe ++lang olai ++lib olai/sexp/lang/reader \
      -o $out/bin/.olai-wrapped \
      "$(racket -e '(display (path->string (collection-file-path "cli.rkt" "olai")))')"
    chmod +x $out/bin/.olai-wrapped

    # TZDIR: gregor outside /usr/share. OLAI_ACP_AGENT: serve refuses to
    # start without one — default the bundled adapter so `nix build` / HM
    # / `nix run` need no ambient env. An exported var still wins.
    makeWrapper $out/bin/.olai-wrapped $out/bin/olai \
      --set TZDIR "${tzdata}/share/zoneinfo" \
      --set-default OLAI_ACP_AGENT "${lib.getExe acpAgent}" \
      --prefix PATH : "${tzdata}/bin"

    mkdir -p $out/share/tzdata
    ln -sfn "${tzdata}/share/zoneinfo" $out/share/tzdata/zoneinfo

    runHook postInstall
  '';

  meta = with lib; {
    description = "olai CLI — validate and render #lang olai outlines";
    mainProgram = "olai";
    license = licenses.agpl3Plus;
  };
}
