# The example as its own artifact: one program, built from this directory and
# the `live` package it consumes. Not part of that package — live/default.nix
# drops examples/ from the collection it ships, because somebody installing
# the framework has no use for the demo and no reason to compile it.
#
# The Nix file lives beside what it is about, like acp/, e2e/ and live/ do;
# flake.nix only callPackages it (`nix run .#counters`).
{ lib, stdenv, racket, live }:

stdenv.mkDerivation {
  pname = "counters";
  version = "0.1";

  # The program is these five modules, stated positively: the README, this
  # file, the just module and the test are about the example without being
  # part of the thing that runs, so editing any of them rebuilds nothing. A
  # sixth module is one line here — which is the right amount of ceremony for
  # a directory whose whole point is that a human reads all of it.
  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./app.rkt
      ./clock.rkt
      ./counters.rkt
      ./header.rkt
      ./list.rkt
    ];
  };

  nativeBuildInputs = [ racket ];
  # racket is a true runtime dep: `raco exe` writes a stub over store racket.
  buildInputs = [ racket ];

  # No build phase: the install is a package install and a `raco exe`.
  dontBuild = true;

  # `live` is installed under $out rather than a temp dir on purpose. Its
  # browser runtime is found through define-runtime-path at RUN time, so the
  # path baked into the executable has to be one that still exists when
  # somebody runs it.
  installPhase = ''
    runHook preInstall

    export PLTUSERHOME="$out/share/counters-plt"
    mkdir -p "$PLTUSERHOME"

    # --copy, not --link: a link would leave /build paths in the catalog for
    # raco exe to bake in. The framework comes from its own derivation, with
    # its vendored static/ already staged (live/default.nix).
    cp -a "${live}" ./live-pkg
    chmod -R u+w ./live-pkg
    raco pkg install --copy --no-docs --deps force ./live-pkg

    mkdir -p $out/bin
    raco exe -o $out/bin/counters app.rkt

    runHook postInstall
  '';

  meta = with lib; {
    description = "counters: the live/ framework's worked example, as a program";
    mainProgram = "counters";
    license = licenses.agpl3Plus;
  };
}
