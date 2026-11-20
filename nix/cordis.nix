# Upstream Cordis gotchas olai cannot use the pin without working around. The
# code-side ledger of what each workaround costs is
# `packages/effect-cordis/README.md`'s "Where the pin's instability lives".
# Status at f8ea3cd (cordis 4.0.0-rc.10, plugin-loader 1.0.0-rc.7,
# plugin-include 1.1.0): all four still open.
#
#   1. NO PUBLIC RESOLVER SEAM on `@cordisjs/plugin-loader`. `EntryTree.import`
#      resolves a row's `name` with a bare `import()` from inside the loader's
#      own package, which under bun's isolated linker cannot see a workspace
#      member; the only way through is to fill `loader.internal` — the slot
#      upstream keeps for Node's own `ModuleLoader` — with one method and a
#      cast (`packages/effect-cordis/src/loader.ts`). rc.7 resolves bare
#      specifiers by writing a `.cordis/resolve.mjs` helper into the config
#      file's project, which is not a seam a consumer can supply.
#   2. NO TYPED DUPLICATE-PROVIDER ERROR. `ctx.provide` refuses a second
#      provider by throwing a plain `Error` whose PROSE carries the owning
#      fiber's name (`service "x" has been registered at <owner>`), so the
#      owner can only be recovered by matching that sentence
#      (`packages/effect-cordis/src/lifecycle.ts`, pinned by `lifecycle.test.ts`).
#   3. DISPOSERS UNLOAD CONCURRENTLY. A fiber's disposers are unloaded with
#      `Promise.all` (`Fiber._unload`), so a disposer that waits for dependents
#      does not keep the disposers beside it from releasing first; olai takes
#      its provisions' disposers out of that set and runs them in order
#      (`lifecycle.ts`'s `offer` and `close`).
#   4. AN ERROR WITHOUT A STACK DOES NOT SURVIVE `composeError`. `handleError`
#      (`src/utils.ts`) splits `.stack` unguarded; under Bun an Error can have
#      no `stack` (always so while `Error.stackTraceLimit` is 0), and the
#      splice then throws a TypeError in place of the failed start or
#      `ctx.provide` refusal. olai keeps what a start threw itself and reads a
#      lost refusal off the service store (`lifecycle.ts`).
#
# The `@ts-nocheck` stamp below is the fifth: compiled under olai's
# `noUncheckedIndexedAccess` / `noImplicitOverride` (which upstream does not
# set) plus the three options each Cordis package turns off for itself, the pin
# is ~35 errors. The stamp hides Cordis's authoring only — the pin's exported
# types are still computed and olai's call sites still checked against them.
#
# Upstream's manifests point at `lib/` (a `tsc` emit this tree does not run),
# so the hydrated copy's entry points are rewritten to `src/`, and the two
# packages that publish no `exports` at all are given one.

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
