# `@kolu/surface-cli`: the surface projected as argv, and `olai surface <verb>` on top of it

Status: brainstorming, rev 2 (2026-08-22). Prompted by `POST /capture` (#327, 2026-08-21): a bespoke HTTP door with its own body, auth, CSRF gate and error table, for one verb, because no generic client could reach the surface from outside a browser or an MCP session. The claim here is that the generic client is the thing to build, that it is a *projection of the surface* exactly as `@kolu/surface-mcp` is, and that it belongs upstream beside it. Rev 2 carries the human's rulings (at the foot): the CLI library is assumed, the phone door is dropped, `captured-by` records what the door has, names are flat, there is no `olai mcp`. Roadmap: `surface-cli` (to file), with the retirement of `/capture` as its child.

## The problem, stated without the capture

Olai has one server and, in its own words, three clients of one ops layer: a tab over the websocket, an agent at `/mcp`, and a share sheet at `/capture`. The first two are *faces* of the surface — `serveSurfaceApp` with `BROWSER_FACE`, `serveSurfaceAsMcp` with the `MCP` map and 28 bespoke tools over an `AGENT_FACE` client (`packages/server/src/faces.ts`, `packages/server/src/mcp/face.ts`). The third is not a face at all. `capture.ts` is ~550 lines that re-derive, for one verb, what the framework already provides for every verb: a body schema (`Posted`), an identity rule (`Tailscale-User-Login`, required), a CSRF gate (`Sec-Fetch-Site` + JSON content-type), a status table (`usage:400, not-found:404, validation:422, busy:503`), and its own writer name. Its header is candid about why: "`/mcp` is a whole closed tool table behind a bearer". The bearer is minted per process (`serve.ts:149`) and handed to nobody but the chat, so from a terminal on another machine — or from this one, outside a browser — there was no door. `/capture` is the door that got built because the general one was missing.

A CLI over the surface is the general one. Not a write CLI in the sense the docs forbid four times over (`running.md:234`, `architecture.md:2`, `main.ts`'s header, `acp.md:45`): nothing here opens the directory, and there is still one process that writes it. It is a fourth *client* of that process, and the sentence in those four places should say "no second writer" rather than "no CLI", because that is the principle they were protecting.

## What a surface is, for the purpose of projecting it

`defineSurface(spec)` takes five kinds of member and mints one flat `RpcGroup` whose tags are `surface/<member>/<verb>` (`@kolu/surface/define`):

- **cells** `{ schema, default }` — verbs `get` (a *stream*: snapshot then every change), `set` / `patch`;
- **collections** `{ keySchema, schema }` — `keys`, `get` (per key), `deltas` (one batched snapshot-then-delta stream for the whole set), `upsert`, `delete`;
- **streams** and **events** `{ inputSchema, outputSchema }` — `get` with an input;
- **procedures** `ns.verb: { input?, output?, error? }` — unary calls.

`READ_VERBS = get | keys | deltas` is the read half of that vocabulary, and `@kolu/surface/expose` turns a per-face `ExposeMap` — `"resource"` for a primitive (its read verbs), `"tool" | { tool: { mutates } }` for a procedure — into a default-deny `FaceExposure` that `restrictHandlers` applies. A served surface has as many faces as it has transports: the websocket (`serveSurfaceApp`), a per-user unix socket (`serveOverUnixSocket`), stdio, and the MCP adapter. The framework already says out loud why faces differ in trust: "a local CLI on a `0700` socket is not an anonymous tab someone left open" (`expose.ts`, header). On the consuming side the client is symmetric and transport-blind: a *link* (`websocketLink`, `unixSocketLink`, `stdioLink`, `directDispatch`) yields a `SurfaceDispatch`, `buildSurfaceFace(surface, dispatch)` turns it into `client.surface.<member>.<verb>(input)` — an `Effect` for a unary verb, a `Stream` for a read — and `mirrorRemoteSurface` folds a whole surface into plain callbacks for a live board. kolu's own docs describe a CLI/TUI consumer in exactly these terms ("How to consume a surface outside SolidJS"), and `kolu-cli` *is* one: nine hand-written verbs over the padi surface, one connection, stdout data / stderr prose, a pinned exit-code matrix. What kolu does not have is the generic adapter: surface → argv, the way `surface-mcp` is surface → MCP.

`@kolu/surface-mcp` is the model. `serveSurfaceAsMcp({ surface, client, expose, tools?, serverInfo?, instructions?, transport? })` takes a `Surface`, a surface-client factory and an `ExposeMap`, and derives everything else: procedure `ns.verb` → tool `ns_verb` (`toolName`), cell `k` → resource `surface://cells/k`, collection → key-set resource plus a `{id}` template, stream/event → resource; plus `tools: Record<string, BespokeTool>` for hand-authored, call-shaped verbs whose `handler(args, client, signal)` is an `Effect`. It owns the generic parts only — naming, the Effect-Schema→JSON-Schema bridge, transport discipline — and no domain.

## Two lenses

**Löwy — decompose by volatility, and a client does not orchestrate.** What changes, and how often, decides where a thing lives:

| what changes | how often | who owns it |
|---|---|---|
| the domain spec — olai's cells, collections, procedures | weekly | the app's `defineSurface`; the CLI is *derived* from it, no CLI code per change |
| the hand-authored verb table — olai's 28 `TOOLS` | weekly | the app, as **one record handed to both faces** |
| how to reach the server — unix socket, websocket, ssh, a token | rarely, per app | the app's composition root; the adapter is transport-blind |
| the argv grammar — schema → flags, `--json`, stdin | rarely | `surface-cli` |
| rendering, exit codes, stream and signal discipline | rarely | `surface-cli` (lifted out of `kolu-cli`'s `exit.ts` / `verbs/shared.ts`) |
| which faces one binary mounts — `web`, `surface`, `mcp` | per product | the binary, so the adapter returns **a command tree (a value)**, it does not run a program |

And the use case stays behind the surface: "capture" is *resolve the inbox convention, date it, attribute it, write one node* — that is a verb the server owns, not a macro the client composes. A thin client means `olai surface capture` is one call, the same one the phone and the agent make.

**Hickey — decomplect; data over vocabulary; one name for one thing.** The adapter is a pure function `(Surface, ExposeMap, verbs) → Command[]`, and at runtime it is argv → data → wire → data → stdout with no state of its own. The CLI verb *is* the MCP tool name, computed by the same `toolName`, so `olai surface git_commit` and the tool `git_commit` cannot drift — the drift between two faces reading one map by two grammars is exactly what `classifyExpose` was written to end. CLI-only ergonomics (a positional argument, a text renderer) are an open map *beside* the verb table, keyed by name, never fields complected into the verb; the verb record stays a value both faces can take verbatim.

## The API

**The CLI library is assumed, not abstracted.** Olai's `main.ts` and kolu's `kolu-cli` and `server` all parse argv with `effect/unstable/cli` (Effect 4's own `Command` / `Flag` / `Argument`; two residual `cleye` imports in kolu are on their way out). So `surface-cli` speaks it natively: it returns `Command.Command` values the host mounts with `Command.withSubcommands`, the endpoint flags are Effect `Flag`s, a usage error is Effect CLI's own, and handlers are Effects — which is what makes Ctrl-C reach an in-flight call for free. There is no `runSurfaceCli`: the host binary already has `Command.run`. Abstracting over parsers would be a seam nobody is on the other side of.

```ts
// @kolu/surface-cli
import type { Command, Flag } from "effect/unstable/cli"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import type { ExposeMap } from "@kolu/surface/expose"                        // the SAME grammar surface-mcp takes
import type { SurfaceVerb, ClientOrConnection } from "@kolu/surface/verbs"   // moved down from surface-mcp — below

export interface SurfaceCliOptions<S extends SurfaceSpec, F extends Record<string, Flag.Flag<any>>> {
  surface: Surface<S>
  expose: ExposeMap<S>                  // default-deny: "resource" for primitives, "tool" | {tool:{mutates}} for procedures
  verbs?: Record<string, SurfaceVerb>   // the SAME record the app hands serveSurfaceAsMcp as `tools`
  endpoint: {                           // the transport seam — app-owned, framework-blind
    flags: F                            // shared root flags, position-independent: { socket, url, host, … }
    connect: (values: Flag.Values<F>) => Promise<ClientOrConnection>   // unixSocketLink / websocketLink / ssh / direct
  }
  annotate?: Record<string, VerbAnnotation>   // CLI-only ergonomics, by verb name
  info?: { name: string; version: string }
}

export interface VerbAnnotation {
  positional?: readonly string[]          // input fields bound to argv positions: capture "title"
  render?: (output: unknown) => string    // text on a TTY; JSON is the default, `--json` forces it
}

/** The projection — pure. Returns commands the host binary mounts beside its own
 *  (`Command.withSubcommands([...surfaceCommands(opts)])`) and runs with `Command.run`. */
export function surfaceCommands<S, F>(opts: SurfaceCliOptions<S, F>): ReadonlyArray<Command.Command<any>>

export { flagsOf }   // Effect Schema → Effect CLI flag record: the argv half of the Schema→JSON-Schema bridge
export { EXIT }      // 0 ok · 1 the verb's declared error · 2 usage · 3 no server / transport · 130 SIGINT
```

What it projects, one rule per member kind, mirroring `surface-mcp`'s table:

| spec member | argv |
|---|---|
| procedure `ns.verb` exposed `"tool"` | `<verb-name> [--field …] [--json '{…}' \| -]` with `verb-name = toolName(ns, verb)`; flags derived from `input` (scalars and arrays of scalars as flags, `Record<string,string>` as repeatable `--field k=v`, anything deeper as a JSON-valued flag); a scalar input (surface-mcp's `wrapped`) becomes the positional |
| bespoke verb `name` | `<name> …` by the same rule over its `input`; `description` is the long `--help` |
| cell / collection / stream / event exposed `"resource"` | `get <member> [key] [--follow]` — first frame then exit, `--follow` = ndjson of the subscription; `keys <collection> [--follow]`; `watch <collection>` — the `deltas` stream, snapshot then deltas |
| always | `list [--json]` — the exposed table with schemas; this face's `tools/list` |

Discipline: stdout is data (JSON; ndjson for anything streamed; compact when piped, indented on a TTY), stderr is prose; a verb's declared `error` prints as JSON on stderr with exit 1; usage is 2; "nobody serving at …" is 3; Ctrl-C interrupts the in-flight Effect and exits 130. Input is decoded with the verb's own Schema *before* the round trip, so a typo is a local usage error from the same taxonomy the server would have used. A bespoke handler is `(args, client, signal) => Effect` exactly as it is today.

### What moves down into `@kolu/surface`

The real upstream change, and the Hickey point: `BespokeTool` (renamed `SurfaceVerb` — it was never MCP-specific), `toolName(ns, verb)`, and the Effect-Schema→JSON-Schema bridge (`toInputSchema`) leave `surface-mcp` for a neutral `@kolu/surface/verbs`; `surface-mcp` re-exports under the old names. Otherwise the CLI imports the MCP SDK to obtain a type, and the two faces compute names separately.

### Open points in the API

- **Flat names — ruled.** `olai surface git_commit` reads worse than `olai surface git commit`, and the flat MCP name is the verb anyway (one name, one function, zero drift between faces). Nesting is not built.
- **Runtime-built flags.** `Command.make(name, config, handler)` takes a plain record, so `flagsOf(schema)` can build one at runtime; types inside the adapter are loose, as `SurfaceClientCallable` already is in `surface-mcp`. Whether `effect/unstable/cli` ships a schema-driven flag helper is unverified; if it does, `flagsOf` shrinks.
- **Two gates, as with MCP.** The serving face's `FaceExposure` decides what the server answers; the CLI's `ExposeMap` decides what it offers. Same arrangement `surface-mcp` has with `restrictHandlers`.

## Olai's interface: `olai surface <verb>`

Every verb sits under one subcommand, `surface`, beside `web`. Bare `olai` prints the two and exits non-zero.

```
olai web <dir> [--port] [--host] [--commit|--no-commit|--push]     # unchanged — the one server
olai surface [--socket PATH | --url URL] <verb> …                  # the client
```

Endpoint resolution, in order: `--socket` / `--url` → `$OLAI_SOCKET` / `$OLAI_URL` → a worktree's `.olai-dev/url` walking up from cwd → the per-user runtime socket `getRuntimeSocketPath({ app: "olai" })` (`$XDG_RUNTIME_DIR/olai/surface.sock`, else `/tmp/olai-$UID/surface.sock`). Nothing answering is exit 3 with "no `olai web` at …" — never the directory opened by the client.

The verbs are olai's 28 `TOOLS` plus `capture`, and the `MCP` map's five resources, under the same names the agent sees:

```sh
# bespoke verbs — the same record the MCP face gets (bespokeFrom(TOOLS))
olai surface capture "look into the new cabinets" --text "the joinery place off Main" --url https://example.com/cabinets
olai surface add_node --file _olai/Inbox.olai --title "…" --note "…"
olai surface search_nodes --query 'is:todo prop:captured-by=srid'
olai surface read_node a1b2c3                # scalar input → positional (annotate: { read_node: { positional: ["id"] } })
olai surface read_subtree a1b2c3 --depth 2
olai surface set_done --id a1b2c3
olai surface set_date --id a1b2c3 --date 2026-08-25
olai surface move_node --id a1b2c3 --parent d4e5f6 --after g7h8i9
olai surface apply --json '{…}'              # the whole Edit, as data
olai surface write_document docs/x.md -       # body from stdin
olai surface commit --message "…" ; olai surface push
olai surface empty_trash

# resources — the MCP map's five, read verbs only
olai surface keys outlines
olai surface get outlines docs/roadmap/features.olai
olai surface get errors ; olai surface get git ; olai surface get pending
olai surface watch outlines                  # snapshot, then one ndjson line per delta, until Ctrl-C
olai surface get pending --follow

# introspection
olai surface list [--json]                   # the table: name, title, mutates, input schema
olai surface add_node --help                 # the MCP description is the long help
```

Output is the verb's structured result as JSON (`{"id":"a1b2c3","file":"_olai/Inbox.olai","committed":false,"why":"…"}` for a capture); a refusal is the `OpFailure` as JSON on stderr and exit 1.

The composition root:

```ts
// packages/server/src/main.ts
const surfaceVerbs = surfaceCommands({
  surface,
  expose: MCP,                              // the resources the agent face has — read verbs only
  verbs: bespokeFrom(TOOLS),                // the 28 + capture; identical to the MCP face's `tools`
  endpoint: {
    flags: { socket: Flag.string("socket").pipe(Flag.optional), url: Flag.string("url").pipe(Flag.optional) },
    connect: (values) => dialOlai(values),  // unixSocketLink by default; websocketLink for --url; ssh is surface-remote's
  },
  annotate: { capture: { positional: ["title"] }, read_node: { positional: ["id"] }, read_subtree: { positional: ["id"] } },
  info: { name: "olai", version },
})
const surfaceCmd = Command.make("surface").pipe(Command.withSubcommands(surfaceVerbs))
Command.make("olai").pipe(Command.withSubcommands([web, surfaceCmd]))
```

### The server side: one more face

`serve.ts` adds the face kolu designed for exactly this client: `serveOverUnixSocket({ socketPath, group: runtime.group, handlers: runtime.handlers, expose: AGENT_FACE, log })` — a `0700` per-user socket serving the agent face (`ops.run`, `git.*`, `ops.*`, `search.nodes` and the resources), which the browser websocket deliberately does not expose. A local CLI needs no token; the socket's mode is the gate, and the writer trailer says `cli`. Remote is then the kolu-native story: `@kolu/surface-remote`'s ssh-to-socket, where ssh is the authentication — no bearer to mint, no header to trust, which is the knot `/capture` was tied around. A websocket link through `tailscale serve` (identity header on the upgrade, as `who.get` already reads) remains possible for a tailnet device without ssh, at the cost of a second websocket face or a widened `BROWSER_FACE`; not in the first cut.

The phone share sheet is the one client that cannot run a binary, and it gets **no door** (ruled 2026-08-22). A phone captures through the web page (the Inbox's `⌘K` on the tailnet) or through an MCP client; there is no HTTP verb for it, and `/mcp`'s off-loopback bearer stays exactly as it is. The alternatives weighed and declined: `/mcp` accepting the identity header off-loopback (no widening in trust, but a ruling about the whole door for one client), and a `POST /call/<verb>` alias over `tools/call` (small, but a second HTTP grammar for the same verbs). Either can be revisited the day a phone capture is missed in practice; nothing else in this design depends on it.

### What happens to `/capture`

- `capture` becomes an entry in `TOOLS` — `write("capture", "Capture a thought", "…", CaptureRequest, …)` whose handler is `captureInto` over `ops.run`: title, optional text/url/props, no file, no id, the inbox convention, dated. `olai surface capture`, the MCP tool `capture`, and the phone's one body all fall out of that line; an agent can capture, which it cannot today.
- `captured-by` (ruled 2026-08-22): the door records the identity it *has* — the identity header on an HTTP/ws face, the socket owner (OS user) on the unix-socket face — and omits the property when it has none (the in-process MCP face). A caller who supplies `captured-by` is still refused, as today.
- `capture.ts`, its route, tests and `CAPTURE_PATH` go wholesale — no HTTP door replaces them; `docs/running.md`'s "Quick capture, over HTTP" becomes "Quick capture, from a terminal": `olai surface capture …`, a Raycast script or a cron job shelling out to it.

## PR phases

**PR 1 — kolu (`juspay/kolu`), one PR, three commits that each stand alone:**

1. *Move, no behaviour change.* `BespokeTool` → `SurfaceVerb`, `toolName`, `toInputSchema` into `packages/surface/src/verbs.ts` (export `./verbs`); `surface-mcp` re-exports the old names. Existing `surface-mcp` tests unchanged and green prove the move.
2. *New package `packages/surface-cli`.* `surfaceCommands`, `flagsOf`, `EXIT`; `effect/unstable/cli` from the pinned `effect`, no new dependency. Tests: a fixture surface (the README's `load` / `processes` / `proc.kill`) served over `serveOverUnixSocket` and driven end-to-end — golden `--help`, every flag shape `flagsOf` emits, `get`/`keys`/`watch` as ndjson, the exit matrix, Ctrl-C on a `--follow`. `kolu-cli` is *not* migrated onto it in this PR (its verbs render text and own their endpoint flags; adopting `EXIT` from the shared home is a follow-up).
3. *Docs.* `website/src/content/surface/expose-to-cli.mdx` beside "expose-to-agents", a reference page `ref-surface-cli`, and `packages/surface-cli/README.md` in the family's shape; `expose.ts`'s "which faces take one" paragraph gains the CLI as the consumer of a `FaceExposure` on the socket side and a map on the client side.

CI per the odu skill, Linux only; merge; note the SHA.

**PR 2 — olai, one PR, self-sufficient** (it is not mergeable before PR 1 lands, because it carries the pin):

1. Pin kolu to the merged SHA: `npins/sources.json`, the hydrate list in `nix/kolu.nix` / `OLAI_KOLU_DIRS` gains `surface-cli`, `just kolu-deps` green.
2. `capture` into `@olai/ops` `TOOLS` with `captureInto`; the attribution ruling above; tests move from `capture.test.ts` to `tools.test.ts`.
3. `serve.ts`: the unix-socket face with `AGENT_FACE`; socket path from `getRuntimeSocketPath`, overridable by `--socket` on `web`; the writer `cli`; the home-manager module passes nothing new (the default path is the convention).
4. `main.ts`: `olai surface` via `surfaceCommands` as above; `dialOlai` with the resolution order; `olai` bare lists `web` and `surface`.
5. Delete `capture.ts`, its route and tests, `CAPTURE_PATH`, and the `JSON_ONLY` / `crossSite` gates that existed for it. No door replaces them.
6. Docs: `running.md` ("Quick capture, over HTTP" becomes "Quick capture, from a terminal"; the "no write CLI" sentence becomes "no second writer — `olai surface` is a client"), `architecture.md:2` (faces of one surface — a tab, an agent, a terminal — not three write surfaces), `editing.md:390`, `format.md:150`'s inbox paragraph, `main.ts`'s header, `brainstorming/acp.md:45`'s "still no write CLI" gets a dated note pointing here; `HACKING.md`'s consistency rule unchanged in substance.
7. e2e: a Cucumber feature that starts the nix-built binary, captures through `olai surface capture`, reads it back with `olai surface get outlines _olai/Inbox.olai`, and sees it in the Inbox page.

`olai mcp` — `serveSurfaceAsMcp` over stdio with the same `connect`, `kolu mcp`'s pattern — is **not built** (ruled 2026-08-22). `/mcp` over HTTP, loopback tokenless and bearer off it, remains the one agent door; `.mcp.json` is untouched by this work.

## Rulings (human, 2026-08-22)

- **CLI library:** `effect/unstable/cli` is assumed by `surface-cli`, not abstracted; the adapter returns `Command` values.
- **Phone door:** none. `/capture` is deleted without an HTTP replacement; a phone captures through the web page or an MCP client.
- **`captured-by`:** the identity the door has (header on HTTP/ws, socket owner on the unix socket), omitted when it has none; caller-supplied still refused.
- **Verb names:** flat — the MCP tool name via the shared `toolName`; no nested spelling.
- **`olai mcp`:** not built.
- **PR shape:** one kolu PR (move + package + docs), then one self-sufficient olai PR carrying the pin.
