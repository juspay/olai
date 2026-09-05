# Packages ekapkgs does not yet ship, plus bun 1.4.1 (`bun install --offline`).
# Drop each overlay as the pin grows the attribute. Hosted typefaces come
# from the pin (ekapkgs#5, rebased onto master). Node is `pkgs.nodejs.v24`.
# Playwright is a FOD; npins and nixpkgs-fmt are rust builds, realised on CI hosts.
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

  npins = final.callPackage "${sources.npins}/npins.nix" { pkgs = final; };

  # ekapkgs ships nixfmt; this tree's *.nix are still nixpkgs-fmt-shaped.
  nixpkgs-fmt = final.callPackage ./vendor/nixpkgs-fmt.nix { };

  playwright-driver = final.callPackage ./vendor/playwright { };
}
