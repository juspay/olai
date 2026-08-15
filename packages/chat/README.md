# @olai/chat — one conversation with one agent

Talking to a coding agent over ACP: starting the subprocess, holding the session, turning what it says into rows a panel can draw, answering the six verbs a person has (send, cancel, new conversation, load one, list them, attach a file to what they are about to send) — and the two that answer a question the agent asked back.

It sits BESIDE `@olai/ops` rather than above or below it. A conversation and an edit are two things a person does to the same directory and neither is built out of the other — which is why this package does not depend on `ops` at all. The agent reaches the ops layer the same way any MCP client would: through a URL and a bearer token it is handed at `session/new`. That is not fastidiousness about imports. It is the whole reason a whole-file write is not something an agent can express here: there is no function to call, only tools that take a node id.

## One session, and why that is a decision

olai is a single-user app, so there is ONE session — not one per tab, not one per outline. Every browser watching sees the same transcript, which is why nothing here is per-connection and a second tab needs no catch-up protocol: it subscribes to the same collection and gets the conversation in its first frame.

The session is the agent's, not ours. Boot asks `session/list` for the served directory, and `claude --resume` in a terminal reaches the same conversations. WHICH of them the panel comes up in is olai's own note rather than a guess: the id is written down when the panel enters a conversation (`memory.ts`) and read back at the next boot, so a restart replays the one you were in. Boot used to adopt the most recently updated conversation instead, which answers "what moved last" and was standing in for "which one is mine" — so a terminal `claude` in the same directory, a `/clear` sibling or a stale timestamp took the panel over (`chat-restore-wrong`). Newest-in-directory is the FALLBACK now: the remembered conversation is gone, or this directory has never been served.

The TRANSCRIPT is still not persisted on this side, and that is the part that has not changed: a second copy of the conversation would be a second thing to be wrong. What is written down is an id and the directory it belongs to, in one small file under `$XDG_STATE_HOME` — never under the served directory, which is the outline set.

## The modules, and their separate reasons to change

| file | what it owns |
|---|---|
| `adapter.ts` | which executable speaks ACP: the pinned adapter by default, `OLAI_ACP_AGENT` to override, empty to turn chat off |
| `agent.ts` | the ACP client: one subprocess, one protocol. Nothing else in olai spells `session/prompt`. Also `adopt` — which stored conversation a boot opens in, pure and exported for its own test |
| `memory.ts` | which conversation the panel was in, across a restart: one file per served directory under the XDG state home, two verbs and an id. A read or a write that fails is a row in the transcript, never a failed boot |
| `directory.ts` | how a directory is SPELLED, decided once — read by the thing that matches a stored session's `cwd` against ours and by the thing that names this directory's memory after it, which must never come to answer differently |
| `interpret.ts` | what the CLAUDE CODE adapter means by what it sends: which permission requests are answered without asking, `_meta.claudeCode.toolName`, the CLI `init` message it forwards, which config option is the model — and what the agent's own word for a running model is, since the picker offers ALIASES (`sonnet`) where the CLI reports API ids (`claude-sonnet-5`). Pure, so the adapter-specific VALUES are one file to read when olai is pointed at another agent |
| `kolu.ts` | whether this host is running kolu, the stdio server to hand a session if it is — and, if it is not and should have been, the sentence saying why not |
| `pipes.ts` | a subprocess's pipes as a stream of JSON-RPC messages, and why a child never ran to have any — the two things the two subprocesses above have in common |
| `questions.ts` | the questions on the wire, and the one rule about them: each ends exactly once, however it ends. Also the SEAM where `@olai/acp`'s own refusal word (`Refused`) becomes the domain's (`UsageFailure`) |
| `events.ts` | the closed vocabulary of what an agent tells us — a consumer that needs more needs a new member, not a look at the wire |
| `wrote.ts` | the other half of the same question, for a write that went through the ops layer: the reply's own classification of the change, its node, and the rollup's nudge. Never a diff — a `.olai` diff is one enormous line |
| `transcript.ts` | the conversation as ROWS: chunks accumulate, tool calls update in place by id, a replay replaces rather than appends |
| `attachments.ts` | the conversation's tmp directory: where an attached file lands, what a chunked upload may continue, and what the prompt says about it |
| `context.ts` | the nodes a message is ABOUT, on their way into the prompt: one line per node, the id in backticks. Its sibling above is the argument — a handle the agent can act on, never a copy of the thing |
| `prompt.ts` | the one rule for putting lines UNDER a message — a blank line between what a person wrote and what olai added, nothing at all to add when there is nothing, and the lines alone when there were no words. The two files above own only their own line |
| `chat.ts` | the join, and the only place that knows both halves |

