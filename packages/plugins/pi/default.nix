# PI'S NIX HALF — the plugin's own `default.nix`, in the fold's contract.
#
# The pi engine's shipped ACP adapter is the other half of the same `acp/` shim
# the Claude row reads (one lockfile, one npmDepsHash — see acp/README.md). Now
# that engines are plugins, THIS file owns the pi row's facts: the npm package,
# the wrapper's bin, the MCP extension that arms it, and the bridge bundle the
# extension loads. The shared build itself is `@olai/plugin-kit`'s
# `kit.npmAdapter`, the same mechanism the Claude plugin calls.
#
# The knob `OLAI_ACP_PI` is a `file` the fold bakes into the `olai` wrapper with
# `--set-default`, and the package `pi-agent` is what the fold exports as a
{pkgs, pins, kit, b2n ? null, acpShim, ...}:
let
  lib = pkgs.lib;


  # `mods` is the shim's installed node_modules — the same literal the build's
  # postInstall spells against (`$out` being the shell's build output).
  mods = "$out/lib/node_modules/olai-acp/node_modules";

  # THE OTHER HALF OF PI'S PATCH: the extension pi loads and the vocabulary
  # module it shares with the pin's test rig. Installed one directory up from
  # the SDK and typebox inside the shim's tree so the extension's relative-URL
  # import rule answers — see its header — rather than a bare specifier being
  # left to whichever module resolution pi's engine happens to run with.
  mcpBridgeDir = "${mods}/olai-pi-mcp-bridge";
  bridge = ./acp/mcp-bridge;

  adapter = kit.npmAdapter {
    name = "olai-acp-pi";
    # The shared `acp/` shim at the repo root: one lockfile, one FOD, one
    # npmDepsHash for the Claude and Pi adapters both.
    shim = acpShim;
    shimName = "olai-acp";
    # tracks acp/package.json: @agentclientprotocol/claude-agent-acp + pi-acp
    version = "0.73.0+pi-0.0.33";
    package = "pi-acp";
    entry = "dist/index.js";
    bin = "pi-acp";
    npmDepsHash = "sha256-AQw99ESOzQALZWKYIhe18WKWXjql07WGow/eAnFJeLg=";
    # This plugin's patches, beside the sources they are generated from.
    patches = ./acp/patches;
    # esbuild bundles the MCP bridge into one self-contained file (below),
    # which is what pi LOADS through jiti from inside a bun-compiled binary
    # whose package-resolution drops the knot of relative-URL discipline.
    extraNativeBuildInputs = [ pkgs.esbuild ];
    # PI_ACP_MCP_EXTENSION is the ONE arming knob the patched adapter reads:
    # this wrapper sets it, so every documented way of starting olai gets an
    # adapter whose `mcpCapabilities` answer http/sse TRUE in fact, not the
    # pin's README's say-so. An OLAI_ACP_PI override lane that isn't this build
    # answers its own flags — that is why the capability read lives in the
    # adapter's env, not in olai's roster.
    #
    # No `pi` baked in: the agent it drives is a per-machine find, so the ROW
    # names it at spawn time (`PI_ACP_PI_COMMAND`, set by this plugin's probe)
    # rather than it being fixed here.
    env = [ ''--set PI_ACP_MCP_EXTENSION "${mcpBridgeDir}/extension.bundle.mjs"'' ];
    postInstall = ''
      mkdir -p "${mcpBridgeDir}"
      cp ${bridge}/extension.mjs "${mcpBridgeDir}/extension.mjs"
      cp ${bridge}/naming.js "${mcpBridgeDir}/naming.js"
      cp ${bridge}/wire.mjs "${mcpBridgeDir}/wire.mjs"
      ${pkgs.esbuild}/bin/esbuild "${mcpBridgeDir}/extension.mjs" \
        --bundle --platform=node --format=esm --log-level=warning \
        --outfile="${mcpBridgeDir}/extension.bundle.mjs"
    '';
  };
in
{
  # THE PI ROW'S EXECUTABLE RESOURCE. `file` kind: the knob points at the
  # wrapper itself, so the `just nix` lane can assert it is executable.
  knobs.OLAI_ACP_PI = {
    kind = "file";
    path = "${adapter}/bin/pi-acp";
  };
  packages.pi-agent = adapter;
}