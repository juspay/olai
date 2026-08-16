#!/usr/bin/env bun
/**
 * A scripted ACP agent, for driving the chat loop without a language model.
 *
 * It speaks just enough of the protocol to be indistinguishable from a real
 * agent as far as `packages/server/src/chat/agent.ts` is concerned:
 * line-delimited JSON-RPC on stdio, `initialize` / `session/new` /
 * `session/list` / `session/load` / `session/set_mode` / `session/prompt`,
 * `session/cancel` as a notification, and `session/update` notifications on the
 * way.
 *
 * What makes it worth having is the last thing it does: it calls the REAL
 * internal MCP server, over the real HTTP route, with the token the real
 * `session/new` handed it. So an e2e scenario drives the real panel, the real
 * ops layer and the real store — everything except the part that would need a
 * model, and that part is the one thing a CI lane cannot afford to be
 * non-deterministic about.
 *
 * Behaviour is keyed on the prompt text, so a scenario asks for what it needs:
 *
 *   name <id>    say that id in backticks, and nothing else
 *   done <id>    call `set_done` on that node, then say so
 *   add <title>  call `add_node` under the first outline's first root
 *   edit [file]  report a DIRECT file edit, as a `diff` content block — an
 *                outline if the name ends `.olai`, an over-budget rewrite for
 *                `huge.md`, unbroken tokens (add, remove, and a same-line
 *                context row) for `long.md`, an ordinary
 *                markdown edit otherwise
 *   servers      name the MCP servers this session was handed
 *   slow         dawdle, long enough to cancel
 *   deaf         go quiet with our stdin closed, so nothing said back arrives
 *   talkative    keep streaming through a cancel, the way a slow one does
 *   picture      answer with an `image` block, which the panel cannot draw
 *   lose         refuse every `session/list` from here on
 *   flood        say more than fits, so scrolling is a thing that can be tested
 *   hold         start a tool call and STOP there, until released
 *   subagent     spawn TWO agents and interleave their tool calls with each
 *                other's, each frame stamped with the `Agent` call it came out
 *                of — the whole of what the adapter says about who did what
 *   model <id>   switch the model the way the wrapped CLI does — which is to
 *                say silently, and not observably until the NEXT turn
 *   reconfig     re-announce the session's config options unchanged, the way
 *                the adapter does when anything else in that set moves
 *   window <n> [hold]   move the context WINDOW, the way the adapter does when
 *                it corrects a seeded guess at the end of a turn. `hold` stops
 *                between the turn's two usage frames, so a scenario can look at
 *                the mid-stream window rather than infer it
 *   ask          ask a structured question and report the answer
 *   askstrict    ask one with a REQUIRED, typed field, the way an MCP server does
 *   plan         ask to leave plan mode, the way the adapter does
 *   permit       ask permission for an ops tool, which needs no person
 *   nameless     ask permission for a tool nothing has named
 *   crash        exit mid-turn
 *   a prompt naming an attached file   read the file and say how big it is
 *   anything     one chunk of prose and an `end_turn`
 *
 * The last three are REQUESTS to the client rather than notifications, which is
 * the shape those parts of the protocol have: the agent stops until an answer
 * comes back. `ask` refuses to ask at all unless the client advertised
 * `elicitation.form` at `initialize` — which is what makes the capability
 * itself something a scenario can assert, rather than a line in a file that
 * could be deleted with every test still passing.
 *
 * `hold` is how a scenario gets to look at a turn WHILE it is happening. A
 * turn that finishes in a millisecond can only be asserted about afterwards,
 * and afterwards is precisely when the bugs this suite exists for stop being
 * visible: a row that is remounted on every frame looks perfect once the frames
 * stop. It waits for a file (`.agent-release` in the directory it was started
 * in) rather than for a clock, so the scenario says when — a dot-file, which
 * the store's walk prunes, so waiting for one is not itself an edit.
 *
 * STORED SESSIONS are an environment variable, because which boot path runs is
 * a property of the machine the agent woke up on rather than of anything the
 * client says: `OLAI_FAKE_ACP_STORED` unset means nothing is stored (so a
 * client boots with `session/new`), and set means `session/list` answers and
 * `session/load` replays. There are two of them, and either can be taken AWAY
 * between boots (`.agent-forgot-<sessionId>`, the way `hold` is released): a
 * conversation the client remembers being in and can no longer open is the case
 * its fallback exists for, and a scenario has to be able to reach it.
 *
 * Dumb and deterministic on purpose. This is test infrastructure, not a
 * simulator.
 *
 * It lives in `agent/` rather than in `support/` because Cucumber imports
 * everything under `support/` as part of the world, and importing this reads
 * stdin — which, in the runner's own process, ends immediately and takes the
 * run down with it. A directory of its own is what makes that unrepresentable.
 */

import { existsSync, rmSync, statSync } from "node:fs"
import { basename } from "node:path"

import { readMessages } from "../support/ndjson.ts"

const OUT = process.stdout

