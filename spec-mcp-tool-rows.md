# Spec: olai's own tool calls in the chat transcript

One PR. Nothing in here is deferred. Read `CLAUDE.md` first: Cordis adherence, docs in the same PR, full e2e coverage, `just ci` for verification.

## The problem

When an agent calls one of olai's MCP tools, the chat panel draws this:

```
✓ mcp__olai__outlines_subtree                 ▸
✓ mcp__olai__outlines_add                     ▸
✓ mcp__olai__outlines_update                  ▸
✓ mcp__olai__outlines_update                  ▸
Done. Created in Finance.olai:
```

Four things are wrong, and one of them is a bug in shipped code:

1. **The label is the engine's raw spelling.** Every ACP adapter falls into a default case for tools it does not know and uses the tool name as the title. olai advertises a human title for every tool (`Add a node`, `Write several fields of one node`, in `packages/plugins/outlines/src/tools.ts:101-244` and the other rows' `tools.ts`), but ACP carries no tool catalogue to the client, so the panel never sees it.
2. **No row says which outline it touched.** The file is in the reply, but only inside the fold as JSON.
3. **The story line under a write never appears. This is a bug.** `packages/plugins/chat/src/wrote.ts:65-90` (`wroteIn`) looks for `rawOutput.structuredContent.did` or `rawOutput.did`. No shipped adapter puts the reply there. Only the e2e fake (`packages/tests/agent/fake-acp-agent.ts:986-1013`, `rawOutput: result`) does, so the suite is green while every real engine draws nothing.
4. **The fold prints the reply twice**: once as the adapter's text block (`progressOf(update.content)` → `progress`) and once as `JSON.stringify(rawOutput)` inside `detail` (`packages/plugins/chat/src/agent.ts:2569-2606`).

### What each engine actually sends for an olai tool call

Verified against the pinned adapters (Claude: `@agentclientprotocol/claude-agent-acp` in the nix store, `dist/tools.js:333-339` and `dist/acp-agent.js:5924-5937`; Codex: `@agentclientprotocol/codex-acp` 1.10.0 `dist/index.js:22905-23028, 24691-24700`; OpenCode: the 1.18.x binary's embedded bundle; Pi: olai's own bridge `packages/plugins/pi/acp/mcp-bridge/wire.mjs:30-33`).

| Engine | `tool_call.title` | `kind` | where olai's reply is in `tool_call_update` | `update.content` |
|---|---|---|---|---|
| Claude Code | `mcp__olai__outlines_add` | `other` | `rawOutput` = the MCP `content` array: `[{type:"text", text:"<pretty JSON of reply>"}]`. `structuredContent` is dropped. `_meta.claudeCode.toolName` carries the raw name. | one text block with the same JSON |
| Codex | `mcp.olai.outlines_add` | `execute` | `rawOutput = { result: <CallToolResult>, error }`, so `rawOutput.result.structuredContent`. `rawInput = { server, tool, arguments }`, `_meta.is_mcp_tool_call: true`. | none |
| OpenCode | `olai_outlines_add` | `other` | `rawOutput = { output: "<JSON string of CallToolResult>", metadata: <CallToolResult> }`, so `rawOutput.metadata.structuredContent`. | one text block = `output` |
| Pi | `olai: outlines_add` (bridge label) | `other` | `rawOutput = { content: [{type:"text", text}] }`. olai's own bridge discards `structuredContent` before pi ever sees it. | one text block |
| e2e fake (today) | `outlines_add` | none | `rawOutput = <CallToolResult>` with `structuredContent` at top level | none |

