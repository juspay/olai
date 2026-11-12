# Root composer for olai's Nix packages, invoked by flake.nix.
#
# `b2n` is upstream bun2nix's package (`packages.<system>.default`): the CLI
# derivation, with `hook` and `fetchBunDeps` on passthru. Required — everything
# here is backed by `base`, which needs it.
{ pkgs ? import ./nix/nixpkgs.nix { }, b2n, rev ? "dev" }:
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

  # THE WORKSPACE MEMBERS' MANIFESTS, read off the two globs `package.json`
  # declares (`packages/*`, `packages/plugins/*`) rather than found by walking
  # `packages/` for the name. A walk is what a `fileset.fileFilter` would do,
  # and in a checkout that has run `bun install` it descends into every
  # member's own `node_modules` — thousands of manifests, and `olai-deps`
  # would hash differently on a machine depending on what a developer had done
  # in it. Reading the two directories names exactly the manifests `bun
  # install` has to resolve, and nothing a dev tree grew.
  memberManifests =
    let
      membersOf = dir:
        map (name: dir + "/${name}/package.json")
          (builtins.attrNames
            (pkgs.lib.filterAttrs (_: type: type == "directory")
              (builtins.readDir dir)));
    in
    builtins.filter builtins.pathExists
      (membersOf ./packages ++ membersOf ./packages/plugins);

  # THE REGISTRY HALF OF bun.nix, and the reason this split works at all.
  #
  # `bun.nix` lists every package in the lockfile, and that includes the
  # WORKSPACE MEMBERS — `"@olai/server" = copyPathToStore ./packages/server;`,
  # one line per member, a second copy of this repo's own sources keyed by
  # bare name because a member has no registry version. Handed to
  # `fetchBunDeps` they each become a cache entry, so the dependency cache —
  # and `olai-deps` with it — would move on every source edit, which is the
  # whole thing this split exists to stop. bun resolves a `workspace:*` arrow
  # from the tree it is installing in (the manifests are in `depsSrc`), never
  # from the global cache, so the cache does not want them.
  #
  # The filter reads the KEY — `<name>@<version>` for a registry package, a
  # bare name for a member — so no value is forced and no member is copied
  # into the store just to decide. What it drops is then asserted to be
  # exactly the workspace members: a future bun2nix entry that is neither
  # (a git dependency, say) is also versionless, and would otherwise vanish
  # from the cache silently, failing much later as an --offline miss.
  #
  # `bun.nix` itself stays generated and untouched; this is a filter over
  # what it returns.
  memberNames = map (m: (pkgs.lib.importJSON m).name) memberManifests;
  registryPackages = args:
    let
      all = import ./bun.nix args;
      versioned = name: builtins.match ".+@[^@]+" name != null;
      dropped = builtins.filter (name: !versioned name) (builtins.attrNames all);
      unexpected = pkgs.lib.subtractLists memberNames dropped;
    in
    if unexpected != [ ]
    then
      throw ''
        bun.nix has versionless entries that are not workspace members: ${builtins.concatStringsSep ", " unexpected}.
        olai-deps keeps only the registry packages (default.nix); teach that filter what these are.
      ''
    else pkgs.lib.filterAttrs (name: _: versioned name) all;

  # WHAT `bun install` MAKES, and nothing of the source tree. Keyed on the
  # manifests and the lockfile, so it is ONE store path for as long as the
  # dependencies hold still.
  #
  # `olai-base` used to be this install and the sources in one derivation,
  # which made ~600 MB of node_modules part of a package whose hash moves with
  # every commit. The cache measured the cost: 35 copies of that closure in
  # eight days, 22 GB of the `kolu-r2` bucket, every one of them the same
  # dependencies re-pushed under a new name because a `.ts` file had changed.
  # Split out, those bytes are stored once per lockfile. juspay/odu#175 made
  # the same split for the same reason; this is that shape.
  #
  # The fileset is therefore everything `bun install --frozen-lockfile` READS
  # and not one file more: the root manifest, the lockfile, `bunfig.toml` (the
  # linker), `bun.nix` (the fetched tarballs) and every workspace member's
  # `package.json` so the member resolves. No `tsconfig.base.json` — the
  # install does not read it, and a file here that the install does not read
  # gives the per-commit churn back. The hydrate copier is not here either:
  # it comes off the kolu pin (`nix/kolu.nix`), already a store path.
  depsSrc = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions ([
      ./package.json
      ./bun.lock
      ./bun.nix
      ./bunfig.toml
    ] ++ memberManifests);
  };

  # The installed dependency tree, with the @kolu/*, @odu/* and cordis sources
  # hydrated into it from the npins pins — raw TypeScript, no build step (the
  # kolu convention).
  #
  # THE HYDRATES LIVE HERE because they write into `node_modules`, and a
  # hydrated package resolves its own imports from its REALPATH: that realpath
  # is inside this derivation, whose root `node_modules` is the one holding
  # `effect`, `solid-js` and the rest — the walk-up invariant `bunfig.toml`
  # states, now satisfied one derivation over. Their sources are pins, so they
  # move when a pin moves and not when a commit does.
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
  olai-deps = pkgs.stdenv.mkDerivation {
    pname = "olai-deps";
    inherit version;
    src = depsSrc;

    # b2n.hook propagates its own bun; listing ours first wins on PATH, so the
    # bun that installs and the bun the wrapper execs are one version.
    nativeBuildInputs = [ pkgs.bun b2n.hook ];

    # `bunNix` as a FUNCTION rather than the path: `fetchBunDeps` callPackages
    # whatever it is handed, so the generated file is read with the same
    # arguments it always had and the workspace entries are filtered out of
    # the result (see `registryPackages`).
    bunDeps = b2n.fetchBunDeps {
      bunNix = { copyPathToStore, fetchFromGitHub, fetchgit, fetchurl, ... }@args:
        registryPackages args;
    };

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

    # Nothing to compile and nothing to fix up: the server runs its sources
    # directly, and the default fixup walk over node_modules is pure overhead.
    dontUseBunBuild = true;
    dontBuild = true;
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
    postBunNodeModulesInstallPhase = ''
      sh ${kolu.hydrateScript} ${kolu.hydrateArgs}
      sh ${kolu.hydrateScript} ${cordis.hydrateArgs}
    '';

    # TWO DIRECTORIES, and both are install output. `$out/node_modules` is
    # exactly what bun wrote at the root — no manifest, no source, nothing this
    # derivation was handed — because those inputs are already in the
    # lockfile's hash and a copy of them here would be a second spelling of a
    # tree whose whole point is not to have one.
    #
    # `$out/workspaces/<member path>` is the SECOND thing bun wrote: the
    # isolated linker gives every workspace member its own farm beside its
    # manifest (`bunfig.toml` says why isolated). It is kept beside
    # node_modules rather than inside it so the sentence above stays true of
    # the one directory a resolver reads, and each farm is filed under the
    # member's own repo-relative path so `olai-base` puts it back by copying
    # path for path — `packages/plugins/<name>` is a member too, and a
    # basename would collide the two tiers.
    #
    # The workspace links in those farms are the sibling arrows — `@olai/log`,
    # `olai-plugin-identity` — and they point at `../../plugins/identity` and
    # the like, which is NOT in this output and is not meant to be. They stay
    # RELATIVE so they land on real source once `olai-base` puts the farm back
    # beside the manifest; dangling here is the trick, not an accident.
    installPhase = ''
      runHook preInstall
      mkdir -p $out
      cp -a node_modules $out/node_modules
      for member in packages/* packages/plugins/*; do
        [ -d "$member/node_modules" ] || continue
        mkdir -p "$out/workspaces/$member"
        cp -a "$member/node_modules" "$out/workspaces/$member/node_modules"
      done
      runHook postInstall
    '';
  };

  # The repo tree, bun-runnable with no build step (the kolu convention) — the
  # source fileset, plus a node_modules that POINTS AT `olai-deps` rather than
  # containing it. A commit's worth of difference is now a few megabytes of
  # source, the browser bundle, and a tree of symlinks.
  base = pkgs.runCommand "olai-base-${version}"
    {
      nativeBuildInputs = [ pkgs.bun ];
      # The default fixup walk over a tree of sources and symlinks is pure
      # overhead — bun runs the sources directly, and there is no bin dir here
      # whose shebangs anyone reads.
      dontFixup = true;
      meta.description = "olai's source tree with node_modules resolved against olai-deps";
    } ''
    cp -r ${src} $out
    chmod -R u+w $out
    cd $out

    shopt -s dotglob nullglob

    # Mirror deps' node_modules one directory at a time. Three kinds of entry,
    # three answers:
    #
    #   a symlink      — replayed VERBATIM. Every one bun writes is relative,
    #                    and the tree it means is THIS one: `.bun/…` lands on
    #                    the reference this same loop makes.
    #   a scope (`@…`) — recursed into, because `@kolu` holds hydrated source
    #                    DIRECTORIES and `@effect` holds dependency links, and
    #                    only the entries themselves know which.
    #   any other dir  — linked BY REFERENCE into the store. That is `.bun`
    #                    (nearly all of the bytes this split is about), `.bin`,
    #                    and the hydrated sources, whose imports resolve from
    #                    their realpath inside `olai-deps`.
    mirror() {
      local from=$1 to=$2 path name
      mkdir -p "$to"
      for path in "$from"/*; do
        name=''${path##*/}
        if [ -L "$path" ]; then
          cp -P "$path" "$to/$name"
        elif [ -d "$path" ] && [ "''${name#@}" != "$name" ]; then
          mirror "$path" "$to/$name"
        else
          ln -s "$path" "$to/$name"
        fi
      done
    }
    mirror ${olai-deps}/node_modules $out/node_modules

    # And each member's own farm back beside its manifest, where the `../../`
    # hops in it are true again. Copied path for path, so a plugin's farm
    # lands under `packages/plugins/<name>` and a top-level member's under
    # `packages/<name>`.
    deps=${olai-deps}
    for farm in "$deps"/workspaces/packages/*/node_modules \
                "$deps"/workspaces/packages/plugins/*/node_modules; do
      rel=''${farm#"$deps"/workspaces/}
      mkdir -p "$(dirname "$out/$rel")"
      cp -a "$farm" "$out/$rel"
      chmod -R u+w "$out/$rel"
    done

    # NOW THE STEPS THAT NEED THE SOURCES, in the order they needed before.
    # The plugin hydrate is here rather than in `olai-deps` because its second
    # half writes into the plugins' own trees (`install -m 644 … into
    # packages/plugins/<name>/`), and the generated rows are written here for
    # the mark's own reason: the generated files are gitignored, so they are
    # never in the store copy of the tree, and a packaged build cannot ship a
    # stale one.
    sh ${bundle.hydrateScript}
    bun packages/bundle/generate.ts

    # The BROWSER gets a real bundle, built by the same script the dev loop
    # runs, so there is one build and not two that could drift.
    #
    # @tailwindcss/cli transitively dlopen()s @parcel/watcher's native binding
    # at startup — even without --watch — and that binding wants libstdc++,
    # which the sandbox does not put on the loader path.
    export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:''${LD_LIBRARY_PATH:-}"
    export OLAI_FONTS_DIR="${olai-fonts}"
    ${stamp.exportLine rev}
    bun packages/web/src/build.ts packages/web/dist

    # The wrappers below hard-code these two paths. Fail the BUILD, not a
    # user's first run, if either moves.
    for entry in \
      "$out/packages/server/src/main.ts" \
      "$out/packages/web/dist/index.html"
    do
      test -e "$entry" || {
        echo "olai-base: $entry is missing — update default.nix if the path changed" >&2
        exit 1
      }
    done
  '';

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
  # engine and mail alike (KOLU_ACP_AGENT, OLAI_ACP_CODEX, OLAI_ACP_PI,
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
  inherit olai olai-client olai-fonts base olai-deps bundle;
}