const emit = (message: unknown): void => {
  OUT.write(`${JSON.stringify(message)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  emit({ jsonrpc: "2.0", id, result })
}

/** The other half of {@link respond}: a request we will not answer. Named for
 *  the same reason its sibling is — the envelope is the protocol's, not this
 *  file's, and two hand-built copies is how one of them drifts. */
const refuse = (id: unknown, code: number, message: string): void => {
  emit({ jsonrpc: "2.0", id, error: { code, message } })
}

const notify = (method: string, params: unknown): void => {
  emit({ jsonrpc: "2.0", method, params })
}

/** The client's answers to requests WE sent, by the id we sent them under.
 *  Ids are prefixed so they cannot be mistaken for the client's own. */
const answering = new Map<string, (result: unknown) => void>()
let nextRequestId = 0

/** Ask the client something and wait. Half the protocol runs this way — a
 *  permission, an elicitation — and a scripted agent that could only notify
 *  could not exercise any of it. */
const request = (method: string, params: unknown): Promise<unknown> =>
  new Promise((resolve) => {
    const id = `agent-${++nextRequestId}`
    answering.set(id, resolve)
    emit({ jsonrpc: "2.0", id, method, params })
  })

/**
 * Take back every question still on the wire, the way a real agent does when
 * its turn is cancelled: `$/cancel_request` per outstanding id, which aborts
 * the client's handler.
 *
 * The promises are resolved HERE rather than waited on, because a cancelled
 * request gets no response — that is the point of cancelling it — so an agent
 * that went on awaiting them would hang on a turn it had just abandoned.
 */
const withdrawRequests = (): void => {
  for (const [id, resolve] of [...answering]) {
    answering.delete(id)
    notify("$/cancel_request", { requestId: id })
    resolve(null)
  }
}

const noise = (line: string): void => {
  process.stderr.write(`${line}\n`)
}

// ── what this process is ───────────────────────────────────────────────

/** Where the client said we are working. Remembered from `session/new` so
 *  `session/list` can answer about it. */
let cwd = process.cwd()
/** Which conversation we are in. A load moves it. */
let sessionId = "fake-session-1"
/** The MCP server the client handed us, if any: `{url, headers}`. */
let mcp: { url: string; headers: Record<string, string> } | null = null
/** The NAMES of every MCP server the client handed us, in the order it sent
 *  them. Olai's own is the http one this file actually calls; the rest are
 *  somebody else's programs on the host, which this file has no business
 *  spawning — reporting that they arrived is the whole of what a scenario
 *  about them can ask. */
let servers: ReadonlyArray<string> = []
/** Set by a `session/cancel` notification, cleared when a prompt is accepted. */
let cancelled = false
/** Whether we shut our own stdin (`deaf`). Read where the end of that pipe
 *  would otherwise mean the client had gone. */
let deaf = false
/** Whether `session/list` refuses from here on (`lose the conversations`). A
 *  prompt rather than an environment variable, because boot ASKS — a server
 *  that refused from the start would fail its own boot instead of reaching the
 *  picker, which is the thing under test. */
let listRefused = false
/** What the client said it can do, out of `initialize`. Read for one thing: a
 *  client that did not advertise `elicitation.form` is one a real adapter would
 *  never ask a structured question of, and this one does not either. */
let capabilities: Record<string, unknown> = {}

const STORED = process.env["OLAI_FAKE_ACP_STORED"] ?? ""
const stored = () => STORED !== ""

const STORED_TITLES: Record<string, string> = {
  "fake-stored-old": "an older conversation",
  "fake-stored-new": "the last conversation",
}

/** Whether a scenario has made this conversation GONE — deleted from the
 *  agent's own store, which is the case a client's fallback exists for. A
 *  dot-file per session id in the served directory, like {@link RELEASE}: the
 *  store's walk prunes those, so arming one is not an edit. Per ID rather than
 *  one flag for the older row, so "the newest is gone" needs no second
 *  mechanism. */
const forgotten = (sessionId: string): boolean =>
  existsSync(`${cwd}/.agent-forgot-${sessionId}`)

/** The client's own two, NEWEST LAST — so a client that takes the first entry
 *  instead of the most recently updated one adopts the wrong conversation. */
const storedSessions = () =>
  [
    {
      sessionId: "fake-stored-old",
      cwd,
      title: STORED_TITLES["fake-stored-old"],
      updatedAt: "2026-07-01T09:00:00.000Z",
    },
    {
      sessionId: "fake-stored-new",
      // The same place, spelled with a trailing slash: an agent stores the
      // spelling it was handed, and a client comparing strings would miss it.
      cwd: `${cwd}/`,
      title: STORED_TITLES["fake-stored-new"],
      updatedAt: "2026-08-01T17:30:00.000Z",
    },
  ].filter((session) => !forgotten(session.sessionId))

/**
 * The picker, shaped the way the real adapter's is.
 *
 * Two rows spelled as ids, and three ALIASES — which is the shape that matters
 * and the one this file used to be missing. The pinned adapter (0.66.0) offers
 * `default`, `opus[1m]`, `sonnet`, `haiku`: bare family words, while the live
 * model it reports on the wire is a concrete API id like `claude-sonnet-5`.
 * With only id-spelled rows here, a panel that could not bridge the two
 * vocabularies passed every scenario in this suite and named a raw id in front
 * of the person who filed the bug.
 *
 * `opus[1m]` is here for the OTHER direction — the one a review constructed
 * against the real adapter. It is a row that states a context lane, and a live
 * id never states one, so it must NOT be allowed to answer for a bare
 * `claude-opus-5`: that named a 1M window over a session running 200k, in the
 * line a person reads to decide whether to `/compact`.
 */
const CONFIG_OPTIONS = [
  {
    id: "model",
    name: "Model",
    type: "select",
    currentValue: "fake-model-1",
    options: [
      { value: "fake-model-1", name: "Fake One" },
      { value: "fake-model-2", name: "Fake Two" },
      { value: "sonnet", name: "Fake Sonnet" },
      { value: "haiku", name: "Fake Haiku" },
      { value: "opus[1m]", name: "Fake Opus (1M context)" },
    ],
  },
]

/**
 * The two texts the `edit` verb reports — a `.md` a real agent would have
 * rewritten with `Edit`.
 *
 * Shaped for what the panel has to do with it rather than for prose: unchanged
 * lines at both ends (so the collapsed-run idiom is exercised on both sides),
 * a replaced block in the middle, and enough rows in total that the trim has
 * something to hide and the expand has something to show.
 */
const EDITED = {
  before: [
    "# Kitchen notes",
    "",
    "The remodel is in three parts, and two of them are waiting on the third.",
    "",
    "- oak doors, twelve of them, ordered on the second",
    "- a worktop nobody has chosen yet",
    "- the sink stays exactly where it is",
    "- the tiles are somebody else's problem",
    "",
    "Nothing here is decided until the worktop is.",
    "",
  ].join("\n"),
  after: [
    "# Kitchen notes",
    "",
    "The remodel is in three parts, and two of them are waiting on the third.",
    "",
    "- oak doors, twelve of them, delivered on the ninth",
    "- a walnut worktop, ordered on the tenth",
    "- the sink stays exactly where it is",
    "- the tiles are somebody else's problem",
    "- the lights arrive with the worktop",
    "",
    "The worktop settles it: everything else can be booked in now.",
    "",
    "_Rewritten while you watched._",
    "",
  ].join("\n"),
}

/**
 * The same gesture aimed at an OUTLINE — an agent's own `Edit` on a `.olai`,
 * which is the one thing olai's own tools cannot do and the one file a text
 * diff may never be drawn of.
 *
 * The records are the chat fixture's own, so what the panel reports is a change
 * to a node a scenario can name.
 */
const EDITED_OUTLINE = {
  before: [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets"}`,
    "",
  ].join("\n"),
  after: [
    `{"id":"kitchen","ord":"a0","title":"kitchen remodel #home"}`,
    `{"id":"order","parent":"kitchen","ord":"a1","title":"order the new cabinets","desc":"oak, twelve of them"}`,
    "",
  ].join("\n"),
}

