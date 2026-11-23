# CLAUDE'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The Claude Code engine ships its ACP adapter Pinned — every documented way of
# starting olai must come with one. The adapter is KOLU'S DERIVATION, built
# here from olai's own pins: kolu's `nix/packages/acp-adapter.nix` (the npm
# shim, patches and names from `@kolu/acp-claude`, the wrapper and the env it
# arms) driving `bin/claude` of agent-distro's floor, built by kolu's
# `packages/agent-distro/package.nix` from olai's `agent-distro` pin — the
# revision kolu's closure already forces equal to its own. So the Claude Code
# CLI olai's Claude talks to is the one a person's terminals and kolu run, and
# a kolu pin bump moves adapter and CLI together. Both kolu files say in their
# headers that another repository imports them by path.
#
# THIS file owns only olai's two lines: the knob `KOLU_ACP_AGENT`, a `file`
# the fold bakes into the `olai` wrapper with `--set-default` as it does for
# every plugin knob, and the flake output `.#claude-agent` —
# `packages.claude-agent` at the bottom — arrived at through the fold's
# disjoint-union merge rather than a root line.
{ pkgs, pins, ... }:
let
  floor = import "${pins.kolu}/packages/agent-distro/package.nix" { inherit pkgs; src = pins.agent-distro; };
  adapter = pkgs.callPackage "${pins.kolu}/nix/packages/acp-adapter.nix" { agent-distro = floor; };
in
{
  # THE PACKAGE THIS ENGINE'S SOURCE IMPORTS out of the kolu pin — the leg, the
  # model table, the remote signals and the name — folded into the root's
  # seeds the way every tenant's `koluSeeds` are.
  koluSeeds = [ "@kolu/acp-claude" ];
  # THE CLAUDE ROW'S EXECUTABLE RESOURCE. `file` kind: the knob points at the
  # wrapper itself, so the `just nix` lane can assert it is executable.
  knobs.KOLU_ACP_AGENT = {
    kind = "file";
    path = "${adapter}/bin/claude-agent-acp";
  };
  # Exported by the flake as `.#claude-agent`.
  packages.claude-agent = adapter;
}