The reply olai's server produces is the same on every engine: `content` (one text block of pretty JSON) plus `structuredContent`, both from one serialization (`@kolu/surface-mcp` `ok()`), with olai's envelope fields `did` on writes, `root`, and on reads `vintage` (`packages/plugins/mcp/src/tools.ts:145-155, 304-307, 468-480`). A write reply is `@olai/format`'s `WriteResult` (`packages/format/src/writing.ts:1419-1478`): `id`, `title`, `file`, `summary`, `nudge?`, `sort?`, `captured?`, `rev`, `why`. A read reply carries `file` at top level on every arm except a `fields`-projected node walk (`packages/format/src/reading.ts`: `Subtree`, `Detail`, `OutlineRoots`, `ProjectedRoots` have it; `ProjectedSubtree` does not). Leave the envelope alone; this PR does not touch `answer()`.

## The target

```
✓ Read a subtree                      Finance.olai  ▸
✓ Add a node                          Finance.olai  ▸
  + Q3 budget review                         created
✓ Write several fields of one node    Finance.olai  ▸
  ◷ Q3 budget review                       scheduled
✓ Write several fields of one node    Finance.olai  ▸
  ✓ Q3 budget review                     marked done
Done. Created in Finance.olai:
```

Decisions already made with the user. Do not reopen them.

- **Row line = tool title + file.** Reads get title + file and no story line.
- **Title source = a service the MCP row provides.** Chat consumes it optionally. Absent service means the raw name stays.
- **Fold = input JSON once, reply JSON once**, for a recognised olai call. Other tools' folds are unchanged.
- **The raw name stays reachable**: as the hover `title` of the row's text and as a line at the head of the fold.
- **The e2e fakes send one shape per engine**, and the scenarios prove the label, the file, the story line, the clickable node and the single-copy fold under all four.
- **The story line's node is clickable.**

## Who owns what

The codebase's rule for chat is already set by the kolu and odu doorbell rows: **chat owns the frame, the row plugin owns the contents, and the handoff is a slot chat declares.** See `packages/plugins/chat/src/slots.ts:10` (`delivery.mark`), `packages/plugins/chat/src/browser/marks.ts` (lookup by plugin name; its doc comment says why a lookup and not a table), `packages/plugins/kolu/src/browser.tsx:99` (kolu registering its own mark). `@olai/bundle`'s `fence.test.ts` holds that no general package spells a plugin's name in code.

Four owners, nothing else:

| Concern | Owner | Why |
|---|---|---|
| How an engine spells an MCP call and wraps a tool result | each engine plugin's `Leg` (`packages/plugins/{claude,codex,opencode,pi}/src/leg.ts`) | the leg already owns every other fact about its wire |
| Which tools olai serves, their titles, and which row owns each | the MCP row (`packages/plugins/mcp`) | the composed name is MCP's spelling; the set is what MCP serves |
| What an outlines reply means and how its story is drawn | the outlines plugin (`packages/plugins/outlines`) | `WriteResult`, `sort`, `SAID`, `GLYPH` are outline facts |
| The row: frame, title, file span, fold, chevron, and the slot the story hangs in | chat | the frame is generic |

Chat must not import anything from outlines after this PR (today: `olai-plugin-outlines/changes` at `Wrote.tsx:25`). Chat must not know any engine's output shape. Chat must not name the MCP key in `needs`.

## Part 1. The MCP row: a catalogue service

Read `docs/architecture/cordis.md:99-116` and `docs/architecture/plugin-system.md:1139`. Chat must keep working when the MCP row is off, and MCP when chat is off. Copy the ticket mint exactly: MCP owns a key (`packages/plugins/mcp/src/contract.ts`, `Offers.own("ticket-mint", …)` at `server.ts:57`), the composition root reads it optionally (`packages/bundle/src/inputs.ts:13-15`, `offered(host, ticketMint)?.mint(...) ?? null`), core's `Tools` service carries it with a stated absence (`packages/plugin-api/src/services.ts:1175-1206, 1630-1637`), chat already has `Tools` in `needs`.

