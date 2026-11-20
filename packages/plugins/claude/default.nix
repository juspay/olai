{ pkgs, pins, kit, b2n ? null, ... }:
let
  lib = pkgs.lib;

  facts = import "${pins.kolu}/packages/acp-claude/adapter";

  nodeArch = "${pkgs.stdenv.hostPlatform.node.platform}-${pkgs.stdenv.hostPlatform.node.arch}";
  mods = "$out/lib/node_modules/${facts.shimName}/node_modules";

  adapter = kit.npmAdapter (facts // {
    name = "olai-acp-claude";
    extraNativeBuildInputs = lib.optional pkgs.stdenv.hostPlatform.isLinux pkgs.patchelf;
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
  koluSeeds = [ "@kolu/acp-claude" ];
  knobs.KOLU_ACP_AGENT = {
    kind = "file";
    path = "${adapter}/bin/claude-agent-acp";
  };
  packages.claude-agent = adapter;
}
