{ pkgs, pins, kit, ... }:

let
  src = pins.kolu;

  mark = kit.mark {
    svg = "${src}/packages/client/favicon.svg";
    revision = src.revision;
    from = "juspay/kolu packages/client/favicon.svg";
  };
in
{
  koluSeeds = [ "@kolu/detect" "@kolu/solid-dockrow" "terminal-themes" ];

  koluPins."osfacts-client" = {
    src = "${pins.osfacts}/client-ts";
    revision = pins.osfacts.revision;
  };

  koluPins."@juspay/agent-distro" = {
    src = "${pins.agent-distro}/src";
    revision = pins.agent-distro.revision;
  };

  koluPins."@odu/run-client" = {
    src = "${pins.odu}/packages/run-client";
    revision = pins.odu.revision;
  };
  koluPins."@odu/run-history" = {
    src = "${pins.odu}/packages/run-history";
    revision = pins.odu.revision;
  };
  koluPins."@odu/service-client" = {
    src = "${pins.odu}/packages/service-client";
    revision = pins.odu.revision;
  };

  generated."src/browser/mark.generated.ts" = mark;

  packages.kolu-mark = mark;
}