1. **`packages/plugins/mcp/src/contract.ts`**:
   ```ts
   /** One tool this row serves, as the panel may name it. `owner` is the plugin
    *  whose table the tool came from; it is the name a slot face is hung by. */
   export interface Advertised { readonly title: string; readonly owner: string }
   export interface Catalogue {
     /** Null when `server` is not this row's server, or `tool` is not served. */
     readonly advertised: (server: string, tool: string) => Advertised | null
   }
   export const catalogue = serviceTag<Catalogue>("mcp.catalogue")
   ```
   `server` is compared to the name this row serves under (`endpoint.ts:125`, `"olai"`). `tool` is the advertised name `<row>_<verb>` as `scopedToolName` composes it (`packages/plugins/mcp/src/tools.ts:144, 245`). `owner` is the first argument to `scopedToolName`, the sibling's plugin name. Carry only what is drawn.
2. **`packages/plugins/mcp/src/server.ts`**: `Offers.own("catalogue", () => ({ advertised }))` beside the ticket mint. **No cache and no roster subscription.** `advertised` walks `rows()` (`endpoint.ts:24`, live off `TransportSurface.agentRows()`) on every call, exactly as `bundle()` does. A lookup holds no generation, so it has nothing to invalidate; `Served.directory()` and `ticketsFor` are the same shape.
3. **`packages/bundle/src/inputs.ts`**: `advertisedFor(host)` beside `ticketsFor`, resolving `offered(host, catalogue)?.advertised(server, tool) ?? null` per call.
4. **`packages/plugin-api/src/services.ts` `Tools`**: add `advertised: (server: string, tool: string) => Advertised | null`, provisioned from `config.advertisedFor?.(server, tool) ?? null`. Document that `null` means no catalogue is serving, or not ours. This is a deliberate choice to widen `Tools` rather than add a second optional carrier; note it in the member's doc comment.

## Part 2. Engine plugins: spelling, and where the reply is

### The spelling, declared once

`allowingOurs` (`packages/acp/src/leg.ts:156-167`) already takes each engine's spelling as a function `(server) => prefix`. Today claude passes `` `mcp__${server}__` `` (`claude/src/leg.ts:94`) and opencode `` `${server}_` `` (`opencode/src/leg.ts:111`) inline. Lift it to a declared member so it is written once per leg:

```ts
/** How this adapter spells a tool an MCP server contributes, as the prefix
 *  before the tool's own name. Null when the wire carries no such spelling. */
readonly spelling: ((server: string) => string) | null
```

`allowedWithoutAsking` becomes `allowingOurs(spelling)` where it is that today. Pi declares `` `${server}_` `` (that is what its bridge mints, `mcp-bridge/naming.js:33`) but keeps `allowedWithoutAsking: () => null`, with the comment at `pi/src/leg.ts:150-155` updated to say the spelling exists for display and approval still belongs to pi's own settings. Codex declares `null`.

### Two display-only members

```ts
/** DISPLAY ONLY. Which of `servers` this call went to and the tool's advertised
 *  name there, read off a tool_call frame. Null for anything else.
 *  `allowedWithoutAsking` remains the one approval rule. */
readonly mcpCall: (frame: MCPFrame, servers: ReadonlyArray<string>) => { server: string; tool: string } | null

/** The MCP result's `structuredContent`, wherever this adapter put it in
 *  `rawOutput`, as an untyped record. Undefined when there is none. */
readonly replyIn: (rawOutput: unknown) => Record<string, unknown> | undefined
```

`MCPFrame` carries `title`, `rawInput`, `_meta`, and the programmatic name the leg already extracts (`toolNameIn(meta) ?? toolNameOf(id)`). `servers` is the list `agent.ts` already holds for `allowedWithoutAsking`.

Add `mcpCallBy(spelling)` beside `allowingOurs` in `packages/acp/src/leg.ts`: for each server, if the programmatic name (else the title) starts with `spelling(server)`, answer `{ server, tool: rest }`. Claude, opencode and pi use it. Only codex hand-writes `mcpCall`: `_meta.is_mcp_tool_call === true`, string `rawInput.server` and `rawInput.tool`, server in `servers`. Do not parse the dotted title. The codex header's "titles are not an approval boundary" stays true; add one sentence that display reads `rawInput`.

