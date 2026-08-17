#!/usr/bin/env bun
/**
 * A scripted ACP agent, for driving the chat loop without a language model.
 *
 * It speaks just enough of the protocol to be indistinguishable from a real
 * agent as far as `packages/server/src/chat/agent.ts` is concerned:
 * line-delimited JSON-RPC on stdio, `initialize` / `session/new` /
 * `session/list` / `session/load` / `session/set_mode` /
 * `session/set_config_option` / `session/prompt`,
 * `_session/steering`, `session/cancel` as a notification, and `session/update`
 * notifications on the way.
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
 *   hunks [file] the same edit landing in THREE PLACES — the announcement's one
 *                optimistic block, then the PostToolUse report the real
 *                adapter builds out of `structuredPatch`: one `diff` block per
 *                hunk, every one of them under the same path
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
 *   subagent slow  spawn ONE and have it do nothing until released, which is
 *                what a fan-out looks like for as long as anybody watches it:
 *                the spawn's own frame is on the wire and not one frame from
 *                the agent is
 *   refuse steering   turn `_session/steering` into an error from here on, so
 *                a scenario can see what a panel does with words it could not
 *                deliver
 *   slow steering  make `_session/steering` answer two seconds late from here
 *                on, so a cancel can overtake a steer already in flight
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

import { existsSync, readFileSync, rmSync, statSync } from "node:fs"
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
/** Whether a turn is in flight right now. The one flag `_session/steering`
 *  reads, and the reason it is a flag rather than a look at the queue: a steer
 *  is answered from the READ LOOP, while the turn it is about is still sitting
 *  in `handle`. */
let running = false
/** What has been steered into the turn in flight and not yet acted on, in the
 *  order it arrived. Drained by the turn itself ({@link takeSteering}) — which
 *  is the whole difference a scenario can see between a message that steered a
 *  turn and one that waited for it. */
const steered: Array<string> = []
/** Whether `_session/steering` refuses from here on (`refuse steering`). An
 *  agent that is alive, listening, and cannot be told anything more until its
 *  turn is over — which is the one case where a person's words have nowhere to
 *  go but back on the screen. */
let steerRefused = false
/**
 * How long `_session/steering` sits on a steer before answering (`slow
 * steering`). Zero answers off the read loop, which is what every other
 * scenario wants and what a real adapter does.
 *
 * A delay is the only way to stage the ORDERING a client can get wrong: a
 * person sends mid-turn and then cancels, and the steer answers after the turn
 * it was aimed at is gone. Long enough that the cancel always wins — the
 * scenario presses one button after the other, which is hundreds of
 * milliseconds — and it is the only direction that can flake, since a steer
 * that answered too EARLY would simply be injected and the scenario would say
 * so.
 */
let steerDelayMs = 0
const SLOW_STEER_MS = 2_000
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
 *
 * WHAT THE PICKER IS PICKING is a variable rather than a constant, because a
 * client may SET it (`session/set_config_option`) and because a boot resets it:
 * `fake-model-1` is this agent's `settings.json` pin, asserted over whatever the
 * last turn ran, on `session/new` and `session/load` alike. That is the shape
 * the real adapter has (0.66.0: env, then settings, then the resumed
 * transcript — and the first two are re-asserted over the third on resume), and
 * it is the whole of what makes `chat-model-reverts-on-restart` reproducible
 * here.
 */
const MODEL_ROWS = [
  { value: "fake-model-1", name: "Fake One" },
  { value: "fake-model-2", name: "Fake Two" },
  { value: "sonnet", name: "Fake Sonnet" },
  { value: "haiku", name: "Fake Haiku" },
  { value: "opus[1m]", name: "Fake Opus (1M context)" },
]

/**
 * THE PIN this agent boots on — its `settings.json`, in effect.
 *
 * A dot-file in the served directory, read at every session open, like
 * {@link forgotten} and for the same reason: a scenario has to be able to move
 * it BETWEEN boots, which is exactly what a redeployed container does when
 * somebody edits its settings. Absent, it is `fake-model-1`, which is what
 * every scenario that never touches it sees.
 */
const pinnedModel = (): string => {
  try {
    return readFileSync(`${cwd}/.agent-pin`, "utf8").trim() || "fake-model-1"
  } catch {
    return "fake-model-1"
  }
}

