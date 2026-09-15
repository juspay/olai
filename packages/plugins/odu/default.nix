# ODU'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The mechanism lives in `@olai/plugin-kit` (`kit.mark` for the face over a
# sentence, `kit.contract` for the validator the fold runs). This file names
# odu's facts: the npins pin, the mark's SVG inside it, the three packages the
# server hydrates as raw TypeScript, the npm externals they declare, the binary
# `OLAI_ODU_BIN` carries, and the one dead man switch the fold composes as
# `checks.plugin-odu-surface`.
#
# `nix/odu.nix` used to hold all of it at the root, where the plugin could be
# renamed without it noticing. The pin moved past the plugin's probe at
# juspay/odu#105 (the verbs `run`, `wait`, and `cancel` were renamed
# wholesale); the binary this file wraps AND the probe the plugin ships must
# land in the same commit, a fact the sandboxed `surface` check now answers
# directly rather than by the root's prose.
#
# `b2n` must be a real `bun2nix` package (the CLI derivation with `hook` and
# `fetchBunDeps` on passthru). The fold's `contract` door passes it through only
# when the root asks for the real package; on the fold-check and shell paths
# it is `null` and both `bin` and `checks` short-circuit to never-tested
# stubs — the shell reads odu's `hydrate`/`externals`/`knobs`/`generated` for
# facts only, never to build. `b2n == null` forces `bin` and `checks` to the
# same standing-answer the root uses to keep shell eval lazy.
#
# `odu` is `packages/plugins/odu/default.nix` (the fold discovers it by the
# `default.nix` filename), not `nix/odu.nix`; the old path is gone with this
# commit.
{ pkgs, pins, kit, b2n ? null }:

let
  src = pins.odu;

  # THE PIN AS A WHOLE ODUS BUILT FROM, `default.nix` and all. Composed rather
  # than re-described: `${src}/default.nix` is the recipe odu's own flake runs,
  # and an olai-side re-spelling of the makeWrapper arguments would be exactly
  # the drift `hydrate` below rides kolu's one script to avoid. `pkgs` cannot
  # be substituted for odu's own pinned one: the build hydrates @kolu/* sources
  # from the overlay odu's nixpkgs import applies, and the revisions those
  # resolve to are the pin's business, not this tree's. `b2n` not supplied
  # short-circuits to a stub — the dev shell never builds odu.
  bin =
    if b2n == null then
      pkgs.runCommand "olai-odu-bin-stub" { } "mkdir -p $out"
    else
      (import "${src}/default.nix" {
        pkgs = import "${src}/nix/nixpkgs.nix" {
          inherit (pkgs.stdenv.hostPlatform) system;
        };
        inherit b2n;
        selfFlake = "${src}";
      }).odu;

  mark = kit.mark {
    svg = "${src}/logo.svg";
    revision = src.revision;
    from = "juspay/odu logo.svg";
  };
in
{
  # THREE (src, dest) pairs, in the shape `hydrate-kolu-packages.sh` takes.
  # The names in the manifests are the names an import writes.
  hydrate =
    let
      pair = dir: name: { src = "${src}/packages/${dir}"; dest = name; };
    in
    [
      (pair "run-client" "@odu/run-client")
      (pair "run-history" "@odu/run-history")
      (pair "service-client" "@odu/service-client")
    ];

  # The pinned packages' npm externals, for `scripts/check-hydrated-deps.sh`
  # (and the fold's `plugin-deps` leg): the UNION of what the three declare,
  # minus workspace `@odu/*` arrows that resolve to the other two hydrated
  # directories rather than to the registry. Read out of the store path so the
  # answer is the pin's, not a transcription.
  externals =
    let
      manifestOf = dir:
        builtins.fromJSON
          (builtins.readFile "${src}/packages/${dir}/package.json");
      npmOf = dir:
        let
          deps = (manifestOf dir).dependencies or { };
          names = builtins.filter (n: builtins.match "@odu/.*" n == null)
            (builtins.attrNames deps);
        in
        builtins.listToAttrs
          (map (n: { name = n; value = deps.${n}; }) names);
    in
    (npmOf "run-client") // (npmOf "run-history") // (npmOf "service-client");

  # The mark, written by plugin-kit's own derivation: the pin's `logo.svg`,
  # read at the pin's revision, inlined by `src/mark/inline.ts` and stamped
  # with the from/revision it arrived under. `just install` copies the
  # `mark.generated.ts` file into `src/browser/` (the same generated wiring
  # every plugin's mark uses), and bumping the pin is the whole of an update.
  generated."src/browser/mark.generated.ts" = mark;
  # THE SERVER'S OWN BINARY, as a directory the `olai` wrapper splices onto
  # PATH — one `holds = "odu"` so the wrapper's `--run` line names the
  # executable it guards. The sandboxed surface check below pokes the same
  # binary end to end.
  knobs.OLAI_ODU_BIN = {
    kind = "dir";
    path = "${bin}/bin";
    holds = "odu";
  };
  checks = { tree }:
    if b2n == null then { } else {
      # SANDBOXED SURFACE CHECK — the sandboxed sibling of `just odu-surface`
      # (mod.just). Runs `src/surface.check.ts` against the pinned odu binary in
      # a fully-staged working copy of the sources (so `process.cwd()` in the
      # probe reads a real directory), with `out` an allowed-to-create store
      # path so the probe's failure handshake has somewhere to write. The `bun`
      # carrying it is `pkgs.bun` — `pkgs.bun` tracks nixpkgs, the packaged
      # `olai` tracks the odu-blessed FOD, and a divergence between the two is
      # (today) only what this probe catches; the fallback is `just odu-surface`
      # against the dev shell's bun2nix.
      surface = pkgs.runCommand "olai-plugin-odu-surface" {
        nativeBuildInputs = [ pkgs.bun ];
        src = tree;
        server = bin;
      } ''
        export HOME=$TMPDIR
        cd $src
        OLAI_ODU_BIN=$server/bin \
          bun packages/plugins/odu/src/surface.check.ts $server/bin
        mkdir -p $out
        echo "$server/bin" > $out/ok
      '';
    };
  # binary is both the plugin's and this repository's CI runner. Two keys, one
  # derivation: `odu-bin` is the knob's own word for it, `odu` is the runner
  # name the fast-remote recipes use. `odu-mark` is the logo the plugin's
  # browser chunk inlines.
  packages = {
    odu = bin;
    odu-bin = bin;
    odu-mark = mark;
  };
}
