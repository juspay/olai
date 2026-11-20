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
      isWorkspaceMember = name: builtins.elem name memberNames;
      unexpected = builtins.filter
        (name: !isWorkspaceMember name && builtins.match ".+@[^@]+" name == null)
        (builtins.attrNames all);
    in
    if unexpected != [ ]
    then
      throw ''
        bun.nix has entries that are neither a registry package nor a workspace member: ${builtins.concatStringsSep ", " unexpected}.
        olai-deps keeps only the registry packages (default.nix); teach that filter what these are.
      ''
    else pkgs.lib.filterAttrs (name: _: !isWorkspaceMember name) all;

  depsSrc = pkgs.lib.fileset.toSource {
    root = ./.;
    fileset = pkgs.lib.fileset.unions ([
      ./package.json
      ./bun.lock
      ./bun.nix
      ./bunfig.toml
    ] ++ memberManifests);
  };

  # bun 1.4.1's `--offline` makes a sandbox install a cache miss naming the
  # missing entry rather than DNSResolveFailed; `--frozen-lockfile` stops bun
  # 1.4 rewriting bun.lock (lockfileVersion 1→2), the rewrite that goes
  # looking for npm manifests. See juspay/olai#503.
  olai-deps = pkgs.stdenv.mkDerivation {
    pname = "olai-deps";
    inherit version;
    src = depsSrc;

    nativeBuildInputs = [ pkgs.bun b2n.hook ];

    bunDeps = b2n.fetchBunDeps {
      bunNix = { copyPathToStore, fetchFromGitHub, fetchgit, fetchurl, ... }@args:
        registryPackages args;
    };

    # Setting bunInstallFlags replaces the hook's default, so Darwin still
    # needs --backend=symlink: clonefile from the store cache leaves
    # node_modules/.bun read-only.
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

    deps=${olai-deps}
    for farm in "$deps"/workspaces/packages/*/node_modules \
                "$deps"/workspaces/packages/plugins/*/node_modules; do
      rel=''${farm#"$deps"/workspaces/}
      mkdir -p "$(dirname "$out/$rel")"
      cp -a "$farm" "$out/$rel"
      chmod -R u+w "$out/$rel"
    done

    sh ${bundle.hydrateScript}
    bun packages/bundle/generate.ts

    # @tailwindcss/cli transitively dlopen()s @parcel/watcher's native binding
    # at startup — even without --watch — and that binding wants libstdc++,
    # which the sandbox does not put on the loader path.
    export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib:''${LD_LIBRARY_PATH:-}"
    export OLAI_FONTS_DIR="${olai-fonts}"
    ${stamp.exportLine rev}
    bun packages/web/src/build.ts packages/web/dist

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
    makeWrapper ${pkgs.bun}/bin/bun $out/bin/olai \
      --add-flags "${base}/packages/server/src/main.ts" \
      --set OLAI_DIST_DIR "${olai-client}" \
      ${bundle.wrapperArgs}
  '';
in
{
  inherit olai olai-client olai-fonts base olai-deps bundle;
}
