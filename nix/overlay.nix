# Packages ekapkgs does not yet ship, plus bun 1.4.1 (`bun install --offline`).
# Drop each overlay as the pin grows the attribute. Hosted typefaces come
# from the pin (ekapkgs#5, rebased onto master). Playwright is a FOD;
# npins and nixpkgs-fmt are rust builds, realised on CI hosts.
final: prev:
let
  sources = import ../npins;
in
{
  bun = final.callPackage ./bun.nix { };

  mkShell = final.callPackage ./vendor/mk-shell.nix { };
  mkShellNoCC = final.callPackage ./vendor/mk-shell.nix {
    stdenv = final.stdenvNoCC;
  };

  # Pin's default `nodejs` is 24; the `nodejs_24` alias is still missing.
  nodejs_24 = prev.nodejs;

  npins = final.callPackage "${sources.npins}/npins.nix" { pkgs = final; };

  # ekapkgs ships nixfmt; this tree's *.nix are still nixpkgs-fmt-shaped.
  nixpkgs-fmt = final.callPackage ./vendor/nixpkgs-fmt.nix { };

  playwright-driver = final.callPackage ./vendor/playwright { };
}
