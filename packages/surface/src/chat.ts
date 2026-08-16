/**
 * Chat, on the wire.
 *
 * The conversation is TWO members and one verb set, and which is which follows
 * from what each of them is a fact about:
 *
 *   - **`transcript` is a collection**, keyed by entry id, served with the
 *     batched `deltas` verb. That verb IS snapshot-then-deltas: a subscriber
 *     gets every entry that already exists in one frame and then one coalesced
 *     frame per tick. So a tab opened halfway through a turn, a tab reloaded
 *     after a crash and a tab that has been listening since the first token all
 *     see the same conversation, with no replay protocol and no client-side
 *     merge. Keying it is what makes a TOOL FRAME updatable: the agent reports
 *     a call, then reports it again with a status, and the second report is an
 *     upsert on the same key rather than a second row.
 *
 *     The framework audit (docs/brainstorming/surface-utilization.md) asked for
 *     "events paired with a collection", because an event replays nothing to a
 *     late joiner. A `deltas` collection is that pair in one member — the push
 *     and the history are the same frames down the same subscription — so
 *     publishing each entry to an event as well would be one fact delivered
 *     twice and a dedup rule in the browser. Noted here rather than in a commit
 *     message because the next person to read the audit will ask.
 *
 *   - **`chat` is a cell**: which session this is, what it is called, which
 *     model is running, what slash commands the agent offers, and whether a
 *     turn is in flight. One value the server owns, read-only on the wire, and
 *     the panel header is a view of it.
 *
 *   - **the procedures are the verbs**: send, cancel, new, load, the list the
 *     picker draws, the two that answer a question the agent asked, and
 *     `attach` — the one that carries BYTES, in bounded chunks, because a
 *     pasted picture is the one thing about a conversation that is not already
 *     a string. Each declares its failure channel, so "a turn is already
 *     running" arrives as a `busy` a caller can branch on rather than as an
 *     opaque transport error.
 *
 * Nothing in the transcript is an optimistic echo. What a person typed appears
 * because the server put it there, exactly like everything else — so two tabs
 * always agree, and a send that failed never leaves a message on screen that
 * was never sent.
 */

import {
  AskAnswer,
  AskChoice,
  AskField,
  AskOutcome,
  FileDiff,
  Usage,
  YES_NO,
} from "@olai/acp/wire"
import {
  BusyFailure,
  Found,
  isOpFailure,
  kindOf,
  OpFailure,
  Sort,
  UsageFailure,
} from "@olai/format"
import { Schema } from "effect"

/**
 * The ask vocabulary — and {@link FileDiff} and {@link Usage} below —
 * re-exported rather than declared.
 *
 * `AskChoice`, `AskField`, `AskAnswer`, `AskOutcome`, `YES_NO`, `FileDiff` and
 * `Usage` belong to `@olai/acp` now — they are ACP's elicitation, diff and
 * usage shapes in olai's spelling, and the package that speaks the protocol is
 * the one that owns its words. They are re-exported HERE because they TRAVEL: the
 * transcript entry below carries them, the browser draws them, and consumers
 * keep importing them from the spec they already import everything else from
 * — exactly the arrangement `RepoState` has, declared by `@olai/git` and
 * re-exported through `@olai/format`.
 *
 * They come off the `@olai/acp/wire` subpath, which is the half of that
 * package with no protocol payload in it: the projections over ACP's own
 * payloads ride the main entry, and only `@olai/chat` reads those.
 */
export { AskAnswer, AskChoice, AskField, AskOutcome, FileDiff, Usage, YES_NO }

/**
 * A question the agent asked, and what became of it.
 *
 * `outcome` is `null` exactly while the turn is BLOCKED on a person: the form is
 * live, the composer says so, and nothing else in the conversation is going to
 * happen until it is answered or dismissed. Afterwards the same row stays in
 * the transcript with what was chosen written into it — the record of what was
 * asked and what was said back, which is the reason this is an entry rather
 * than a modal.
 */
export const Ask = Schema.Struct({
  fields: Schema.Array(AskField),
  outcome: Schema.NullOr(AskOutcome),
})
export type Ask = typeof Ask.Type