/**
 * A token with no whitespace at all — the case `overflow-wrap: anywhere`
 * exists for, and the one `whitespace-pre-wrap` alone cannot break. 700
 * characters is past every dock and sheet this suite draws, so a regression
 * to `whitespace-pre` is a horizontal scrollbar rather than a lucky fit.
 */
const unbroken = (seed: string): string => {
  const unit = `${seed}X`
  return unit.repeat(Math.ceil(700 / unit.length)).slice(0, 700)
}

const LONG_ADDED = unbroken("added")
const LONG_REMOVED = unbroken("removed")
const LONG_CONTEXT = unbroken("context")

/**
 * A long-line edit that pins all three row kinds the gutter must survive:
 * a wrapping context line that did not change, a wrapping removal, and a
 * wrapping addition. Short neighbours keep the trim honest.
 */
const LONG_EDITED = {
  before: [
    "# Kitchen notes",
    "",
    LONG_CONTEXT,
    LONG_REMOVED,
    "the sink stays exactly where it is",
    "the tiles are somebody else's problem",
    "the lights arrive with the worktop",
    "Nothing here is decided until the worktop is.",
    "book the electrician",
    "book the tiler",
    "",
  ].join("\n"),
  after: [
    "# Kitchen notes",
    "",
    LONG_CONTEXT,
    LONG_ADDED,
    "the sink stays exactly where it is",
    "the tiles are somebody else's problem",
    "the lights arrive with the worktop",
    "Nothing here is decided until the worktop is.",
    "book the electrician",
    "book the tiler",
    "",
  ].join("\n"),
}

/** A rewrite past the panel's comparison budget: two texts with nothing in
 *  common and more lines than the table may have cells, which is the case that
 *  has to SAY it gave up rather than draw the top of the old file as though it
 *  were a hunk. */
const REWRITTEN = {
  before: `${Array.from({ length: 600 }, (_, at) => `was ${at}`).join("\n")}\n`,
  after: `${Array.from({ length: 600 }, (_, at) => `now ${at}`).join("\n")}\n`,
}

const COMMANDS = [
  { name: "review", description: "review the outline" },
  { name: "plan", description: "plan the next step" },
  { name: "compact", description: "compact the conversation" },
]

// ── the internal MCP server, called for real ───────────────────────────

let nextMcpId = 0

const callMcp = async (
  method: string,
  params: unknown,
): Promise<Record<string, unknown>> => {
  if (mcp === null) throw new Error("no MCP server was configured")
  const response = await fetch(mcp.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...mcp.headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextMcpId, method, params }),
  })
  if (response.status === 202) return {}
  const body = (await response.json()) as { result?: Record<string, unknown> }
  return body.result ?? {}
}

/** A call that finished, carrying nothing but the fact — the shape the real
 *  adapter has for a completion whose result the announcement already said
 *  everything about. Shared by the turns that announce their own frames rather
 *  than going through {@link useTool}, which has a result to report and sends
 *  its own. */
const completed = (toolCallId: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
  })
}

/** Announce a tool call, run it, and report how it went — the shape a real
 *  agent's `tool_call` / `tool_call_update` pair has. */
const useTool = async (
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> => {
  const toolCallId = `call-${++nextMcpId}`
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: `${name}`,
      status: "in_progress",
      rawInput: args,
    },
  })

  const result = await callMcp("tools/call", { name, arguments: args })
  const failed = result["isError"] === true
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: failed ? "failed" : "completed",
      rawOutput: result,
    },
  })
  return result
}

// ── turns ──────────────────────────────────────────────────────────────

const say = (text: string): void => {
  notify("session/update", {
    sessionId,
    update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
  })
}

/** An answer that is NOT prose — the protocol's `image` content block, which
 *  the panel cannot draw. One pixel of base64, because what is under test is
 *  that a block of this kind leaves a mark rather than a blank, and the bytes
 *  are the one part of it nothing reads. */
