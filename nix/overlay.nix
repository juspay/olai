# Packages ekapkgs does not yet ship. Drop each overlay as the pin grows
# the attribute. Hosted typefaces are vendored here (ekapkgs#5 may not
# merge). Node is `pkgs.nodejs.v24`. Playwright is a FOD. ripgrep, npins
# and nixpkgs-fmt come from the ekapkgs pin.
final: prev:
let
  callFont = path: final.callPackage path { };
in
{
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
