# Packages ekapkgs does not yet ship, plus bun 1.4.1 (`bun install --offline`).
# Drop each overlay as the pin grows the attribute. Fonts and playwright are
# FODs (zip fetches); ripgrep and npins are rust builds, realised on CI hosts.
final: prev:
let
  sources = import ../npins;
  callFont = path: final.callPackage path { };
in
{
  bun = final.callPackage ./bun.nix { };

  mkShell = final.callPackage ./vendor/mk-shell.nix { };
  mkShellNoCC = final.callPackage ./vendor/mk-shell.nix {
    stdenv = final.stdenvNoCC;
  };

  # This ekapkgs pin's newest node is 23; npm ci in acp/ is happy on 22 LTS.
  nodejs_24 = prev.nodejs_22;

  npins = final.callPackage "${sources.npins}/npins.nix" { pkgs = final; };

  ripgrep = final.callPackage ./vendor/ripgrep.nix { };

  # ekapkgs ships nixfmt; this tree's *.nix are still nixpkgs-fmt-shaped.
  nixpkgs-fmt = final.callPackage ./vendor/nixpkgs-fmt.nix { };

  playwright-driver = final.callPackage ./vendor/playwright { };

  literata = callFont ./vendor/fonts/literata/package.nix;
  ia-writer-quattro = callFont ./vendor/fonts/ia-writer-quattro/package.nix;
  ia-writer-mono = callFont ./vendor/fonts/ia-writer-mono/package.nix;
  atkinson-hyperlegible-next = callFont ./vendor/fonts/atkinson-hyperlegible-next/package.nix;
  et-book = callFont ./vendor/fonts/et-book/package.nix;
  geist-font = callFont ./vendor/fonts/geist-font/package.nix;
  lexend = callFont ./vendor/fonts/lexend/package.nix;
  crimson-pro = callFont ./vendor/fonts/crimson-pro/package.nix;
  vollkorn = callFont ./vendor/fonts/vollkorn/package.nix;
  commit-mono = callFont ./vendor/fonts/commit-mono/package.nix;
}