const showPicture = (): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      content: {
        type: "image",
        mimeType: "image/png",
        data:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    },
  })
}

const sleep = (millis: number) => new Promise<void>((done) => setTimeout(done, millis))

/** The file a scenario touches to let a held turn go on. */
const RELEASE = ".agent-release"
/** Long enough that a slow machine is not the reason a scenario fails, short
 *  enough that a scenario which forgot to release fails on its own assertion
 *  rather than on the runner's timeout. */
const HOLD_LIMIT_MS = 30_000

const released = async (onTick?: () => void): Promise<void> => {
  const marker = `${cwd}/${RELEASE}`
  for (let waited = 0; waited < HOLD_LIMIT_MS; waited += 100) {
    if (existsSync(marker)) {
      rmSync(marker, { force: true })
      return
    }
    onTick?.()
    await sleep(100)
  }
  noise("fake agent: nothing released the held turn; going on anyway")
}

/**
 * The message the Claude Code adapter forwards from the CLI it wraps.
 *
 * It is what a real `/model` produces and the config option does NOT: the CLI
 * handles that command itself, so the picker goes on reporting what the session
 * started on. Reproducing that here is the only way an e2e can tell a header
 * that follows the running model from one that follows the picker.
 */
const sdkInit = (model: string): void => {
  notify("_claude/sdkMessage", {
    sessionId,
    message: { type: "system", subtype: "init", model },
  })
}

/**
 * The model the wrapped CLI is running, and WHEN a change to it is observable.
 *
 * The real adapter emits one `init` per turn, as that turn STARTS — so the turn
 * that runs `/model` still announces the model it began on, and the new one is
 * first heard of when the NEXT turn starts. Captured against 0.66.0 with
 * `emitRawSDKMessages: true`: nothing else in that turn carries it, the only
 * other trace being a `<synthetic>` assistant message saying so in prose.
 *
 * `model <id>` therefore takes effect AFTER this turn's announcement, which is
 * the whole of what makes the panel's one-turn lag a property a scenario can
 * assert instead of a surprise a person reports.
 */
let liveModel = "fake-model-1"

/**
 * How full the context is, and how the real adapter reports it.
 *
 * `usage_update` is ACP's own update kind, sent SEVERAL TIMES A TURN: the agent
 * revises `used` as the turn goes and the last frame of the turn adds the
 * cumulative cost. Both halves may move — captured against 0.66.0, the first
 * turn after a `/model` reports the PREVIOUS model's window mid-stream and the
 * true one on that last frame, because the adapter seeds the window from what
 * it last learned and corrects it authoritatively when the turn ends.
 *
 * Reproduced here rather than simplified, because a panel that held the FIRST
 * report of a turn instead of the newest would look right in every scenario
 * that only ever sent one.
 */
let used = 0
let size = 200_000

/** One report, as the protocol shapes it. `cost` rides the turn's last frame
 *  alone, exactly as the real one's does — and nothing draws it, which is a
 *  claim worth being able to make about a field that is actually there. */
const usageUpdate = (final: boolean): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "usage_update",
      used,
      size,
      ...(final ? { cost: { amount: 0.1234, currency: "USD" } } : {}),
    },
  })
}

/** A turn that was cancelled while it was waiting on the client ends as a
 *  cancelled turn. Answers whether it did, so the caller stops there. */
const endedCancelled = (id: unknown): boolean => {
  if (!cancelled) return false
  respond(id, { stopReason: "cancelled" })
  return true
}

/** Whether the client said it can draw a form. `{}` is how the protocol spells
 *  "yes" — the presence of the key is the whole of the claim. */
const canElicit = (): boolean => {
  const elicitation = capabilities["elicitation"] as
    | { form?: unknown }
    | null
    | undefined
  return elicitation?.form != null
}

