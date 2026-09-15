# BUILD ONE ACP ADAPTER FROM AN NPM SHIM — the mechanism, said once.
#
# npm is the only channel any shipped adapter comes through, so every one
# gets the same treatment every other pin here does: a committed lockfile in
# the plugin's own directory, one fixed-output derivation for the tarballs,
# nothing fetched at build time and no `npx` at run time. A nix-built olai
# therefore needs nothing ambient — no PATH lookup, no version that drifts
# under you between two machines.
#
# This function carries what is SHARED by every adapter, and names no plugin:
#   - `buildNpmPackage` over the shim's `package.json` and `package-lock.json`
#     (the only two files the build reads — kept out of the hash so a stray
#     third file in the shim dir does not move the store path);
#   - `dontNpmBuild` (a shim has nothing to compile),
#     `--ignore-scripts` (no package here runs an install step),
#     `dontStrip` and `dontPatchELF` (the SDK ships `claude` as a
#     bun-compiled executable; anything that moves its offsets breaks it —
#     only the interpreter may be touched);
#   - a `makeWrapper` over `nodejs` for the entry point;
#   - the SORTED `patchesFor` over a `patches/` directory, applied with
#     `patch -p1 -F0` (see below).
#
# The CALLER supplies the per-adapter facts: the shim directory, the npm
# hash, the package/entry/bin names, the wrapper's `env` lines, and a
# `postInstall` for anything beyond that (a patchelf of a bun binary, an
# esbuild of a bridge — both want a tool `extraNativeBuildInputs` adds).
#
# `patchesFor` reads every `.patch` in `patches/`, sorted by name, because
# the order patches apply in is a fact somebody depends on the moment two of
# them touch one file and `readDir` has no order worth relying on. Each
# plugin's `patches/README.md` says what each patch is and what olai added.
# A DIRECTORY THAT IS NOT THERE is an engine with no patches, so absence
# answers the empty list rather than failing the eval. A patch is a DPATH
# store input, so editing one rebuilds its adapter.
#
# `patch -p1 -F0` is the audible promise the whole arrangement rests on: npm
# ships each adapter COMPILED, so what `patch -p1` reads is the bundle rather
# than the TypeScript it was built from, and a version bump must FAIL rather
# than silently drop behaviour. `-F0` is the audible half — default fuzz would
# land a hunk up to two LINES from where its context said it belongs.
#
# To make a NEW adapter: a shim directory with its own lockfile (regenerate
# with `npm install --package-lock-only --ignore-scripts`), set the hash to
# `lib.fakeHash`, build, paste the hash it prints.
{ pkgs }:
let
  lib = pkgs.lib;
  buildNpmPackage = pkgs.buildNpmPackage;
  makeWrapper = pkgs.makeWrapper;
  nodejs = pkgs.nodejs;
in
{ name
, version
, shim
, npmDepsHash
, package
, entry
, bin
, patches ? null
, env ? [ ]
, extraNativeBuildInputs ? [ ]
, postInstall ? ""
# The shim's own `package.json` name — npm installs by THIS, not by the
# derivation's `name`: `$out/lib/node_modules/<shimName>/node_modules` is
# where the entry and the SDK binary live after npmInstallHook. Defaults to
# "acp" because `cleanSourceWith` already strips the shim down to
# `package.json` + `package-lock.json` and names the result `acp`.
, shimName ? "acp"
}:
let
  # `shim` would also pull in whatever else lands in that directory; keep the
  # src (and its hash) to just the two files the build actually reads. Each
  # adapter's patches are read from the SAME directory (below), so each gets
  # its own store input and a patch edit never moves the shim hash.
  src = lib.cleanSourceWith {
    name = "acp";
    src = shim;
    filter = path: _type:
      baseNameOf path == "package.json" || baseNameOf path == "package-lock.json";
  };
in
buildNpmPackage {
  pname = name;
  inherit version src npmDepsHash;
  dontNpmBuild = true;
  npmFlags = [ "--ignore-scripts" ];
  dontStrip = true;
  dontPatchELF = true;
  nativeBuildInputs = [ makeWrapper ] ++ extraNativeBuildInputs;

  postInstall =
    let
      mods = "$out/lib/node_modules/${shimName}/node_modules";
      allPatches =
        if patches != null && builtins.pathExists patches then
          map (n: patches + "/${n}")
            (builtins.sort (a: b: a < b)
              (builtins.attrNames
                (lib.filterAttrs (n: kind: kind == "regular" && lib.hasSuffix ".patch" n)
                  (builtins.readDir patches))))
        else
          [ ];
    in
    ''
      adapter="${mods}/${package}"
      entry="$adapter/${entry}"
      test -f "$entry"
      ${lib.concatMapStringsSep "\n" (patch: ''patch -p1 -F0 -d "$adapter" < ${patch}'') allPatches}
      makeWrapper ${nodejs}/bin/node "$out/bin/${bin}" \
        --add-flags "$entry" \
        ${lib.concatStringsSep " \\\n          " env}
      ${postInstall}
    '';

  meta = {
    description = "An ACP adapter olai ships, built from its own npm shim";
    platforms = lib.platforms.unix;
  };
}
