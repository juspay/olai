# Root composer for olai's Nix packages, invoked by flake.nix.
#
# `b2n` is upstream bun2nix's package (`packages.<system>.default`): the CLI
# derivation, with `hook` and `fetchBunDeps` on passthru. Required — everything
# here is backed by `base`, which needs it.
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

  # The hosted typefaces, already converted to woff2 — @olai/fonts owns both
  # the catalog and the derivation that realises it, so this is the whole of
  # what the client build needs to be told about fonts.
  olai-fonts = import ./packages/fonts { inherit pkgs; };

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
    # bun that installs and the bun the wrapper execs are one version. No
    # woff2 here: the faces are already woff2 when this build sees them
    # (packages/fonts/default.nix), and its font step is a copy.
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
      # @tailwindcss/cli transitively dlopen()s @parcel/watcher's native
      # binding at startup — even without --watch — and that binding wants
      # libstdc++, which the sandbox does not put on the loader path.
      export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:''${LD_LIBRARY_PATH:-}"
      export OLAI_FONTS_DIR="${olai-fonts}"
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

  # The ACP agent the chat panel talks to, pinned rather than looked up: a
  # nix-built olai needs nothing ambient, and two machines run the same adapter.
  acp-agent = pkgs.callPackage ./nix/acp-agent.nix { };

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
      --set-default OLAI_ACP_AGENT "${acp-agent}/bin/claude-agent-acp"
  '';
in
{
  inherit olai olai-client olai-fonts base acp-agent;
}