const runTurn = async (id: unknown, text: string): Promise<void> => {
  cancelled = false
  noise(`fake agent: ${text}`)

  // What every turn opens with, before it has read a word of the prompt — the
  // adapter's own order, and the reason a `/model` is heard one turn late.
  sdkInit(liveModel)

  const [verb, ...rest] = text.trim().split(/\s+/)
  const argument = rest.join(" ")

  // The window the agent believes in, moving under the conversation.
  //
  // `window`, NOT `context`: that verb is taken, by the scenarios that prove an
  // armed node reaches the prompt as an id the ops tools accept.
  //
  // `window <n> hold` stops BETWEEN the turn's two frames, which is the only
  // way a scenario can look at the mid-stream state rather than infer it from
  // where the turn ended — and inferring it is not enough here, because a
  // version of this file that moved the window before both frames would end in
  // the same place and pin nothing.
  const moving = verb === "window" ? Number(rest[0]) : null
  const holding = verb === "window" && rest[1] === "hold"

  // What a turn spends, reported the way a real turn reports it: MORE THAN ONE
  // frame, with BOTH numbers moving between them, and the cost riding the last.
  // A panel that held the first report of a turn rather than the newest would
  // pass every scenario that only ever sent one.
  //
  // The window moves BETWEEN the two frames rather than before them, which is
  // where the real adapter moves it: on the first turn after a `/model` it
  // reports the previous model's window mid-stream and corrects it
  // authoritatively when the turn ends. Assigning it before both frames — which
  // is what this did first — sent the new denominator in both, so a panel that
  // kept a turn's FIRST window would have passed. Newest-wins was pinned for
  // `used` and not for `size`, which is half a claim.
  used += 12_000
  usageUpdate(false)
  if (holding) await released()
  if (moving !== null) size = moving
  used += 900
  usageUpdate(true)

  if (verb === "window") {
    say(`the context window is ${size} now.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "crash") {
    say("about to fall over")
    await sleep(20)
    process.exit(1)
  }

  if (verb === "slow") {
    say("thinking")
    for (let tick = 0; tick < 200 && !cancelled; tick++) await sleep(50)
    respond(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  // A turn nothing can be said INTO. The read end of our stdin is closed while
  // the process goes on streaming, so every later frame the client writes gets
  // EPIPE — which is exactly what a cancel aimed at an agent whose pipe has
  // died looks like, and the one shape of failure that used to be swallowed
  // whole (`Effect.ignore` on the notify): the button was pressed, nothing
  // happened, and the turn went on. Alive and deaf rather than dead, because a
  // process that EXITS is noticed by the exit handler and reported on its own.
  if (verb === "deaf") {
    say("thinking, and no longer listening")
    deaf = true
    process.stdin.destroy()
    // ...and NEVER ANSWERS. The turn stays open for the length of the
    // scenario, which is the whole of what is being reproduced: a cancel is
    // written into a pipe nobody is reading, the write reports nothing back
    // (under Bun a pipe never tells its writer the reader has gone — checked,
    // both for a closed stdin and for a process that has exited), and the turn
    // goes on. Everything about that used to look like success from olai's
    // side, which is exactly why the panel has to watch the TURN rather than
    // the write.
    await sleep(30_000)
    return
  }

  // An agent that will not stop yet and SAYS SO — the honest slow case. It
  // ignores the cancel (a real one is inside a tool call it cannot abandon
  // mid-way) and keeps streaming, which is precisely what must NOT be reported
  // as an agent that has stopped listening.
  if (verb === "talkative") {
    for (let said = 1; said <= 12; said++) {
      say(`still working ${said}\n`)
      await sleep(700)
    }
    respond(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  // An answer with something in it this panel cannot draw. It used to be
  // dropped on the floor — the row was there and it was EMPTY — so the whole
  // claim is that the transcript says a picture arrived.
  if (verb === "picture") {
    say("here it is:")
    showPicture()
    respond(id, { stopReason: "end_turn" })
    return
  }

  // From now on we cannot say what conversations we have. Not the same as
  // having none — and until the picker grew a refused arm, both arrived there
  // as an empty list and were drawn as "no stored conversations".
  if (verb === "lose") {
    listRefused = true
    say("the conversation store is unreadable")
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "servers") {
    // The list, as one definite line: `servers: [olai kolu]`. A scenario about
    // what a session was GIVEN can then assert the whole answer rather than
    // the absence of a word, which is the only shape of that claim a streaming
    // panel can be asked for without waiting to see whether more arrives.
    say(`servers: [${servers.join(" ")}]`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "flood") {
    // Chunk by chunk into ONE entry, which is what an answer is: what has to
    // overflow the pane is a single growing paragraph, because a list that
    // grows by rows and an answer that grows by tokens are the two cases and
    // only the second one is hard.
    for (let line = 0; line < 40; line++) {
      say(`line ${line} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
    }
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "hold") {
    const toolCallId = `call-${++nextMcpId}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "a tool call you can watch",
        status: "in_progress",
        rawInput: { held: argument === "" ? "until released" : argument },
        locations: [{ path: "/served/house.olai", line: 12 }],
      },
    })
    // What a real call does while it runs: says something about itself. Sent
    // BEFORE the release, so a scenario can prove the panel drew it without
    // waiting for the call to finish — which is the whole difference between
    // progress and a result.
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "in_progress",
        content: [
          { type: "content", content: { type: "text", text: "halfway through" } },
        ],
      },
    })
    // AFTER the frame, so it is this paragraph that is left open: a tool call
    // closes the one before it, which is what makes the two states — a call
    // running and an answer growing — observable at the same moment.
    // Chunk after chunk for as long as the hold lasts, because ONE chunk only
    // proves a paragraph appeared. What a streaming panel has to do is grow the
    // paragraph that is already on screen, and that is a claim about the second
    // chunk and every one after it.
    say("working on it")
    await released(() => say("."))
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "completed",
        rawOutput: { released: true },
      },
    })
    say(" — and done.")
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "ask") {
    // Byte for byte the shape `askUserQuestionsToCreateRequest` builds for one
    // single-select question: the question as the message, a titled `oneOf`,
    // and the per-question "Other" box marked with the shared `_meta` key.
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      respond(id, { stopReason: "end_turn" })
      return
    }
    const answer = await request("elicitation/create", {
      mode: "form",
      sessionId,
      toolCallId: `call-${++nextMcpId}`,
      message: "Which cabinets should I order?",
      requestedSchema: {
        type: "object",
        properties: {
          question_0: {
            type: "string",
            title: "Cabinets",
            oneOf: [
              { const: "oak", title: "oak", description: "the ones in the drawing" },
              { const: "birch", title: "birch" },
            ],
          },
          question_0_custom: {
            type: "string",
            title: "Other",
            description: "Type your own answer instead of choosing an option above (optional).",
            _meta: {
              _askUserQuestionCustomAnswer: {
                questionId: "question_0",
                isCustomAnswer: true,
              },
            },
          },
        },
      },
    })
    if (endedCancelled(id)) return
    say(`you answered: ${JSON.stringify(answer)}`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "askstrict") {
    // The shape an MCP server asks in, rather than the one the CLI's own
    // AskUserQuestion produces: a REQUIRED field, and a typed one. Claude's
    // questions are all optional chips, so this is the only way to reach the
    // path where the panel's answer can be refused by the schema it was for.
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      respond(id, { stopReason: "end_turn" })
      return
    }
    const answer = await request("elicitation/create", {
      mode: "form",
      sessionId,
      message: "How many cabinets?",
      requestedSchema: {
        type: "object",
        required: ["howMany"],
        properties: {
          howMany: { type: "integer", title: "How many" },
          note: { type: "string", title: "Note" },
        },
      },
    })
    if (endedCancelled(id)) return
    say(`you answered: ${JSON.stringify(answer)}`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "nameless") {
    // A permission request for a tool nothing has named: no `_meta`, no
    // announcement to have learned the name from, and a title that is not an
    // MCP tool id. The client cannot tell what this is, and the whole point of
    // recognising OURS positively is that this asks rather than approves.
    const answer = await request("session/request_permission", {
      sessionId,
      toolCall: { toolCallId: `call-${++nextMcpId}`, title: "do something unnamed" },
      options: [
        { kind: "allow_once", name: "Allow Once", optionId: "allow" },
        { kind: "reject_once", name: "Deny", optionId: "reject" },
      ],
    })
    if (endedCancelled(id)) return
    const outcome = (answer as { outcome?: { outcome?: string; optionId?: string } })
      ?.outcome
    say(`permission: ${outcome?.optionId ?? outcome?.outcome ?? "nothing"}`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "plan" || verb === "permit") {
    // The two permission requests that matter, told apart ONLY by the tool
    // name the announcement carries: a plan exit is a person's to answer, and
    // an ops call is not. `permit` must never draw a form; `plan` must always
    // draw one, and must never come back `auto` unless somebody pressed it.
    const plan = verb === "plan"
    const toolCallId = `call-${++nextMcpId}`
    const toolName = plan ? "ExitPlanMode" : "mcp__olai__set_done"
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: plan ? "Ready to code?" : toolName,
        status: "pending",
        rawInput: {},
        _meta: { claudeCode: { toolName } },
      },
    })
    const answer = await request("session/request_permission", {
      sessionId,
      toolCall: { toolCallId, title: plan ? "Ready to code?" : toolName },
      options: plan
        // The adapter's own list for a plan exit, with `auto` FIRST and
        // allow-flavoured: that is the option a client answering by machine
        // used to pick, silently. (The real one is filtered against the
        // session's available modes and can lead with `bypassPermissions`;
        // what matters here is that the first entry is an allow.)
        ? [
          { kind: "allow_always", name: 'Yes, and use "auto" mode', optionId: "auto" },
          { kind: "allow_always", name: "Yes, and auto-accept edits", optionId: "acceptEdits" },
          { kind: "allow_once", name: "Yes, and manually approve edits", optionId: "default" },
          { kind: "reject_once", name: "No, keep planning", optionId: "plan" },
        ]
        : [
          { kind: "reject_once", name: "Deny", optionId: "reject" },
          { kind: "allow_once", name: "Allow Once", optionId: "allow" },
        ],
    })
    if (endedCancelled(id)) return
    const outcome = (answer as { outcome?: { outcome?: string; optionId?: string } })
      ?.outcome
    say(`permission: ${outcome?.optionId ?? outcome?.outcome ?? "nothing"}`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  // Handled INSIDE the wrapped CLI, which is why the picker never hears about
  // it — and why this changes nothing that is observable until the next turn
  // announces itself. The prose is all this turn has to say about it, exactly
  // as the real one's `<synthetic>` message is.
  if (verb === "model") {
    liveModel = argument
    say(`switched to ${argument}.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  // The picker SAYING ITSELF AGAIN, which the real adapter does whenever
  // anything in that set moves — a mode change, an effort change — because a
  // `config_option_update` carries the whole set rather than the entry that
  // changed. Its model row still names what the session started on, so this is
  // the frame that must not overwrite a `/model` the CLI has reported since.
  if (verb === "reconfig") {
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "config_option_update", configOptions: CONFIG_OPTIONS },
    })
    say("the session's options were re-announced.")
    respond(id, { stopReason: "end_turn" })
    return
  }

  // A DIRECT file edit — the thing an olai op is not. What a real adapter
  // sends for an `Edit` is a tool call carrying a `diff` content block: an
  // absolute path, the text that was there, and the text that is there now.
  // Nothing is written to the disk here, deliberately: what is under test is
  // the panel's reading of the protocol, and a scripted agent that also wrote
  // the file would be testing the store on the way past.
  //
  // The diff rides the ANNOUNCEMENT and the completion carries only a status,
  // which is the shape a real one has and the one that catches the merge rule:
  // a row that read a status-only report as "no diffs now" would drop the
  // change at the moment the call finished.
  if (verb === "edit") {
    const toolCallId = `call-${++nextMcpId}`
    const file = argument === "" ? "notes.md" : argument
    // Which TEXTS depends on the file, because what the panel has to do with
    // them depends on the file: an outline may never be drawn as lines, and a
    // rewrite past the comparison budget has to say that it is one.
    //
    // The suffix is SPELLED rather than asked of `@olai/format`'s `fileKind`,
    // which this package imports elsewhere. That is not an oversight: this is a
    // third party, and an agent on the far end of a pipe has no access to
    // olai's constants — deriving the fixture from the implementation under
    // test would make the scenario agree with the client by construction.
    const texts = file.endsWith(".olai")
      ? EDITED_OUTLINE
      : file === "huge.md"
      ? REWRITTEN
      : file === "long.md"
      ? LONG_EDITED
      : EDITED
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: `Edit ${file}`,
        status: "in_progress",
        rawInput: { file_path: `${cwd}/${file}` },
        _meta: { claudeCode: { toolName: "Edit" } },
        content: [
          {
            type: "diff",
            path: `${cwd}/${file}`,
            oldText: texts.before,
            newText: texts.after,
          },
        ],
      },
    })
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
    })
    say(`rewrote \`${file}\`.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  // A TURN WITH OTHER AGENTS IN IT. The adapter forwards a spawned agent's
  // tool calls on the same feed as the main agent's — there is no second
  // stream and no `sessionUpdate` of its own — and stamps each one with the
  // `Agent` call it came out of, in `_meta.claudeCode.parentToolUseId`
  // (`liveBackgroundTasks`, adapter 0.66.0). Everything a panel can know about
  // who did what is that one field, so this turn sends exactly what the real
  // one does and nothing more.
  //
  // TWO agents, INTERLEAVED, because one is the case that proves nothing: a
  // single subagent's calls arrive in a run under the frame that spawned it,
  // and a panel that simply indented every call it did not recognise would
  // pass. Two running at once is what people spawn agents FOR, and it is the
  // shape where a lane has to say whose it is.
  if (verb === "subagent") {
    /** One announcement. The frame is the SAME either way — that is the whole
     *  point of the scenario — so it is written once and the only thing the
     *  two callers differ by is the `_meta` a panel has to read to tell them
     *  apart. Spelled as two frames, the reader would have to diff them to
     *  find that. */
    const announce = (
      toolCallId: string,
      title: string,
      claudeCode: Record<string, string>,
    ): void => {
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title,
          status: "in_progress",
          rawInput: { description: title },
          _meta: { claudeCode },
        },
      })
    }
    const spawn = (id: string, title: string): void =>
      announce(id, title, { toolName: "Agent" })
    /** One call made INSIDE a spawned agent — the main agent's own frame, plus
     *  the one field that says whose it is. */
    const inside = (id: string, title: string, parent: string): void =>
      announce(id, title, { toolName: "Grep", parentToolUseId: parent })
    // MINTED, not spelled: a call id is unique to the call, and a transcript
    // is keyed by it — so a turn that reused last turn's ids would update last
    // turn's rows in place and draw nothing at all the second time it was
    // asked for. Which is a thing the panel does correctly and a scripted
    // agent can hide.
    const first = `agent-${++nextMcpId}`
    const second = `agent-${++nextMcpId}`
    const cabinets = `sub-${++nextMcpId}`
    const note = `sub-${++nextMcpId}`
    const worktops = `sub-${++nextMcpId}`
    spawn(first, "explore the outline")
    inside(cabinets, "grep for cabinets", first)
    spawn(second, "review the notes")
    inside(note, "read the note", second)
    // ... and back to the FIRST agent, under a row belonging to the second.
    // The one place a rail on its own cannot answer "whose is this".
    inside(worktops, "grep for worktops", first)
    // Status ONLY, with no `_meta` at all — the shape the adapter has for a
    // completion, and the one that catches a row which read the silence as
    // "no agent now" and stepped out of its lane the moment it finished.
    for (const call of [cabinets, note, worktops, first, second]) completed(call)
    say("both agents reported back.")
    respond(id, { stopReason: "end_turn" })
    return
  }

  // WHAT THE AGENT RECEIVED, asserted by the agent itself. A node armed on a
  // row reaches a prompt as one line naming its id (`@olai/chat`'s
  // `context.ts`), and the whole claim of that design is that the id is the
  // handle olai's own tools take — so this reads the line, calls `read_node`
  // with what it found, and says the TITLE that came back. A scenario that
  // sees the right title has proof the id crossed the wire and resolved: no
  // spelling of the prompt that lost it could produce that sentence.
  if (verb === "context") {
    const named = [...text.matchAll(/^Node in context: `([^`]+)`/gm)].map(
      (match) => match[1] ?? "",
    )
    if (named.length === 0) {
      say("no node in context.")
      respond(id, { stopReason: "end_turn" })
      return
    }
    for (const node of named) {
      const read = await useTool("read_node", { id: node })
      const found = read["structuredContent"] as { title?: string } | undefined
      // A SENTENCE the browser could not have written on its own — the chip on
      // the message carries the title too, so a scenario matching the bare
      // title would pass on a build that never put the node in the prompt at
      // all. (It did, until a sabotage run said so.)
      say(`\`${node}\` is the node titled ${found?.title ?? "?"}.\n`)
    }
    respond(id, { stopReason: "end_turn" })
    return
  }

  // An id in PROSE and nothing else — no tool call, no write. What is under
  // test is the panel's reading of a backtick, and the id a scenario wants to
  // see named is not always one a tool would accept (a placement is the case
  // this exists for: `set_done` refuses one, and an agent still writes them).
  if (verb === "name") {
    say(`look at \`${argument}\`.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "done") {
    await useTool("set_done", { id: argument })
    say(`marked \`${argument}\` done.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "add") {
    const outlines = await callMcp("tools/call", { name: "list_outlines", arguments: {} })
    const listed = (outlines["structuredContent"] as
      | { outlines?: ReadonlyArray<{ file: string }> }
      | undefined)?.outlines ?? []
    const file = listed[0]?.file
    await useTool("add_node", { file, title: argument })
    say(`added \`${argument}\`.`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "search") {
    const found = await useTool("search_nodes", { text: argument })
    say(`searched: ${JSON.stringify(found["structuredContent"])}`)
    respond(id, { stopReason: "end_turn" })
    return
  }

  // An attachment reaches an agent as a PATH in the prompt, and the whole
  // claim of that design is that the agent can then READ it. So this one does:
  // it opens the file the prompt named and says how big it is, which is a fact
  // it can only have got off the disk. A scripted agent cannot look at a
  // picture or parse a PDF, and it does not have to — what an e2e can prove is
  // that the bytes the browser sent are the bytes at the path the agent was
  // given, whatever kind of file they are.
  //
  // The label is `@olai/chat`'s (`promptWith`), and it says FILE because the
  // line carries text and PDFs as well as pictures.
  const attached = [...text.matchAll(/^Attached file: (.+)$/gm)].map((match) => match[1] ?? "")
  if (attached.length > 0) {
    for (const file of attached) {
      const bytes = existsSync(file) ? statSync(file).size : -1
      say(`read ${bytes} bytes from ${basename(file)}\n`)
    }
    respond(id, { stopReason: "end_turn" })
    return
  }

  say(`you said: ${text}`)
  respond(id, { stopReason: "end_turn" })
}

