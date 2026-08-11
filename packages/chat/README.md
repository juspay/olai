# @olai/chat — one conversation with one agent

Talking to a coding agent over ACP: starting the subprocess, holding the
session, turning what it says into rows a panel can draw, and answering the five
verbs a person has (send, cancel, new conversation, load one, list them).

It sits BESIDE `@olai/ops` rather than above or below it. A conversation and an
edit are two things a person does to the same directory and neither is built out
of the other — which is why this package does not depend on `ops` at all. The
agent reaches the ops layer the same way any MCP client would: through a URL and
a bearer token it is handed at `session/new`. That is not fastidiousness about
imports. It is the whole reason a whole-file write is not something an agent can
express here: there is no function to call, only tools that take a node id.

## One session, and why that is a decision

olai is a single-user app, so there is ONE session — not one per tab, not one
per outline. Every browser watching sees the same transcript, which is why
nothing here is per-connection and a second tab needs no catch-up protocol: it
subscribes to the same collection and gets the conversation in its first frame.

The session is the agent's, not ours. Boot asks `session/list` for the served
directory and ADOPTS the most recently updated conversation, replaying it — so
the panel comes up where you left it, and `claude --resume` in a terminal
reaches the same conversations. Nothing is persisted on this side, because a
second copy of the transcript would be a second thing to be wrong.

## The modules, and their separate reasons to change

| file | what it owns |
|---|---|
| `adapter.ts` | which executable speaks ACP: the pinned adapter by default, `OLAI_ACP_AGENT` to override, empty to turn chat off |
| `agent.ts` | the ACP client: one subprocess, one protocol. Nothing else in olai spells `session/prompt` |
| `kolu.ts` | whether this host is running kolu, and the stdio server to hand a session if it is |
| `pipes.ts` | a subprocess's pipes as a stream of JSON-RPC messages — the one thing the two subprocesses above have in common |
| `events.ts` | the closed vocabulary of what an agent tells us — a consumer that needs more needs a new member, not a look at the wire |
| `transcript.ts` | the conversation as ROWS: chunks accumulate, tool calls update in place by id, a replay replaces rather than appends |
| `chat.ts` | the join, and the only place that knows both halves |

A tool call is not instantaneous, so a frame is not just a status that flips.
`tool_call_update` carries incremental `content` and follow-along `locations`,
and both reach the row while it runs — the transcript keys frames by the agent's
own call id, so a report is an upsert on the same key rather than a second row.
Content REPLACES rather than accumulates, which is the protocol's own rule for
an update: a report carries the call's content as it stands, so appending would
print the first half of a long output twice.

`events.ts` is the seam that makes the rest of this hold. Nothing above it
spells `session/update`, reads a `ContentBlock`, or knows which `configOptions`
entry the model is. A consumer wanting something not in that union needs a new
member — which is what keeps the ACP version in one file and the conversation in
another.

`chat.ts` BUILDS the agent rather than being handed one, so `session/update`
stays a phrase this package is the last to say: a caller passes the adapter it
resolved and the directory to run it in, never a protocol object. The seam for a
scripted agent is one level further out and more honest for it —
`OLAI_ACP_AGENT` pointed at a script, which is how the e2e suite drives every
turn it asserts on, and which exercises the subprocess and the wire that an
injected object would replace with an assumption.

## Kolu's terminals, when the host has them

