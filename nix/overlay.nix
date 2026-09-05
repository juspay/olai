# Packages ekapkgs does not yet ship. Drop each overlay as the pin grows
# the attribute. Hosted typefaces come from the pin (ekapkgs#5, rebased
# onto master). Node is `pkgs.nodejs.v24`. Playwright is a FOD; npins and
# nixpkgs-fmt are rust builds, realised on CI hosts.
final: prev:
let
  sources = import ../npins;
in
{
  npins = final.callPackage "${sources.npins}/npins.nix" { pkgs = final; };

  # ekapkgs ships nixfmt; this tree's *.nix are still nixpkgs-fmt-shaped.
  nixpkgs-fmt = final.callPackage ./vendor/nixpkgs-fmt.nix { };

  playwright-driver = final.callPackage ./vendor/playwright { };
}
