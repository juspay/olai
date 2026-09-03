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
 *   links        write two LINKS in prose — a relative `.md` path and an
 *                address of this app — which is what an agent asked about a
 *                vault does unprompted, and what used to reload the whole app
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
 *   attach <name> <status>  say what the wrapped CLI reports about its
 *                connection to that server from the NEXT turn on — the
 *                `mcp_servers` status of the adapter's `init`, which is one
 *                turn late for the reason `model` is
 *   slow         dawdle, long enough to cancel
 *   deaf         go quiet with our stdin closed, so nothing said back arrives
 *   talkative    keep streaming through a cancel, the way a slow one does
 *   picture      answer with an `image` block, which the panel cannot draw
 *   lose         refuse every `session/list` from here on
 *   flood        say more than fits, so scrolling is a thing that can be tested
 *   stream [slow]  a five-paragraph answer, five characters a chunk — a real
 *                model's shape, for measuring what streaming one costs the
 *                wire. `slow` paces the chunks the way a model does, which is
 *                what makes the FRAME count mean something
 *   hold         start a tool call and STOP there, until released
 *   abandon      announce a tool call, never report on it, and END THE TURN
 *                anyway — alive and idle afterwards, which `crash` is not. It
 *                is what a turn that gave up on a call leaves behind: a row the
 *                wire still calls `in_progress`, forever, in a conversation
 *                somebody can go on talking to
 *   watch        ARM A BACKGROUND TASK the way the patched adapter reports one:
 *                a call that goes `in_progress` and stays there past the end of
 *                the turn, carrying the harness's own task on its `_meta`. Its
 *                DEATH — the two bookends, and the sentence the exit code
 *                arrives in — lands when a scenario releases it, which is the
 *                whole point: by then the turn that armed it is long over
 *   twice        report one tool call with the SAME frame sent twice, byte for
 *                byte — the announcement and the completion each repeated
 *   error        answer `session/prompt` with a JSON-RPC error instead of a
 *                stop reason, and STAY ALIVE — one turn that failed, in a
 *                conversation that is still there
 *   subagent     spawn TWO agents and interleave their tool calls with each
 *                other's, each frame stamped with the `Agent` call it came out
 *                of — the whole of what the adapter says about who did what
 *   subagent slow  spawn ONE and have it do nothing until released, which is
 *                what a fan-out looks like for as long as anybody watches it:
 *                the spawn's own frame is on the wire and not one frame from
 *                the agent is
 *   subagent again  RESUME the agent the last subagent turn spawned: the
 *                harness starts that agent's task a second time, so the
 *                adapter reopens the call that SPAWNED it and the same row
 *                runs, calls and reports again — one agent, one row, one door,
 *                two outings
 *   subagent notify  spawn ONE async agent, end the turn, and on release
 *                inject a `<task-notification>` user chunk the way the
 *                harness does — the leftover door, for a forwarded chunk
 *                the patched pin never actually sends
 *   subagent report  the same spawn, but the report arrives the way the
 *                SHIPPED pin files it: a `tool_call_update` carrying
 *                `_meta.claudeCode.backgroundTask.report`, no user chunk
 *   subagent crash  the same, and then FALL OVER while it is still out —
 *                which leaves a `pending` Agent call nothing will ever
 *                complete, on rows a dead agent's panel deliberately keeps
 *   refuse busy  refuse every `session/prompt` that arrives while a turn is
 *                RUNNING, from here on — an agent with no queue at all, which
 *                is neither of the two olai ships against and is the shape an
 *                older adapter has
 *   refuse steering   turn `_session/steering` into an error from here on, so
 *                a scenario can see what a panel does with words it could not
 *                deliver
 *   swallow steering  take every `_session/steering` and NEVER ANSWER it, so
 *                a scenario can see the other face: an agent that went quiet
 *                with a person's words on the wire, where nothing here can say
 *                whether they landed
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
 *   ask later    the same, HELD until released — so a scenario can look away
 *                before the question lands, which is what the chat panel's
 *                attention alerts are about
 *   askstrict    ask one with a REQUIRED, typed field, the way an MCP server does
 *   plan         ask to leave plan mode, the way the adapter does
 *   permit       ask permission for an ops tool, which needs no person
 *   nameless     ask permission for a tool nothing has named
 *   subagent asks     a SPAWNED agent asks permission mid-run — the request
 *                itself stamped with the `Agent` call it came out of
 *   subagent elicits  the same, as an `AskUserQuestion` elicitation, which
 *                names the tool call it was asked from and nothing else
 *   external <server> <tool> <json-args>   call a tool on an ATTACHED stdio
 *                MCP server — one of the `mcpServers` the client handed
 *                `session/new`, spawned on first use — with the frames a real
 *                call's turn would wear, the result's first text block said
 *                back in prose. It is how a scenario gets a workbench agent to
 *                USE one of olai's probed tools rather than merely log that
 *                the server arrived
 *   crash        exit mid-turn, having SPOKEN first
 *   vanish       exit mid-turn having said NOTHING AT ALL — not even the
 *                usage frames every other turn opens with, so the client has
 *                no evidence the prompt was ever read. The other side of
 *                `crash`, and the pair is what pins which of the two may put a
 *                mark on the message that started the turn
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
 * A LOAD THAT DAWDLES is `.agent-hold-load`, released by the same
 * `.agent-release` a held turn waits on: `session/load` sits on the wire until
 * a scenario says when, which is the only stretch in which a client is between
 * conversations and a second open can be started against the first.
 *
 * REFUSING TO OPEN A CONVERSATION is a dot-file per verb
 * (`.agent-refuse-new`, `.agent-refuse-load`), for the same reason stored
 * sessions are an environment variable: it is a property of the machine rather
 * than of anything the client says, and one of the two paths that opens a
 * conversation is a SERVER STARTING, which no prompt can reach. The agent stays
 * up, answers `session/list`, and says no to the one verb — which is a live
 * agent with no conversation, and not a dead one.
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
 * A conversation MINTED THIS RUN, on the other hand, is runtime state of this
 * process, exactly as a real agent's transcript file is a fact its disk picked
 * up while it was running: once a session opened here has CARRIED A TURN,
 * `session/list` names it ({@link minted}) — the handshake always advertised
 * the list capability for that reason, and a fresh vault is a vault whose list
 * is EMPTY, not one whose agent cannot say so. What a minted row carries is
 * what a turn cost it: its title is the first prompt's words and its stamp is
 * the last prompt's moment. The static pair is never re-read this way — a
 * row `OLAI_FAKE_ACP_STORED` put down keeps its pinned words and stamps, so
 * the scenarios that assert them see one answer from the two shapes.
 *
 * Dumb and deterministic on purpose. This is test infrastructure, not a
 * simulator.
 *
 * It lives in `agent/` rather than in `support/` because Cucumber imports
 * everything under `support/` as part of the world, and importing this reads
 * stdin — which, in the runner's own process, ends immediately and takes the
 * run down with it. A directory of its own is what makes that unrepresentable.
 */

import { spawn } from "node:child_process"
import { appendFileSync, existsSync, readFileSync, rmSync, statSync } from "node:fs"
import { basename, join } from "node:path"

import { readMessages } from "../support/ndjson.ts"
import { emitter, MARKER, RELEASE, released as releasedIn, speaking } from "../support/scripted.ts"

const OUT = process.stdout

/** The wire, and what an agent puts on it — the transport this file shares with
 *  the other scripted agent ({@link ../support/scripted.ts}). What is NOT
 *  shared is anything either of them MEANS: the frames, the `_meta`, the call
 *  ids and the option order are this file's own, which is the whole reason two
 *  fakes are worth having. */
const emit = emitter(OUT)
const { notify, refuse, request, respond, take, withdraw } = speaking(emit, "agent")

/**
 * Prompts this agent has READ and not yet started on — its queue, made
 * askable.
 *
 * The queue itself is the promise chain at the bottom of this file, which has
 * held mid-turn prompts behind the running turn since before anything asked it
 * to. What this adds is the one question a cancel has to ask of it.
 */
/** WHAT AN `Agent` CALL IS TITLED, which is the tool's name and never the
 *  description it was sent with. The adapter's own behaviour, modelled here
 *  because a fixture that titled a spawn by its description made four surfaces
 *  that read the title look right in this suite and be wrong in front of a
 *  person — see `spawn` below. */
const SPAWN_TITLE = "Task"

