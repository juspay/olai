{ pkgs, pins, kit, b2n ? null, ... }:
let
  codexAgent = pkgs.callPackage ./acp { };
in
{
  knobs.OLAI_ACP_CODEX = {
    kind = "file";
    path = "${codexAgent}/bin/codex-acp";
  };
  packages.codex-agent = codexAgent;
}
