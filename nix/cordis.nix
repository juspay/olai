# The pinned Cordis TypeScript olai's spike consumes — TWO packages from one
# repo, copied the way `@odu/run-client` is.
#
# cordiverse/cordis is a workspace: `packages/core` is `cordis`, `packages/loader`
# is `@cordisjs/plugin-loader`. Both are hydrated as raw TypeScript from the
# npins pin (npins/sources.json, name `cordis`). There is no vendor/ copy and
# no sync script: bumping the pin is `just update-pins`, same as kolu and odu.
#
# THE PIN TRACKS MASTER at the revision the spike ran against. `just update-pins`
# walks it forward; `npins/sources.json` records the sha either way.
#
# Upstream package.json points at `lib/` (a tsc emit this tree does not run).
# The hydrated copy's main/exports point at `src/`, and every `.ts` file is
# stamped `// @ts-nocheck`, because olai's tsc is stricter than Cordis's and
# this spike typechecks its own files, not the pin. That rewrite is a
# derivation, not a file in this repo.
#
# BOTH ARMS ARE THROWAWAY. Phase 2 either typechecks the pin under olai's
# `tsc` — the raw-TS argument the kolu and odu pins already make — or files
# the strictness delta upstream and drops the stamp. And the jq rewrite
# currently sets `exports["."]` only: that is enough for `import "cordis"`
# and `import "@cordisjs/plugin-loader"`. A subpath the spike does not
# import (`./src/*` happens to already point at source upstream) is not a
# proof the rewrite is complete. Phase 2's rewrite must cover every subpath
# the code imports, not just `.`.
#
# cosmokit and `@standard-schema/spec` stay on npm, declared at the root at the
# versions the pin names — the same arrangement `@odu/run-client` has with
# `effect`. The copier is kolu's (`hydrate-kolu-packages.sh`); this file
# supplies argv.

{ pkgs }:

let
  npins = import ../npins;

  asTypescript = name: src:
    pkgs.runCommand name { nativeBuildInputs = [ pkgs.jq ]; } ''
      cp -r ${src} $out
      chmod -R u+w $out
      jq '
        .main = "./src/index.ts"
        | .types = "./src/index.ts"
        | .exports["."] = "./src/index.ts"
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

  core = asTypescript "cordis-core-src" "${npins.cordis}/packages/core";
  loader = asTypescript "cordis-loader-src" "${npins.cordis}/packages/loader";
  coreManifest = builtins.fromJSON (builtins.readFile "${npins.cordis}/packages/core/package.json");
in
{
  # Two (src, dest) pairs, in the shape `hydrate-kolu-packages.sh` takes.
  hydrateArgs = "${core} cordis ${loader} @cordisjs/plugin-loader";

  # The pin's own runtime dependencies, for `scripts/check-hydrated-deps.sh`.
  # Peers (`@cordisjs/plugin-loader`, `@cordisjs/plugin-include`) are optional
  # plugins, not externals the hydrated core resolves by walking up — they
  # stay off this map. cosmokit and `@standard-schema/spec` are npm at the
  # root, at the versions this object names.
  externals = coreManifest.dependencies or { };

  revision = npins.cordis.revision;
}