// ── the protocol ───────────────────────────────────────────────────────

const openSession = (params: Record<string, unknown>): void => {
  if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
  const given = (params["mcpServers"] ?? []) as ReadonlyArray<{
    type?: string
    name?: string
    url?: string
    headers?: ReadonlyArray<{ name: string; value: string }>
  }>
  servers = given.map((server) => server.name ?? "?")
  const http = given.find((server) => server.type === "http")
  mcp = http?.url === undefined ? null : {
    url: http.url,
    headers: Object.fromEntries(
      (http.headers ?? []).map((header) => [header.name, header.value]),
    ),
  }
}

/** Replay a stored conversation, the way a real `session/load` does: every
 *  message as an ordinary `session/update`, and only then the answer. */
const replay = (): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "what did we decide?" },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "we decided to order the cabinets." },
    },
  })
}

const handle = async (message: Record<string, unknown>): Promise<void> => {
  const id = message["id"]
  const method = message["method"]
  const params = (message["params"] ?? {}) as Record<string, unknown>

  switch (method) {
    case "initialize":
      capabilities = (params["clientCapabilities"] ?? {}) as Record<string, unknown>
      respond(id, {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: stored(),
          mcpCapabilities: { http: true },
          ...(stored() ? { sessionCapabilities: { list: {} } } : {}),
        },
        agentInfo: { name: "fake-acp-agent", version: "0.1.0" },
      })
      return

    case "session/list":
      if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
      // An agent that CANNOT say what it has stored — asked, and refusing.
      // Distinct from an agent with nothing stored, which answers an empty
      // list, and the whole point of the scenario that arms it: the two used
      // to reach the picker as the same thing.
      if (listRefused) {
        refuse(id, -32000, "the conversation store is unreadable")
        return
      }
      respond(id, { sessions: stored() ? storedSessions() : [] })
      return

    case "session/new":
      openSession(params)
      sessionId = "fake-session-1"
      // A fresh conversation is on whatever the picker says it is picking.
      liveModel = "fake-model-1"
      // ... and has spent nothing in a window of its own.
      used = 0
      size = 200_000
      respond(id, { sessionId, configOptions: CONFIG_OPTIONS })
      // NO `init` here, and that is the adapter's own shape: it forwards one
      // per PROMPT, so between opening a session and sending the first one the
      // picker is the only thing that has said which model this is. A client
      // that needed the CLI to speak before it could name a model would draw a
      // nameless header for exactly that long.
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "available_commands_update", availableCommands: COMMANDS },
      })
      return

    case "session/load":
      openSession(params)
      sessionId = String(params["sessionId"] ?? sessionId)
      replay()
      liveModel = "fake-model-1"
      // A different conversation is a different context. The client empties
      // what it was showing when the session goes, so nothing is drawn about
      // this one until its first turn reports.
      used = 0
      size = 200_000
      respond(id, { configOptions: CONFIG_OPTIONS })
      notify("session/update", {
        sessionId,
        update: { sessionUpdate: "available_commands_update", availableCommands: COMMANDS },
      })
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "session_info_update",
          title: STORED_TITLES[sessionId] ?? "a loaded conversation",
        },
      })
      return

    case "session/set_mode":
      respond(id, {})
      return

    case "session/prompt": {
      const blocks = (params["prompt"] ?? []) as ReadonlyArray<
        { type?: string; text?: string }
      >
      const text = blocks.map((block) => block.text ?? "").join("")
      await runTurn(id, text)
      return
    }

    case "session/cancel":
      cancelled = true
      withdrawRequests()
      return

    default:
      if (id !== undefined && id !== null) {
        refuse(id, -32601, `no such method: ${String(method)}`)
      }
  }
}