`replyIn` per engine, straight from the table:

- **claude**: `rawOutput` is an array; first `{type:"text"}` block; `JSON.parse` its text; return it if it is a record. Parse failure → `undefined` (a refusal is prose).
- **codex**: `rawOutput.result.structuredContent` when a record.
- **opencode**: `rawOutput.metadata.structuredContent` when a record; else `JSON.parse(rawOutput.output).structuredContent` when `output` is a string.
- **pi**: `rawOutput.details` when a record (Part 5), else `rawOutput.structuredContent`.

### One fixture per engine, shared with the fakes

Each engine plugin exports its wrapping from a test-facing module (`olai-plugin-<engine>/testlib`, following `packages/plugins/chat/src/testlib.ts`):

```ts
/** What this engine's adapter hands olai for an MCP call: the announcement
 *  frame, and the completion's rawOutput for a given CallToolResult. */
export const announced = (server: string, tool: string, args: unknown): Partial<ToolCall>
export const wrapped   = (result: CallToolResult): { rawOutput: unknown; content?: ToolCallContent[] }
```

`leg.test.ts` asserts `replyIn(wrapped(x).rawOutput)` returns `x.structuredContent` and `mcpCall(announced(...), ["olai"])` returns `{server:"olai", tool}`, plus the near-misses: a server not in `servers` → `null`, a non-MCP frame → `null`, a refusal and a foreign tool's output → `undefined`. The fakes in Part 6 emit `announced(...)` and `wrapped(...)`, so the fixture and the fake cannot drift. The codex test at `leg.test.ts:37-42` pinning `allowedWithoutAsking → null` for a dotted name must keep passing. If `packages/acp` has a shared leg conformance test, add the three members to it.

## Part 3. Chat: the frame

### `agent.ts`, the `tool_call` / `tool_call_update` arm (`:800-868`)

```ts
const call  = options.leg.mcpCall(frame, servers)                          // {server, tool} | null
const ours  = call === null ? null : options.advertised?.(call.server, call.tool) ?? null
const reply = ours === null ? undefined : options.leg.replyIn(update.rawOutput)
emit({
  _tag: "tool",
  id,
  title:  ours?.title ?? update.title ?? undefined,
  called: update.title ?? undefined,          // always the engine's own spelling
  row:    ours?.owner,
  reply,
  status: …unchanged…,
  detail: ours === null ? detailOf(update.rawInput, update.rawOutput) : detailOf(update.rawInput, undefined),
  progress: progressOf(update.content),       // faithful; the frame decides what to draw
  diffs, locations, parent, spawned, armed: …unchanged…
})
```

- `ours !== null` is the whole of "this call is one of olai's". The catalogue is keyed on server and tool, so a second handed server (kolu, odu) with a colliding tool name is not ours. Nothing in the reply decides this.
- `replyIn` is only asked for our calls, so claude's `JSON.parse` never runs on a foreign tool's text.
- `options.advertised` is threaded like `probes`: `Options` (`agent.ts:222-298`) gains `readonly advertised?: (server: string, tool: string) => Advertised | null`; `chat.ts:913-925` (`spawn`) passes it; `server.ts` sources it from `tools.advertised`. Omitted is absent.
- The friendly title is known on the `tool_call` frame, so it is the first title the transcript sees and is fixed as the row's text (`transcript.ts:973-979`).
- For our calls `detail` carries the **input only**. The raw name and the reply are on the wire as `called` and `reply`; the frame composes the fold from them. No value rides the wire twice.
- `wroteIn` and `wrote.ts` are deleted from chat. Their logic moves to outlines (Part 4).

### Wire, `packages/plugins/chat/src/wire/members.ts` `ToolEntry`