const waiting = new Set<unknown>()

/**
 * ... and the ones a CANCEL answered while they were still waiting.
 *
 * THE PINNED ADAPTER'S OWN SHAPE, and worth reproducing because a client is
 * entitled to be surprised by it: `session/cancel` settles every queued turn
 * `cancelled` immediately — and the words run anyway, because they were pushed
 * onto the model's input when they arrived (verified against 0.66.0,
 * 2026-08-24). So one press of cancel produces a `cancelled` per turn in
 * flight, in whichever order they come back, and the panel has to say one thing
 * about it.
 */
const settledEarly = new Set<unknown>()

/** An answer to something the client asked — {@link respond} with the one thing
 *  a queue makes possible on top: a turn already answered while it waited is
 *  answered ONCE, and goes on to run its words with nothing left to say on the
 *  wire. */
const reply = (id: unknown, result: unknown): void => {
  if (settledEarly.delete(id)) return
  respond(id, result)
}

/**
 * Take back every question still on the wire, the way a real agent does when
 * its turn is cancelled: `$/cancel_request` per outstanding id, which aborts
 * the client's handler.
 *
 * The promises are resolved by the registry rather than waited on, because a
 * cancelled request gets no response — that is the point of cancelling it — so
 * an agent that went on awaiting them would hang on a turn it had just
 * abandoned. WHICH notification says so is this adapter's own, which is why the
 * loop is here and the bookkeeping is not.
 */
const withdrawRequests = (): void => {
  for (const id of withdraw()) {
    notify("$/cancel_request", { requestId: id })
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
 *  somebody else's programs on the host, which this file spawns only when a
 *  turn asks for it ({@link externalOf} and its verb, `external <server>
 *  <tool> <json-args>`) — reporting that they arrived is otherwise the whole
 *  of what a scenario about them can ask. */
let servers: ReadonlyArray<string> = []
/** What the wrapped CLI says about its connection to each of them, by name —
 *  the `mcp_servers` status the real adapter forwards on its `init`. Every
 *  server a session is handed is `connected` unless a scenario says otherwise
 *  (`attach <name> <status>`), because that is what a working host does and
 *  what every scenario that is not about this wants. */
const attachment = new Map<string, string>()
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
 * Whether a `session/prompt` arriving while a turn RUNS is refused outright
 * (`refuse busy`).
 *
 * The world's third leg, and the only one this file does not otherwise have:
 * both agents olai ships against hold a mid-turn prompt and answer it in
 * order, so an agent that says NO to one — an older adapter, one that never
 * grew a queue — was a case reasoned about rather than driven. Refused rather
 * than swallowed because a refusal is the shape a panel can be right or wrong
 * about: the row keeps the words, wears *not sent*, and offers to send them
 * again, which is what a scenario can hold this end to.
 */
let busyRefused = false
/**
 * Whether `_session/steering` is taken and never answered from here on
 * (`swallow steering`).
 *
 * The other half of {@link steerRefused}, and the DIFFERENT thing entirely: a
 * refusal is an answer, and this is the absence of one. The turn goes on
 * normally — this agent is alive, reading, and streaming — which is what makes
 * it the honest shape of the case a client can only meet with a deadline. It
 * is not `deaf`: that one destroys its own stdin and stops taking anything at
 * all, so the cancel it exists for is unreachable too.
 */
let steerSwallowed = false
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

/**
 * THE CONVERSATIONS THIS PROCESS HAS SEEN CARRY A TURN, by id — the live half
 * of `session/list`: what a real agent's transcript files say about
 * conversations STARTED after it woke up, which the environment variable
 * above can never say because it was read once, at spawn.
 *
 * A turn accepted is the mark — not the open: a fresh session nobody has
 * spoken into has no transcript, so listing it would be claiming a
 * conversation that is nowhere. Whose it is is `sessionId` at the moment of
 * the prompt: the same rule the static pair reads `cwd` by — the session a
 * turn is IN is the one it lands on.
 */
interface Minted {
  readonly title: string | null
  readonly updatedAt: string
  readonly messageCount: number
}
const minted = new Map<string, Minted>()

/** The list, whole: the pair the machine woke up with, plus whatever this run
 *  minted — each shape pruned its own way, and the static ids winning any
 *  overlap so their pinned words and stamps never move. */
const listedSessions = () => {
  const staticRows = stored() ? storedSessions() : []
  const staticIds = new Set(staticRows.map((row) => row.sessionId))
  return [
    ...staticRows,
    ...[...minted]
      .filter(([id]) => !staticIds.has(id) && !forgotten(id))
      .map(([sessionId, row]) => ({
        sessionId,
        cwd,
        title: row.title,
        updatedAt: row.updatedAt,
        _meta: { claudeCode: { messageCount: row.messageCount } },
      })),
  ]
}

/** Whether a scenario has made this conversation GONE — deleted from the
 *  agent's own store, which is the case a client's fallback exists for. A
 *  dot-file per session id in the served directory, like {@link RELEASE}: the
 *  store's walk prunes those, so arming one is not an edit. Per ID rather than
 *  one flag for the older row, so "the newest is gone" needs no second
 *  mechanism. */
const forgotten = (sessionId: string): boolean =>
  existsSync(`${cwd}/.agent-forgot-${sessionId}`)

/**
 * Whether this agent REFUSES to open a conversation — `new`, `load`, or both.
 *
 * An answer rather than a silence, which is the whole of what the client has to
 * tell apart: the process is up, the handshake is done, `session/list` answers,
 * and the one thing it will not do is put somebody in a conversation. A client
 * that read that as a dead agent would say `not running` about a process that
 * had just spoken to it.
 *
 * A DOT-FILE per verb, the way {@link forgotten} and the release are — the
 * store's walk prunes those, so arming one is not an edit — and read at the
 * moment of the request rather than at boot, because the two paths a client
 * opens a conversation through are a person pressing something and a SERVER
 * STARTING, and a scenario has to be able to reach the second one by arming a
 * file and restarting.
 */
const refusesToOpen = (verb: "new" | "load"): boolean =>
  existsSync(`${cwd}/.agent-refuse-${verb}`)

/**
 * Whether `session/load` DAWDLES — armed by `.agent-hold-load`, released by
 * the same `.agent-release` a held turn waits on.
 *
 * A load is the one open that takes real time: the agent re-opens a
 * conversation and replays every message in it before it answers, which is why
 * the client gives it its own two-minute deadline. `hold` is how a scenario
 * gets to look at the client DURING one — the stretch where a person's next
 * keystroke lands on a panel that is between conversations, and the only
 * stretch in which a second open can be started against the first.
 */
const holdsLoad = (): boolean => existsSync(`${cwd}/${MARKER.holdLoad}`)

/**
 * Whether this handshake ADVERTISES NOTHING — no queue, no steering.
 *
 * Read at `initialize` and off the filesystem, for `refusesToOpen`'s reason: it
 * is a property of the machine the agent woke up on rather than of anything the
 * client says, and the client hears it exactly once, before it has said
 * anything at all.
 *
 * What it buys is the panel's OTHER face, on one agent: a conversation with
 * something that has told olai nothing about itself. Every send still goes and
 * this file still queues them; what the panel stops doing is promising a person
 * their message will be got to, and offering them an interruption to press.
 */
const silent = (): boolean => existsSync(`${cwd}/${MARKER.saysNothing}`)

/** The client's own two, NEWEST LAST — so a client that takes the first entry
 *  instead of the most recently updated one adopts the wrong conversation.
 *
 *  Each carries the one FACT the patched adapter's `session/list` adds beyond
 *  the protocol's four fields (`_meta.claudeCode`,
 *  `acp/patches/session-list-info.patch`): the adapter always reads a count,
 *  and the OLDER of this pair is the one a `/clear` left behind, so the fake
 *  names what replaced it. The second line of a picker's row is what a
 *  scenario reads off this. */
const storedSessions = () =>
  [
    {
      sessionId: "fake-stored-old",
      cwd,
      title: STORED_TITLES["fake-stored-old"],
      updatedAt: "2026-07-01T09:00:00.000Z",
      _meta: { claudeCode: { messageCount: 47, supersededBy: "fake-stored-new" } },
    },
    {
      sessionId: "fake-stored-new",
      // The same place, spelled with a trailing slash: an agent stores the
      // spelling it was handed, and a client comparing strings would miss it.
      cwd: `${cwd}/`,
      title: STORED_TITLES["fake-stored-new"],
      updatedAt: "2026-08-01T17:30:00.000Z",
      // One, and that is the point: the row draws "1 message" singular.
      _meta: { claudeCode: { messageCount: 1 } },
    },
  ].filter((session) => !forgotten(session.sessionId))

/**
 * The picker, shaped the way the real adapter's is.
 *
 * Two rows spelled as ids, and three ALIASES — which is the shape that matters
 * and the one this file used to be missing. The adapter (captured at 0.66.0)
 * offers `default`, `opus[1m]`, `sonnet`, `haiku`: bare family words, while
 * the live model it reports on the wire is a concrete API id like
 * `claude-sonnet-5`. With only id-spelled rows here, a panel that could not
 * bridge the two vocabularies passed every scenario in this suite and named a
 * raw id in front of the person who filed the bug.
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
 * the real adapter has (0.73.0: env, then settings, then the resumed
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
 * 0.73.0). So an edit that landed in three places arrives as three blocks under
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
/** The `Agent` call the last subagent turn sent somebody out on — what
 *  `subagent again` reopens.
 *
 *  ACROSS TURNS, which is the whole point of it being module state: a resume
 *  is a thing that happens to an agent that reported in an EARLIER turn, and
 *  that is exactly the shape the panel got wrong (the human, 2026-08-28: an
 *  agent worked for twenty minutes with no face anywhere). A verb that spawned
 *  and resumed inside one turn would be a different claim, and the easier
 *  one. */
let lastSpawn: string | null = null

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

// ── attached externals ───────────────────────────────────────────────

/**
 * One STDIO entry off the session's own `mcpServers` — spawned lazily the
 * first time a turn asks its tools for something, the way the wrapped CLI
 * lazily attaches a server nothing ever calls. Spawning per PROMPT would
 * leak one child per turn; spawning at `session/new` would put a process
 * behind every conversation in a suite that almost never asks, so first-ask
 * it is.
 *
 * The conversation with one is the smallest honest piece of MCP: newline-
 * DELIMITED JSON-RPC on the child's pipes (MCP's stdio transport — no
 * Content-Length wrapper), an `initialize`, the `initialized` notification,
 * and then calls answered by `id`. Anything that would need
 * capability-negotiation or `notifications/*` back-talk is out of this file's
 * business: a fixture's job is to be a client of the server's SHAPE, and an
 * `external` verb's caller owns the tool name and the arguments.
 */
let externals = new Map<string, {
  type?: string
  name?: string
  command?: string
  args?: ReadonlyArray<string>
  env?: ReadonlyArray<{ name: string; value: string }>
}>()

interface External {
  readonly ask: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>
  readonly drop: () => void
}

/** The attach, memoised — `null` is the memoised FAILURE, so one broken
 *  spawn is one roster word (`attachment`) and one sentence per turn that
 *  asks, never a second child. Cleared with the session: a stale spawn
 *  must not ride `openSession`'s externals reset. */
const attached2 = new Map<string, External | null>()

const dropAttached = (): void => {
  for (const held of attached2.values()) held?.drop()
  attached2.clear()
}

const externalOf = async (name: string): Promise<External | null> => {
  const held = attached2.get(name)
  if (held !== undefined) return held
  const entry = externals.get(name)
  if (entry === undefined || entry.command === undefined) {
    attached2.set(name, null)
    return null
  }
  let drop: (() => void) | undefined
  try {
    const child = spawn(
      entry.command,
      [...(entry.args ?? [])],
      {
        stdio: ["pipe", "pipe", "inherit"],
        // The entry's own env MERGED OVER this process's, the same rule the
        // adapter's spawn keeps — a server that wanted a socket path from
        // the client gets it without losing PATH.
        env: {
          ...process.env,
          ...Object.fromEntries((entry.env ?? []).map((pair) => [pair.name, pair.value])),
        } as Record<string, string>,
      },
    )
    const reap = (): void => { child.kill() }
    drop = reap
    if (child.stdin === null || child.stdout === null) throw new Error("no pipes")
    let next = 0
    const pending = new Map<number, (message: Record<string, unknown>) => void>()
    let queue = ""
    child.stdout.on("data", (chunk: Buffer) => {
      queue += chunk.toString("utf8")
      for (;;) {
        const at = queue.indexOf("\n")
        if (at === -1) return
        const line = queue.slice(0, at).trim()
        queue = queue.slice(at + 1)
        if (line === "") continue
        let message: Record<string, unknown>
        try {
          message = JSON.parse(line) as Record<string, unknown>
        } catch {
          continue
        }
        const mid = message["id"]
        if (typeof mid !== "number") continue
        pending.get(mid)?.(message)
      }
    })
    const ask = (method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> =>
      new Promise((resolve, reject) => {
        const mid = ++next
        const timer = setTimeout(() => {
          pending.delete(mid)
          reject(new Error(`${method} unanswered after 300s`))
        }, 300_000)
        pending.set(mid, (message) => {
          clearTimeout(timer)
          pending.delete(mid)
          if (message["error"] !== undefined) reject(new Error(JSON.stringify(message["error"])))
          else resolve((message["result"] as Record<string, unknown>) ?? {})
        })
        child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, ...(params === undefined ? {} : { params }) }) + "\n")
      })
    await ask("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "fake-acp-agent", version: "0.0.0" },
    })
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
    const external: External = { ask, drop: reap }
    attached2.set(name, external)
    return external
  } catch (thrown) {
    drop?.()
    attached2.set(name, null)
    attachment.set(name, "failed")
    noise(`external ${name}: attach failed — ${String(thrown)}`)
    return null
  }
}