/**
 * A NODE a message is about — what "ask agent" on a row arms the composer with.
 *
 * The armed thing is an ID and only an id ({@link ../../surface/src/index.ts}'s
 * `chat.send`): a browser knows which row was clicked and nothing else that will
 * still be true when the server reads it. Everything below is the SET's answer,
 * read at the moment the turn is accepted — so the agent is never told a title
 * that disagrees with the file, and a node archived between arming and sending
 * refuses the send rather than naming something that has moved.
 *
 * The fields ARE `@olai/format`'s `Found`'s, five of them, taken off that
 * declaration rather than spelled again (`reading.ts`, the floor both this spec
 * and the ops layer stand on) — and for its reasons: the id is the handle every
 * olai tool takes, `file:line` is where a person is pointed, and `path` — the
 * canonical ancestor titles, outermost first — is what makes a bare title like
 * "order" mean something.
 *
 * A NARROWING and not a copy, and the difference is which half is shared. WHICH
 * fields a chip carries is this spec's own decision — deliberately less than
 * what a read answers with, the same kind of thing `./edit.ts`'s `Applied` is to
 * the ops layer's, and the reason neither is a shared declaration. What each of
 * those fields IS is the floor's, because the server fills them from
 * `Query.foundOf` (`server/src/context.ts`) and a `path` that stopped being a
 * list of strings would otherwise change under a chip that never noticed. Both
 * reviewers found that gap by experiment, one edit apart: five fields spelled
 * here independently of the five they are read off.
 * What is deliberately NOT here is the node's CONTENT: a subtree pasted into a
 * prompt is a copy that stops being true the moment anything writes, and the
 * agent has `read_node` / `read_subtree` for the live one. That is the same
 * decision an attachment already makes — the agent is handed the path and reads
 * the file itself, rather than the bytes riding the prompt.
 */
export const NodeContext = Schema.Struct({
  id: Found.fields.id,
  title: Found.fields.title,
  /** Root-relative, like every other `file:line` olai spells. */
  file: Found.fields.file,
  line: Found.fields.line,
  /** The canonical ancestor titles, outermost first. Empty at the top level of
   *  an outline, which is the answer rather than a gap in it. */
  path: Found.fields.path,
})
export type NodeContext = typeof NodeContext.Type

/**
 * What an olai WRITE did to a node, which is the other half of the same
 * feature and deliberately not a diff.
 *
 * A `.olai` diff is one enormous line per node with everything on it changing
 * at once — the commit panel's own rule, and the reason `@olai/format`
 * classifies a change into a {@link Sort} instead. So a tool call that went
 * through the ops layer carries the node-level story: the same word the commit
 * panel draws (*marked done*, *note rewritten*, *moved*), the node it is about,
 * and whatever the rollup had to say about it.
 *
 * The `sort` is the reply's own (`@olai/ops`' `Applied.sort`), derived there
 * from the two readings the write is made of — never re-derived here and never
 * read out of the summary's prose. It is `null` for a write that changed no
 * record, where there is no honest word for what happened.
 */
export const Wrote = Schema.Struct({
  sort: Schema.NullOr(Sort),
  /** The node the write was about, by ID — the reply's own `Applied.id`, which
   *  is the one thing in this row that names a node rather than describing one.
   *
   *  It is here so the row can be a REFERENCE: an olai write is the shape a
   *  transcript actually contains most often, and until this crossed the wire
   *  the panel could say *marked done · order the new cabinets* and still have
   *  nothing to point at. `null` for a reply that carried no id, which is a
   *  payload this layer reads defensively rather than a case olai produces. */
  id: Schema.NullOr(Schema.String),
  /** The node the write was about, by title — as the reply names it. */
  title: Schema.String,
  /** Which outline it lives in now, root-relative. `null` for a reply that
   *  named none — one spelling of absent across the three fields that can be,
   *  rather than a second empty for this one to mean it with. */
  file: Schema.NullOr(Schema.String),
  /** What the rollup noticed — advice on a write that LANDED, never a reason
   *  anything failed. `null` when there was nothing to say. */
  nudge: Schema.NullOr(Schema.String),
})
export type Wrote = typeof Wrote.Type