A tool call is not instantaneous, so a frame is not just a status that flips. `tool_call_update` carries incremental `content` and follow-along `locations`, and both reach the row while it runs — the transcript keys frames by the agent's own call id, so a report is an upsert on the same key rather than a second row. Content REPLACES rather than accumulates, which is the protocol's own rule for an update: a report carries the call's content as it stands, so appending would print the first half of a long output twice.

**What a call CHANGED travels structured, in two vocabularies.** A `diff` block used to be flattened into that same progress string as the sentence `— <path>`, on the argument that the outline is where an olai edit shows up anyway — and the second half of that stopped being true, because a direct edit to a `.md` or a source file shows up in no outline at all. So `@olai/acp`'s `diffsOf` reads those blocks into `FileDiff`s and the panel draws the change; the client computes the line diff from the two texts, which is what keeps the wire carrying facts rather than a rendering. A write through the OPS layer gets the opposite treatment and for the commit panel's own reason — a `.olai` diff is one enormous line per node — so `wrote.ts` reads olai's own tool reply into the node-level story instead: *marked done*, *note rewritten*, *moved*. The classification is the reply's (`@olai/ops`' `Applied.sort`), never re-derived here and never read out of prose.

`events.ts` is the seam that makes the rest of this hold. Nothing above it spells `session/update`, reads a `ContentBlock`, or knows which `configOptions` entry the model is. A consumer wanting something not in that union needs a new member — which is what keeps the ACP version in one file and the conversation in another.

`chat.ts` BUILDS the agent rather than being handed one, so `session/update` stays a phrase this package is the last to say: a caller passes the adapter it resolved and the directory to run it in, never a protocol object. The seam for a scripted agent is one level further out and more honest for it — `OLAI_ACP_AGENT` pointed at a script, which is how the e2e suite drives every turn it asserts on, and which exercises the subprocess and the wire that an injected object would replace with an assumption.

## When the agent has a question

`initialize` advertises `elicitation.form`, and that one line is what lets the agent ask anything at all: without it the Claude Code adapter puts `AskUserQuestion` in `disallowedTools`, so an agent that wanted to check which of two things you meant had to guess, or write the question into prose and hope somebody answered it in the next message.

With it, two ACP methods reach a person and both are drawn as the same thing — a form in the transcript, which is a row rather than a modal, so it is still there afterwards saying what was asked and what was chosen:

- **`elicitation/create`**, form mode: a JSON Schema of primitive-typed properties. The adapter renders `AskUserQuestion` into one (a titled `oneOf` per single-select, an array with a titled `anyOf` per multi-select, and beside each question its own free-text "Other" box), and feeds the answers back as that tool's own `updatedInput`. MCP servers on the session reach the same method with schemas of their own.
- **`session/request_permission`**: a list of named options for one tool call, which is a single-select with the options already spelled out.

`@olai/acp` projects both, purely, so what a form looks like for a question nobody has asked yet is a unit test. A property whose type this panel has no control for makes the whole request UNDRAWABLE: it is declined and said out loud, because half a form is one somebody submits believing they answered all of it. Both directions answer with a value or that package's own `Refused` — one kind of no for a question that cannot be drawn and an answer that does not fit its question — and `questions.ts` translates it into the `UsageFailure` the rest of olai refuses things with, at the seam, once.

`questions.ts` holds the promises, and has one rule: a question ends exactly once. Somebody answers in one tab while somebody dismisses in another, while the agent withdraws it because the turn was cancelled, while the subprocess dies — all four are a call to `settle`, first one wins, and every ending goes down one channel so the row on screen and the value on the wire cannot disagree. It is its own module because it is a state machine rather than a protocol fact, and that is not taste: `withdrawAll` was first written to empty the map and then settle what it had taken out, which settles nothing, and every question would have hung on a conversation that had already ended. Inside the ACP client's closure that needed an agent, a browser and a cancelled turn to see. **A dismissal is a decline on the wire** — the agent is told a person would not say — and never a fabricated answer.

Nothing times out. A pending question holds the ACP request open, which is exactly what a blocked turn is; what the panel owes in return is that the block is impossible to miss (`chat.asking` on the state cell, drawn in the composer, the header and the app's permanent agent toggle). Every question is withdrawn if the conversation it belongs to ends — a new session, a load, a dead subprocess — so a live form is never a control that does nothing.

### Which permissions are answered without asking

Bypass mode is the design (resolved 2026-08-09) and it is still the design: a permission request for one of the MCP servers *we handed this session* — olai's mediated ops, kolu's terminals — is allowed immediately, because those tools are already validated and a click per write is not a permission model.

Everything else is a person's. That direction is the load-bearing one. The adapter maps plan mode's "Ready to code?" onto a permission request whose FIRST allow-flavoured option switches the session to `auto`, and this client used to answer every request with the first allow it found — so it was taking that decision on somebody's behalf, silently, every time. The rule is positive recognition: a tool we cannot name is a tool a person is asked about. The name comes from the `tool_call` the adapter always emits before it asks (the permission request itself carries a display title, not a name), which is the one agent-specific `_meta` this package reads and the reason it is read.

The rule itself is a PURE FUNCTION — `interpret.ts`, `allowedWithoutAsking(tool, given, options)` — for the reason `@olai/acp` is pure: what stops this panel approving its own permissions should be a unit test on a payload rather than a branch you can only reach by starting a subprocess and talking it into asking. The e2e suite drives both requests through a real agent and stays the net for the wiring.

## Kolu's terminals, when the host has them

A session is handed olai's own tool server, and a second one when this host is running [kolu](https://kolu.dev): `kolu mcp` over stdio, so the agent you are talking to about your outlines can also see the terminals your coding agents are running in. It is automatic and has no knob, and the caller is not asked, because the answer can change between one conversation and the next.

What a knob would be protecting against is worth naming, because the two ways of being wrong do not cost the same. Missing a kolu that is there costs a session some tools. Attaching one that is NOT there costs the agent a server whose every tool fails — it will try them, because it was told they were available, and what it gets back is a transport error rather than an answer. So the bar is not "a kolu started": it is an answered read of a cell the daemon owns, and anything short of that is refused.

Which is the first of three decisions in `kolu.ts` worth knowing:

**Per conversation, not per boot.** A padi started after olai is picked up by the next conversation rather than the next restart. It costs one process start on a path that already spawns a subprocess and handshakes with it.

**The probe IS the detection.** A `kolu` on PATH is not necessarily the host's kolu: a padi-spawned terminal prepends its own bundled copy, and one of those was an older build reporting the same version string while missing most of the verbs ([juspay/kolu#2146](https://github.com/juspay/kolu/issues/2146), fixed by #2147 — but the wrong build still SPAWNS, so the lesson outlives the fix). So nothing here trusts a path, a version or an exit code: the executable is started, handshaken with, and asked to read a resource only a live daemon can answer. One answer is evidence of both halves — this binary speaks the protocol, AND a padi is behind it — and the absolute path that answered is what the session is given, so the agent cannot resolve the bare word against a different PATH and spawn something else.

Anything short of an answer is a NO, and the no says which of two it is (`Detected`). `none` is no `kolu` on PATH at all — the ordinary case, quiet, and not a fault. `silent` is a `kolu` that IS there and would not answer, and it carries `why`: it could not be started, it closed the pipe, it timed out, or it refused the daemon's own identity read — which is what a build running against no padi does (juspay/kolu#2146), and the one worth telling somebody about. Those four used to be one `false` with the reason destroyed inside a `catch` before anything could report it.

**`PADI_SOCKET` set with nothing on PATH is `silent` too**, and it is the one `silent` with no file to name. Absence is quiet because olai auto-detects and nothing declares that a host should have kolu — but that variable is a declaration, set by a kolu terminal for what it starts and by a person who meant it. And the PATH it is measured against is OLAI's: run as a systemd user service (`nix/home/module.nix` passes neither), this process need not see a `kolu` its user runs every day, which is the original incident approached from the environment instead of from the binary. Narrow on purpose — without the variable this stays quiet, so a machine that never heard of kolu never hears about it.

**And the no is on screen.** One probe answers both halves: `Kolu.serverOf` is what a session is handed, `Kolu.missingFrom` is what a person is owed about the one it was not, and `agent.ts` reads both off the same `Detected` rather than probing twice. A `silent` becomes a `servers` event carrying the server's name, the file that was probed and the reason in the words it was given in; the state cell holds it for the life of the conversation and the panel draws it under its header (`mcp-fail-visible`). A `none` becomes nothing at all — nothing failed on a host that is not running kolu, and a panel that reported that absence as a fault would be a complaint on every machine that has never heard of kolu.

The `it could not be started` arm is a second door and has to be: under Bun an exec failure arrives as an `error` EVENT on a child `spawn` has already returned, so the `try` around the spawn never sees one. Two things hang on racing it rather than merely catching it — an unhandled `error` event is an uncaught exception, and what *follows* an exec failure is our own write to a stdin that died with it, so the reason a person got was `Cannot call write after a stream was destroyed`. Both subprocesses this package deals with had that problem; each now solves it where its spawn lives. The ACP agent's is `pipes.ts`'s (`unstartable`), beside the framing, because that is the same question — what a Node child does to the process that spawned it. The kolu probe's is `@kolu/detect`'s, because kolu starts that child now.

That mattered most on the one this file is not about. `OLAI_ACP_AGENT` is a path a PERSON sets — a typo, a moved binary, a store path that was collected — which makes it the likeliest thing here to be wrong, and it was the case that reported the least: a stack trace on olai's stderr, and a panel saying `initialize` had failed on a destroyed stream. `agent.ts` races the same promise against its handshake now and refuses with `could not start the agent \`<command>\`: …`, which names the thing to go and fix.

**The probe itself is kolu's** (`@kolu/detect`, juspay/kolu#2168). Resolving `kolu` on PATH, starting it, handshaking, and reading a cell only a live daemon can answer is knowledge *about kolu* — including the two incidents it encodes, which are facts about kolu's own builds and discoverable there rather than here. So `kolu.ts` no longer writes a message or reads a pipe: it asks, and gets back which of the five ways it failed, with the failing party's own words where there were any. What stays is the judgement — this file still owns every sentence on the strip, still decides that an absence is only a fault when `PADI_SOCKET` says a padi was expected, and still reads `PADI_SOCKET` and `PATH` itself rather than letting the probe reach for them, because that environment is olai's fact and not kolu's to interpret. `pipes.ts` remains what it always was for the ACP session, which is still this package's own subprocess.

**What is detected is the DAEMON, not kolu's web server**, which may be running on another machine reaching this host as a remote. `PADI_SOCKET` is forwarded when olai was launched inside a kolu terminal, and kolu resolves its own default when it was not — socket discovery is not reimplemented here, and a host running two padis says so and is left alone rather than guessed about.

## What the caller does

Four exports. Resolve the adapter, build, wire the two publishers, register `stop` as a finalizer, `start`:

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

`tools` is a thunk because the MCP server's address is not knowable until the listener has bound, and the session is opened after that.

A `null` adapter is not an error. Serving a directory has never depended on an agent being installed; the panel says so and the outlines are unaffected.

There is no `log` in that list any more, and that is the point: this package logs the way every other one does ([`@olai/log`](../log/README.md)), so nothing has to be handed a place to write. What it says lands at three levels. The agent's own stderr is relayed at `debug` — it is somebody else's program's log and by volume the loudest thing olai ever emits, so it is off until `--log-level debug` asks for it. Trouble the panel is already drawing (a session that would not open, a boot the next prompt will retry) is a `warn`, because nothing has stopped. Every line carries `agent=<command>`, which is what the `acp: ` prefix used to be, except now it is a field. There is no fiber inside an ACP notification handler or a subprocess `data` event, which is why the emitter is taken once at `make` rather than a line at a time.

The same package owns how a FAILURE is rendered into the sentences this one hands a person — `AgentGone.why`, a `trouble` notice. All of them go through `reasonOf`, including the one that reads a fiber's `Cause`: `Effect.onError` hands the cause rather than the failure, and `String` on one of those is `Cause([Fail(…)])` with the reason buried inside it. There used to be three spellings of that in this file, one of them wrong.

## Four decisions worth naming

**A turn is accepted, not awaited.** `send` answers the moment the prompt is on the wire; what happens next arrives on the transcript, so every open tab stays in step and a five-minute turn is not a five-minute call.

**A message sent mid-turn STEERS the turn that is running, and this package holds nothing.** Three arrangements have been tried and only the third is honest about what a person is doing when they type during a turn. It used to be REFUSED, with the input turned off while it refused, so the next thought had nowhere to go. Then it QUEUED: accepted, drawn as a row, and held in an array here until the turn was over — which made a message meant to redirect an agent into a message about whatever came next, and then destroyed it. `dropQueue("cancelled")` was the incident: an orchestrator turn held open for a subagent (the adapter's `Turn.deferredSettle`), four messages sat in the queue for its whole lifetime, and one press of cancel threw all four away. There was no copy anywhere — the transcript is not persisted, the agent's own session is the persistence, and a queued message had never reached that session.

So the queue is deleted rather than fixed. `send` puts the prompt on the wire immediately, always. Which lane it takes is the agent's business, not this file's: an idle agent gets a `session/prompt` and a working one gets `_session/steering`, the extension the pinned adapter advertises in `initialize`'s top-level `_meta` and delivers at the SDK's `now` priority — so the message pre-empts the current generation and lands between the running turn's own steps. Verified against the adapter directly: a steer sent while a turn was mid-answer came back `{"outcome":"injected"}` and the turn changed course inside the same `session/prompt`, which still resolved once. A concurrent `session/prompt` would NOT have done that; the adapter enqueues one behind the running turn, which is the same waiting one layer down.

Two consequences fall out. **Cancel means stop the agent and nothing else** — everything typed was already delivered, so there is nothing left for a cancel to decide the fate of. And **delivery that genuinely fails is said on the ROW**: the `user` entry keeps its words, gains `unsent`, and offers `chat.resend`, which re-delivers the exact prompt this package kept (pictures by path, node lines and all — the row carries pictures by NAME, so a retry rebuilt from the row would be a different message). Nothing drains that; only a person's click does — and the prompt lives beside the row it belongs to, in the transcript, so a row marked `unsent` with nothing behind it (a button that refuses) is not a state anything can construct.

An agent with **no steering at all** needs no special handling and gets none: it refuses `_session/steering` and that refusal travels the error channel in its own words, exactly like a dead pipe or a deadline, and reaches a person as the same row keeping the same words. `initialize` does advertise the extension, and reading that advertisement would be predicting what the request already proves — two answers to one question, and the request is the one that cannot be wrong. The scripted agent in the e2e suite deliberately advertises nothing and steers anyway, which is that arrangement under test.

`turn` is a TICKET rather than a fiber handle, and that is what makes the two lanes safe: it is written down before the fork, so there is no instant in which a turn is running and `send` reads otherwise, and the turn's own end-of-turn report is gated on still being the current ticket, so a turn that settled while its replacement was starting cannot mark a thinking panel idle.

**The refusals the ops layer produces are ours to render.** The agent gets the structured detail in its tool result, but what it then says about it is prose. So the MCP layer tells us about every refusal and it lands in the transcript as DATA — which is what makes "a refused write shows its detail in chat" true regardless of how the agent phrases it.

**An attached file is a PATH by the time the conversation sees it.** The bytes arrive over `chat.attach` as bounded chunks and are written straight into a tmp directory of this conversation's own — `attachments.ts`, and never under the served directory, where the store probes and a commit would sweep them up. What `send` then carries is where they landed, and what the prompt says is `Attached file: <path>`: Claude Code reads the file itself. The label says FILE because the line carries PDFs and text as well as pictures — the gate widened in `/surface` and this sentence widened with it. So no base64 rides the prompt into the session the agent persists, nothing here depends on the session's `promptCapabilities.image`, and the whole path from browser to agent stays a string. The directory goes when the conversation is left and when the chat stops — which is a finalizer of the serve scope, so it goes with the server too.

A path that arrives over the wire is checked, never believed. A chunk's `appendTo` and a send's attachment list are both re-resolved against that directory, through symlinks, on both sides of the comparison — so a continuation token is exactly that, and not a capability to append to any file this process can write.

`attach` takes the SAME permit as a session change, because the two touch one directory. Leaving a conversation is allowed while an upload is running — only a running turn blocks it — so without that, a chunk could be writing into a directory `discard` was removing. Serialized, both orders are whole: an upload finishes into the conversation it began in, or it starts in the one that replaced it. One chunk is a three-megabyte write, so the permit is held for milliseconds rather than for an upload. A continuation whose conversation was left in between is refused like any other path that is not ours, and the browser drops an answer that arrives for a conversation it is no longer in.