/** A STAND-ALONE `useTool` ({@link useTool}'s shape) against an ATTACHED
 *  external: the frames are the pair every other tool in this file wears,
 *  because from the client's seat this IS a call the session's agent made —
 *  the server's name prefixes the title so the row reads which of them took
 *  it. The outcome's text is the first TEXT block of the result, or the
 *  result itself — MCP's tool result is `content` blocks with an optional
 *  `structuredContent`, and a fixture reads without guessing. */
const useExternal = async (
  server: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> => {
  const toolCallId = `call-${++nextMcpId}`
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call",
      toolCallId,
      title: `${server} — ${name}`,
      status: "in_progress",
      rawInput: args,
    },
  })
  const sayOutcome = (status: "completed" | "failed", output: unknown): void =>
    notify("session/update", {
      sessionId,
      update: { sessionUpdate: "tool_call_update", toolCallId, status, rawOutput: output },
    })
  const server_ = await externalOf(server)
  if (server_ === null) {
    sayOutcome("failed", { error: `no attached MCP server named \`${server}\`` })
    return `no attached MCP server named \`${server}\``
  }
  try {
    const result = await server_.ask("tools/call", { name, arguments: args })
    const blocks = result["content"] as ReadonlyArray<{ type?: string; text?: string }> | undefined
    const said = blocks?.find((block) => block?.type === "text")?.text
      ?? JSON.stringify(result["structuredContent"] ?? result)
    sayOutcome(result["isError"] === true ? "failed" : "completed", result)
    return said
  } catch (thrown) {
    sayOutcome("failed", { error: String(thrown) })
    return `the call failed: ${String(thrown)}`
  }
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

/** How many characters of the answer ride in one notification — the size a
 *  model's own tokens arrive at, and the size the defect was measured at. */
const CHUNK = 5

/** Milliseconds between chunks under `stream slow` — about fifteen milliseconds
 *  a token, which puts a 634-chunk answer at roughly ten seconds. That is a
 *  fast model rather than a slow one, and it is the right end to measure from:
 *  the faster the tokens, the more frames an uncoalesced wire sends. */
const PACE = 15

/** FIVE PARAGRAPHS of ordinary prose, deterministic and 3,180 bytes — the
 *  answer `stream` streams. Written out rather than generated so two runs of
 *  the driver, against two worktrees, measure the same bytes. */
