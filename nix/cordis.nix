# The pinned Cordis TypeScript olai's server runs on — FOUR packages from one
# repo, copied the way `@odu/run-client` is.
#
# cordiverse/cordis is a workspace: `packages/core` is `cordis`, `packages/loader`
# is `@cordisjs/plugin-loader`, `packages/include` is `@cordisjs/plugin-include`
# and `packages/group` is `@cordisjs/plugin-group`. All four are hydrated as raw
# TypeScript from the npins pin (npins/sources.json, name `cordis`). There is no
# vendor/ copy and no sync script: bumping the pin is `just update-pins`, the
# same as kolu and odu. Cordis arrives ONLY this way — the human's ruling of
# 2026-09-02, and the reason `packages/cordis-spike` shipped nothing.
#
# WHY FOUR AND NOT TWO. The spike hydrated core and the loader, which is enough
# to mount a fiber from a row. olai's base bundle is a FILE, and `--plugins` is
# a `disabled` patch over the rows in it — which is `@cordisjs/plugin-include`'s
# job, and `-group` is the one builtin (`cordis:group`) a row may name to nest
# other rows. Both are peers of the core the pin already carries, so hydrating
# them is one more (src, dest) pair each rather than a second arrangement.
#
# THE PIN TRACKS MASTER at the revision this tree compiled against. `just
# update-pins` walks it forward; `npins/sources.json` records the sha either way.
#
# ## The two throwaway arms of the spike's rewrite, and what became of them
#
# Upstream's manifests point at `lib/` — a `tsc` emit this tree does not run —
# so the hydrated copy's `main`, `types`, `typings` and every `exports` entry
# are rewritten to `src/`. The spike rewrote `exports["."]` ALONE, which was
# enough for the two specifiers it imported and was not a proof the rewrite was
# complete. This one WALKS the map: every string under `exports`, at any depth,
# that names `./lib/<x>.js` or `./lib/<x>.d.ts` becomes `./src/<x>.ts`, and a
# conditional entry (`{types, default}`) collapses to the one source file both
# conditions now mean. A package with no `exports` at all — include and group,
# which publish `lib/` and nothing else — is GIVEN one, so `import
# "@cordisjs/plugin-include"` resolves the same way the other two do.
#
# And the `@ts-nocheck` stamp STAYS, which is the one thing phase 2 owed and
# did not get. It is no longer a hand-wave, though: the spike said "olai's tsc
# is stricter than Cordis's" and phase 2 MEASURED it, which turns a suspicion
# into a five-line upstream ask.
#
# ## The delta, exactly
#
# Cordis's own `tsconfig.base.json` is `strict: true`, and each package it
# publishes turns options back OFF in its own `tsconfig.json`:
#
#   packages/core     noImplicitAny: false, noImplicitThis: false, strictFunctionTypes: false
#   packages/loader   noImplicitAny: false
#   packages/include  (base only)
#   packages/group    (base only)
#
# and olai's `tsconfig.base.json` adds two upstream does not set at all:
# `noUncheckedIndexedAccess` and `noImplicitOverride`. Compiled under Cordis's
# OWN per-package flags the pinned revision is clean — verified against
# `packages/core` at this revision, which emits declarations with no error.
# Compiled under olai's, it is ~35 errors, every one of them an instance of
# those five flags and none of them a bug in Cordis.
#
# So this is not a delta olai can close from here: an option a package turns off
# for itself is a decision about how that package is written, and the honest
# route the proposal names is the second one — the delta goes upstream as the
# ask "adopt noUncheckedIndexedAccess and noImplicitOverride, and retire the
# three off-switches", and this stamp comes off the day a pin bump makes it
# true. It is a real suppression and it is worth naming what it does NOT
# suppress: the pin's exported TYPES are still computed and olai's own call
# sites are still checked against them, so a revision that moved the API is red
# in olai's source. What the stamp hides is Cordis's authoring, not Cordis's
# shape.
#
# cosmokit, `@standard-schema/spec` and js-yaml stay on npm, declared at the
# root at the versions the pin names — the same arrangement `@odu/run-client`
# has with `effect`. The copier is kolu's (`hydrate-kolu-packages.sh`); this
# file supplies argv.

{ pkgs }:

let
  npins = import ../npins;

  # ONE REWRITE FOR FOUR MANIFESTS. `walk` is jq's own recursive map, so a
  # subpath nested inside a condition object is reached without this filter
  # knowing the shape of any particular manifest — which is the whole
  # difference between this and the spike's single-key `exports["."]`.
  #
  # `private = true` keeps bun from ever treating the copy as a registry
  # package: it is a Nix-store source dropped into node_modules after the
  # install, exactly as the @kolu/* members are.
  asTypescript = name: src:
    pkgs.runCommand name { nativeBuildInputs = [ pkgs.jq ]; } ''
      cp -r ${src} $out
      chmod -R u+w $out
      jq '
        def to_src:
          if type == "string" then
            (if test("^\\./lib/.*\\.d\\.ts$") then
               sub("^\\./lib/"; "./src/") | sub("\\.d\\.ts$"; ".ts")
             elif test("^\\./lib/.*\\.js$") then
               sub("^\\./lib/"; "./src/") | sub("\\.js$"; ".ts")
             else . end)
          else . end;
        .main = "./src/index.ts"
        | .types = "./src/index.ts"
        | (if has("typings") then .typings = "./src/index.ts" else . end)
        | .exports = ((.exports // {}) | walk(to_src))
        | .exports["."] = "./src/index.ts"
        | .exports["./package.json"] = "./package.json"
        | .private = true
      ' "$out/package.json" > "$out/package.json.tmp"
      mv "$out/package.json.tmp" "$out/package.json"
      find "$out" -name '*.ts' -print | while IFS= read -r f; do
        first=$(head -n 1 "$f")
        if [ "$first" != "// @ts-nocheck" ]; then
          printf '%s\n%s\n' "// @ts-nocheck" "$(cat "$f")" > "$f"
        fi
      done
    '';

  member = dir: asTypescript "cordis-${dir}-src" "${npins.cordis}/packages/${dir}";

  core = member "core";
  loader = member "loader";
  include = member "include";
  group = member "group";

  manifestOf = dir:
    builtins.fromJSON (builtins.readFile "${npins.cordis}/packages/${dir}/package.json");
in
{
  # Four (src, dest) pairs, in the shape `hydrate-kolu-packages.sh` takes.
  hydrateArgs =
    "${core} cordis "
    + "${loader} @cordisjs/plugin-loader "
    + "${include} @cordisjs/plugin-include "
    + "${group} @cordisjs/plugin-group";

  # The pin's own runtime dependencies, for `scripts/check-hydrated-deps.sh` —
  # the UNION over the four hydrated packages, because all four resolve their
  # externals by walking up into the one root node_modules and a check that
  # asked only about the core would be green while the loader's `cosmokit` or
  # include's `js-yaml` was missing.
  #
  # Peers are deliberately NOT folded in here, and that is this pin's one
  # departure from the shape kolu's `externals` has. Every peer the four
  # declare is ANOTHER OF THE FOUR (`cordis`, `@cordisjs/plugin-loader`) plus
  # `node-addon-require-builtin`, which is optional and is the Node-internals
  # route the loader takes when it can — under Bun it cannot, and `import()`
  # by specifier is the arm that runs (§5's HMR note). None of those is an npm
  # external the root could declare without inventing a second copy of a pin.
  externals =
    (manifestOf "core").dependencies
    // (manifestOf "loader").dependencies
    // (manifestOf "include").dependencies;

  revision = npins.cordis.revision;
}
