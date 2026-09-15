# THE ACP SHIM, BUILT ONCE PER ADAPTER — this file is now the SHARED MECHANISM the
# Claude and Pi plugins' `default.nix` files each call with their own row, not
# the home of the rows themselves. An ENGINE IS A PLUGIN, and a plugin OWNS its
# Nix half: the per-adapter facts (the npm package inside the shim tree, its
# entry, the wrapper's bin name, the patches it carries, whatever it needs
# installed beside it, and the wrapper's env) live in
# `packages/plugins/claude/default.nix` and `packages/plugins/pi/default.nix`.
# This file names no plugin.
#
# npm is the only channel either adapter ships through, so both get the same
# treatment every other pin here does: a committed lockfile in `acp/`, one
# fixed-output derivation for the tarballs, nothing fetched at build time and
# no `npx` at run time. A nix-built olai therefore needs nothing ambient — no
# PATH lookup, no version that drifts under you between two machines.
#
# **The npm SHIM stayed one file.** `acp/package.json` and its lockfile remain
# a single file with both adapter dependencies in it, and this functionality
# returns TWO derivations (one per adapter) from that one shim. That is a
# decision rather than a leftover: one lockfile is ONE fixed-output derivation
# and one `npmDepsHash`, and splitting it would buy nothing this phase asks for
# while costing two large FODs and two hashes to keep in step. `acp/README.md`
# argues it where a person looking for the pin will land.
#
# **The PATCHES live with their adapter.** They are
# `packages/plugins/claude/acp/patches/` and `packages/plugins/pi/acp/patches/`,
# beside the sources they are generated from, because an adapter's patch set
# moves on that adapter's own release clock — this one's pin moved five times
# in a month and the other's has not moved at all. Each plugin passes its own
# `patches` directory; this file READS it (`${patches}`), so adding one is a
# file in the plugin and nothing here. Each is still a PATH, so the derivation
# depends on the patch's own hash and a change to it rebuilds the adapter.
#
# Regenerate after ANY edit to acp/package.json — the shim's own name is in the
# lockfile, so renaming it moves the hash as surely as a version bump does:
#
#   cd acp && npm install --package-lock-only --ignore-scripts
#   set npmDepsHash to lib.fakeHash, build, paste the hash it prints.
#
# The lockfile names a prebuilt `claude` for every platform npm knows about, so
# the deps FOD is large and its hash is the same on every system; `npm ci` then
# keeps only the host's copy.
#
# Carried over from the racket reference's `acp/default.nix`, whose comments
# about the bun-compiled `claude` binary are the load-bearing part: both the
# stripper and an RPATH rewrite move offsets the bun runtime reads back out of
# its own file, and it segfaults. Only the interpreter may be touched.
{ lib, stdenv, buildNpmPackage, makeWrapper, nodejs }:
# ONE ADAPTER'S ROW — the args a plugin supplies. `src` defaults to the shared
# `acp/` shim; each plugin overrides `package`/`entry`/`bin`/`env` and adds its
# own `patches`, `postInstall` (everything beyond wrapping: the pi bridge's
# esbuild bundle, the claude binary's patchelf) and `nativeBuildInputs` for the
# tools that postInstall needs.
{ name        # distinct pname per adapter so two store paths from one shim collide on nothing
, version     # e.g. "0.73.0+pi-0.0.33" — names both pins; see acp/package.json
, package     # the npm package this row wraps, inside the shim's installed tree
, entry       # the file the wrapper runs, relative to that package
, bin         # the wrapper's bin name — what the knob points at
, src ? ../acp
, npmDepsHash
, patches ? null   # a plugin's acp/patches directory, or null for none
, env ? [ ]        # makeWrapper args beyond --add-flags (the row's own)
, nativeBuildInputs ? [ ]
, postInstall ? "" # everything the makeWrapper above does not cover
}:
let
  # ../acp would also pull in whatever else lands in that directory; keep the
  # src (and its hash) to just the two files the build actually reads.
  cleanSrc = lib.cleanSourceWith {
    name = "acp";
    inherit src;
    filter = path: _type:
      baseNameOf path == "package.json" || baseNameOf path == "package-lock.json";
  };

  # EVERY `.patch` IN THAT PLUGIN'S OWN DIRECTORY, in name order — read rather
  # than listed. SORTED, because the order patches apply in is a fact somebody
  # depends on the moment two of them touch one file, and `readDir` has no order
  # worth relying on. A DIRECTORY THAT IS NOT THERE is an adapter with no
  # patches, so the absence answers the empty list rather than failing.
  allPatches =
    if patches != null && builtins.pathExists patches then
      map (n: patches + "/${n}")
        (builtins.sort (a: b: a < b)
          (builtins.attrNames
            (lib.filterAttrs (n: kind: kind == "regular" && lib.hasSuffix ".patch" n)
              (builtins.readDir patches))))
    else [ ];
in
buildNpmPackage {
  inherit version npmDepsHash;
  pname = name;
  # ONE shim, TWO adapters, TWO store paths. The version names both pins rather
  # than claiming either build is its adapter alone: a bump of either line of
  # acp/package.json moves the store path's NAME, not only its hash — a pi-acp
  # bump that left the claude path stamped "0.73.0" would be the old claim
  # living on after its evidence.
  src = cleanSrc;

  # acp/ is a shim around its two pinned dependencies: nothing to compile,
  # and no package in the tree has an install script to run.
  dontNpmBuild = true;
  npmFlags = [ "--ignore-scripts" ];

  # See the header: the SDK ships `claude` as a bun-compiled executable, and
  # anything that moves its offsets breaks it.
  dontStrip = true;
  dontPatchELF = true;

  nativeBuildInputs = [ makeWrapper ] ++ nativeBuildInputs;

  postInstall =
    let
      # npm installs the shim by its own package.json name; `mods` is the
      # installed tree's node_modules, the stable address a row's `env` and
      # `postInstall` spell against (`$out` is the shell's build output).
      mods = "$out/lib/node_modules/olai-acp/node_modules";
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

  # No meta.license on purpose: the adapter is Apache-2.0 but the `claude`
  # binary it drives ships under Anthropic's commercial terms, and declaring
  # that unfree would make `nix build` demand allowUnfree from every consumer of
  # this flake.
  meta = {
    description = "An ACP adapter olai ships, read from the shared acp/ shim";
    homepage = "https://github.com/zed-industries/claude-code-acp";
    platforms = lib.platforms.unix;
  };
}