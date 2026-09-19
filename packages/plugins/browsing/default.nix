{ pkgs, ... }:
let
  # The pinned nixpkgs wrapper sets PLAYWRIGHT_BROWSERS_PATH to its matching
  # playwright-driver.browsers and defaults PLAYWRIGHT_MCP_BROWSER to chromium.
  executable = "${pkgs.playwright-mcp}/bin/playwright-mcp";
in
{
  knobs.OLAI_BROWSER_MCP = {
    kind = "file";
    path = executable;
  };
  checks = { tree }: {
    surface = pkgs.runCommand "olai-plugin-browsing-surface"
      { nativeBuildInputs = [ pkgs.bun ]; }
      ''
        cd ${tree}
        bun packages/plugins/browsing/src/surface.check.ts ${executable}
        mkdir -p $out
      '';
  };
}
