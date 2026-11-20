{ pkgs ? import ./nix/nixpkgs.nix { } }:
let
  pins = import ./npins;

  bundle = import ./packages/bundle {
    inherit pkgs pins;
  };

  kolu = import ./nix/kolu.nix {
    inherit pkgs;
    extraSeeds = bundle.koluSeeds;
    pinnedSources = bundle.koluPins;
  };
  cordis = import ./nix/cordis.nix { inherit pkgs; };
  olaiFonts = import ./packages/fonts { inherit pkgs; };
in
pkgs.mkShell {
  name = "olai-shell";

  env = {
    OLAI_KOLU_HYDRATE_SCRIPT = kolu.hydrateScript;
    OLAI_KOLU_HYDRATE = kolu.hydrateArgs;

    OLAI_KOLU_EXTERNALS = builtins.toJSON kolu.externals;

    OLAI_PLUGIN_INSTALL = bundle.devInstallScript;
    OLAI_PLUGIN_EXTERNALS = builtins.toJSON bundle.externals;

    OLAI_CORDIS_HYDRATE = cordis.hydrateArgs;
    OLAI_CORDIS_EXTERNALS = builtins.toJSON cordis.externals;

    OSS_OLAI_VAULT = "${pins.oss-olai}";

    # The Playwright npm package fetches its own browsers during `bun install`
    # unless this is set; the `e2e` shell takes them from nixpkgs instead.
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";

    OLAI_FONTS_DIR = "${olaiFonts}";
  };

  packages = with pkgs; [
    bun
    coreutils
    just
    jq
    nixpkgs-fmt
    nodejs_24
    npins
  ];
}
