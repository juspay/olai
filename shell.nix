# Dev shell — shared by `nix develop` (via flake.nix) and `nix-shell`.
{ pkgs ? import ./nix/nixpkgs.nix { } }:
let
  kolu = import ./nix/kolu.nix { inherit pkgs; };
  odu = import ./nix/odu.nix { inherit pkgs; };
  pins = import ./npins;
  olaiFonts = import ./packages/fonts { inherit pkgs; };
  koluMark = import ./packages/plugins/olai-plugin-kolu { inherit pkgs; };
in
pkgs.mkShell {
  name = "olai-shell";

  # The @kolu/* sources, as the argv the hydrate script takes, and kolu's own
  # answer for the versions the dependency check asserts against. Both are read
  # by justfile recipes, not by a shellHook: entering the shell realises the
  # sources but copies nothing.
  env = {
    # The hydrate SCRIPT is kolu's too now — the copy that lived in
    # `scripts/` claimed to be byte-identical with odu's and was not, and had
    # drifted from kolu's canonical one as well. Two variables rather than one
    # concatenated argv, so a caller can see which half is which.
    OLAI_KOLU_HYDRATE_SCRIPT = kolu.hydrateScript;
    OLAI_KOLU_HYDRATE = kolu.hydrateArgs;

    # KOLU'S OWN ANSWER for every external its hydrated sources need, as JSON —
    # a merged {name: version} map, peers already folded in.
    # `scripts/check-hydrated-deps.sh` asserts olai's manifests against THIS rather
    # than against a second copy of the list — which is the difference between
    # a version constraint that is checked and one that is hoped.
    OLAI_KOLU_EXTERNALS = builtins.toJSON kolu.externals;

    # ODU'S ONE PACKAGE, the same two ways: the argv for the copier (kolu's
    # script — `nix/odu.nix` says why there is not a second one), and the
    # pinned manifest `scripts/check-hydrated-deps.sh` asserts olai's root
    # against. It is a WHOLE package.json where kolu's is a merged map, and the
    # script reads both shapes rather than the justfile normalising one of them
    # with a jq filter: one pin, one variable, one thing to look at.
    # A separate variable rather than a longer `OLAI_KOLU_HYDRATE`, because the
    # two pins move independently — a single argv would hide which half a
    # `just update-pins` had walked forward, and which half a `just check`
    # failure is about.
    OLAI_ODU_HYDRATE = odu.hydrateArgs;
    OLAI_ODU_MANIFEST = builtins.toJSON odu.externals;

    # THE ORCHESTRATOR'S VAULT, pinned — the corpus four differential legs read
    # (`@olai/format`'s scope, incremental and splice, and `@olai/server`'s
    # published equivalence). What they want is a REAL vault: trees people
    # actually grew, ids people actually chose, a mirror somebody placed for a
    # reason, an archive with a hundred records in it — none of which a
    # generator draws. That used to be this repository's own `docs/`, and it
    # left with the board (https://github.com/juspay/oss.olai). A PIN is how it
    # stays real without being here: `npins/sources.json` records the revision,
    # `just update-pins` moves it, the store path is content-addressed, and
    # nothing in this tree is a copy of the vault.
    #
    # Set HERE, in the shell every `bun test` runs in, rather than defaulted in
    # the tests. A leg that quietly fell back to a fixture — or skipped — would
    # be a green run that checked nothing, which is the one failure every sweep
    # in this package is built to prevent, so an unset variable or an absent
    # path is a LOUD failure naming this variable.
    OSS_OLAI_VAULT = "${pins.oss-olai}";

    # The browsers come from nixpkgs, in the `e2e` shell only (flake.nix) — so
    # the npm package must never try to fetch its own. This is set HERE, in the
    # shell that runs `bun install`, rather than there, in the shell that runs
    # the tests.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";

    # Hosted typefaces, already woff2: packages/fonts/default.nix converts the
    # face list beside it (packages/fonts/src/hosted.json) once, in the store,
    # and the client build only copies out of here. No CDN, no font binary in
    # the repo, and no woff2_compress in this shell — the derivation brings its
    # own. The packaged build (default.nix) sets the same one variable.
    OLAI_FONTS_DIR = "${olaiFonts}";

    # KOLU'S OWN MARK, already a TypeScript module. The plugin's own
    # `packages/plugins/olai-plugin-kolu/default.nix` reads the pinned kolu's
    # `packages/client/favicon.svg` — the same pin the @kolu/* sources above
    # come from — and writes `mark.generated.ts`; `just install` copies that
    # one file into `packages/plugins/olai-plugin-kolu/src/browser/`, beside the component
    # that draws it, exactly as the hydrate calls copy the sources. A logo is
    # updated by bumping the pin and nothing else.
    #
    # Read by the justfile and by the packaged build's install phase, and by NO
    # TypeScript: no file under `packages/*/src` names this variable, which is
    # what keeps the arrangement clear of the plugin fence rather than a
    # word-boundary technicality.
    OLAI_KOLU_MARK_DIR = "${koluMark}";
  };

  # nodejs is knotted through here rather than ambient: the acp/ pin's
  # `npm ci` is an eat step of `just install`, and the devShells CI runs
  # without an ambient one must bring their own.
  #
  # THERE IS NO ripgrep HERE, and its absence is the point rather than an
  # oversight. Two `just check` legs used to grep the tree with `rg …
  # 2>/dev/null || true`, which on a machine with no ambient one turned
  # "command not found" into an empty result and a GREEN fence — a check that
  # passes by failing to run. Adding `ripgrep` would have made those two legs
  # honest; instead the greps left, to `packages/plugin-api/src/fence.test.ts`,
  # where the pinned bun reads the tree and a missing reader is not a thing that
  # can happen. Nothing in `scripts/` shells out to a searcher any more, so
  # there is nothing here to declare.
  packages = with pkgs; [
    bun
    just
    jq # scripts/check-hydrated-deps.sh — the one thing that reads a pin's JSON
    nixpkgs-fmt
    nodejs_24
    npins
  ];
}
