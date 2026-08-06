# The example as its own artifact: one program, built from this directory and
# the `live` package it consumes. Not part of that package — live/default.nix
# drops examples/ from the collection it ships, because somebody installing
# the framework has no use for the demo and no reason to compile it.
#
# The Nix file lives beside what it is about, like acp/, e2e/ and live/ do;
# flake.nix only callPackages it (`nix run .#counters`).
{ lib, stdenv, racket, arch, live }:

stdenv.mkDerivation {
  pname = "counters";
  version = "0.1";

  # The program is these five modules, the declaration that says what they may
  # depend on and reach for, and the test that says they work — stated
  # positively: the README, this file and the just module are about the example
  # without being part of it, so editing any of them rebuilds nothing. A sixth
  # module is one line here — the right amount of ceremony for a directory
  # whose whole point is that a human reads all of it.
  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./app.rkt
      ./arch.rkt
      ./clock.rkt
      ./counters.rkt
      ./header.rkt
      ./list.rkt
      ./tests
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
    cp -a "${arch}" ./arch-pkg
    cp -a "${live}" ./live-pkg
    chmod -R u+w ./arch-pkg ./live-pkg
    raco pkg install --copy --no-docs --deps force ./arch-pkg
    raco pkg install --copy --no-docs --deps force ./live-pkg

    mkdir -p $out/bin
    raco exe -o $out/bin/counters app.rkt

    runHook postInstall
  '';

  # The test rides with the thing it tests, so building the example IS running
  # it: no lane has to remember, no CI file has to say when, and the answer
  # cannot be stale with respect to the artifact — it was produced by it.
  #
  # installCheck and not check: it needs the framework installed under $out,
  # which is the phase above. It boots the server on 127.0.0.1 with port 0,
  # and the sandbox's loopback is all that takes.
  doInstallCheck = true;
  installCheckPhase = ''
    runHook preInstallCheck
    raco test tests/counters.rkt
    runHook postInstallCheck
  '';

  meta = with lib; {
    description = "counters: the live/ framework's worked example, as a program";
    mainProgram = "counters";
    license = licenses.agpl3Plus;
  };
}
