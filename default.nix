# Root composer for olai's Nix packages, invoked by flake.nix.
#
# `b2n` is upstream bun2nix's package (`packages.<system>.default`): the CLI
# derivation, with `hook` and `fetchBunDeps` on passthru. Required — everything
# here is backed by `base`, which needs it.
{ pkgs ? import ./nix/ekapkgs.nix { }, b2n, rev ? "dev" }:
let
  pins = import ./npins;

  # THE REGISTRY FOLD. `packages/bundle/default.nix` reads `packages/plugins/`,
  # imports every plugin's `default.nix`, validates the contracts with
  # `kit.contract`, and folds them — `hydrate`, `externals`, `koluSeeds`,
  # `koluPins`, `packages`, `checks`, `knobs`, the wrapper's makeWrapper args
  # and the dev loop's export snippet. The root names NO plugin; it reads one
  # fold output for everything a plugin contributes. `container = ./packages/plugins`
  # so `install -m 644` lines in `hydrateScript` resolve from the staged tree's
  # own root (`packages/plugins/<name>/...`).
  bundle = import ./packages/bundle {
    inherit pkgs pins b2n;
    # `containerDir`/`containerInTree` both name `packages/plugins` (readDir
    # at eval, install path at run time, relative to the build's source).
    #
    # Every knob the fold bakes into the `olai` wrapper comes from a plugin's
    # own `default.nix` — `OLAI_HIMALAYA` among them, owned by the mail
    # plugin, so there is no hand-written exception left to spare.
  };
  # The framework's pin: `nix/kolu.nix` takes `extraSeeds` and `pinnedSources`
  # from the fold (each plugin's contribution), and computes the closure for
  # the six seed names every olai source imports.
  kolu = import ./nix/kolu.nix {
    inherit pkgs;
    extraSeeds = bundle.koluSeeds;
    pinnedSources = bundle.koluPins;
  };
  cordis = import ./nix/cordis.nix { inherit pkgs; };
  version = (pkgs.lib.importJSON ./package.json).version;

  # @kolu/surface-app's own helper for stamping a build's commit into the
  # no-store shell (and into the server that serves it, so a tab can tell it is
  # running code from a server that has since been replaced). Imported from the
  # npins path rather than from the staged derivation: reading a nix file out
  # of a built store path would be import-from-derivation.
  stamp = import (pins.kolu + "/packages/surface-app/nix/commit-stamp.nix") { };

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
    # from, which is why odu needs no second one.
    # ...and CORDIS on a third line, four packages out of one pin
    # (nix/cordis.nix): the runtime the server's plugin composition is built
    # on, hydrated as raw TypeScript like everything else olai pins.
    # ...and THE ROWS, AS CODE: the browser's rows, the stylesheet chain and the
    # merged testid table, written out of packages/bundle/olai.yml so that file
    # is the only place a plugin is named (packages/bundle/generate.ts). Here
    # rather than in buildPhase for the mark's reason one line down — the
    # generated files are gitignored, so they are never in the store copy of the
    # tree, and a packaged build cannot ship a stale one.
    # THE WEB ROWS AND THE NUMERIC TOKEN TABLES, for the mark's own reason
    # one line up — generated sources the browser bundle reads as modules
    # (fileset.toSource above takes tracked content only, so a store copy of
    # the tree never has them and a packaged build cannot ship a stale one).
    postBunNodeModulesInstallPhase = ''
      sh ${kolu.hydrateScript} ${kolu.hydrateArgs}
      sh ${kolu.hydrateScript} ${cordis.hydrateArgs}
      sh ${bundle.hydrateScript}
      bun packages/bundle/generate.ts
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
  # THE WRAPPER'S PLUGIN KNOBS, folded once. `bundle.wrapperArgs` is the
  # makeWrapper text the fold's knob-shell renders for every declared knob —
  # one `--run` recording which knobs the wrapper defaulted (the settings
  # panel's 'wrapper-provided' label), one `--set-default` per knob (unset →
  # the pin, empty → the off switch), one `--run` per `dir` knob splicing the
  # directory onto PATH. The ACP adapters are plugins now — claude, pi and
  # codex each own a `default.nix` declaring their knob — so every knob,
  # engine and mail alike (OLAI_ACP_AGENT, OLAI_ACP_CODEX, OLAI_ACP_PI,
  # OLAI_ODU_BIN, OLAI_HIMALAYA), arrives here by composition; nothing is
  # hand-written any more.

  # Every plugin's package output arrives through the fold: `bundle.packages`
  # merges each plugin's `packages.*` (mail's `himalaya-bin` among them), and
  # the flake reads `bundle.packages // { inherit (olai) … }`, so no plugin
  # needs a root line to reach the flake.
  olai = pkgs.runCommand "olai"
    {
      nativeBuildInputs = [ pkgs.makeWrapper ];
      passthru.knobs = bundle.knobs;
      passthru.knobsTable = bundle.knobsTable;
      meta = {
        description = "olai — outliner over flat-record JSONL";
        mainProgram = "olai";
      };
    } ''
    mkdir -p $out/bin
    # THE COMPOSE-NOT-SPLICE RULE, repeated wherever PATH is put together: an
    # unguarded `:$PATH` with PATH unset earns every spawned server a trailing
    # colon — the empty PATH element, the working directory smuggled onto it
    # (juspay/kolu#2146's shape).
    makeWrapper ${pkgs.bun}/bin/bun $out/bin/olai \
      --add-flags "${base}/packages/server/src/main.ts" \
      --set OLAI_DIST_DIR "${olai-client}" \
      ${bundle.wrapperArgs}
  '';
in
{
  inherit olai olai-client olai-fonts base bundle;
}
