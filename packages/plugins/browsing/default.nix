{ pkgs, ... }:
let
  # nixpkgs' wrapper sets PLAYWRIGHT_BROWSERS_PATH to its matching
  # playwright-driver.browsers and defaults PLAYWRIGHT_MCP_BROWSER to chromium.
  executable = "${pkgs.playwright-mcp}/bin/playwright-mcp";

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
  # Hosted ubuntu runners have no user namespaces in the build, so Chromium's
  # own sandbox aborts (SIGABRT, "No usable sandbox!"); the check alone
  # launches with WITHOUT_ITS_OWN_SANDBOX (`src/chromium.ts`). On macOS the
  # profile's cookie store waits on a Keychain a UI-less process cannot
  # answer, which `--use-mock-keychain` in the runtime flags settles.
  checks = { tree }: {
    surface = pkgs.runCommand "olai-plugin-browsing-surface"
      {
        nativeBuildInputs = [ pkgs.bun ];
        # Loopback only: the MCP reaches Chromium's DevTools port and the
        # check serves its pages on 127.0.0.1, which a sandboxed darwin
        # builder refuses without this.
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
