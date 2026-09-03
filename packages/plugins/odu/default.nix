# ODU'S OWN MARK — the pin path, and nothing else.
#
# The mechanism lives in `@olai/plugin-kit`. This file names the file: odu's
# logo is `logo.svg` at the repo root of juspay/odu, and it is read out of
# the same npins revision `@odu/run-client` hydrates from. Bumping the pin
# is the whole of updating the logo.
{ pkgs }:
let
  npins = import ../../../npins;
in
import ../../plugin-kit {
  inherit pkgs;
  svg = "${npins.odu}/logo.svg";
  revision = npins.odu.revision;
  from = "juspay/odu logo.svg";
}
