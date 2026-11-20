{ pkgs, pins, kit, b2n ? null, ... }:
let
  lib = pkgs.lib;


  mods = "$out/lib/node_modules/olai-acp-pi/node_modules";

  mcpBridgeDir = "${mods}/olai-pi-mcp-bridge";
  bridge = ./acp/mcp-bridge;

  adapter = kit.npmAdapter {
    name = "olai-acp-pi";
    shim = ./acp/shim;
    shimName = "olai-acp-pi";
    version = "0.0.33";
    package = "pi-acp";
    entry = "dist/index.js";
    bin = "pi-acp";
    npmDepsHash = "sha256-1bRrVwPBx5i6aGE6vbhI8UgjFkOsLXsHyrMDBXcDP9k=";
    patches = ./acp/patches;
    # pi loads the bridge through jiti from inside a bun-compiled binary whose
    # package resolution drops relative-URL discipline, so it is bundled into
    # one self-contained file.
    extraNativeBuildInputs = [ pkgs.esbuild ];
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
  npmTrees = [ "acp/shim" ];
  knobs.OLAI_ACP_PI = {
    kind = "file";
    path = "${adapter}/bin/pi-acp";
  };
  packages.pi-agent = adapter;
}
