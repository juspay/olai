# The patches THIS ENGINE'S adapter carries

## Where these live, and why here

One patch applies to the pinned `pi-acp` 0.0.33 — to its **compiled**
`dist/index.js`, because npm is the only channel the adapter ships through
(`nix/acp-agent.nix` says why that pin is npm-shaped). It is applied by that
derivation's `postInstall`, so every documented way of starting olai —
`nix run`, the packaged binary, `just serve`, `just run`, the e2e suite's
`OLAI_BIN` — gets the same agent.

**It sits in this plugin's directory rather than beside the shim**, and that
is the agents phase: an engine is a plugin now, with its own release clock,
so its adapter's patches and the sources they are generated from travel with
it. What is still shared is the npm SHIM (`acp/package.json` and its
lockfile) — one lockfile, two adapters, one fixed-output derivation — and
`acp/README.md` says why. The Claude Code adapter's two patches are one
directory over, in `packages/plugins/claude/acp/patches/`.

---

# `pi-mcp-servers.patch` — the session pi-acp was handed its servers to

Route A of the host's MCP bridge (proposed and chosen in juspay/olai#422):
this pin is olai's own answer to *pi has no MCP client* — which is by
the harness's own design decision (its README says so in so many words),
not an accident to wait out upstream of anyone.

## What it patches, and what it never touches

pi-acp 0.0.33 (its `dist/index.js` was read, not guessed at):

- `session/new` *and* `session/load` receive the ACP request's
  `mcpServers` and **store them on the session** — and then the field is
  never read anywhere else in the file. The adapter *advertises its own
  empty piece of this answer*: `mcpCapabilities` in the `initialize`
  response answers `{ http: false, sse: false }` — which pi-acp never
  raises when something does answer.
- `PiRpcProcess.spawn` runs pi as `pi --mode rpc --no-themes`, one process
  per session, `env: process.env` — the whole injection seam, and one a
  patch can't spoil because it is so small.

The patch therefore has two halves, one small each:

1. **The spawn hands over what the request handed.** When the env wrapper
   (see `nix/acp-agent.nix`) armed `PI_ACP_MCP_EXTENSION` and the request
   came with `mcpServers` — both, never one — the spawn becomes
   `pi --mode rpc --no-themes -e <bridge>` and the child's env gains
   `PI_ACP_MCP_SERVERS`, the request's own JSON. No servers, no
   extension, no change: the unpinned wire stays the unpinned wire.
2. **`mcpCapabilities` answers the arming, not the adapter's boast.**
   `http`/`sse` are true when the env named a bridge, false when it named
   nothing — so a foreign `OLAI_ACP_PI` is asked the question it can
   answer rather than read off whatever this pin's README claimed.

## The bridge is the pin's own extension, not pi's file

The `-e` target is `../mcp-bridge/` installed alongside the pinned tree —
`extension.mjs`, **bundled by esbuild in the derivation** because pi loads
extensions through jiti from inside a bun-compiled binary whose module
resolution cannot trace a node_modules tree by the relative-URL discipline
the source file is written in. (The bare evidence: that loader reaches
`@modelcontextprotocol/sdk`'s `client/sse.js` and THEN cannot find
`eventsource`, which is right there — a bundled pi's embedded loader
questions are why the answer is one self-contained file, not the file the
reviewer reads.)

Inside the bridge:

- one SDK client per server, from `PI_ACP_MCP_SERVERS` — stdio entries by
  command, `http`/`sse` entries by url;
- every listed tool `pi.registerTool`ed as `${server}_${tool}`, the name
  olai's panel already reads (`olai_read_node`, `kolu_list_terminals`),
  with the MCP `inputSchema` converted to the TypeBox `pi.registerTool`
  demands (`naming.js`'s `schemaToTypebox`, the way its tests assert);
- a server that declines its attach says so in the transcript — spoken
  from `ctx.ui.notify` — a server's failure being ITS sentence, never a
  mute banner.

## Where its round trip is proven

- `bun test packages/plugins/pi/acp/mcp-bridge` — `roundtrip.test.js` crosses it over an
  in-memory pair with the real SDK: tools listed, registered under the
  panel's names, called through pi's own definitions, errors surfaced.
- The experiment this pin ships for is proven live in #422's evidence: a
  real pi, kimi-k3 answering, the `olai_*` / `kolu_*` rows in the
  transcript answering back.
- pi-acp upstream has no MCP wiring work as of this writing — the closest
  adjacent ask is svkozak/pi-acp#38 (extra CLI args), and the Bridge's
  shape stands on this pin until upstream chooses one (Route B stays
  gated, per this lane's instructions).