/**
 * What a row of the conversation is.
 *
 * A union of six kinds rather than a struct with everything optional, because
 * they are drawn differently and a reader has to switch on something:
 *
 *   - `user` — what was typed, the names of any pictures sent with it, and the
 *     nodes it was ABOUT ({@link NodeContext}). Never markdown: it is quoted,
 *     not rendered.
 *   - `agent` — the agent's prose, accumulated as it streams. Rendered as
 *     markdown once the turn is done, which is a view-time decision.
 *   - `tool` — a tool call, foldable, updated in place by its own id, carrying
 *     what it CHANGED in whichever of the two vocabularies applies: a
 *     {@link FileDiff} per file it rewrote directly, or the node-level
 *     {@link Wrote} story of a write that went through the ops layer — and,
 *     when a subagent made it, which `Agent` call it was made inside.
 *   - `ask` — a question the agent asked, as a form to answer: the options it
 *     offered, the boxes it left, and — once it has been answered — what was
 *     chosen. The turn is blocked on it while `ask.outcome` is `null`.
 *   - `refusal` — a write the ops layer said no to, with the structured detail
 *     the refusal carried. This is the one entry olai mints on its own behalf:
 *     the agent gets the same detail in its tool result, and a person watching
 *     deserves to see the validator's own rows rather than the agent's summary
 *     of them.
 *   - `notice` — the conversation reporting on itself: the agent died, a turn
 *     was cancelled, a session was loaded.
 *
 * A new conversation is not a kind: it EMPTIES this collection. The panel shows
 * one conversation, and rows whose context the agent no longer has are rows
 * nobody can follow up.
 */