let currentModel = "fake-model-1"

const configOptions = () => [
  { id: "model", name: "Model", type: "select", currentValue: currentModel, options: MODEL_ROWS },
]

/** Every value the picker offers, for the one caller that has to refuse
 *  anything else. DELIBERATELY STRICT: the real adapter would also resolve an
 *  alias or a live API id onto one of these rows (`resolveModelPreference`), so
 *  a client that asked in a vocabulary the picker never offered would pass
 *  against it and fail against an agent that simply reads its own list. What is
 *  under test is that olai asks for a ROW. */
const OFFERED = new Set(MODEL_ROWS.map((row) => row.value))

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
 * ONE FILE, SEVERAL HUNKS — and the reason this fixture is a LIST where {@link
 * EDITED} is a pair.
 *
 * An `Edit` is reported TWICE by the adapter, and the two reports are not the
 * same shape. The announcement carries the optimistic block built from the
 * tool's own arguments: one `diff`, `old_string` against `new_string`. Then the
 * PostToolUse hook fires with the tool's real answer, and that one is built by
 * walking `structuredPatch` — **one `diff` block per hunk, every one of them
 * carrying the same `path`** (`toolUpdateFromDiffToolResponse`, adapter
 * 0.66.0). So an edit that landed in three places arrives as three blocks under
 * one name, and a panel that treats a path as a block's identity has three rows
 * claiming to be the same row.
 *
 * THREE of them, and the number is load-bearing rather than generous. Two rows
 * sharing a name is a row silently DROPPED — the panel draws the last of them
 * and says nothing about the rest, which is a lie a reader cannot see. Three is
 * where the framework's own list reconciliation runs off the end of the array
 * it is patching and throws, which is the crash this fixture exists for. A
 * fixture with two would have asserted the smaller half of one bug and left the
 * page-breaking half uncovered.
 *
 * The hunks are the three the {@link EDITED} rewrite is made of, each carrying
 * its own WINDOW of the file rather than only the lines that moved — which is
 * what the helper produces. It walks the hunk's lines and sorts them by their
 * marker: a `-` line goes to `oldText`, a `+` line to `newText`, and a CONTEXT
 * line — neither — is pushed to BOTH. So a block's two sides are that hunk
 * whole, the unchanged rows around the change included and identical on each
 * side. The second hunk here is the one that shows it: the tiles line is on
 * both sides, and the lights line is added under it.
 */
const EDITED_HUNKS = [
  {
    before: [
      "- oak doors, twelve of them, ordered on the second",
      "- a worktop nobody has chosen yet",
    ].join("\n"),
    after: [
      "- oak doors, twelve of them, delivered on the ninth",
      "- a walnut worktop, ordered on the tenth",
    ].join("\n"),
  },
  {
    before: "- the tiles are somebody else's problem",
    after: [
      "- the tiles are somebody else's problem",
      "- the lights arrive with the worktop",
    ].join("\n"),
  },
  {
    before: "Nothing here is decided until the worktop is.",
    after: [
      "The worktop settles it: everything else can be booked in now.",
      "",
      "_Rewritten while you watched._",
    ].join("\n"),
  },
]

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
    // FIRST, before the release is even looked for, because that is the claim
    // under test: a message steered into a turn is acted on by the turn that
    // is still running, not by the one after it.
    await takeSteering()
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
 * Act on what was steered in, INSIDE the turn that is still running.
 *
 * A DELIBERATE SUBSET of what a prompt can ask for: a steered message is
 * followed as an instruction, not run as a whole turn — there is no second
 * `stopReason` to send and nothing here may hold, or a steer could wedge the
 * turn it was steering. `done` is spelled out because it is the one a scenario
 * can see from the outside (the checkbox moves while the agent is still
 * working); everything else is answered in prose, which is enough to prove the
 * words arrived.
 */