const ANSWER = [
  "The cabinets are the part of this that has to be decided first, " +
  "because everything else in the room is measured off them. A run along " +
  "the north wall gives you the longest uninterrupted counter, and the " +
  "window stays where it is. Anything else you do to the room has to be " +
  "drawn after that line is fixed, which is the whole reason it is fixed " +
  "first and not last. The depth is the only number worth arguing about, " +
  "and the answer is the standard one, because every appliance in the " +
  "catalogue is built to it. Going deeper buys you a shelf you cannot " +
  "reach across and a counter you cannot wipe without leaning.",
  "The alternative is an island, which reads better in a drawing than it " +
  "does in a kitchen this size: two people cannot pass behind a chair, " +
  "and the chairs are the whole point of an island. So the island is out, " +
  "and what it was for — somewhere to sit that is not the table — moves " +
  "to the end of the run, where a shallow overhang and two stools do the " +
  "same job and cost a tenth as much. It also leaves the floor clear, " +
  "which is the thing you notice every day and the thing no drawing ever " +
  "shows. A kitchen you can walk through is worth more than a kitchen you " +
  "can photograph.",
  "That leaves the appliances. The oven wants to be near the sink and not " +
  "near the door; the fridge wants to be near the door and not near the " +
  "oven. Those two wants are the same wall, so one of them loses, and it " +
  "should be the fridge: a fridge is opened for ten seconds and an oven " +
  "is worked at for an hour, and the hour is the one worth arranging the " +
  "room around. The dishwasher is not a choice at all — it goes beside " +
  "the sink, on the side your good hand is on, and there is no second " +
  "opinion about it. The bin goes under the sink, for the same reason and " +
  "with the same lack of argument. Everything else — the kettle, the " +
  "toaster, the thing that makes the bread — lives on the counter and can " +
  "be moved by hand, so none of it is a decision anybody has to make " +
  "today.",
  "The lighting follows the counter rather than the ceiling. One line of " +
  "it under the upper cabinets, one over the sink, and nothing in the " +
  "middle of the room at all — a room lit from its edges reads as bigger " +
  "than the same room lit from its centre, and this room needs all the " +
  "help it can get. The switch for the under-cabinet run goes by the " +
  "door, not by the counter, because the person who wants it on is the " +
  "person walking in, and they are carrying something in both hands. Put " +
  "it at the height everything else in the house is at, and nobody will " +
  "ever have to look for it.",
  "None of this is expensive except the cabinets, which is the usual " +
  "shape of a kitchen: the joinery is the project and everything else is " +
  "shopping. If the budget has to give somewhere, it gives on the " +
  "appliances, which can be replaced one at a time later on, and never on " +
  "the run along the north wall. That run is the room, and everything the " +
  "room is asked to do for the next twenty years is asked of it. Buy the " +
  "doors you want the first time; the handles can wait, and so can the " +
  "tiles. What you cannot do later is move the wall the run is on, or the " +
  "window that decides where the light falls on it, and those two are the " +
  "whole of what a kitchen is.",
].join("\n\n")

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

/** Wait until a scenario says when, taking anything steered in FIRST — before
 *  the release is even looked for, because that is the claim under test: a
 *  message steered into a turn is acted on by the turn that is still running,
 *  not by the one after it. The marker, the limit and the loop are shared with
 *  the other scripted agent ({@link ../support/scripted.ts}); what is on each
 *  tick is this one's. */
