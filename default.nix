# Root composer for olai's Nix packages. Used by flake.nix and by
# `nix-build` directly.
#
# `b2n` carries the bun2nix helpers, passed in from flake.nix via
# `lib.mkBun2nix { inherit pkgs; }` (juspay/bun2nix's rawflake standalone
# API). The build derivation throws without it, so a b2n-less import can still
# reach the overlay's @kolu/* attrs.
{ pkgs ? import ./nix/nixpkgs.nix { }, b2n ? null }:
let
  kolu = import ./nix/kolu.nix;
  version = (pkgs.lib.importJSON ./package.json).version;

  src = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions [
      ./package.json
      ./bun.lock
      ./bun.nix
      ./bunfig.toml
      ./tsconfig.base.json
      ./packages
      ./scripts
    ];
  };

  # The repo tree with node_modules installed and the @kolu/* sources
  # hydrated from the npins kolu pin — bun-runnable as raw TypeScript, no
  # build step (the kolu convention).
  #
  # `b2n.fetchBunDeps` reads the committed bun.nix and builds a fake Bun cache
  # from per-tarball FODs (hashes out of the lockfile, so no network in the
  # sandbox); `b2n.hook` installs that cache with `bun install
  # --ignore-scripts`.
  base =
    if b2n == null
    then throw "olai's build derivation needs `b2n` (lib.mkBun2nix output) — build through flake.nix"
    else
      pkgs.stdenv.mkDerivation {
        pname = "olai-base";
        inherit version src;

        # b2n.hook propagates its own bun; listing ours first wins on PATH, so
        # the bun that installs and the bun the wrapper execs are one version.
        nativeBuildInputs = [ pkgs.bun b2n.hook ];

        bunDeps = b2n.fetchBunDeps { bunNix = ./bun.nix; };

        # Matches bunfig.toml, passed explicitly so the linker choice survives
        # if the hook ever stops reading bunfig.toml.
        bunInstallFlags = [ "--linker=isolated" ];

        # Bun runs the sources directly: nothing to compile, and the default
        # fixup walk over node_modules is pure overhead.
        dontUseBunBuild = true;
        dontBuild = true;
        dontFixup = true;
        dontPatchShebangs = true;

        # The @kolu/* packages are not in bun.lock — they are Nix-store
        # sources from the overlay, dropped in *after* bun install populates
        # node_modules. Same argv the dev shell uses (nix/kolu.nix).
        postBunNodeModulesInstallPhase = ''
          sh scripts/hydrate-kolu-packages.sh ${kolu.hydrateArgs pkgs}
        '';

        installPhase = ''
          runHook preInstall
          cp -r . $out
          runHook postInstall
        '';
      };

  olai = pkgs.runCommand "olai"
    {
      nativeBuildInputs = [ pkgs.makeWrapper ];
      meta = {
        description = "olai — outliner over flat-record JSONL";
        mainProgram = "olai";
      };
    } ''
    mkdir -p $out/bin
    makeWrapper ${pkgs.bun}/bin/bun $out/bin/olai \
      --add-flags "${base}/packages/core/src/main.ts"
  '';
in
{
  inherit olai base;
}
