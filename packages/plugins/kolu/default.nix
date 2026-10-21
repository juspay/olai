# KOLU'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# Kolu is olai's framework: the surface, the Dock row, the terminal
# vocabulary, six packages deep. The ROOT's `nix/kolu.nix` declares the
# framework seeds (`@kolu/surface*` alone) and asks kolu's own
# `consumer.nix` to expand them into the thirty-two-member closure this tree
# hydrates as raw TypeScript. This file adds the TENANT half: the favicon the
# chat chip inlines, the Dock row and `@kolu/detect` the appliance door
# answers, and the `terminal-themes` seed nobody else needs.
#
# It plugs into `nix/kolu.nix` through the fold's `extraSeeds` /
# `pinnedSources` — so the tenant answers its own `koluSeeds` and
# `koluPins`, one overlay at a time.
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
  # THE TENANT SEEDS — `terminal-themes` the chat UI's color select reads,
  # the Dock row and detector the plugin's own `appliance` door answers.
  # `@kolu/surface*` stays the framework's (nix/kolu.nix); this list is what
  # the root folds in with `extraSeeds`.
  koluSeeds = [ "@kolu/detect" "@kolu/solid-dockrow" "terminal-themes" ];

  # The osfacts graft, named the way the fold hands it to kolu's
  # `consumer.nix`: `src` is the npins osfacts tree's `client-ts` brother,
  # `revision` is the npins revision the build refuses to be out of step with.
  koluPins."osfacts-client" = {
    src = "${pins.osfacts}/client-ts";
    revision = pins.osfacts.revision;
  };

  # The agent-distro graft, same contract and a different pin: `@kolu/agent-distro`
  # imports agent-distro's own runtime tree from `src/`, and the revision is the
  # one kolu#2312's closure names (`3053b529…`) — kolu refuses at eval if the
  # `agent-distro` pin and that record disagree, so the two cannot drift.
  koluPins."@juspay/agent-distro" = {
    src = "${pins.agent-distro}/src";
    revision = pins.agent-distro.revision;
  };

  # The `@odu/*` trio, same contract: `@kolu/padi-client` carries odu's service
  # contract as a sibling, and kolu#2312's closure names the revision it was
  # built against (`f4ba5da2…`). All three are pinned members, so all three are
  # grafted from the one `odu` pin.
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

  # The favicon, stamped and inlined by `kit.mark`; `just install` (and the
  # packaged build) copies the `mark.generated.ts` file beside the component
  # that draws the chat chip.
  generated."src/browser/mark.generated.ts" = mark;

  # Exported as `kolu-mark`, the same output the packaged build's wrapper
  # used to name at the root.
  packages.kolu-mark = mark;
}