- Remove `wrote` and the `Wrote` schema.
- Add `called: optionalKey(String)`, `row: optionalKey(String)`, `reply: optionalKey(Json)` where `Json` is whatever the wire already uses for opaque values (add one if there is none; `Schema.Unknown` is not acceptable on a wire that proves byte-identical encoding).
- Update the encoding proof and completeness check in `members.test.ts`.

### Transcript, `transcript.ts` tool reducer

- `called` is fixed with `text` (first-frame rule, `#named`); it is a name, and a name must not move under a reader.
- `row` and `reply` are **newest-wins**, on the same line as `detail`. They are only meaningful together; the reply lands on the update frame, and a `row` pinned absent by an unlabelled announcement would strand it.

### Slot, `packages/plugins/chat/src/slots.ts`

```ts
"tool.reply": SlotDefinition<ToolReplyFace, "plugin">
```

```ts
/** What a row plugin may draw under a call to one of its own tools. Hung by
 *  the plugin's name; the panel looks it up by `ToolEntry.row`. */
export interface ToolReplyFace {
  /** The outline the call was about, root-relative, or null. Drawn by the
   *  panel in the row's own file span. */
  readonly fileOf: (reply: Json) => string | null
  /** The story under the row, or null. `show` points at a node the way the
   *  panel's own references do. */
  readonly story: (props: { reply: Json; show: (id: string) => void }) => JSX.Element | null
}
```

Register it as a child contract of `app.panel` next to `delivery.mark` (`packages/plugins/chat/src/browser.tsx:137`). Add `faceOf(row)` beside `markOf` in `packages/plugins/chat/src/browser/marks.ts`, same lookup, same `undefined` semantics.

### Rendering, `packages/plugins/chat/src/browser/chat/ToolFrame.tsx`

- One `createMemo` per row over `faceOf(entry.row)` applied to `entry.reply`, yielding `{ file, story }`. Both the file span and the story read the memo. The reply changes once, when it lands; do not decode it per render.
- Text span (`:222`): `title={entry.called}` only when `entry.called !== entry.text`.
- **A new file span** with its own testid (`chatToolFile`), drawn after the locations span, showing `file` from the memo. Do not reuse the locations span: it already carries three hand-argued disjoint things and its own path normalisation, and this is a fourth fact with a different spelling rule.
- Under the row, where `<Wrote>` was (`:364-371`): `story` from the memo, with `show` from `useShowNode()`. Nothing registered or `null` back draws nothing.
- The fold, when `entry.row` is present: a `called` line with its own testid (`chatToolCalled`) above the detail `<pre>`; then `detail` (the input); then `reply` pretty-printed in its own `<pre>` (`chatToolReply`). `progress` is not drawn when `reply` is present; that decision lives here, beside the one the frame already makes for ended background tasks (`:372-378`). For rows without `row`, the fold is unchanged.
- Delete `Wrote.tsx`. Keep `Reference.tsx` for message chips.
- `body()` gains `entry.reply !== undefined`.

Chat's `testids.ts` loses `chatWrote` and `chatNudge`, gains `chatToolFile`, `chatToolCalled`, `chatToolReply`. `chatNodeRef` stays for `Reference`.

## Part 4. The outlines plugin: its reply, its story

New browser-side file `packages/plugins/outlines/src/browser/replyFace.tsx`, registered in the outlines plugin's browser half:

```ts
yield* slots.register("tool.reply", { fileOf, story })
```

- `fileOf(reply)`: `reply.file` when a non-empty string, else `null`. Covers `WriteResult` and every read arm with a top-level `file`.
- `story({ reply, show })`: decode `reply` with `WriteResult` from `@olai/format`. A reply that does not decode as a write (a read, a projected walk) draws nothing. A write draws one line: `GLYPH[sort]`, the node title through `renderTitle` (`@olai/markdown-ui`), `SAID[sort]` right-aligned, the nudge underneath when present. `sort` absent draws `·` and `nothing changed`, as today. The title is a `<button data-node-ref={id}>` calling `show(id)` when `id` is non-empty, plain text otherwise. No file line under the story; the row's file span carries it.
- Move `wrote.ts`'s five-field projection and `wrote.test.ts` here as the face's own unit tests (same `bun:test` style). Keep the near-misses (unknown `sort`, a foreign reply, a write that moved no record).
- `SAID` and `GLYPH` stay in `packages/plugins/outlines/src/contracts/changes.ts`; this face is now their only transcript reader.
- Test ids in the outlines plugin's own `testids.ts`: `outlinesStory` (with `data-sort`), `outlinesNudge`, `outlinesStoryRef` (with `data-node-ref`). Update `chat_steps.ts:1602, :1670` and `node_context_steps.ts:86-108`.

