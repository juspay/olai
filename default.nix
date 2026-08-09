# Root composer for olai's Nix packages, invoked by flake.nix.
#
# `b2n` carries the bun2nix helpers, built in flake.nix by
# `lib.mkBun2nix { inherit pkgs; }` (juspay/bun2nix's rawflake standalone API).
# It is required: everything here is backed by `base`, which needs it.
{ pkgs ? import ./nix/nixpkgs.nix { }, b2n, rev ? "dev" }:
let
  kolu = import ./nix/kolu.nix;
  version = (pkgs.lib.importJSON ./package.json).version;

  # @kolu/surface-app's own helper for stamping a build's commit into the
  # no-store shell (and into the server that serves it, so a tab can tell it is
  # running code from a server that has since been replaced). Imported from the
  # npins path rather than from the staged derivation: reading a nix file out
  # of a built store path would be import-from-derivation.
  stamp = import ((import ./npins).kolu + "/packages/surface-app/nix/commit-stamp.nix") { };

  src = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions [
      ./package.json
      ./bun.lock
      ./bun.nix
      ./bunfig.toml
      ./tsconfig.base.json
      ./packages
      # The one script the build runs — not all of scripts/, so editing the
      # dependency checker does not rotate this derivation and rebuild.
      ./scripts/hydrate-kolu-packages.sh
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
  base = pkgs.stdenv.mkDerivation {
    pname = "olai-base";
    inherit version src;

    # b2n.hook propagates its own bun; listing ours first wins on PATH, so the
    # bun that installs and the bun the wrapper execs are one version.
    nativeBuildInputs = [ pkgs.bun b2n.hook ];

    bunDeps = b2n.fetchBunDeps { bunNix = ./bun.nix; };

    # Matches bunfig.toml, passed explicitly so the linker choice survives if
    # the hook ever stops reading bunfig.toml.
    bunInstallFlags = [ "--linker=isolated" ];

    # The server runs its sources directly — nothing to compile — and the
    # default fixup walk over node_modules is pure overhead. The BROWSER is the
    # exception: it gets a real bundle, built below by the same script the dev
    # loop runs, so there is one build and not two that could drift.
    dontUseBunBuild = true;
    dontFixup = true;

    # The @kolu/* packages are not in bun.lock — they are Nix-store sources
    # from the overlay, dropped in *after* bun install populates node_modules.
    # Same argv the dev shell uses (nix/kolu.nix).
    postBunNodeModulesInstallPhase = ''
      sh scripts/hydrate-kolu-packages.sh ${kolu.hydrateArgs pkgs}
    '';

    buildPhase = ''
      runHook preBuild
      ${stamp.exportLine rev}
      bun packages/web/src/build.ts packages/web/dist
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      cp -r . $out
      # The wrappers below hard-code these two paths. Fail the BUILD, not a
      # user's first run, if either moves.
      for entry in \
        "$out/packages/server/src/main.ts" \
        "$out/packages/web/dist/index.html"
      do
        test -e "$entry" || {
          echo "installPhase: $entry is missing — update default.nix if the path changed" >&2
          exit 1
        }
      done
      runHook postInstall
    '';
  };

  # The static assets on their own, so the server's closure names the bundle
  # rather than reaching into the build tree for it.
  olai-client = pkgs.runCommand "olai-client"
    { meta.description = "olai browser bundle (static assets)"; }
    "cp -r ${base}/packages/web/dist $out";

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
      --add-flags "${base}/packages/server/src/main.ts" \
      --set OLAI_DIST_DIR "${olai-client}" \
      --set ${stamp.envVar} "${rev}"
  '';
in
{
  inherit olai olai-client base;
}