export const ChatEntry = Schema.Struct({
  /** Stable within a session. A tool call keeps its id across updates, which is
   *  what makes the frame updatable rather than duplicated. */
  id: Schema.String,
  /** Where the entry sits in the conversation. The collection's key order is
   *  arrival order, which is the same thing until a session is reloaded; an
   *  explicit sequence means the panel never has to depend on that. */
  seq: Schema.Int,
  kind: Schema.Literals(["user", "agent", "tool", "ask", "refusal", "notice"]),
  /** The prose. For a tool entry this is its title, and for an `ask` it is what
   *  the agent said it needs — the elicitation's own message. */
  text: Schema.String,
  /** `tool` only: what the agent says the call is doing right now. */
  status: Schema.optionalKey(
    Schema.Literals(["pending", "in_progress", "completed", "failed"]),
  ),
  /** `tool` only: the arguments and the result, as the agent reported them.
   *  Folded away by default — it is detail, not conversation. */
  detail: Schema.optionalKey(Schema.String),
  /** `tool` only: what the call is SAYING as it runs — the protocol's
   *  incremental content blocks. Separate from `detail` because it is the
   *  live half: a call that has been running for thirty seconds has something
   *  to show, and its arguments are not it. */
  progress: Schema.optionalKey(Schema.String),
  /** `tool` only: the files this call REWROTE, one entry per diff block the
   *  protocol sent. Drawn rather than folded — a direct file edit is the one
   *  thing about a call whose whole content is the change, and the outline is
   *  not where it shows up. See {@link FileDiff}. */
  diffs: Schema.optionalKey(Schema.Array(FileDiff)),
  /** `tool` only: what this call WROTE through the ops layer, as a node-level
   *  story rather than as a diff. See {@link Wrote}.
   *
   *  Independent of `diffs` rather than exclusive with it, because the two are
   *  read off different halves of a report — the content blocks and the tool
   *  result — and a report says nothing about the half it does not carry. In
   *  practice a call is one or the other: a tool cannot both go through the ops
   *  layer and rewrite a file, since the agent has no filesystem channel here
   *  and olai's own tools take no bytes. A row that somehow carried both would
   *  draw both, which is the honest thing to do about a call that did both. */
  wrote: Schema.optionalKey(Wrote),
  /** `tool` only: the files the call is working in, as `path` or `path:line`.
   *  The protocol's follow-along locations, which is what lets a reader see
   *  WHERE an agent is without unfolding anything. */
  locations: Schema.optionalKey(Schema.Array(Schema.String)),
  /** `tool` only: the row of the `Agent` call this one was made INSIDE, when a
   *  subagent made it — by that row's own key, so the panel looks the frame up
   *  rather than mapping an id onto one.
   *
   *  It is what makes a turn with several agents in it READABLE. A subagent's
   *  tool calls reach olai on the same flat feed as the main agent's, so
   *  without this the panel drew them in one column, in one voice, and a
   *  reader had no way to know that three agents had been spawned at all — let
   *  alone which of them was the one grepping. The panel draws a row that has
   *  it in a lane, indented behind a rail, under the frame it names. Absent for
   *  the main agent's own calls, which are most of them. */
  parent: Schema.optionalKey(Schema.String),
  /** `refusal` only: the refusal itself, so the panel draws what it carries —
   *  a validation report's rows, each at its own `file:line` — rather than
   *  printing a sentence about them. */
  refusal: Schema.optionalKey(OpFailure),
  /** `ask` only: the form to draw, and what became of it — see {@link Ask}. */
  ask: Schema.optionalKey(Ask),
  /** True while the agent is still adding to this entry. The panel shows a
   *  cursor; nothing else depends on it. */
  streaming: Schema.optionalKey(Schema.Boolean),
  /** `user` only: the nodes this message was ABOUT — what the composer was
   *  armed with when it was sent, resolved against the set at that moment.
   *
   *  A row of the conversation rather than a fact the browser keeps, for the
   *  reason nothing else in this panel is optimistic: what was sent is what the
   *  server put here, so two tabs agree and a reload still says which node the
   *  question was about. It is also what makes the row a reference — the chips
   *  point back at the rows they were armed from ({@link NodeContext}). */
  context: Schema.optionalKey(Schema.Array(NodeContext)),
  /** `user` only: the pictures sent with the message, by FILE NAME.
   *
   *  Names and not paths, and not bytes. The agent was handed the tmp path in
   *  its prompt — that is the whole transport — and what a reader needs from
   *  the row is which picture went with which message. The tab that pasted it
   *  still has the Blob and draws a thumbnail from it; every other tab, and
   *  this one after a reload, draws the name as a chip. `/media/*` cannot help
   *  either of them: it is guarded to the served directory and these bytes are
   *  deliberately in tmp. */
  attachments: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type ChatEntry = typeof ChatEntry.Type

/**
 * One piece of a picture on its way to the conversation's tmp directory.
 *
 * A CHUNK, not a file: the bytes arrive as a sequence of these, because a
 * frame that scaled with the file would eventually be an oversized frame, and
 * the wire answers one of those by closing the socket rather than failing the
 * call — see {@link ./attach.ts}, which owns the numbers.
 */
export const AttachChunk = Schema.Struct({
  /** The file name as the browser had it. Sanitized to a safe basename on the
   *  way to disk — a name is a label here, never a path. */
  name: Schema.String,
  /** ONE chunk of the base64-encoded bytes, cut on a 4-character boundary so
   *  it decodes independently of its neighbours. */
  data: Schema.String,
  /** Absent on the FIRST chunk: create the file. Present on every later one:
   *  the path the previous call answered with, appended to.
   *
   *  It carries no authority. The server re-derives the conversation's own tmp
   *  directory and refuses any path outside it, so this is a continuation
   *  token that happens to be readable. */
  appendTo: Schema.optionalKey(Schema.String),
})
export type AttachChunk = typeof AttachChunk.Type

/**
 * Where the bytes landed, and what they are called there.
 *
 * `path` is the same string for every chunk of one file, which is what makes
 * it usable as the next chunk's `appendTo` — and it is what the prompt names,
 * because the agent reads the file itself.
 *
 * `name` is here because the SENT name is a request and this is the answer:
 * the server sanitizes it and suffixes a collision (`shot.png` pasted twice is
 * `shot.png` and `shot-1.png`), and it is this name the transcript row carries.
 * A caller that kept the name it sent would be keeping a second answer to
 * "what is this file called" — which is one paste away from being wrong, and
 * the thing that goes wrong is a thumbnail drawn against the wrong row.
 */
export const Attached = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
})
export type Attached = typeof Attached.Type

