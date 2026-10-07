{ pkgs, ... }:
let
  # The pinned nixpkgs wrapper sets PLAYWRIGHT_BROWSERS_PATH to its matching
  # playwright-driver.browsers and defaults PLAYWRIGHT_MCP_BROWSER to chromium.
  executable = "${pkgs.playwright-mcp}/bin/playwright-mcp";

  # The full Chromium from the SAME browsers bundle the MCP's wrapper names,
  # so the browser olai runs and the Playwright that attaches to it are one
  # release. The per-platform paths are Playwright's own registry's
  # (`chromium` executable paths), with the revision read off the pin rather
  # than spelled here.
  browsers = pkgs.playwright-driver.browsers;
  revision = pkgs.playwright-driver.browsersJSON.chromium.revision;
  chromium = "${browsers}/chromium-${revision}/" + {
    x86_64-linux = "chrome-linux64/chrome";
    aarch64-linux = "chrome-linux/chrome";
    aarch64-darwin = "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  }.${pkgs.stdenv.hostPlatform.system};
in
{
  knobs.OLAI_BROWSER_MCP = {
    kind = "file";
    path = executable;
  };
  knobs.OLAI_BROWSER_CHROMIUM = {
    kind = "file";
    path = chromium;
  };
  # End to end and hermetic: the pinned Chromium launches headless on a temp
  # profile, the pinned MCP attaches over CDP and browses pages the check
  # serves itself, and the plugin's own CDP client receives screencast frames.
  # Loopback only; no network.
  checks = { tree }: {
    surface = pkgs.runCommand "olai-plugin-browsing-surface"
      {
        nativeBuildInputs = [ pkgs.bun ];
        # Loopback only: the MCP reaches Chromium's DevTools port and the
        # check serves its pages on 127.0.0.1. The macOS build sandbox refuses
        # local networking without this (the MCP's CDP dial was reset); it
        # changes nothing on Linux.
        __darwinAllowLocalNetworking = true;
      }
      ''
        export HOME=$TMPDIR
        cd ${tree}
        bun packages/plugins/browsing/src/surface.check.ts ${executable} ${pkgs.lib.escapeShellArg chromium}
        mkdir -p $out
      '';
  };
}
