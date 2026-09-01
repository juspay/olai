# KOLU'S OWN MARK — the pin path, and nothing else.
#
# The mechanism lives in `@olai/plugin-kit`. This file names the file: kolu's
# logo is `packages/client/favicon.svg` in juspay/kolu, and it is read out of
# the same npins revision every `@kolu/*` source hydrates from. Bumping the
# pin is the whole of updating the logo.
{ pkgs }:
let
  npins = import ../../../npins;
in
import ../../plugin-kit {
  inherit pkgs;
  svg = "${npins.kolu}/packages/client/favicon.svg";
  revision = npins.kolu.revision;
  from = "juspay/kolu packages/client/favicon.svg";
}
