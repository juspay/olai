# CODEX'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The Codex engine owns a separate pin and derivation from the patched
# Claude/Pi pair: its adapter and native CLI move on one release clock,
# independently of the shared `acp/` shim. The full executable side — the npm
# pin, the native Codex binary that pin resolves, and the ACP wrapper olai
# spawns — lives in `./acp/default.nix` beside this file (neither its release
# clock nor its platform layout is shared), and THIS file is the fold door that
# surfaces it: the `OLAI_ACP_CODEX` knob and the `codex-agent` package.
{pkgs, pins, kit, b2n ? null}:
let
  # The plugin's own complete executable side, a buildNpmPackage over its pin.
  codexAgent = pkgs.callPackage ./acp { inherit pkgs; };
in
{
  # THE CODEX ROW'S EXECUTABLE RESOURCE. `file` kind: the knob points at the
  # wrapper itself, so the `just nix` lane can assert it is executable.
  knobs.OLAI_ACP_CODEX = {
    kind = "file";
    path = "${codexAgent}/bin/codex-acp";
  };
  # Exported as `codex-agent`; the flake aliases `.#codex-agent` to this.
  packages.codex-agent = codexAgent;
}