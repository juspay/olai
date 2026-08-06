# The `arch` collection: the declaration language, and the checker over it.
#
# Its own derivation because it is its own package — a library with its own
# reason to be built, under both `live` and `olai` rather than inside either.
# flake.nix only callPackages it, like acp/, e2e/ and live/ do.
#
# It is packaged at all, rather than being a dev-time script, because the two
# collections it sits under carry `#lang arch` files: `live/arch.rkt` and
# `olai/**/arch.rkt` are modules, and a build that installs those packages has
# to be able to compile them. Shipping the checker with them is the price of
# the declarations living beside the code they are about, which is the whole
# point of the thing.
{ lib, stdenvNoCC }:

stdenvNoCC.mkDerivation {
  pname = "arch";
  version = "0.1";

  # What the collection IS, said positively: this file is about producing the
  # package rather than in it, and the README is documentation the package
  # does not need in order to work.
  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.difference ./. (lib.fileset.unions [ ./default.nix ./README.md ]);
  };

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out
    cp -a ./* $out/
    runHook postInstall
  '';

  meta = with lib; {
    description = "#lang arch: a package's architecture as data, and the checker that holds it to it";
    license = licenses.agpl3Plus;
  };
}