/** One of the agent's stored conversations, as the picker lists them. */
export const SessionInfo = Schema.Struct({
  id: Schema.String,
  /** What the agent named it. `null` until it has decided — a fresh session
   *  says its id first and its name later. */
  title: Schema.NullOr(Schema.String),
  /** ISO 8601, which is why the list can be sorted as strings. */
  updatedAt: Schema.NullOr(Schema.String),
})
export type SessionInfo = typeof SessionInfo.Type

/** A slash command the agent offers, as the input's completion draws it. */
export const Command = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
})
export type Command = typeof Command.Type

/**
 * An MCP server this conversation was supposed to get and did NOT, and why.
 *
 * The whole of `mcp-fail-visible`, on the wire. A server that fails to attach
 * used to leave one trace — a debug log line — and a session quietly short of
 * its tools: the panel drew a healthy conversation, the agent could not see
 * kolu's terminals, and the only way to find out which of those two facts was
 * true was to read olai's log from outside the app. Making it a member is what
 * makes it a fact a person can be shown.
 *
 * `why` is the SERVER'S OWN SENTENCE wherever there is one — a JSON-RPC error
 * message, an exec failure's reason — with the probe's framing around it and
 * nothing invented. That is the field's whole value: "kolu did not attach"
 * names the symptom every failure shares and is the one thing that never helped
 * anybody, and the four ways of failing want four different things done about
 * them (`../../chat/src/kolu.ts`).
 *
 * `where` is the file that was probed, absolute. It is here because the incident
 * this member comes from was a question about WHICH binary: a `kolu` on PATH is
 * not necessarily the host's kolu, a padi-spawned terminal prepends its own
 * bundled copy, and one of those was an older build that spawned perfectly and
 * knew nothing (juspay/kolu#2146). A reason without the path leaves the reader
 * where the incident started.
 *
 * `null` is the one failure that never reached a file, and it is the reason this
 * field is nullable at all: an environment that names a padi with no `kolu` on
 * PATH to reach it (`../../chat/src/kolu.ts`). This member shipped with `where`
 * required on the argument that a server olai can find is one it found on PATH
 * — true of every reason that comes back from a spawn, and not of the one that
 * never got to spawn anything. The absence IS the finding there, so it is spelt
 * as one rather than as a sentinel path that is not a path.
 *
 * A server that is simply NOT INSTALLED is not one of these. Nothing failed on
 * a host that is not running kolu, and a panel reporting an absence as a fault
 * is a panel a reader learns to ignore — which is the same mistake as saying
 * nothing, arrived at from the other side.
 */
export const MissingServer = Schema.Struct({
  /** What it is called — the same name the session would have been given it
   *  under, which is the name the agent's own tools would have carried. */
  name: Schema.String,
  /** The executable that was probed, absolute — or `null` when the failure was
   *  that there was nothing to probe. */
  where: Schema.NullOr(Schema.String),
  /** In the server's or the probe's own words. Never a category. */
  why: Schema.String,
})
export type MissingServer = typeof MissingServer.Type

/**
 * Where the conversation stands. Everything the header draws and everything a
 * composer needs to know about whether it may send.
 */
