# Dev shell — shared by `nix develop` (via flake.nix) and `nix-shell`.
{ pkgs ? import ./nix/nixpkgs.nix { } }:
let
  kolu = import ./nix/kolu.nix { inherit pkgs; };
  pins = import ./npins;
  olaiFonts = import ./packages/fonts { inherit pkgs; };
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

    # KOLU'S OWN ANSWER for every external its hydrated sources need, as JSON.
    # `scripts/check-kolu-deps.sh` asserts olai's manifests against THIS rather
    # than against a second copy of the list — which is the difference between
    # a version constraint that is checked and one that is hoped.
    OLAI_KOLU_EXTERNALS = builtins.toJSON kolu.externals;

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
  };

  packages = with pkgs; [
    bun
    just
    jq # scripts/check-kolu-deps.sh
    nixpkgs-fmt
    npins
  ];
}