Outlines must not import from chat. Everything the face needs arrives in its props.

## Part 5. The Pi bridge

`packages/plugins/pi/acp/mcp-bridge/wire.mjs:30-33` must forward the structured reply:

```js
return {
  content: [{ type: "text", text: answerText(answer) }],
  ...(answer?.structuredContent === undefined ? {} : { details: answer.structuredContent }),
}
```

`details` is the field pi's `registerTool` result type reserves for a tool's structured half, and pi-acp forwards the result object as `rawOutput` (`pi-acp` `dist/index.js:1163-1170`). Verify the field name against the pinned pi's tool-result type before relying on it (the pin is under `acp/node_modules`, see `packages/plugins/pi/acp/patches/README.md`). If pi passes unknown keys through, also set `structuredContent`; the pi leg's `replyIn` accepts either.

- `roundtrip.test.js`: assert the returned object carries the server's `structuredContent` under the verified key; the error case asserts it is absent.
- Bundled by `nix/acp-agent.nix:206-219`; no patch changes. Run `bun test packages/plugins/pi/acp/mcp-bridge`.
- `packages/plugins/pi/src/leg.ts:18-22` says olai's servers never reach pi. False since the bridge shipped; contradicts `:211-219`. Rewrite: the servers reach pi through the bridge; `allowedWithoutAsking` is still `null` because pi's own settings answer approval (`docs/plugins/pi.md:25`).

## Part 6. The fakes

Every fake emits its engine's `announced(...)` and `wrapped(...)` from Part 2, never a hand-written shape.

### `packages/tests/agent/fake-acp-agent.ts`

`useTool` (`:986-1013`) sends `title: name` and `rawOutput: result`. It is both the claude and the codex fake (`OLAI_FAKE_CODEX`, `:378`). Under the default it emits claude's `announced`/`wrapped`; under `OLAI_FAKE_CODEX=yes` codex's. `plan`/`permit` at `:1875-1884` already spell `mcp__olai__outlines_done`; leave them. `useExternal` (`:934-969`) is a foreign server and must keep drawing nothing.

### `packages/tests/agent/opencode/opencode`

`done <id>` (`:46`) calls `olai_outlines_done`. Emit opencode's `announced`/`wrapped`. First-frame title stays `olai_outlines_done`.

### `packages/tests/agent/pi/pi-acp`

`mcp read title <node>` (`:188-211`). Make it call the real `/mcp` route like the others and emit pi's `announced`/`wrapped`. Add `mcp done <id>` for `olai_outlines_done`.

If a fake is not importable TypeScript today, make it so; do not copy the shape by hand.

### Scenarios

Use existing steps where they exist (`chat_steps.ts:1204` "the chat shows a tool call named", `:1685` detail folded away; the story and node-press steps after their selector update). Add: "the tool call says which outline it touched" (`chatToolFile`), "the tool call is called {string} underneath" (`chatToolCalled` in the fold, and the hover title), "the tool call's reply is shown once" (one `chatToolReply`, no `chatToolProgress`), "the chat shows no story under the call".

For **each of the four engines** (default claude fake in `the_agent.feature`; `@codex` in `codex_steering.feature`; `@opencode` and `@pi` in `choosing_an_agent.feature`):

