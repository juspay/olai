# Upstream's manifests point at `lib/` — a `tsc` emit this tree does not run —
# so the hydrated copy's entry points are rewritten to `src/`, and the two
# packages that publish no `exports` at all (include, group) are given one.
#
# The `@ts-nocheck` stamp: `packages/core` turns `noImplicitAny`,
# `noImplicitThis` and `strictFunctionTypes` off in its own tsconfig and
# `packages/loader` turns off the first, while olai's tsconfig adds
# `noUncheckedIndexedAccess` and `noImplicitOverride` that upstream never
# sets — so the pin is ~35 errors under olai's tsc. The stamp hides Cordis's
# authoring only: its exported types are still computed and olai's call sites
# still checked against them.

{ pkgs }:

let
  npins = import ../npins;

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
  hydrateArgs =
    "${core} cordis "
    + "${loader} @cordisjs/plugin-loader "
    + "${include} @cordisjs/plugin-include "
    + "${group} @cordisjs/plugin-group";

  externals =
    (manifestOf "core").dependencies
    // (manifestOf "loader").dependencies
    // (manifestOf "include").dependencies;

  revision = npins.cordis.revision;
}