const released = async (onTick?: () => void): Promise<void> => {
  const let_go = await releasedIn(cwd, async () => {
    await takeSteering()
    onTick?.()
  })
  if (!let_go) noise("fake agent: nothing released the held turn; going on anyway")
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
    message: {
      type: "system",
      subtype: "init",
      model,
      // The other half of the same message, and the only place on this wire
      // where a client can learn whether the agent actually reached what it
      // was handed (`mcp-roster-visible`): ACP's `session/new` answers with a
      // session id and says nothing per server. Every server the client gave
      // this session is reported, because that is what the CLI reports — its
      // OWN servers would be here too on a real host, and a client that drew
      // rows for those would be drawing a list it cannot keep honest.
      mcp_servers: servers.map((name) => ({
        name,
        status: attachment.get(name) ?? "connected",
      })),
    },
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
  reply(id, { stopReason: "cancelled" })
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

  // FALL OVER SAYING NOTHING, and BEFORE the usage frames below — which is the
  // whole difference from `crash` and the only reason this verb exists. A turn
  // that produced not one frame leaves the client unable to tell a prompt that
  // was read from one that never arrived, which is the case a message may
  // honestly be marked for. `crash` speaks first and must NOT be markable.
  if (verb === "vanish") process.exit(1)

  // A TURN THAT ANSWERS WITH AN ERROR INSTEAD OF A STOP REASON — and stays
  // alive to take the next one. `session/prompt` is a request like any other,
  // so a JSON-RPC error is an answer it can have: an agent whose mode is in a
  // state it cannot prompt from, a session it has lost track of, a model it
  // could not reach. Nothing died and nothing is unreachable; ONE TURN failed,
  // and the conversation under it is exactly as usable as it was.
  //
  // BEFORE the usage frames, like `vanish` and for its reason: this turn
  // produced not one frame, so what a client may honestly say about the message
  // that started it is the whole of what the error told it.
  if (verb === "error") {
    refuse(id, -32603, "this turn cannot be run in the mode this session is in")
    return
  }

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
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "crash") {
    // SPEAKS FIRST, deliberately — see `vanish`. This is a turn the agent
    // demonstrably worked on, so the message that started it must keep its
    // ordinary face however badly the turn ended.
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "slow") {
    say("thinking")
    for (let tick = 0; tick < 200 && !cancelled; tick++) {
      await takeSteering()
      await sleep(50)
    }
    reply(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
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
    reply(id, { stopReason: cancelled ? "cancelled" : "end_turn" })
    return
  }

  // An answer with something in it this panel cannot draw. It used to be
  // dropped on the floor — the row was there and it was EMPTY — so the whole
  // claim is that the transcript says a picture arrived.
  if (verb === "picture") {
    say("here it is:")
    showPicture()
    reply(id, { stopReason: "end_turn" })
    return
  }

  // From now on this agent will not take a SECOND prompt while it is working —
  // the third leg of the world, and the one nothing else here is. The two
  // agents olai ships against both hold a mid-turn prompt (one advertises it,
  // one was verified), so "what does a busy send do on an agent that neither
  // queues nor advertises" was reasoned about and never driven: an older
  // adapter, or one that simply answers a concurrent `session/prompt` with an
  // error. It is an ORDINARY TURN FAILURE when it happens, which is the claim —
  // the words stay on the row, marked, with the button that sends them again.
  if (verb === "refuse" && argument === "busy") {
    busyRefused = true
    say("a second message while working will be refused from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  // From now on there is no way to reach the turn in flight. The words a
  // person types during one have nowhere to go, and the panel owes them the
  // row rather than a queue.
  if (verb === "refuse" && argument === "steering") {
    steerRefused = true
    say("steering refused from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  // From now on a steer is TAKEN and never answered. Nothing is refused and
  // nothing is injected: the request sits open, the turn goes on, and the only
  // thing that can end the wait is the client's own deadline — which is the
  // one case where a panel cannot say whether the words arrived.
  if (verb === "swallow" && argument === "steering") {
    steerSwallowed = true
    say("steering will be swallowed from here on.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  // From now on we cannot say what conversations we have. Not the same as
  // having none — and until the picker grew a refused arm, both arrived there
  // as an empty list and were drawn as "no stored conversations".
  if (verb === "lose") {
    listRefused = true
    say("the conversation store is unreadable")
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "servers") {
    // The list, as one definite line: `servers: [olai kolu odu]` (the wrapper
    // answers the pin for the third name the way it handed the suite answering
    // the first two). A scenario about
    // what a session was GIVEN can then assert the whole answer rather than
    // the absence of a word, which is the only shape of that claim a streaming
    // panel can be asked for without waiting to see whether more arrives.
    say(`servers: [${servers.join(" ")}]`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "attach") {
    // What the WRAPPED CLI would say about one of them from now on — the real
    // adapter's `mcp_servers` status, which is how an agent reports a server it
    // was handed and could not reach (`mcp-roster-visible`). Set here and
    // observable only from the NEXT turn, for the same reason a `/model` is:
    // the `init` for a turn is emitted as that turn STARTS, so this one has
    // already announced the status it began with.
    const [name, status] = argument.split(/\s+/)
    if (name !== undefined && status !== undefined) attachment.set(name, status)
    say(`${name} is ${status} from the next turn`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  /**
   * A REAL ANSWER, streamed the way a language model streams one — a few
   * characters per notification, hundreds of them, into one paragraph.
   *
   * The instrument for `transcript-stream-quadratic`, and the reason it is
   * exact rather than approximate: what that node is about is the RATIO between
   * an answer's own bytes and the bytes its delivery costs, so a driver
   * measuring it has to send a known number of bytes in a known number of
   * chunks. Five paragraphs and five characters a chunk is the shape that was
   * measured on kolu-bot (3,218 bytes as 643 chunks averaging five), reproduced
   * here so the before and the after are numbers of one session.
   *
   * `flood` is next door and is NOT this: it sends forty big chunks so that
   * something overflows a pane. This one sends six hundred small ones so that
   * something is quadratic.
   */
  if (verb === "stream") {
    // `stream slow` PACES them, which is the honest shape and the one a film
    // shows: a model's tokens arrive over seconds, and what a coalescing wire
    // costs in FRAMES is a function of how long the answer took rather than of
    // how many chunks it came in. Bare `stream` sends the same bytes as fast
    // as a pipe will take them, which is the harsher case for bytes and the
    // uninteresting one for frames.
    const pace = argument === "slow" ? PACE : 0
    for (let at = 0; at < ANSWER.length; at += CHUNK) {
      say(ANSWER.slice(at, at + CHUNK))
      if (pace > 0) await sleep(pace)
    }
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  // A BACKGROUND TASK, ARMED — the one call whose whole point is to outlive
  // the turn it was made in, reported the way the patched adapter reports one
  // (`acp/patches/README.md`): the tool answers the moment the task is
  // running, so the call goes `in_progress` and STAYS there, carrying the
  // harness's own task on its `_meta`. The frames are the shapes a real
  // `Bash(run_in_background)` produced through that adapter on 2026-08-24,
  // down to the sentence the exit code arrives in.
  //
  // THE DEATH IS AFTER THE TURN, and it has to be: a turn ends, another one
  // happens, and the task is still out there — which is the whole of what this
  // feature is about and the thing no row could say before. Released by the
  // same `.agent-release` a held turn waits on, so a scenario says when.
  if (verb === "watch") {
    const toolCallId = `call-${++nextMcpId}`
    const task = "bwa85c0r2"
    const description = "kolu fleet watch"
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "kolu watch --states waiting,awaiting --held-for 60s --nag 10m",
        status: "pending",
        rawInput: { command: "kolu watch --states waiting,awaiting", run_in_background: true },
        _meta: { claudeCode: { toolName: "Bash" } },
      },
    })
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId,
        status: "in_progress",
        _meta: {
          claudeCode: {
            toolName: "Bash",
            backgroundTask: { taskId: task, taskType: "local_bash", description },
          },
        },
        rawOutput: `Command running in background with ID: ${task}.`,
        content: [{
          type: "content",
          content: { type: "text", text: `Command running in background with ID: ${task}.` },
        }],
      },
    })
    say("armed the watch; I will keep working.")
    // The harness's two bookends, in the order they arrive: the guaranteed
    // patch settles the call, and the notification beside it refines the same
    // call with the sentence carrying the exit code.
    void released().then(() => {
      const ended = {
        taskId: task,
        taskType: "local_bash",
        description,
        status: "failed",
      }
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: "failed",
          _meta: { claudeCode: { toolName: "Bash", taskStatus: "failed", backgroundTask: ended } },
        },
      })
      const summary = `Background command "${description}" failed with exit code 3`
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: "failed",
          _meta: {
            claudeCode: {
              toolName: "Bash",
              taskStatus: "failed",
              backgroundTask: { ...ended, summary },
            },
          },
          content: [{ type: "content", content: { type: "text", text: summary } }],
        },
      })
    })
    respond(id, { stopReason: "end_turn" })
    return
  }

  // A CALL THE TURN GIVES UP ON. The turn ends normally and this process stays
  // alive, which is the whole difference from `crash`: the panel goes idle with
  // a row on it that the wire still calls `in_progress` and never will again,
  // and then somebody sends something else. A face that asked the CONVERSATION
  // whether anything was running would light that row back up at that moment —
  // which is the one this verb exists to catch.
  if (verb === "abandon") {
    const toolCallId = `call-${++nextMcpId}`
    notify("session/update", {
      sessionId,
      update: {
        sessionUpdate: "tool_call",
        toolCallId,
        title: "a call nobody ever reported on",
        status: "in_progress",
        rawInput: { abandoned: true },
      },
    })
    say("started something and gave up on it.")
    reply(id, { stopReason: "end_turn" })
    return
  }

  // THE SAME REPORT, TWICE, BYTE FOR BYTE. Nothing in ACP forbids a repeat and
  // more than one agent sends them, so a client that made anything of the
  // second one is a client that is wrong about the wire rather than about that
  // agent. The frame sent again is the very object the first one was built
  // from: a copy edited by so much as a word would be testing something else.
  if (verb === "twice") {
    const toolCallId = `call-${++nextMcpId}`
    const announced = {
      sessionUpdate: "tool_call",
      toolCallId,
      title: "a call reported twice",
      status: "in_progress",
      rawInput: { said: "once" },
      locations: [{ path: `${cwd}/notes.md`, line: 3 }],
    }
    const reported = {
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: "completed",
      rawOutput: { said: "twice" },
      content: [
        { type: "content", content: { type: "text", text: "the same words twice" } },
      ],
    }
    notify("session/update", { sessionId, update: announced })
    notify("session/update", { sessionId, update: announced })
    notify("session/update", { sessionId, update: reported })
    notify("session/update", { sessionId, update: reported })
    say("said the same thing twice.")
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "ask") {
    // Byte for byte the shape `askUserQuestionsToCreateRequest` builds for one
    // single-select question: the question as the message, a titled `oneOf`,
    // and the per-question "Other" box marked with the shared `_meta` key.
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      reply(id, { stopReason: "end_turn" })
      return
    }
    // `ask later` HOLDS first, which is the only way a scenario can be
    // somewhere else when the question lands: asking takes the panel open and
    // a press of Send, and the attention alerts are about a question arriving
    // at a person who has since looked away. So the scenario asks, goes
    // elsewhere, and then releases.
    if (argument === "later") await released()
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "askstrict") {
    // The shape an MCP server asks in, rather than the one the CLI's own
    // AskUserQuestion produces: a REQUIRED field, and a typed one. Claude's
    // questions are all optional chips, so this is the only way to reach the
    // path where the panel's answer can be refused by the schema it was for.
    if (!canElicit()) {
      say("the client cannot draw a form, so there is nothing to ask")
      reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  // Handled INSIDE the wrapped CLI, which is why the picker never hears about
  // it — and why this changes nothing that is observable until the next turn
  // announces itself. The prose is all this turn has to say about it, exactly
  // as the real one's `<synthetic>` message is.
  if (verb === "model") {
    liveModel = argument
    say(`switched to ${argument}.`)
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
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
  // the same `path` (`toolUpdateFromDiffToolResponse`, adapter 0.73.0). An edit
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  // A TURN WITH OTHER AGENTS IN IT. The adapter forwards a spawned agent's
  // tool calls on the same feed as the main agent's — there is no second
  // stream and no `sessionUpdate` of its own — and stamps each one with the
  // `Agent` call it came out of, in `_meta.claudeCode.parentToolUseId`
  // (`liveBackgroundTasks`, adapter 0.73.0). Everything a panel can know about
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
     *  (`claudeCodeMetaFromToolUse`, 0.73.0) and is the only thing on the wire
     *  that says an agent was sent out BEFORE the agent has done anything —
     *  the parent stamp below cannot be sent until it has. The arguments are
     *  the `Agent` tool's own (`AgentInput`): a short description, the prompt,
     *  and the optional kind of agent.
     *
     *  THE TITLE IS THE TOOL'S NAME, and that is not cosmetic — it is the one
     *  thing this fixture used to get wrong, and the whole reason a real defect
     *  reached a review. The adapter titles an `Agent` call `Task`; a row's
     *  title is then pinned at the first frame that carries one, so every agent
     *  of a fan-out is a row reading `Task` and the DESCRIPTION is the only
     *  thing that tells one from another. This file used to title a spawn with
     *  its description, which made four surfaces that read the title look
     *  correct in the suite and be wrong against the real adapter — including
     *  the label over a subagent's permission form, which is the one row in the
     *  panel where being wrong about who is speaking changes what somebody
     *  presses.
     *
     *  So the two are DIFFERENT STRINGS here, always, and a scenario that reads
     *  a name back is reading the description or it is reading nothing.
     *
     *  `pending` rather than in_progress, which is what the adapter announces
     *  a tool use with — a spawn wears it until the first heartbeat, which for
     *  a slow one is a long time and exactly the stretch under test. */
    const spawn = (id: string, said: string, kind?: string): void => {
      // REMEMBERED ACROSS TURNS ({@link lastSpawn}), because that is what a
      // later turn's `subagent again` reopens.
      lastSpawn = id
      announce(id, SPAWN_TITLE, { toolName: "Agent", subagent: true }, {
        rawInput: {
          description: said,
          prompt: `${said}, and report back`,
          ...(kind === undefined ? {} : { subagent_type: kind }),
        },
        status: "pending",
      })
    }
    /** One call made INSIDE a spawned agent — the main agent's own frame, plus
     *  the one field that says whose it is. */
    const inside = (id: string, title: string, parent: string): void =>
      announce(id, title, { toolName: "Grep", parentToolUseId: parent })
    /** A SPAWN'S OWN COMPLETION, carrying the subagent's report the way the
     *  adapter does — content blocks on the call, never prose in the main
     *  agent's voice. It is what the live face RESOLVES INTO, and it is spelled
     *  once because two turns end this way now (an agent that reported, and one
     *  that reported twice): the whole claim of this fixture is the frame
     *  SHAPE, so a correction to it that landed on one turn and not the other
     *  would be a fixture disagreeing with itself about the adapter. */
    const reported = (call: string, said: string): void =>
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: call,
          status: "completed",
          content: [{ type: "content", content: { type: "text", text: said } }],
        },
      })

    // A SUBAGENT THAT STOPS TO ASK, in the two shapes the adapter has for one.
    // Both put a form in front of a person on behalf of an agent nobody sent
    // there directly, and the frames say so in DIFFERENT places — which is why
    // both are driven rather than one standing in for the other.
    //
    // Each is asked in the MIDDLE of that agent's own run, with a call before
    // the form and a call after it, because the form is not only mis-drawn on
    // its own: a row in no lane between two of one agent's calls ENDS the
    // stretch, so the lane re-opens and names itself again underneath the
    // form. That second half is what a reader actually sees, and a turn that
    // asked and stopped could not show it.
    if (argument === "asks" || argument === "elicits") {
      const elicits = argument === "elicits"
      const agent = `agent-${++nextMcpId}`
      const before = `sub-${++nextMcpId}`
      const asking = `call-${++nextMcpId}`
      const after = `sub-${++nextMcpId}`
      spawn(agent, "explore the outline", "Explore")
      inside(before, "grep for cabinets", agent)
      // The tool the question is ABOUT, announced first — which the adapter
      // guarantees for both paths (`ensureToolCallEmitted`) and which the
      // elicitation below depends on entirely: an `elicitation/create` names
      // this call and carries no attribution of its own, so this frame is the
      // only place the client can learn whose question it is.
      announce(asking, elicits ? "AskUserQuestion" : "run a command", {
        toolName: elicits ? "AskUserQuestion" : "Bash",
        parentToolUseId: agent,
      })
      const answer = elicits
        ? await request("elicitation/create", {
          mode: "form",
          sessionId,
          toolCallId: asking,
          message: "Which cabinets should I order?",
          requestedSchema: {
            type: "object",
            properties: {
              question_0: {
                type: "string",
                title: "Cabinets",
                oneOf: [{ const: "oak", title: "oak" }, { const: "birch", title: "birch" }],
              },
            },
          },
        })
        : await request("session/request_permission", {
          sessionId,
          toolCall: {
            toolCallId: asking,
            title: "run a command",
            // WHERE A PERMISSION REQUEST SAYS IT, and the difference from the
            // elicitation above: the adapter stamps the attribution onto the
            // request itself, beside the tool name (0.73.0, `canUseTool`).
            _meta: { claudeCode: { toolName: "Bash", parentToolUseId: agent } },
          },
          options: [
            { kind: "allow_once", name: "Allow Once", optionId: "allow" },
            { kind: "reject_once", name: "Deny", optionId: "reject" },
          ],
        })
      if (endedCancelled(id)) return
      completed(asking)
      // ... and the run CARRIES ON under the form, which is the half the lane
      // rule is about.
      inside(after, "grep for worktops", agent)
      for (const call of [before, after, agent]) completed(call)
      // Reported in each path's OWN words — the same sentences `ask` and
      // `plan` end on — so a scenario reads what came back rather than a shape
      // invented for these two turns.
      const outcome = (answer as { outcome?: { outcome?: string; optionId?: string } })
        ?.outcome
      say(
        elicits
          ? `you answered: ${JSON.stringify(answer)}`
          : `permission: ${outcome?.optionId ?? outcome?.outcome ?? "nothing"}`,
      )
      reply(id, { stopReason: "end_turn" })
      return
    }

    // A SUBAGENT SENT MORE WORK, in a LATER TURN — the shape the panel had no
    // face for at all.
    //
    // A subagent that has reported can be woken with a follow-up instruction
    // over the same transcript, and the harness starts its task again. What
    // reaches a client then is not a new agent: everything that agent does goes
    // on being stamped with the call that SPAWNED it, so olai's patched adapter
    // reopens that very call (`acp/patches/README.md`'s "a task's second life",
    // measured on the real wire by `packages/tests/tasks.ts`). Which is exactly
    // what this sends: a `tool_call_update` putting the old call back to
    // `in_progress`, with nothing else on the frame — no title (the row was
    // named an outing ago and a name may not move), and NO `backgroundTask`,
    // because a resume arms nothing.
    if (argument === "again") {
      const agent = lastSpawn
      if (agent === null) {
        say("nobody has been sent out yet.")
        reply(id, { stopReason: "end_turn" })
        return
      }
      const more = `sub-${++nextMcpId}`
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: agent,
          status: "in_progress",
          _meta: { claudeCode: {} },
        },
      })
      say("sent it more work.")
      await released()
      // ... and its new work files under the SAME row, which is what makes one
      // agent one door however many times it goes out.
      inside(more, "push the branch", agent)
      completed(more)
      reported(agent, "the branch is pushed.")
      say(" the agent reported back again.")
      reply(id, { stopReason: "end_turn" })
      return
    }

    // ... AND THEN FALLING OVER UNDER IT. The face has to come off, and the
    // row's own status cannot be what takes it off: a status is sticky, an
    // agent that dies mid-spawn reports no completion for the call it was in
    // the middle of, and the rows a dead agent left are deliberately still on
    // screen to read. So this one spawns, waits to be looked at, and exits —
    // which is the shape that leaves a `pending` Agent call behind forever.
    if (argument === "crash") {
      spawn(`agent-${++nextMcpId}`, "read every note", "Explore")
      say("sent an agent out.")
      await released()
      process.exit(1)
    }

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
      reported(alone, "there are three notes.")
      say(" the agent reported back.")
      reply(id, { stopReason: "end_turn" })
      return
    }

    // AN ASYNC AGENT'S COMPLETION, as the harness actually delivers it: the
    // spawn arms a background task, the turn that sent it ends, and later a
    // user-role `<task-notification>` arrives carrying the whole report —
    // stamped the way the session JSONL stamps it (`origin.kind:
    // "task-notification"`). That turn is not a person speaking. The panel's
    // contract is the report in the spawn's fold and a one-row ending at the
    // bottom, never the XML in the column.
    if (argument === "notify") {
      const agent = `agent-${++nextMcpId}`
      const task = "a4015bf2ba1fa514d"
      const description = "count the ticks"
      spawn(agent, description, "Explore")
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: agent,
          status: "in_progress",
          _meta: {
            claudeCode: {
              toolName: "Agent",
              subagent: true,
              backgroundTask: { taskId: task, taskType: "local_agent", description },
            },
          },
        },
      })
      say("sent an agent out; I will keep working.")
      void released().then(() => {
        const ended = {
          taskId: task,
          taskType: "local_agent",
          description,
          status: "completed",
        }
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: { toolName: "Agent", taskStatus: "completed", backgroundTask: ended },
            },
          },
        })
        const summary = `Agent "${description}" finished`
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: {
                toolName: "Agent",
                taskStatus: "completed",
                backgroundTask: { ...ended, summary },
              },
            },
            content: [{ type: "content", content: { type: "text", text: summary } }],
          },
        })
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "user_message_chunk",
            content: {
              type: "text",
              text:
                "<task-notification>\n" +
                `<task-id>${task}</task-id>\n` +
                `<tool-use-id>${agent}</tool-use-id>\n` +
                "<status>completed</status>\n" +
                `<summary>${summary}</summary>\n` +
                "<result>I have thorough coverage now. Here is the factual report.\n\n" +
                "# Findings\n\nThere are three notes.\n</result>\n" +
                "</task-notification>",
            },
            _meta: { claudeCode: { origin: { kind: "task-notification" } } },
          },
        })
      })
      reply(id, { stopReason: "end_turn" })
      return
    }

    // THE SHIPPED PATH: the patched pin swallows the user-role turn and
    // files the `<result>` as `_meta.claudeCode.backgroundTask.report` on
    // a `tool_call_update`. No adapter emits origin on a user chunk
    // (`toAcpNotifications` stamps messageId / parentToolUseId only), so
    // a fixture that only stamped origin was testing the leftover door.
    if (argument === "report") {
      const agent = `agent-${++nextMcpId}`
      const task = "a4015bf2ba1fa514d"
      const description = "count the ticks"
      spawn(agent, description, "Explore")
      notify("session/update", {
        sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: agent,
          status: "in_progress",
          _meta: {
            claudeCode: {
              toolName: "Agent",
              subagent: true,
              backgroundTask: { taskId: task, taskType: "local_agent", description },
            },
          },
        },
      })
      say("sent an agent out; I will keep working.")
      void released().then(() => {
        const ended = {
          taskId: task,
          taskType: "local_agent",
          description,
          status: "completed",
        }
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: { toolName: "Agent", taskStatus: "completed", backgroundTask: ended },
            },
          },
        })
        const summary = `Agent "${description}" finished`
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            status: "completed",
            _meta: {
              claudeCode: {
                toolName: "Agent",
                taskStatus: "completed",
                backgroundTask: { ...ended, summary },
              },
            },
            content: [{ type: "content", content: { type: "text", text: summary } }],
          },
        })
        notify("session/update", {
          sessionId,
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: agent,
            _meta: {
              claudeCode: {
                backgroundTask: {
                  taskId: task,
                  report:
                    "I have thorough coverage now. Here is the factual report.\n\n" +
                    "# Findings\n\nThere are three notes.\n",
                },
              },
            },
          },
        })
      })
      reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
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
    // The id, and the REST of its line — which carries the one thing on it that
    // is not a fact about where the node is but about what to do with it: a
    // node that was put away says `; trashed`, because nothing refuses a write
    // into the trash and a row that read like live work would be worked on.
    const named = [...text.matchAll(/^Node in context: `([^`]+)`(.*)$/gm)].map(
      (match) => ({ id: match[1] ?? "", said: match[2] ?? "" }),
    )
    if (named.length === 0) {
      say("no node in context.")
      reply(id, { stopReason: "end_turn" })
      return
    }
    for (const { id: node, said } of named) {
      const read = await useTool("read_node", { id: node })
      const found = read["structuredContent"] as { title?: string } | undefined
      // A SENTENCE the browser could not have written on its own — the chip on
      // the message carries the title too, so a scenario matching the bare
      // title would pass on a build that never put the node in the prompt at
      // all. (It did, until a sabotage run said so.)
      say(
        `\`${node}\` is the node titled ${found?.title ?? "?"}` +
          `${said.includes("; trashed") ? ", and it was put away" : ""}.\n`,
      )
    }
    reply(id, { stopReason: "end_turn" })
    return
  }

  // An id in PROSE and nothing else — no tool call, no write. What is under
  // test is the panel's reading of a backtick, and the id a scenario wants to
  // see named is not always one a tool would accept (a placement is the case
  // this exists for: `set_done` refuses one, and an agent still writes them).
  if (verb === "name") {
    say(`look at \`${argument}\`.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  // LINKS in prose, which is what an agent asked about a vault writes without
  // being taught to: a relative path to a document (the renderer resolves it
  // against the file the markdown was written in, and an agent's answer was
  // written in no file, so it is resolved from the root) and an address of
  // this app spelled out. Both are ANCHORS in rendered markdown belonging to
  // no component — which is why they are worth a verb: the panel is mounted
  // beside the panes, so nothing above them catches the click, and for a while
  // one of these reloaded the whole app.
  if (verb === "links") {
    say(
      "the note is [the cabinets note](notes/cabinets.md) " +
        "and the row is [the order row](/#order).\n",
    )
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "done") {
    await useTool("set_done", { id: argument })
    say(`marked \`${argument}\` done.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "external") {
    // `external <server> <tool> <json-args>` — the whole of what a scenario
    // can ask of somebody else's program the client handed in. The args are
    // the caller's JSON verbatim: this file holds no opinion about one
    // server over another, which is the same discipline `mcp` keeps for
    // olai's own.
    const [server, tool, ...json] = rest
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(json.join(" ") || "{}") as Record<string, unknown>
    } catch (thrown) {
      say(`could not parse the arguments as JSON: ${String(thrown)}`)
      reply(id, { stopReason: "end_turn" })
      return
    }
    if (server === undefined || tool === undefined) {
      say(`usage: external <server> <tool> <json-args>`)
      reply(id, { stopReason: "end_turn" })
      return
    }
    say(await useExternal(server, tool, args))
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "add") {
    const outlines = await callMcp("tools/call", { name: "list_outlines", arguments: {} })
    const listed = (outlines["structuredContent"] as
      | { outlines?: ReadonlyArray<{ file: string }> }
      | undefined)?.outlines ?? []
    // `_olai/Trash.olai` sorts first, and capturing into the trash is not
    // a capture — the tree would never show the row (#226).
    const file = listed.find((one) => one.file !== "_olai/Trash.olai")?.file
    await useTool("add_node", { file, title: argument })
    say(`added \`${argument}\`.`)
    reply(id, { stopReason: "end_turn" })
    return
  }

  if (verb === "search") {
    const found = await useTool("search_nodes", { text: argument })
    say(`searched: ${JSON.stringify(found["structuredContent"])}`)
    reply(id, { stopReason: "end_turn" })
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
    reply(id, { stopReason: "end_turn" })
    return
  }

  say(`you said: ${text}`)
  reply(id, { stopReason: "end_turn" })
}