// ── stdin, line by line ────────────────────────────────────────────────

/** One turn at a time, in the order they arrived — but the READ loop keeps
 *  going, which is what lets a cancel arrive during a prompt. */
let queue: Promise<void> = Promise.resolve()

readMessages(
  process.stdin,
  (message) => {
    // A cancel must be seen NOW, not behind the turn it is cancelling.
    if (message["method"] === "session/cancel") {
      cancelled = true
      withdrawRequests()
      return
    }
    // An answer to something WE asked. It cannot go through the queue: the turn
    // that asked is sitting in it, waiting for exactly this.
    if (message["method"] === undefined) {
      const id = String(message["id"])
      const answering_ = answering.get(id)
      if (answering_ === undefined) {
        noise(`fake agent: an answer to nothing: ${id}`)
        return
      }
      answering.delete(id)
      answering_(message["error"] ?? message["result"])
      return
    }
    queue = queue.then(() => handle(message)).catch((cause: unknown) => {
      noise(`fake agent: ${String(cause)}`)
    })
  },
  (line) => noise(`fake agent: not JSON: ${line}`),
)

// Our client hung up, so there is nobody left to answer — except when WE shut
// the pipe deliberately (`deaf`), where staying alive and streaming is the
// whole point of the scenario.
process.stdin.on("end", () => {
  if (!deaf) process.exit(0)
})
