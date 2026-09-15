# CLAUDE'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The Claude Code engine ships its ACP adapter Pinned — every documented way of
# starting olai must come with one — and this file is where that pin lives now
# that the engines are plugins. The shared mechanism is `@olai/plugin-kit`'s
# `kit.npmAdapter` (one derivation per adapter from the shared `acp/` shim);
# THIS file owns the Claude row's facts: the npm package inside the shim tree,
# the wrapper's bin, the env it arms (pinned `claude` executable, no
# autoupdater or install checks, ripgrep from the store), and the Linux
# patchelf of the bun-compiled `claude` binary the SDK ships.
#
# The knob `OLAI_ACP_AGENT` is a `file` the fold bakes into the `olai` wrapper
# with `--set-default`, exactly as it now does for every plugin knob, and the
# flake output `.#acp-agent` (the historical name for "the Claude adapter") is
{pkgs, pins, kit, b2n ? null, acpShim, ...}:
let
  lib = pkgs.lib;


  # npm's own platform naming: linux-x64, darwin-arm64, …
  nodeArch = "${pkgs.stdenv.hostPlatform.node.platform}-${pkgs.stdenv.hostPlatform.node.arch}";
  # `mods` is the shim's installed node_modules — the same literal the build's
  # postInstall spells against (`$out` being the shell's build output), so the
  # env arms the SDK binary at the path the build actually leaves.
  mods = "$out/lib/node_modules/olai-acp/node_modules";

  adapter = kit.npmAdapter {
    name = "olai-acp-claude";
    # The shared `acp/` shim at the repo root: one lockfile, one FOD, one
    # npmDepsHash for the Claude and Pi adapters both.
    shim = acpShim;
    shimName = "olai-acp";
    version = "0.73.0+pi-0.0.33";
    package = "@agentclientprotocol/claude-agent-acp";
    entry = "dist/index.js";
    bin = "claude-agent-acp";
    npmDepsHash = "sha256-AQw99ESOzQALZWKYIhe18WKWXjql07WGow/eAnFJeLg=";
    # This plugin's patches, beside the sources they are generated from.
    patches = ./acp/patches;
    # patchelf for the SDK's bun-compiled `claude`; only the interpreter may
    # be touched (see `@olai/plugin-kit`'s `npm-adapter.nix` header).
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
  };
in
{
  # THE CLAUDE ROW'S EXECUTABLE RESOURCE. `file` kind: the knob points at the
  # wrapper itself, so the `just nix` lane can assert it is executable.
  knobs.OLAI_ACP_AGENT = {
    kind = "file";
    path = "${adapter}/bin/claude-agent-acp";
  };
  # Exported as `claude-agent`; the flake aliases `.#acp-agent` to this.
  packages.claude-agent = adapter;
}