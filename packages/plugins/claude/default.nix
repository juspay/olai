# CLAUDE'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The Claude Code engine ships its ACP adapter Pinned — every documented way of
# starting olai must come with one. The adapter is KOLU'S DERIVATION, built
# here from olai's own pins: kolu's `nix/packages/acp-adapter.nix` (the npm
# shim, patches and names from `@kolu/acp-claude`, the wrapper and the env it
# arms) driving `bin/claude` of agent-distro's floor, built by kolu's
# `packages/agent-distro/package.nix` from olai's `agent-distro` pin. So the
# Claude Code olai's Claude talks to is the one agent-distro ships, the one
# kolu's terminals and kolu's own adapter run, and a kolu pin bump moves
# adapter and CLI together. Both kolu files say in their headers that another
# repository imports them by path.
#
# THE FLOOR'S REVISION IS CHECKED HERE. kolu builds its own floor from the
# `agent-distro` revision in its own `npins`, and `LAUNCHER_SETTINGS` restates
# that floor's launcher at that revision; a different pin here would be a
# different Claude Code from kolu's, behind settings stated for another one.
# So this file refuses at eval when olai's `agent-distro` pin and the kolu
# pin's record disagree, naming both. It does not lean on the kolu plugin's
# graft guard: that one compares only while the kolu plugin's seeds happen to
# reach `@juspay/agent-distro`.
#
# THIS file owns only olai's own lines: that revision check, the knob
# `KOLU_ACP_AGENT`, a `file` the fold bakes into the `olai` wrapper with
# `--set-default` as it does for every plugin knob, the flake output
# `.#claude-agent` — `packages.claude-agent`, arrived at through the fold's
# disjoint-union merge rather than a root line — and the sandboxed check that
# the built adapter answers a model picker.
{ pkgs, pins, ... }:
let
  koluFloor = (builtins.fromJSON (builtins.readFile "${pins.kolu}/npins/sources.json")).pins.agent-distro.revision;
  floor =
    if pins.agent-distro.revision != koluFloor then
      throw "claude plugin: olai's agent-distro pin is ${pins.agent-distro.revision}, but the kolu pin (${pins.kolu.revision}) builds its floor from ${koluFloor}; move the agent-distro pin to ${koluFloor}"
    else
      import "${pins.kolu}/packages/agent-distro/package.nix" { inherit pkgs; src = pins.agent-distro; };
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
  # SANDBOXED ADAPTER CHECK — `checks.plugin-claude-adapter`: the built adapter,
  # spoken to over ACP in the build sandbox with an empty `HOME`, no
  # credentials and no network, must answer `session/new` with a `model`
  # picker of at least one row (`src/adapter.check.ts` says why, and why it
  # names no model). It reads no other source of this repository, so it takes
  # the probe file alone rather than the staged `tree` the other plugins'
  # surface checks run in.
  checks = { ... }: {
    adapter = pkgs.runCommand "olai-plugin-claude-adapter"
      {
        nativeBuildInputs = [ pkgs.bun ];
        probe = ./src/adapter.check.ts;
        inherit adapter;
      } ''
      export HOME=$TMPDIR/home
      mkdir -p $HOME
      bun $probe $adapter/bin/claude-agent-acp $HOME
      mkdir -p $out
      echo "$adapter/bin/claude-agent-acp" > $out/ok
    '';
  };
}
