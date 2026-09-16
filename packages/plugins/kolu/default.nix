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

  # The favicon, stamped and inlined by `kit.mark`; `just install` (and the
  # packaged build) copies the `mark.generated.ts` file beside the component
  # that draws the chat chip.
  generated."src/browser/mark.generated.ts" = mark;

  # Exported as `kolu-mark`, the same output the packaged build's wrapper
  # used to name at the root.
  packages.kolu-mark = mark;
}
