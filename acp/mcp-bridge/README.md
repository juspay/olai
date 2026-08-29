# The MCP bridge — what the pin hands pi

## What this is, and why the hole belongs to the adapter

pi-acp 0.0.33's `dist/index.js` is the file olai reads rather than a source tree named in the README's own voice:

- `session/new` and `session/load` each receive the request's `mcpServers` and **store them on the session object** — and the field is read NOWHERE else in the file: a name gathered and immediately unreached, a socket we answer for.
- `PiRpcProcess.spawn` is the ONLY seam through which anything reaches pi, and one patch can't spoil: `pi --mode rpc --no-themes <args>`, one process per session, `env: process.env` — a process never asks a question its process env wasn't answered.
- `mcpCapabilities: { http: false, sse: false }` is the answer to handshakes IT is asked, not a summary of what its writer hoped the stepping stones would be.

`acp/patches/pi-mcp-servers.patch` closes the hole. Both halves of the handshake (session/new, session/load) hand the request's servers through to the SINGLE spawn, which reaches pi EXACTLY once, as pi's own `-e` flag to a bridge `olai-pi-mcp-bridge` whose existence the spawn requires. Nothing about pi's mode, its session bookkeeping, or its answer protocol changes: pi commits the same `--session` flags it always does, the patch rides the one spawn. Nothing aboutthe handshake the surface sees changes either: the answers pi-acp carries (`end_turn`-mappings, queued chunk texts, the banner's double-answer) stay the answers — what changed is the capability flip and, behind it, what the model's tool surface consists of. A bump of `pi-acp` or its wiring that moved the patch off pin's four anchors fails HERE AT THE BUILD — `patch -p1 -F0` answers this: nothing continues silently into a vague half, which is the whole reason the flag is `-F0` rather than the default's soft two-line tolerance.

What gets wired — three sentences per leg and no more, because that's how the budget of a pin always reads:

| the panel hands it | what pi calls it | what the tool rows say |
|---|---|---|
| `olai`, HTTP to its own `/mcp` (same port as the web process) | `olai_search_nodes`, `olai_read_node`, … | `The search for "slugs" returned exactly 1 hit —` |
| `kolu`, stdio to its own adapter (the `kolu` on PATH) | `kolu_watch_next`, `kolu_watch_close`, … | `This host has 4 terminals …` |

The answer the adapter advertises (`mcpCapabilities: { http: true, sse: true }`) is TRUE by the spawn's own answer: when the wrapper named a bridge, it honors both; when it named nothing, it answers false-false — the surface's answer is the wrapper's own env, not a claim in olai's source. What olai cannot answer and doesn't: an adapter NOT this pin (the `OLAI_ACP_PI` override lane in the pin's scripts) — its answers are its own, the claim structure is exported here and not to a surface a foreign adapter is guaranteed to ACCEPT.

## What's in this folder

- `naming.js` — the vocabulary BOTH the surface and pi answer by:
  - `toolName(server, tool)` => `server_tool` (e.g. `olai_search_nodes`), dead-stable, collapsed to pi's tool-name alphabet;
  - `schemaToTypebox(Type, schema)` — MCP's inputSchema to the TypeBox `pi.registerTool` demands, on the subset olai's and kolu's shapes actually use, anything else falling back to `Any` rather than guessed at;
  - `serverToClientPlan(name, spec)` — the stdio/http/sse branch table the adapter answers.
- `wire.mjs` — `registerServerTools(pi, Type, client, plan)` and `answerText(answer)`; no SDK imports of its own, so the pin's tests answer from a node_modules-less tree.
- `extension.mjs` — the shell the derivation BUNDLES (read the header for the reason: pi loads extensions through jiti out of a bun-compiled binary, whose resolver cannot trace the tree the patch otherwise hands it — the evidence is in the file's header).
- `naming.test.js` — the shapes the other legs answer by, asserted with no pin in sight.
- `roundtrip.test.js` — the round trip, SDK side-by-side over an in-memory transport pair: tools listed, registered under the panel's names, called through pi's own definitions, errors surfaced.
- `regenerate.sh` — the splices into pristine pi-acp dist, machine-diffed (same discipline as `acp/session-list-info/regenerate.sh`, whose header says WHY in the register).

## Bumping the pin, and what to re-verify

1. `cd acp && npm install --package-lock-only --ignore-scripts` — the lockfile FIRST; every dependency the bridge needs has to be in the npm deps FOD rather than fetched at build time, because there is no `npx` at runtime.
2. `bash acp/mcp-bridge/regenerate.sh` — the patch's diff until it burns clean; the `-F0` build says which anchor moved, and the reason for the failure IS the bump's answer: anchors move because shape moved, and a shape that moved needs the four answers revisited rather than the patch re-pasted.
3. `npmDepsHash = lib.fakeHash` in `nix/acp-agent.nix` → build → paste the hash it prints. Three legs in the dance, not two: the lockfile, the patch, the hash — the build only answers with all three consistent.
4. Everything about the protocol connector — **re-verify against the bump**: the four anchors (`sessions.create`'s `cwd: params.cwd`, restore's `cwd,`, the spawn's arg-limbo, `mcpCapabilities`), the bridge's import paths, the tests (they answer mcpCapabilities per arm). Make the e2e pin answer it too — `nix build ..#olai` and the culled path the script hands the activation.

## The half this pin is not

Route B is when a pi-acp answers this natively: it doesn't today. Upstream's answer (`svkozak/pi-acp#38` — the "support specify command line args" request — is the adjacency, not the hole: the answer olai's pin needs is mcpServers handed into the spawn, not a flags escape hatch) is **gated on ratification in the olai board**; no upstream contact comes out of this folder.
