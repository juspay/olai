# CLAUDE'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The Claude Code engine ships its ACP adapter Pinned — every documented way of
# starting olai must come with one. WHICH adapter is pinned is not olai's to
# say alone: kolu runs the same one, so the npm shim, its lockfile and hash, the
# two patches and the package/entry/bin names live once, in kolu's
# `@kolu/acp-claude` (`packages/acp-claude/adapter/default.nix` in the kolu
# pin), and the builder is kolu's `nix/npm-adapter.nix` (`kit.npmAdapter`).
# THIS file owns only olai's own lines: the env the wrapper arms (the SDK's
# bundled `claude`, no autoupdater or install checks, ripgrep from the store),
# and the Linux patchelf of that bun-compiled binary.
#
# The knob `KOLU_ACP_AGENT` is a `file` the fold bakes into the `olai` wrapper
# with `--set-default`, exactly as it now does for every plugin knob. The
# flake output is `.#claude-agent` — `packages.claude-agent` at the bottom —
# arrived at through the fold's disjoint-union merge rather than a root line.
{ pkgs, pins, kit, b2n ? null, ... }:
let
  lib = pkgs.lib;

  # The facts both products build from.
  facts = import "${pins.kolu}/packages/acp-claude/adapter";

  # npm's own platform naming: linux-x64, darwin-arm64, …
  nodeArch = "${pkgs.stdenv.hostPlatform.node.platform}-${pkgs.stdenv.hostPlatform.node.arch}";
  # `mods` is the shim's installed node_modules — the same literal the build's
  # postInstall spells against (`$out` being the shell's build output), so the
  # env arms the SDK binary at the path the build actually leaves.
  mods = "$out/lib/node_modules/${facts.shimName}/node_modules";

  adapter = kit.npmAdapter (facts // {
    name = "olai-acp-claude";
    # patchelf for the SDK's bun-compiled `claude`; only the interpreter may
    # be touched (see kolu's `nix/npm-adapter.nix` header).
    extraNativeBuildInputs = lib.optional pkgs.stdenv.hostPlatform.isLinux pkgs.patchelf;
    # Node is pinned and so is the CLI the SDK drives (the adapter reads
    # CLAUDE_CODE_EXECUTABLE before it goes looking); nothing here resolves off
    # PATH. The rest is what nixpkgs' claude-code sets: no self-update (this
    # closure is immutable), and the ripgrep buried in the bun archive cannot
    # be patched, so hand it the one from the store.
    env = [
      ''--set-default CLAUDE_CODE_EXECUTABLE "${mods}/@anthropic-ai/claude-agent-sdk-${nodeArch}/claude"''
      "--set DISABLE_AUTOUPDATER 1"
      "--set DISABLE_INSTALLATION_CHECKS 1"
      "--set USE_BUILTIN_RIPGREP 0"
      ''--prefix PATH : "${lib.makeBinPath [ pkgs.ripgrep pkgs.procps ]}"''
    ];
    postInstall = lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
      claude="${mods}/@anthropic-ai/claude-agent-sdk-${nodeArch}/claude"
      test -x "$claude"
      patchelf --set-interpreter \
        "$(cat "${pkgs.stdenv.cc}/nix-support/dynamic-linker")" "$claude"
    '';
  });
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
