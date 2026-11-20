{ pkgs ? import ./nix/nixpkgs.nix { }, b2n, rev ? "dev" }:
let
  pins = import ./npins;

  bundle = import ./packages/bundle {
    inherit pkgs pins b2n;
  };
  kolu = import ./nix/kolu.nix {
    inherit pkgs;
    extraSeeds = bundle.koluSeeds;
    pinnedSources = bundle.koluPins;
  };
  cordis = import ./nix/cordis.nix { inherit pkgs; };
  version = (pkgs.lib.importJSON ./package.json).version;

  stamp = import (pins.kolu + "/packages/surface-app/nix/commit-stamp.nix") { };

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

  depsSrc = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions ([
      ./package.json
      ./bun.lock
      ./bun.nix
      ./bunfig.toml
    ] ++ memberManifests);
  };

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

    nativeBuildInputs = [ pkgs.bun b2n.hook ];

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

    dontUseBunBuild = true;
    dontBuild = true;
    dontFixup = true;

    postBunNodeModulesInstallPhase = ''
      sh ${kolu.hydrateScript} ${kolu.hydrateArgs}
      sh ${kolu.hydrateScript} ${cordis.hydrateArgs}
    '';

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

  base = pkgs.runCommand "olai-base-${version}"
    {
      nativeBuildInputs = [ pkgs.bun ];
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