A session is handed olai's own tool server, and a second one when this host is
running [kolu](https://kolu.dev): `kolu mcp` over stdio, so the agent you are
talking to about your outlines can also see the terminals your coding agents are
running in. It is automatic and has no knob — the cost of being wrong is one MCP
server an agent never uses — and the caller is not asked, because the answer can
change between one conversation and the next.

Which is the first of three decisions in `kolu.ts` worth knowing:

**Per conversation, not per boot.** A padi started after olai is picked up by
the next conversation rather than the next restart. It costs one process start
on a path that already spawns a subprocess and handshakes with it.

**The probe IS the detection.** A `kolu` on PATH is not necessarily the host's
kolu: a padi-spawned terminal prepends its own bundled copy, and one of those
was an older build reporting the same version string while missing most of the
verbs ([juspay/kolu#2146](https://github.com/juspay/kolu/issues/2146), fixed by
#2147 — but the wrong build still SPAWNS, so the lesson outlives the fix). So
nothing here trusts a path, a version or an exit code: the executable is
started, handshaken with, and asked to read a resource only a live daemon can
answer. One answer is evidence of both halves — this binary speaks the protocol,
AND a padi is behind it — and the absolute path that answered is what the
session is given, so the agent cannot resolve the bare word against a different
PATH and spawn something else. Anything short of an answer is a `null`,
silently: a host without kolu is the ordinary case, not a fault.

The probe is a JSON-RPC conversation on a subprocess's pipes, which is what the
ACP session is too — so the framing lives in `pipes.ts` and neither of them owns
it. What that file encapsulates is one axis: how a Node child's pipes become Web
streams under Bun's node compatibility. `kolu.ts` writes three messages and
reads until one of them is answered; it does not know what a newline is.

**What is detected is the DAEMON, not kolu's web server**, which may be running
on another machine reaching this host as a remote. `PADI_SOCKET` is forwarded
when olai was launched inside a kolu terminal, and kolu resolves its own default
when it was not — socket discovery is not reimplemented here, and a host running
two padis says so and is left alone rather than guessed about.

## What the caller does

Four exports. Resolve the adapter, build, wire the two publishers, register
`stop` as a finalizer, `start`:

```ts
const adapter = adapterFrom(process.env[AGENT_ENV])
if (adapter === null) yield* Effect.logInfo(whyNoAgent(process.env[AGENT_ENV]))
const chat = adapter === null ? null : yield* make({
  adapter,
  cwd: servedDirectory,
  tools: () => mcpServerOnceTheListenerHasBound,
  onState,
  onTranscript,
})
```

`tools` is a thunk because the MCP server's address is not knowable until the
listener has bound, and the session is opened after that.

A `null` adapter is not an error. Serving a directory has never depended on an
agent being installed; the panel says so and the outlines are unaffected.

There is no `log` in that list any more, and that is the point: this package
logs the way every other one does ([`@olai/log`](../log/README.md)), so nothing
has to be handed a place to write. What it says lands at three levels. The
agent's own stderr is relayed at `debug` — it is somebody else's program's log
and by volume the loudest thing olai ever emits, so it is off until
`--log-level debug` asks for it. Trouble the panel is already drawing (a session
that would not open, a boot the next prompt will retry) is a `warn`, because
nothing has stopped. Every line carries `agent=<command>`, which is what the
`acp: ` prefix used to be, except now it is a field. There is no fiber inside an
ACP notification handler or a subprocess `data` event, which is why the emitter
is taken once at `make` rather than a line at a time.

The same package owns how a FAILURE is rendered into the sentences this one
hands a person — `AgentGone.why`, a `trouble` notice. All of them go through
`reasonOf`, including the one that reads a fiber's `Cause`: `Effect.onError`
hands the cause rather than the failure, and `String` on one of those is
`Cause([Fail(…)])` with the reason buried inside it. There used to be three
spellings of that in this file, one of them wrong.

## Two decisions worth naming

**A turn is accepted, not awaited.** `send` answers the moment the prompt is on
the wire; what happens next arrives on the transcript, so every open tab stays
in step and a five-minute turn is not a five-minute call.

**A message sent mid-turn QUEUES.** It used to be refused, and the panel turned
its input off while it was refusing — so a person watching an agent work, who
had the next thing ready long before it finished, had to hold it in their head
and come back for it. Everything sent is accepted in the order it was typed and
the turns run one after another, drained by the running turn's own fiber, which
is what makes "one turn at a time" true without anything polling for it. What is
queued is dropped — out loud, as a notice — when the thing it was queued behind
stops meaning what it meant: a cancel, an agent that died, a conversation being
left.

A queued message is a ROW the moment it is sent. It is what was said, in the
order it will be asked; the count on the state adds only that the agent has not
reached it yet, which is a fact about the agent rather than about the message.

**The refusals the ops layer produces are ours to render.** The agent gets the
structured detail in its tool result, but what it then says about it is prose.
So the MCP layer tells us about every refusal and it lands in the transcript as
DATA — which is what makes "a refused write shows its unfinished children in
chat" true regardless of how the agent phrases it.