// ── the protocol ───────────────────────────────────────────────────────

const openSession = (params: Record<string, unknown>): void => {
  // Our e2e scenarios mint this cwd and hand it to the double — controlled
  // input, not protocol. The counted trim lives in acp/diffs.ts.
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
    command?: string
    args?: ReadonlyArray<string>
    env?: ReadonlyArray<{ name: string; value: string }>
  }>
  servers = given.map((server) => server.name ?? "?")
  const http = given.find((server) => server.type === "http")
  mcp = http?.url === undefined ? null : {
    url: http.url,
    headers: Object.fromEntries(
      (http.headers ?? []).map((header) => [header.name, header.value]),
    ),
  }
  // The STDIO entries, kept whole against the day a turn asks for one —
  // spawning one is lazy ({@link externalOf}), so this is a listing and not
  // a process tree per conversation. A new session replaces the last: reap
  // any child the previous listing spawned, or a stale attach rides this reset.
  dropAttached()
  externals = new Map(
    given
      .filter((server) => server.type === undefined && typeof server.command === "string")
      .map((server) => [server.name ?? "?", server]),
  )
}

/**
 * Replay a stored conversation, the way a real `session/load` does: every
 * message as an ordinary `session/update`, and only then the answer.
 *
 * IT OPENS WITH WHAT THE PERSON SAID, and the tool call in the middle of it is
 * ALREADY COLLAPSED — one `tool_call_update` carrying the whole finished call,
 * with no announcement in front of it, because there is nothing left to
 * announce: the call ran in a turn that ended before this process was started.
 * That is what a history is, and it is the shape a client meets nowhere else —
 * every live turn announces before it reports.
 */
