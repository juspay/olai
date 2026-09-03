# mcp-bridge

## What it is

pi-acp (0.0.33) accepts `mcpServers` on `session/new` and `session/load`, stores them, and never reads them again. The session's MCP servers never reach pi — olai's `/mcp` servers die at the adapter.

This folder is the bridge that answers the hole. The pin's derivation applies `../patches/pi-mcp-servers.patch` to the adapter's `dist/index.js`, and the patched spawn hands each session's pi:

1. the **bridge extension** via pi's `-e` flag (`PI_ACP_MCP_EXTENSION`), and
2. the **servers** in its process env (`PI_ACP_MCP_SERVERS`), one JSON serialized value per process — safe because pi-acp spawns one process per session.

pi loads it, one SDK client per server, each tool on the panel's names — `olai_search_nodes`, `olai_read_node`, `kolu_watch_close`, … — and the model answers with them the way olai's surface already reads.

The adapter's own advertised `mcpCapabilities` is the testable witness: `{ http: true, sse: true }` only when the env named a bridge. If the env is not set, it goes back to `{ http: false, sse: false }` — a capability answer that's the env's truth, never a claim.

## What's here

| File | What it is |
|---|---|
| `naming.js` | The vocabulary both olai's panel and pi's tool surface answer (`server_tool` names, the MCP-schema→TypeBox conversion, the stdio/http/sse branch). No SDK imports. |
| `wire.mjs` | `registerServerTools(pi, Type, client, plan)` — what the pin's `registerTool` looks like when handlers call the SDK client. |
| `extension.mjs` | The shell the derivation bundles (why bundling: [pi's extension loader is jiti in a bun-compiled binary](https://github.com/earendil-works/pi) and can't trace the node_modules tree — in the file's header). |
| `naming.test.js` | Pure unit answers. No pin in sight. |
| `roundtrip.test.js` | A real SDK pair over an in-memory transport: tools listed, names answered, calls through pi's API, errors surfaced. |
| `regenerate.sh` | The patches/generation dance (same discipline as `packages/plugins/claude/acp/session-list-info/regenerate.sh`). |

## Bumping the pin

Bump the `pi-acp` line in `acp/package.json`. Then:

1. `cd acp && npm install --package-lock-only --ignore-scripts` — the lockfile first.
2. `bash packages/plugins/pi/packages/plugins/pi/acp/mcp-bridge/regenerate.sh` — the patch re-baseline.
3. Set `npmDepsHash` to `lib.fakeHash` in `nix/acp-agent.nix`, build, paste the hash it prints.
4. Re-verify the four anchors the patch notes (the spawn args, both spawn call sites, mcpCapabilities) and the tests.

**`-F0` at the build is the guarantee**: it fails loudly on the moved anchor instead of glue-pasting it somewhere nearby.

## Upstream

There's no native pi-acp mcp-support work yet (the closest is [svkozak/pi-acp#38](https://github.com/svkozak/pi-acp/issues/38), and that's about *extra CLI args*, not mcpServers). This answer stays the pin's own; upstream participation waits for a ratified decision.