export const ChatState = Schema.Struct({
  /**
   * What the one session is doing.
   *
   *   - `booting` — the agent is starting, or being asked for its sessions.
   *     A prompt typed now is accepted and sent when the handshake finishes.
   *   - `idle` — ready.
   *   - `thinking` — a turn is in flight. Sending is still allowed: the
   *     message goes in the transcript and QUEUES, and is prompted the moment
   *     this turn ends. A person who has thought of the next thing should not
   *     have to hold it in their head until an agent is ready for it.
   *   - `gone` — the agent is not there. `trouble` says why, and the next
   *     prompt retries the boot.
   *   - `off` — no ACP agent is configured. The panel still DRAWS and says so,
   *     naming the variable that would give it one: a capability that is
   *     silently absent cannot be told apart from one that is broken. The
   *     server serves the outlines either way.
   */
  status: Schema.Literals(["off", "booting", "idle", "thinking", "gone"]),
  /** The session the server is in, or `null` between sessions. */
  session: Schema.NullOr(SessionInfo),
  /** The model a turn actually runs on, labelled the way the agent labels its
   *  own models. `null` until the agent has said. */
  model: Schema.NullOr(Schema.String),
  /**
   * How full this conversation's context is — see {@link Usage}.
   *
   * Beside the model rather than under it, and for the model's own reason: the
   * header names what a turn RUNS ON because its cost and character depend on
   * it, and this is the other half of that sentence — how much room is left to
   * run it in, which is what "should I `/compact`?" is asking.
   *
   * `null` until the agent has reported some, which is not the same as a
   * conversation that has spent nothing (that is `used: 0`): an agent that
   * sends no `usage_update` at all leaves this empty for the life of the
   * session, and the header simply says nothing about room. It goes with the
   * conversation, like the model and the missing servers.
   */
  usage: Schema.NullOr(Usage),
  commands: Schema.Array(Command),
  /** How many messages are typed and waiting for the turn in flight to end.
   *
   *  A count rather than the messages themselves, because the messages are
   *  already in the transcript: what you typed is a row the moment you send
   *  it, in the order you meant it, and this is only the panel's way of saying
   *  the agent has not reached them yet. */
  queued: Schema.Int,
  /**
   * How many questions the agent is waiting on a person to answer.
   *
   * Its own fact rather than a sixth `status`, because it is TRUE AT THE SAME
   * TIME as `thinking`: the turn is in flight and blocked, and a panel that
   * said only one of those would have to pick which half to lie about. Nonzero
   * is what turns the composer's "working…" into "waiting on you" — the whole
   * point being that a question nobody has noticed hangs the turn silently
   * forever.
   */
  asking: Schema.Int,
  /** The last thing that went wrong where no caller was waiting — a boot that
   *  failed, an agent that died mid-turn. `null` once a turn succeeds. */
  trouble: Schema.NullOr(Schema.String),
  /**
   * The MCP servers this conversation was meant to get and did not — see
   * {@link MissingServer}.
   *
   * On the CELL rather than in the transcript, and that is the decision: this
   * is a standing property of the conversation, like the model it runs on and
   * the commands it offers, and not something that HAPPENED at a point in it. A
   * notice row would scroll away under the first answer and be gone by the time
   * anybody wondered why the agent could not see their terminals — which is the
   * complaint this member exists to end, arrived at one screenful later.
   *
   * Decided per conversation, because the servers are: a padi started after
   * olai is picked up by the next session, so this empties itself the moment
   * one attaches. EMPTY is the ordinary case and the one every healthy session
   * is in — nothing is drawn for it.
   */
  missing: Schema.Array(MissingServer),
})
export type ChatState = typeof ChatState.Type

/** What a page sees before any frame arrives, and what the cell holds when
 *  there is no agent configured at all. The panel draws in this state — see
 *  `status` above — so this is a value a reader ends up looking at, not a
 *  placeholder for one. */
export const CHAT_OFF: ChatState = {
  status: "off",
  session: null,
  model: null,
  usage: null,
  commands: [],
  queued: 0,
  asking: 0,
  trouble: null,
  missing: [],
}

/** Why a chat verb said no. `OpFailure`'s four kinds already cover it — `busy`
 *  for a turn in flight, `not-found` for a session that is gone, `usage` for an
 *  empty prompt — and a second vocabulary would be a second thing to decode. */
export const ChatFailure = OpFailure

/** Re-exported so a consumer of the surface can name a refusal, ask which
 *  KIND it is and draw its detail without also depending on the format
 *  package: the browser subscribes to this spec, not to the format, and a
 *  second answer to "which kind is this" is exactly what it must not have. */
export { BusyFailure, isOpFailure, kindOf, OpFailure, UsageFailure }