const takeSteering = async (): Promise<void> => {
  // `splice(0)` takes the whole list and leaves it empty, so nothing steered
  // WHILE this is awaiting a tool call is lost or double-run — and there is no
  // unreachable `?? ""` standing in for a `shift` the loop guard already made
  // impossible.
  for (const text of steered.splice(0)) {
    const [verb, ...rest] = text.trim().split(/\s+/)
    const argument = rest.join(" ")
    if (verb === "done") {
      await useTool("set_done", { id: argument })
      say(` — steered mid-turn: marked \`${argument}\` done.`)
      continue
    }
    say(` — steered mid-turn: ${text}`)
  }
}

/**
 * The message the Claude Code adapter forwards from the CLI it wraps.
 *
 * It is what a real `/model` produces and the config option does NOT: the CLI
 * handles that command itself, so the picker goes on reporting what the session
 * started on. Reproducing that here is the only way an e2e can tell a header
 * that follows the running model from one that follows the picker.
 */
/** Whether the client asked for those messages, per session — see
 *  {@link openSession}. */
let forwardsInit = false

const sdkInit = (model: string): void => {
  if (!forwardsInit) return
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

  // BEFORE the bare `slow` below, which would otherwise swallow it. From here
  // on a steer takes {@link SLOW_STEER_MS} to answer, which is how a scenario
  // gets a cancel onto the wire ahead of a steer that is already in flight.
  if (verb === "slow" && argument === "steering") {
    steerDelayMs = SLOW_STEER_MS
    say("steering will answer slowly from here on.")
    respond(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "slow") {
    say("thinking")
    for (let tick = 0; tick < 200 && !cancelled; tick++) {
      await takeSteering()
      await sleep(50)
    }
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

  // From now on there is no way to reach the turn in flight. The words a
  // person types during one have nowhere to go, and the panel owes them the
  // row rather than a queue.
  if (verb === "refuse" && argument === "steering") {
    steerRefused = true
    say("steering refused from here on.")
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
      update: { sessionUpdate: "config_option_update", configOptions: configOptions() },
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

  // THE SAME EDIT, LANDING IN TWO PLACES — and the whole of what makes it a
  // different scenario is the SECOND report.
  //
  // A real `Edit` is reported twice and the two reports are built by two
  // different functions. The announcement is optimistic: one `diff` block, the
  // tool's own `old_string` against its `new_string`. Then the adapter's
  // PostToolUse hook fires with the tool's real answer and walks
  // `structuredPatch`, pushing one block PER HUNK — every one of them carrying
  // the same `path` (`toolUpdateFromDiffToolResponse`, adapter 0.66.0). An edit
  // with `replace_all`, or one that simply touches several parts of a file, is
  // shape, and it is the commonest shape a coding agent produces.
  //
  // So this turn sends exactly those three frames and nothing else. The path
  // repeating is not decoration: it is the fact under test.
  if (verb === "hunks") {
    const toolCallId = `call-${++nextMcpId}`
    const file = argument === "" ? "notes.md" : argument
    const path = `${cwd}/${file}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: `Edit ${file}`,
        status: "in_progress",
        rawInput: { file_path: path },
        _meta: { claudeCode: { toolName: "Edit" } },
        content: [
          {
            type: "diff",
            path,
            oldText: EDITED_HUNKS[0]?.before,
            newText: EDITED_HUNKS[0]?.after,
          },
        ],
      },
    })
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        _meta: { claudeCode: { toolName: "Edit" } },
        content: EDITED_HUNKS.map((hunk) => ({
          type: "diff",
          path,
          oldText: hunk.before,
          newText: hunk.after,
        })),
        locations: EDITED_HUNKS.map(() => ({ path })),
      },
    })
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed" },
    })
    // COUNTED off the fixture rather than written out, because the number is
    // the thing this verb is about: a sentence saying two while three blocks
    // went out is the scenario contradicting itself in the one place a reader
    // looks to see what happened.
    say(`rewrote \`${file}\` in ${EDITED_HUNKS.length} places.`)
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
      claudeCode: Record<string, unknown>,
      // NAMED rather than two more positional tails: a spawn differs from a
      // call made inside one by its arguments and its status, and a call site
      // reading `announce(id, title, meta, {…}, "pending")` says neither of
      // those out loud.
      differs: {
        readonly rawInput?: Record<string, unknown>
        readonly status?: string
      } = {},
    ): void => {
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          title,
          status: differs.status ?? "in_progress",
          rawInput: differs.rawInput ?? { description: title },
          _meta: { claudeCode },
        },
      })
    }
    /** A SPAWN, as the adapter builds one. `subagent: true` rides beside the
     *  tool name on every frame it makes for an `Agent`/`Task` call
     *  (`claudeCodeMetaFromToolUse`, 0.66.0) and is the only thing on the wire
     *  that says an agent was sent out BEFORE the agent has done anything —
     *  the parent stamp below cannot be sent until it has. The arguments are
     *  the `Agent` tool's own (`AgentInput`): a short description, the prompt,
     *  and the optional kind of agent.
     *
     *  `pending` rather than in_progress, which is what the adapter announces
     *  a tool use with — a spawn wears it until the first heartbeat, which for
     *  a slow one is a long time and exactly the stretch under test. */
    const spawn = (id: string, title: string, kind?: string): void =>
      announce(id, title, { toolName: "Agent", subagent: true }, {
        rawInput: {
          description: title,
          prompt: `${title}, and report back`,
          ...(kind === undefined ? {} : { subagent_type: kind }),
        },
        status: "pending",
      })
    /** One call made INSIDE a spawned agent — the main agent's own frame, plus
     *  the one field that says whose it is. */
    const inside = (id: string, title: string, parent: string): void =>
      announce(id, title, { toolName: "Grep", parentToolUseId: parent })

    // ONE AGENT, SENT OUT AND SLOW. The case the lanes above cannot show: a
    // fan-out is watched during the stretch BEFORE anybody reports, and until
    // the spawn itself was drawn that stretch was a pending dot with an
    // ordinary title on it. So this one spawns and then does nothing at all
    // until the scenario releases it — no beat, no call, no prose — which is
    // the honest worst case, since a real subagent's first act is to read its
    // instructions and that produces no frame.
    if (argument === "slow") {
      const alone = `agent-${++nextMcpId}`
      const read = `sub-${++nextMcpId}`
      spawn(alone, "read every note", "Explore")
      say("sent an agent out.")
      await released()
      inside(read, "read the note", alone)
      completed(read)
      // The spawn's own completion, carrying the subagent's report the way the
      // adapter does — content blocks on the call, never prose in the main
      // agent's voice. It is what the face RESOLVES INTO.
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: alone,
          status: "completed",
          content: [
            {
              type: "content",
              content: { type: "text", text: "there are three notes." },
            },
          ],
        },
      })
      say(" the agent reported back.")
      respond(id, { stopReason: "end_turn" })
      return
    }

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
    spawn(first, "explore the outline", "Explore")
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
  // WHETHER THE CLI'S OWN MESSAGES ARE FORWARDED, off the `_meta` of the call
  // that made this session — `session/new` and `session/load` alike, which is
  // where the real adapter reads it (`loadSession` hands its own `_meta` to
  // `createSession`, defaulting the flag to false). Honoured rather than assumed
  // because assuming it hid a real gap: a client that asked only at
  // `session/new` heard nothing about the running model for the whole life of
  // every RESTORED conversation, and every scenario here still passed.
  forwardsInit = Array.isArray(
    ((params["_meta"] as { claudeCode?: { emitRawSDKMessages?: unknown } } | undefined)
      ?.claudeCode?.emitRawSDKMessages),
  )
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