const replay = (): void => {
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "what did " },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "we decide?" },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "tool_call_update",
      toolCallId: "replayed-1",
      title: "read the notes",
      status: "completed",
      rawInput: { file_path: `${cwd}/notes.md` },
      rawOutput: { read: true },
    },
  })
  notify("session/update", {
    sessionId,
    update: {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "we decided to order the cabinets." },
    },
  })
  // `an older conversation` is the one a scenario picks, so it has to overflow
  // the pane — otherwise "scrolled to the newest line" is true of a short
  // transcript by construction and says nothing. The two lines above stay so
  // every other stored-session claim still has the words it already asserts.
  if (sessionId === "fake-stored-old") {
    for (let line = 0; line < 40; line++) {
      say(`line ${line} — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
    }
    // AFTER the open-jump has landed, and only when a scenario asked: a
    // restored transcript's markdown (and any later row) grows the pane
    // once the reader is already looking at it. Armed by `.agent-want-late`,
    // released by the same `.agent-release` a held turn uses, so the late
    // line is a step rather than a race against the first assertion.
    if (existsSync(`${cwd}/.agent-want-late`)) {
      rmSync(`${cwd}/.agent-want-late`, { force: true })
      void released().then(() => {
        say(`late line — ${"the quick brown fox jumps over the lazy dog. ".repeat(3)}\n\n`)
      })
    }
  }
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
 * Four outcomes, and the client has to tell them apart — the fourth being the
 * absence of the other three (`swallow steering`), which is what an agent that
 * stopped listening while still alive looks like on this wire:
 *
 *   - a turn is running → the message joins it (`injected`) and the turn acts
 *     on it before it ends ({@link takeSteering});
 *   - nothing is running → `promptRequired`, which hands the message BACK
 *     rather than starting a turn nobody asked for. The client only steers
 *     while it believes a turn is running, so this is the race — and a client
 *     that took it as delivered would lose the message;
 *   - `refuse steering` was asked for → a JSON-RPC error, which is an agent
 *     that cannot be reached mid-turn at all;
 *   - `swallow steering` was asked for → NOTHING, ever. The request stays open
 *     and the client's deadline is the only thing that ends it, which is the
 *     one case where "did the message land" has no answer on this end.
 */
const steerTurn = (id: unknown, params: Record<string, unknown>): void => {
  // WHETHER A TURN IS RUNNING IS READ WHEN THE ANSWER IS SENT, not when the
  // request arrives, and with `slow steering` armed those are different
  // moments. That is the whole of what the delay buys: a cancel can overtake a
  // steer on the wire, and the answer that comes back — "nothing to steer" —
  // is then about a turn a PERSON stopped rather than one that finished.
  const answer = (): void => {
    // NEVER ANSWERED, and the request is left open rather than errored: the
    // client's own deadline is the only thing that can end this, which is the
    // whole point of the verb.
    if (steerSwallowed) return
    if (steerRefused) {
      refuse(id, -32000, "this turn cannot be steered")
      return
    }
    if (!running) {
      reply(id, { outcome: "promptRequired", reason: "noRunningTurn" })
      return
    }
    steered.push(promptTextOf(params))
    reply(id, { outcome: "injected" })
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
      reply(id, {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: stored(),
          mcpCapabilities: { http: true },
          // The LIST is always answerable: an empty one is the ordinary truth
          // of a fresh directory, not a capability missing. `loadSession`
          // stays the stored knob's because it chooses the boot path — see the
          // header and {@link minted}.
          sessionCapabilities: { list: {} },
          // IT HOLDS A PROMPT SENT WHILE IT IS BUSY — said where the real
          // adapter says it, inside the capabilities, in its own `_meta`
          // corner. Nothing about this file's behaviour depends on saying it
          // (the read loop has queued prompts behind the running turn all
          // along); what depends on it is the panel's PROMISE, which is made
          // only for an agent that said this.
          ...(silent() ? {} : { _meta: { claudeCode: { promptQueueing: true } } }),
        },
        agentInfo: { name: "fake-acp-agent", version: "0.1.0" },
        // ... and IT TAKES AN INTERRUPTION, in the top-level `_meta` beside
        // the capabilities, which is where the steering extension's own
        // contract puts it and where the real adapter puts it.
        //
        // IT USED TO SAY NEITHER, deliberately, back when every mid-turn
        // message was a steer: reading an advertisement then would have been
        // predicting what the request was about to prove. It is read now
        // because it decides whether a person is OFFERED an interruption at
        // all, and a control has to be drawn before anybody can press it. The
        // request is still the proof — `refuse steering` is the scenario that
        // says so, on an agent that advertises this and then says no.
        //
        // `.agent-says-nothing` takes both away, which is the OTHER agent's
        // case reachable on this one: a panel that has been told nothing makes
        // no promise and offers no interruption, and every send still goes.
        ...(silent() ? {} : { _meta: { steering: { supported: true } } }),
      })
      return

    case "session/list":
      // Same as openSession: this cwd is ours, not an agent's.
      if (typeof params["cwd"] === "string") cwd = params["cwd"].replace(/\/+$/, "")
      // COUNTED, one line per time asked — refused or not, the asking is the
      // pin: a scenario notes the file, settles another turn of a
      // conversation the last answer already names, and the count must not
      // have moved. Appended-line shaped rather than a rewritten counter
      // because several adapters on one directory each answer their own; the
      // dot-file idiom keeps the store's walk out of it.
      appendFileSync(join(cwd, ".agent-list-asks"), "1\n")
      // An agent that CANNOT say what it has stored — asked, and refusing.
      // Distinct from an agent with nothing stored, which answers an empty
      // list, and the whole point of the scenario that arms it: the two used
      // to reach the picker as the same thing.
      if (listRefused) {
        refuse(id, -32000, "the conversation store is unreadable")
        return
      }
      reply(id, { sessions: listedSessions() })
      return

    case "session/new":
      if (refusesToOpen("new")) {
        refuse(id, -32603, "this agent will not start a conversation in this directory")
        return
      }
      openSession(params)
      sessionId = "fake-session-1"
      // A fresh conversation is on whatever the picker says it is picking, and
      // what it is picking is the pin.
      currentModel = pinnedModel()
      liveModel = currentModel
      // ... and has spent nothing in a window of its own.
      used = 0
      size = 200_000
      reply(id, { sessionId, configOptions: configOptions() })
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
      // BEFORE ANY OF IT — no `openSession`, no replay, no move of `sessionId`.
      // An agent that refuses a load has not opened anything, so a client left
      // pointing at the conversation it asked for is a client the agent never
      // agreed with.
      if (refusesToOpen("load")) {
        refuse(id, -32603, `no such conversation: ${String(params["sessionId"])}`)
        return
      }
      // ...and BEFORE any of it too, for the same reason: a load that is still
      // on the wire has opened nothing, and what a scenario looks at in that
      // window is a client that is between conversations.
      if (holdsLoad()) await released()
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
      reply(id, { configOptions: configOptions() })
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
      reply(id, {})
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
      reply(id, { configOptions: configOptions() })
      return
    }

    case "session/prompt": {
      const text = promptTextOf(params)
      // It is not waiting any more: this is the turn now.
      waiting.delete(id)
      // ... and the conversation it landed in EXISTS from here on: a transcript
      // is a file a turn wrote, so `session/list` names it from this prompt's
      // moment — see {@link minted}. The pair a prompt carries is one user
      // row and this file's answer to it, whichever way the turn then goes.
      {
        const had = minted.get(sessionId)
        minted.set(sessionId, {
          title: had?.title ?? text,
          updatedAt: new Date().toISOString(),
          messageCount: (had?.messageCount ?? 0) + 2,
        })
      }
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
      // ... and it settles every turn still WAITING, right here, the way the
      // pinned adapter does ({@link settledEarly}). Their words are not
      // touched: they are already in this process, they run in their turn, and
      // what a client learns is that one press of cancel comes back as one
      // `cancelled` per turn it had in flight.
      for (const id of waiting) {
        settledEarly.add(id)
        respond(id, { stopReason: "cancelled" })
      }
      waiting.clear()
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
      const answered = take(message["id"])
      if (answered === null) {
        noise(`fake agent: an answer to nothing: ${String(message["id"])}`)
        return
      }
      answered(message["error"] ?? message["result"])
      return
    }
    // A PROMPT joins the queue before it joins the chain, so a cancel arriving
    // while it waits can answer it ({@link waiting}). Recorded here rather than
    // in `handle` for the reason the cancel is read here: by the time `handle`
    // runs, this prompt is the turn rather than one behind it.
    if (message["method"] === "session/prompt") {
      // ... unless this agent will not take one at all while it is working
      // ({@link busyRefused}). Answered HERE and never enqueued, which is the
      // whole shape of an agent with no queue: the refusal comes back at once
      // rather than when the running turn ends, and nothing about the turn in
      // flight changes.
      if (busyRefused && running) {
        refuse(message["id"], -32603, "this agent cannot take a message while it is working")
        return
      }
      waiting.add(message["id"])
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
