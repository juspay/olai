# Root composer for olai's Nix packages, invoked by flake.nix.
#
# `b2n` is upstream bun2nix's package (`packages.<system>.default`): the CLI
# derivation, with `hook` and `fetchBunDeps` on passthru. Required — everything
# here is backed by `base`, which needs it.
{ pkgs ? import ./nix/nixpkgs.nix { }, b2n, rev ? "dev" }:
let
  kolu = import ./nix/kolu.nix { inherit pkgs; };
  odu = import ./nix/odu.nix { inherit pkgs b2n; };
  cordis = import ./nix/cordis.nix { inherit pkgs; };
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

  # Each tenant's own logo, out of that tenant's pin, already a TypeScript
  # module — `@olai/plugin-kit` is the transform, the plugin's `default.nix`
  # names the file. `nix build .#kolu-mark` / `.#odu-mark` is the command
  # that answers "what does the pin currently say the logo is", which
  # matters because the generated file is gitignored and a pin bump therefore
  # shows no diff of its own.
  kolu-mark = import ./packages/plugins/kolu { inherit pkgs; };
  odu-mark = import ./packages/plugins/odu { inherit pkgs; };

  src = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions [
      ./package.json
      ./bun.lock
      ./bun.nix
      ./bunfig.toml
      ./tsconfig.base.json
      ./packages
    ];
  };

  # The repo tree with node_modules installed and the @kolu/* sources
  # hydrated from the npins kolu pin — bun-runnable as raw TypeScript, no
  # build step (the kolu convention).
  #
  # `b2n.fetchBunDeps` reads the committed bun.nix and builds a fake Bun cache
  # from per-tarball FODs (hashes out of the lockfile, so no network in the
  # sandbox); `b2n.hook` installs that cache with `bun install
  # --ignore-scripts`. `--offline` (bun 1.4.1) is the sandbox contract: a
  # registry round-trip is a hard error naming the missing cache entry, not
  # DNSResolveFailed from a private netns. `--frozen-lockfile` is the other
  # half — bun 1.4 otherwise wants to rewrite bun.lock (lockfileVersion 1→2)
  # and that rewrite is the thing that goes looking for manifests. The hook
  # does not pass either; olai does. See juspay/olai#503.
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
    # the hook ever stops reading bunfig.toml. Setting bunInstallFlags
    # replaces the hook's default, so Darwin still needs --backend=symlink
    # (clonefile from the store cache leaves node_modules/.bun read-only).
    bunInstallFlags = [
      "--linker=isolated"
      "--offline"
      "--frozen-lockfile"
    ] ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
      "--backend=symlink"
    ];

    # The server runs its sources directly — nothing to compile — and the
    # default fixup walk over node_modules is pure overhead. The BROWSER is the
    # exception: it gets a real bundle, built below by the same script the dev
    # loop runs, so there is one build and not two that could drift.
    dontUseBunBuild = true;
    dontFixup = true;

    # The @kolu/* packages are not in bun.lock — they are Nix-store sources,
    # dropped in *after* bun install populates node_modules. Both the SCRIPT
    # and the argv come off the pin (nix/kolu.nix), so this derivation and the
    # dev shell run the same copier over the same list.
    # ...and `@odu/run-client` beside them, through the SAME script: the copier
    # takes (src, dest) pairs and knows nothing about which repo a source came
    # from, which is why odu needs no second one (nix/odu.nix).
    # ...and CORDIS on a third line, four packages out of one pin
    # (nix/cordis.nix): the runtime the server's plugin composition is built
    # on, hydrated as raw TypeScript like everything else olai pins.
    # ...and THE ROWS, AS CODE: the browser's rows, the stylesheet chain and the
    # merged testid table, written out of packages/bundle/olai.yml so that file
    # is the only place a plugin is named (packages/bundle/generate.ts). Here
    # rather than in buildPhase for the mark's reason one line down — the
    # generated files are gitignored, so they are never in the store copy of the
    # tree, and a packaged build cannot ship a stale one.
    # ...and kolu's MARK on a fourth line, which is the same errand for an asset
    # rather than for sources. It must run here rather than in buildPhase
    # because `bun packages/web/src/build.ts` bundles it as a module: the
    # generated file is gitignored and `fileset.toSource` above takes tracked
    # content only, so it is never in the store copy of the tree and a packaged
    # build is structurally incapable of shipping a stale working-tree logo.
    postBunNodeModulesInstallPhase = ''
      sh ${kolu.hydrateScript} ${kolu.hydrateArgs}
      sh ${kolu.hydrateScript} ${odu.hydrateArgs}
      sh ${kolu.hydrateScript} ${cordis.hydrateArgs}
      bun packages/bundle/generate.ts
      install -m 644 ${kolu-mark}/mark.generated.ts packages/plugins/kolu/src/browser/mark.generated.ts
      install -m 644 ${odu-mark}/mark.generated.ts packages/plugins/odu/src/browser/mark.generated.ts
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

  # Codex owns a separate pin and derivation: its adapter and native CLI move
  # on one release clock, independently of the patched Claude/Pi bundle above.
  codex-agent = pkgs.callPackage ./packages/plugins/codex/acp { };

  # The pinned odu BINARY, the second half of what the odu pin vendors
  # (nix/odu.nix): the chat probe resolves `odu` on the SERVER's PATH, so a
  # packaged olai puts it there itself rather than asking a host to have one —
  # the acp-agent line's own argument, one integration over.
  odu-bin = odu.bin;

  # THE ODU KNOB THE WRAPPER READS, documented beside it because the wrapper
  # is generated text: `OLAI_ODU_BIN` names a DIRECTORY to put first on the
  # server's PATH. Unset, it answers the pin — every packaged start resolves
  # the build's own `odu`; set to a directory, it answers that one (an
  # operator testing a development odu against a packaged olai); set to the
  # empty string, it is the explicit off switch — the probe then answers
  # from the ambient PATH, and a PATH with no odu draws the plugin's missing
  # row rather than nothing. `--set-default` is what makes the empty answer
  # reachable: it substitutes only when the variable is UNSET, so an empty
  # value survives it. A set-but-not-a-directory value is skipped with a
  # stderr line (the row then says the rest) — a serve that refuses to boot
  # over one mis-set variable is the worse failure for the systemd unit.
  # scripts/olai-path.sh is the dev loop's spelling of the same knob; the
  # e2e suite's servers are this wrapper, so it is also the suite's spelling.
  olai = pkgs.runCommand "olai"
    {
      nativeBuildInputs = [ pkgs.makeWrapper ];
      meta = {
        description = "olai — outliner over flat-record JSONL";
        mainProgram = "olai";
      };
    } ''
    mkdir -p $out/bin
    # The compose-not-splice rule olai-path.sh teaches, and every face owns:
    # an unguarded `:$PATH` with PATH unset earns every spawned server a
    # trailing colon — the empty PATH element, the working directory
    # smuggled onto it. scripts/olai-path.sh writes it the same way.
    makeWrapper ${pkgs.bun}/bin/bun $out/bin/olai \
      --add-flags "${base}/packages/server/src/main.ts" \
      --set OLAI_DIST_DIR "${olai-client}" \
      --set-default OLAI_ACP_AGENT "${acp-agent}/bin/claude-agent-acp" \
      --set-default OLAI_ACP_CODEX "${codex-agent}/bin/codex-acp" \
      --set-default OLAI_ACP_PI "${acp-agent}/bin/pi-acp" \
      --set-default OLAI_ODU_BIN "${odu-bin}/bin" \
      --run 'if [ -n "$OLAI_ODU_BIN" ]; then if [ -d "$OLAI_ODU_BIN" ]; then export PATH="$OLAI_ODU_BIN''${PATH:+:$PATH}"; else echo "olai: OLAI_ODU_BIN=$OLAI_ODU_BIN is not a directory — no odu goes on the PATH of this serve" >&2; fi; fi'
  '';
in
{
  inherit olai olai-client olai-fonts kolu-mark odu-mark base acp-agent codex-agent odu-bin;
}