1. A write (`done <id>` / `mcp done <id>`): named `Mark done`; says which outline it touched; the story says `marked done`; pressing the node in the story shows the row; called `mcp__olai__outlines_done` (or the engine's spelling) underneath; unfolded, the reply is shown once.
2. A read (`context` / `mcp read title`): named `Read a node`; says which outline it touched; no story under the call.

Engine-independent, in `the_agent.feature`:

3. A refused write (`:50`): the row reads `Mark done`, the refusal row shows, no story.
4. An external server's call (`an_external_agent.feature`): adapter's title kept, no file span, no story.
5. The existing story scenarios (`the_agent.feature:33, :362`) must pass against the new claude-shaped fake. Confirm once that they fail with the claude leg's `replyIn` stubbed to `undefined`; that is the proof the old fixture was lying.
6. `@rows-off:mcp` (`plugin_flags.feature`) with a tool call: raw title, no story, nothing thrown. If no agent can call a tool with MCP off, replace with a unit test on `agent.ts` with `advertised` omitted.

Record it in `docs/architecture/e2e-coverage.md` under `## Olai tool rows (#<issue>)` in the file's convention.

## Part 7. Docs, same PR

- `docs/chat.md:271-285`: the row for one of olai's own tools is named by the tool's title, with the outline beside it; the engine's spelling is the hover and a line at the head of the fold; what is drawn under it is the owning row's story, hung in the `tool.reply` slot the way `delivery.mark` hangs a doorbell's mark. Adjust the "announced with" sentence at `:275`.
- `docs/plugins/mcp.md`: the `mcp.catalogue` service.
- `docs/plugins/outlines.md`: the story face it hangs in chat.
- `docs/plugins/claude.md:22`, `codex.md:24`, `opencode.md:23`, `pi.md:24`: one sentence each on the declared spelling, where the reply lands in `rawOutput`, and that the leg reads it for display only.
- `packages/plugins/chat/README.md:27-35`: two rows added to the engine table, "where olai's reply lands" and "how olai's own call is named for display".
- Wherever `delivery.mark` is used as the example of a chat slot in `docs/architecture/`, mention `tool.reply` beside it.
- `packages/plugins/pi/src/leg.ts:18-22`: as in Part 5.
- `website/`: do not touch.

## Verification, in order

```
bun test packages/plugins/chat packages/plugins/outlines packages/plugins/mcp packages/acp packages/plugins/claude packages/plugins/codex packages/plugins/opencode packages/plugins/pi packages/bundle
bun test packages/plugins/pi/acp/mcp-bridge
just typecheck-fast-remote
just test-fast-remote
just e2e-fast-remote
```

Then commit, push, `just ci`. Commit early and often; CI is faster than local.

## Out of scope

- ACP's `kind` field, which the panel does not read.
- Summaries for large read replies.
- Changing which fields `outlines_add` accepts, or nudging the model away from add-then-update.
- Story faces for rows other than outlines. The slot is there; markdown, files, trash and the rest may hang one later.

## Review record

This spec was reviewed twice, separately, in the manner of kolu.dev/blog/hickey-lowy: once for braided concepts, once for volatility on the wrong clock. Both reviewers fired on the same three spots, and those are settled above:

- `did` stamped on every reply as chat's "is this ours" bit: dropped. The catalogue keyed on server and tool answers that before any payload is read.
- `row` fixed at the first frame while `reply` was newest-wins: both newest-wins now.
- The raw name and the reply written into `detail` as well as onto the wire: `detail` is the input only; the frame composes the rest.

Single-lens findings taken: the spelling declared once per leg and `mcpCall` derived from it; the catalogue with no cache and no roster bell; `called` always the engine's title; `progress` sent faithfully and hidden by the frame; the file in its own span; the face decoded once per reply; one fixture per engine shared by leg tests and fakes.

Declined: splitting `ToolReplyFace` into two slots (grows code for no diverging clock); a second optional carrier instead of `Tools.advertised` (grows code; the choice is noted on the member).