/** The steering extension's method name, as the real adapter spells it. */
const STEER_METHOD = "_session/steering"

/** The words out of a `prompt` array, which the two lanes that take one — a
 *  turn and a steer — must read IDENTICALLY. Written twice, it was the cast
 *  that would have drifted: a lane taught to filter on `type === "text"` or to
 *  read an image block while the other was not would pass every scenario while
 *  quietly dropping content on one side. */
const promptTextOf = (params: Record<string, unknown>): string =>
  ((params["prompt"] ?? []) as ReadonlyArray<{ text?: string }>)
    .map((block) => block.text ?? "")
    .join("")

/**
 * A message put INTO the turn that is running, answered from the read loop.
 *
 * Three answers, and the client has to tell them apart:
 *
 *   - a turn is running → the message joins it (`injected`) and the turn acts
 *     on it before it ends ({@link takeSteering});
 *   - nothing is running → `promptRequired`, which hands the message BACK
 *     rather than starting a turn nobody asked for. The client only steers
 *     while it believes a turn is running, so this is the race — and a client
 *     that took it as delivered would lose the message;
 *   - `refuse steering` was asked for → a JSON-RPC error, which is an agent
 *     that cannot be reached mid-turn at all.
 */
const steerTurn = (id: unknown, params: Record<string, unknown>): void => {
  // WHETHER A TURN IS RUNNING IS READ WHEN THE ANSWER IS SENT, not when the
  // request arrives, and with `slow steering` armed those are different
  // moments. That is the whole of what the delay buys: a cancel can overtake a
  // steer on the wire, and the answer that comes back — "nothing to steer" —
  // is then about a turn a PERSON stopped rather than one that finished.
  const answer = (): void => {
    if (steerRefused) {
      refuse(id, -32000, "this turn cannot be steered")
      return
    }
    if (!running) {
      respond(id, { outcome: "promptRequired", reason: "noRunningTurn" })
      return
    }
    steered.push(promptTextOf(params))
    respond(id, { outcome: "injected" })
  }
  if (steerDelayMs === 0) {
    answer()
    return
  }
  setTimeout(answer, steerDelayMs)
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
        // No steering advertisement, and its absence is a claim: the real
        // adapter does advertise one (top-level `_meta`), and the client
        // deliberately does not read it — a steer that goes out to an agent
        // that never said it could steer is answered by the REQUEST, which is
        // the only thing that can actually prove it. This file steers fine
        // without saying so, which is that arrangement under test.
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
      // A fresh conversation is on whatever the picker says it is picking, and
      // what it is picking is the pin.
      currentModel = pinnedModel()
      liveModel = currentModel
      // ... and has spent nothing in a window of its own.
      used = 0
      size = 200_000
      respond(id, { sessionId, configOptions: configOptions() })
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
      // THE PIN, ASSERTED OVER THE CONVERSATION'S OWN MODEL — which is the bug
      // `chat-model-reverts-on-restart` is about, and what the real adapter
      // does on every resume when `settings.json` names a model. Whatever this
      // conversation was switched to is gone unless somebody says otherwise.
      currentModel = pinnedModel()
      liveModel = currentModel
      // A different conversation is a different context. The client empties
      // what it was showing when the session goes, so nothing is drawn about
      // this one until its first turn reports.
      used = 0
      size = 200_000
      respond(id, { configOptions: configOptions() })
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

    // A client SETTING what the picker picks — the one verb the panel has for
    // saying which model a conversation should be on, and the way it puts a
    // restored one back on the model it was switched to. The answer carries the
    // whole set with its new current value, as the protocol says it must; the
    // CLI moves with it, so the next turn's `init` announces the new model and
    // a client that never sent this hears the pin instead.
    case "session/set_config_option": {
      const value = params["value"]
      if (params["configId"] !== "model" || typeof value !== "string") {
        refuse(id, -32602, `no such config option: ${String(params["configId"])}`)
        return
      }
      if (!OFFERED.has(value)) {
        refuse(id, -32602, `Invalid value for config option model: ${value}`)
        return
      }
      currentModel = value
      liveModel = value
      respond(id, { configOptions: configOptions() })
      return
    }

    case "session/prompt": {
      const text = promptTextOf(params)
      // The flag the steer handler reads, and it must come off however the
      // turn ends — a crash of a turn that left it set would make every later
      // steer claim to have been injected into nothing.
      running = true
      try {
        await runTurn(id, text)
      } finally {
        running = false
        // Anything steered into a turn that never paused to look goes with
        // that turn. The instant verbs here are over before a steer can land,
        // and carrying one into the NEXT turn would be this file keeping the
        // very queue its client just stopped keeping.
        steered.length = 0
      }
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
    // ... and so must a steer, for the same reason and more so: the whole
    // point of it is to reach the turn that is running, and a steer that
    // waited in the queue behind that turn would BE the queue this file's
    // client just stopped keeping. Answered here, off the read loop, while
    // `handle` is still sitting inside `runTurn`.
    if (message["method"] === STEER_METHOD) {
      steerTurn(message["id"], (message["params"] ?? {}) as Record<string, unknown>)
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
