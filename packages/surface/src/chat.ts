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
 *   - **the procedures are the verbs**: send, resend, cancel, new, load, the
 *     list the picker draws, the two that answer a question the agent asked,
 *     and `attach` — the one that carries BYTES, in bounded chunks, because a
 *     pasted picture is the one thing about a conversation that is not already
 *     a string. Each declares its failure channel, so "a turn is already
 *     running" arrives as a `busy` a caller can branch on rather than as an
 *     opaque transport error.
 *
 *     `resend` is the odd one and says something about the rest: every other
 *     verb acts on the conversation, and that one acts on a ROW — the `user`
 *     entry the agent would not take. It is a verb rather than a second send
 *     because the browser cannot rebuild that message (the row carries its
 *     pictures by name and the prompt carries their paths), so what the server
 *     kept is the only whole copy.
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
 * that disagrees with the file, and a node the set no longer declares between
 * arming and sending refuses the send rather than naming something that is gone.
 *
 * A node ARCHIVED between the two is not that, and this paragraph used to say it
 * was: archiving moves a record with its id intact, so it resolves, and it is
 * meant to — what was put away is reachable at every door that asks for it
 * (2026-08-17's ruling took the default presence, never the way to ask). That
 * it WAS put away is a thing the agent has to be told, and it is told by the
 * line rather than by a field here: `file` already says `_olai/Trash.olai`, and
 * `@olai/chat`'s `lineFor` asks the format the same question every other reader
 * of an archive asks (`isTrashed`). A boolean beside the file it is computed
 * from would be one more pair for a producer to get wrong, and a convention
 * frozen into a wire schema — where #226 moved this very area two commits ago.
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
 * A call that SENT AN AGENT OUT, and what is known about the agent.
 *
 * It exists so that a spawn is legible as a spawn from the instant it is
 * announced. The other half of the same feature — which `Agent` call a row was
 * made INSIDE ({@link ToolEntry.parent}) — cannot say anything until the
 * spawned agent has made a call, and a subagent that is still reading its
 * instructions has made none: for the whole of that stretch, which is the
 * stretch a person is watching, the panel had a pending row with an ordinary
 * title on it and no reason to think anybody had been sent anywhere.
 *
 * PRESENCE is the fact, and the field inside it is the detail. A spawn is known
 * to be one whether or not it named a kind of agent — so this is a STRUCT that
 * may be empty rather than a nullable string, and which of the two it is
 * decides how a caller can be wrong. A bare `spawned: string | null` puts "not
 * a spawn" and "a spawn nobody labelled" one falsy value apart, and the first
 * `if (entry.spawned)` anybody writes drops the second on the floor; an empty
 * struct is truthy, and the only way to ask about the kind is to ask about the
 * kind.
 */
export const Spawned = Schema.Struct({
  /** Which kind of agent, in the words whoever configured it used —
   *  `Explore`, `general-purpose`, a name out of somebody's own agent
   *  definitions.
   *
   *  ABSENT when nobody has said, which is an ordinary spawn rather than a
   *  broken one: naming a kind is optional in the tool that starts an agent.
   *  Absent rather than `null` so that "nobody said" is spelled the way
   *  "unchanged" is spelled everywhere else on a tool row — the fact arrives
   *  across several frames, and one word for a field that has nothing in it
   *  means the transcript's stickiness needs no second rule to hold this
   *  together.
   *
   *  The agent's own word, never mapped onto one of olai's. A name this end
   *  does not recognise is drawn as it came, for the reason the header draws an
   *  unrecognised model id raw: rounding somebody's agent to the nearest one
   *  this panel has heard of would be naming an agent nobody started. */
  kind: Schema.optionalKey(Schema.String),
})
export type Spawned = typeof Spawned.Type

/**
 * What became of a message that did not land — the two things this end can
 * HONESTLY know, and the difference between them is a button.
 *
 *   - `refused` — it CERTAINLY did not go. Something said no to it while it
 *     had taken no effect: the agent has no steering method or no such session,
 *     the process was not there to be asked, or the turn it was aimed at had
 *     been stopped by the person who sent it (the agent answers "nothing to
 *     steer", and the server tells that from a turn that merely finished by the
 *     ticket the message was aimed at). Nothing happened, so *send again* is an
 *     honest offer and the server still holds the exact prompt to make good on
 *     it.
 *   - `unanswered` — NOTHING CAME BACK. The steer went out and the deadline
 *     passed, or the connection died with it in flight. An agent that took the
 *     message and then went quiet is indistinguishable from one that never took
 *     it, so this end cannot say which — and the panel says exactly that, with
 *     no retry, because pressing one would offer a duplicate to somebody with
 *     no way to tell. The words are still on the row, which was always the
 *     promise; what is missing is the certainty, not the message.
 *
 * The distinction is made where it is knowable — at the wire, in
 * `@olai/chat`'s `AgentGone` — and carried here rather than re-inferred from a
 * sentence: a reason is prose, and prose is not something a panel can draw two
 * faces out of.
 */
export const Delivery = Schema.Literals(["refused", "unanswered"])
export type Delivery = typeof Delivery.Type

/**
 * What a tool call is doing, in ACP's own four words.
 *
 * Required on a {@link ToolEntry} because the transcript's one writer always
 * says: a call nothing has reported a status for is announced `pending`, and
 * that is a value on the row rather than a default every reader re-applies.
 */
export const ToolStatus = Schema.Literals([
  "pending",
  "in_progress",
  "completed",
  "failed",
])
export type ToolStatus = typeof ToolStatus.Type

/**
 * The four fields every row carries, in the order the encoded JSON has always
 * written them. Spread into each arm so a kind-discriminated union still
 * encodes as the same flat object: `id`, `seq`, `since`, then `kind`, then
 * `text`, then that arm's own keys. Reordering this, or inserting `kind`
 * anywhere else, is a byte change.
 *
 * `since` is WHEN the row first appeared, as an ISO 8601 instant — the
 * server's clock at the moment olai first heard of it. Minted beside `seq` and
 * by the same writer: `seq` is WHERE a row sits and this is WHEN it arrived,
 * both decided once and neither settable by a caller. Sticky across every later
 * report of the same row, so a tool call announced `pending` and updated four
 * times keeps the instant it was ANNOUNCED rather than the instant of the last
 * frame — which is the only instant a duration can honestly be measured from.
 *
 * HERE rather than in the browser, and that is the whole reason it is on the
 * wire at all. This collection is served snapshot-then-deltas, so a tab opened
 * mid-turn, a tab reloaded after a crash and a tab that has been listening
 * since the first token all see the same conversation — and a browser-side
 * stopwatch, started whenever a tab happened to begin looking, would have each
 * of them saying a different number and every one of them short. What a call
 * has been running for is a fact about the call.
 *
 * REQUIRED, like `seq` and for its reason: the transcript is the only thing in
 * this tree that mints a row, it is not persisted, and it stamps every one —
 * so "no stamp" describes a server that does not exist, and making it optional
 * would hand every present and future reader a silence branch for a case
 * nothing can produce. Worse, that branch would be indistinguishable from the
 * one that is real: a malformed instant, which is a claim about somebody else's
 * string rather than about a missing field.
 */
const chatEntryHead = {
  /** Stable within a session. A tool call keeps its id across updates, which is
   *  what makes the frame updatable rather than duplicated. */
  id: Schema.String,
  /** Where the entry sits in the conversation. The collection's key order is
   *  arrival order, which is the same thing until a session is reloaded; an
   *  explicit sequence means the panel never has to depend on that. */
  seq: Schema.Int,
  since: Schema.String,
}

/** `tool` and `ask`: the row of the `Agent` call this one was made INSIDE,
 *  when a subagent made it — by that row's own key, so the panel looks the
 *  frame up rather than mapping an id onto one.
 *
 *  It is what makes a turn with several agents in it READABLE. A subagent's
 *  tool calls reach olai on the same flat feed as the main agent's, so
 *  without this the panel drew them in one column, in one voice, and a
 *  reader had no way to know that three agents had been spawned at all — let
 *  alone which of them was the one grepping. The panel draws a row that has
 *  it in a lane, indented behind a rail, under the frame it names. Absent for
 *  the main agent's own calls and questions, which are most of them.
 *
 *  A QUESTION carries it for the same reason and one sharper one. A
 *  subagent's permission form is a decision a person is about to make, and a
 *  form drawn in the main column says the main agent is the one asking — the
 *  one row in this collection where being wrong about who is speaking
 *  changes what somebody does. It is also the row that BREAKS A RUN: a form
 *  with no lane, landing between two of a subagent's own calls, ends the
 *  stretch, and the lane re-opens and names itself again underneath it. */
const parent = Schema.optionalKey(Schema.String)

/**
 * What a person typed.
 *
 * Never markdown: it is quoted, not rendered. Carries a {@link Delivery} when
 * it did not go, or cannot be shown to have gone — the one row in this
 * collection that records something that did NOT happen.
 */
export const UserEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("user"),
  text: Schema.String,
  /** The nodes this message was ABOUT — what the composer was armed with when
   *  it was sent, resolved against the set at that moment.
   *
   *  A row of the conversation rather than a fact the browser keeps, for the
   *  reason nothing else in this panel is optimistic: what was sent is what the
   *  server put here, so two tabs agree and a reload still says which node the
   *  question was about. It is also what makes the row a reference — the chips
   *  point back at the rows they were armed from ({@link NodeContext}). */
  context: Schema.optionalKey(Schema.Array(NodeContext)),
  /** The pictures sent with the message, by FILE NAME.
   *
   *  Names and not paths, and not bytes. The agent was handed the tmp path in
   *  its prompt — that is the whole transport — and what a reader needs from
   *  the row is which picture went with which message. The tab that pasted it
   *  still has the Blob and draws a thumbnail from it; every other tab, and
   *  this one after a reload, draws the name as a chip. `/media/*` cannot help
   *  either of them: it is guarded to the served directory and these bytes are
   *  deliberately in tmp. */
  attachments: Schema.optionalKey(Schema.Array(Schema.String)),
  /**
   * What became of this message's DELIVERY, when it did not simply go.
   *
   * Everything typed goes to the agent the moment it is sent — a turn already
   * running is steered rather than waited on — so a row only carries this when
   * that delivery did not happen, or cannot be shown to have happened. Two
   * values, because there are exactly two things this end can honestly know
   * (see {@link Delivery}), and they were one flag until they were told apart:
   * a person watching a message go quiet read the same `not sent` a refusal
   * gives, and pressed the same button under it.
   *
   * Absent on every row that WENT, rather than a `null` arm — the ordinary
   * message says nothing about this, the same way it says nothing about diffs.
   * It is cleared by {@link ../index.ts}'s `chat.resend` when the retry lands,
   * so the row stops advertising a failure that has stopped being true.
   */
  delivery: Schema.optionalKey(Delivery),
})
export type UserEntry = typeof UserEntry.Type

/** The agent's prose, accumulated as it streams. Rendered as markdown once the
 *  turn is done, which is a view-time decision. */
export const AgentEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("agent"),
  text: Schema.String,
  /** True while the agent is still adding to this entry. The panel shows a
   *  cursor; nothing else depends on it. Absent rather than `false` — the
   *  ordinary settled paragraph says nothing about this, and the writer only
   *  ever writes `true`. */
  streaming: Schema.optionalKey(Schema.Literal(true)),
})
export type AgentEntry = typeof AgentEntry.Type

/**
 * A tool call, foldable, updated in place by its own id.
 *
 * Carries what it CHANGED in whichever of the two vocabularies applies: a
 * {@link FileDiff} per file it rewrote directly, or the node-level
 * {@link Wrote} story of a write that went through the ops layer — and, when
 * a subagent made it, which `Agent` call it was made inside, or, when it
 * STARTED one, what is known about the agent it started ({@link Spawned}).
 */
export const ToolEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("tool"),
  /** The call's title, which is the agent's own string. */
  text: Schema.String,
  /** What the agent says the call is doing right now. Always present: the
   *  writer defaults an unannounced call to `pending`, so a reader does not. */
  status: ToolStatus,
  /** The arguments and the result, as the agent reported them. Folded away by
   *  default — it is detail, not conversation. */
  detail: Schema.optionalKey(Schema.String),
  /** What the call is SAYING as it runs — the protocol's incremental content
   *  blocks. Separate from `detail` because it is the live half: a call that
   *  has been running for thirty seconds has something to show, and its
   *  arguments are not it. */
  progress: Schema.optionalKey(Schema.String),
  /** The files this call REWROTE, one entry per diff block the protocol sent.
   *  Drawn rather than folded — a direct file edit is the one thing about a
   *  call whose whole content is the change, and the outline is not where it
   *  shows up. See {@link FileDiff}. */
  diffs: Schema.optionalKey(Schema.Array(FileDiff)),
  /** What this call WROTE through the ops layer, as a node-level story rather
   *  than as a diff. See {@link Wrote}.
   *
   *  Independent of `diffs` rather than exclusive with it, because the two are
   *  read off different halves of a report — the content blocks and the tool
   *  result — and a report says nothing about the half it does not carry. In
   *  practice a call is one or the other: a tool cannot both go through the ops
   *  layer and rewrite a file, since the agent has no filesystem channel here
   *  and olai's own tools take no bytes. A row that somehow carried both would
   *  draw both, which is the honest thing to do about a call that did both. */
  wrote: Schema.optionalKey(Wrote),
  /** The files the call is working in, as `path` or `path:line`. The protocol's
   *  follow-along locations, which is what lets a reader see WHERE an agent is
   *  without unfolding anything. */
  locations: Schema.optionalKey(Schema.Array(Schema.String)),
  parent,
  /** This call SPAWNED an agent — see {@link Spawned}. The other end of
   *  `parent`, and the end that can be known at the moment an agent is sent out
   *  rather than at the moment it first reports back. Absent on every call that
   *  spawned nobody, which is nearly all of them. */
  spawned: Schema.optionalKey(Spawned),
  /**
   * The TURN this call was announced in has ended, and the call was never
   * reported on.
   *
   * The sibling of {@link AgentEntry.streaming} in every way that matters —
   * derived by the transcript's one writer, only ever `true`, and absent for
   * the ordinary case — and it exists because `status` alone cannot say this.
   * A status is STICKY: an agent that died between announcing a call and
   * reporting on it leaves that row `pending` for as long as the panel is open,
   * and that is deliberate, because the row is the honest record of a call that
   * was announced and never came back. What olai knows and the row could not
   * say is that its turn is over.
   *
   * A CONVERSATION-LEVEL "is a turn in flight" is the approximation this
   * replaces, and it fails in one exact place: send again in the same
   * transcript — a dead agent's rows are deliberately not cleared — and the new
   * turn makes the whole panel live again, so last turn's abandoned calls
   * resume looking like work in progress, and the panel's live faces would put
   * a pulsing rail and a five-minute clock on them. Whether a call is still
   * going is a fact about the CALL's turn, so it is on the call.
   *
   * Cleared by a fresh report on the same call, which is the only thing that
   * could make it untrue: the field means "as far as anything here knows, this
   * one never came back", and a frame saying otherwise is anything here
   * knowing.
   */
  stranded: Schema.optionalKey(Schema.Literal(true)),
})
export type ToolEntry = typeof ToolEntry.Type

/**
 * A question the agent asked, as a form to answer: the options it offered, the
 * boxes it left, and — once it has been answered — what was chosen. The turn
 * is blocked on it while `ask.outcome` is `null`. Carries which `Agent` call
 * ASKED it when a subagent did, the same way a tool call carries which one
 * made it.
 */
export const AskEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("ask"),
  /** What the agent said it needs — the elicitation's own message. */
  text: Schema.String,
  parent,
  /** The form to draw, and what became of it — see {@link Ask}. Always present:
   *  an ask row without a form is not an ask row. */
  ask: Ask,
})
export type AskEntry = typeof AskEntry.Type

/**
 * A write the ops layer said no to, with the structured detail the refusal
 * carried. This is the one entry olai mints on its own behalf: the agent gets
 * the same detail in its tool result, and a person watching deserves to see
 * the validator's own rows rather than the agent's summary of them.
 */
export const RefusalEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("refusal"),
  text: Schema.String,
  /** The refusal itself, so the panel draws what it carries — a validation
   *  report's rows, each at its own `file:line` — rather than printing a
   *  sentence about them. Always present: a refusal row without a refusal is
   *  not one. */
  refusal: OpFailure,
})
export type RefusalEntry = typeof RefusalEntry.Type

/** The conversation reporting on itself: the agent died, a turn was cancelled,
 *  a session was loaded. */
export const NoticeEntry = Schema.Struct({
  ...chatEntryHead,
  kind: Schema.Literal("notice"),
  text: Schema.String,
})
export type NoticeEntry = typeof NoticeEntry.Type

/**
 * What a row of the conversation is.
 *
 * A union of six kinds, discriminated on `kind`. They are drawn differently
 * and a reader has to switch on something; the type now says which fields a
 * kind carries, so a non-call row with a `status` is unrepresentable rather
 * than a fact every consumer had to re-establish.
 *
 * The encoding of every row the writer produces is unchanged: the same flat
 * JSON, optional keys omitted, in the same field order. The decoder now also
 * requires the flags' only honest value (`streaming` / `stranded` are `true`
 * when present, never `false`) and the fields a kind always carries (`status`
 * on a tool, `ask` on an ask, `refusal` on a refusal). A key that does not
 * belong to the matching arm is dropped at decode rather than re-emitted —
 * sanitizing, not a second encoding. No migration for well-formed rows.
 *
 *   - `user` — {@link UserEntry}
 *   - `agent` — {@link AgentEntry}
 *   - `tool` — {@link ToolEntry}
 *   - `ask` — {@link AskEntry}
 *   - `refusal` — {@link RefusalEntry}
 *   - `notice` — {@link NoticeEntry}
 *
 * A new conversation is not a kind: it EMPTIES this collection. The panel shows
 * one conversation, and rows whose context the agent no longer has are rows
 * nobody can follow up.
 */
export const ChatEntry = Schema.Union([
  UserEntry,
  AgentEntry,
  ToolEntry,
  AskEntry,
  RefusalEntry,
  NoticeEntry,
])
export type ChatEntry = typeof ChatEntry.Type

/**
 * ONE PIECE OF A ROW STILL BEING SAID — the wire's unit while an answer
 * streams, and the reason a five-paragraph answer costs the socket five
 * paragraphs instead of three hundred of them.
 *
 * A row that GROWS used to be published the way every other row is: the whole
 * entry, upserted on its own key, once per chunk the agent sent. An agent
 * streams a token at a time — 3,218 bytes of answer arrived as 643 chunks
 * averaging five bytes, measured on a real turn — and an upsert per chunk puts
 * the SUM OF THE PREFIXES on the wire, which is quadratic in the length of the
 * answer: 1,039,111 bytes for those 3,218, three hundred and twenty-three
 * times the thing being read. On a link with a quarter-second of latency in it
 * that is not merely wasteful — hundreds of small-then-large writes pace
 * badly, and what a reader SEES is an answer arriving in lumps.
 *
 * So a chunk rides as ITS OWN ENTRY in a collection of its own, and carries
 * only what is new. `of` names the transcript row it belongs to, `at` is where
 * in that row's text this piece starts, and `text` is the piece. The reader
 * joins them onto the row it already holds. What crosses the socket over a
 * turn is the answer's own size, once.
 *
 * THE JOIN IS TOTAL AND IDEMPOTENT, which is what lets this be a SECOND
 * member rather than a change to how the first one is delivered. `transcript`
 * still answers a new subscriber with WHOLE rows — the server keeps the row's
 * true text and hands it over complete — so a piece a tab is handed may be
 * text its row already has. `at` is what makes that decidable without a
 * protocol: a piece that ends at or before the row's own length is already
 * folded in and adds nothing; one that ends past it contributes exactly the
 * part past it. Two snapshots taken a moment apart, in either order, converge
 * on the same string — which is the whole of what the pairing has to promise.
 *
 * AND A WHOLE ROW ALWAYS SUPERSEDES ITS PIECES. Every upsert on the
 * `transcript` carries the row's text in full, so the server drops a row's
 * pieces at the moment it republishes it — at the end of the paragraph, at a
 * cancel, at a new conversation — and the last word about a row is always the
 * row. Nothing has to be reassembled to be right; the pieces are an
 * ACCELERATION of a fact the transcript states anyway.
 */
export const Saying = Schema.Struct({
  /** The transcript row this piece belongs to, by that row's own key — the
   *  same spelling `ToolEntry.parent` uses, and for its reason: what a reader
   *  wants is the row, so the row is what is named. */
  of: Schema.String,
  /** Where this piece starts in that row's text, counted in characters of the
   *  text the transcript itself holds. It is what makes the join idempotent
   *  ({@link Saying}) and what orders two pieces of one row without a counter
   *  beside them: pieces of a row are contiguous, so `at` is both the position
   *  and the sequence. */
  at: Schema.Int,
  /** The piece itself — never the text so far, which is the bug this member
   *  exists to be the absence of. */
  text: Schema.String,
})
export type Saying = typeof Saying.Type

/**
 * How a piece is filed: the row it belongs to and where it starts.
 *
 * Derived from the value rather than counted, so the key of a piece is a
 * function of the piece — two writers cannot mint the same key for two
 * different pieces, and a re-publish of one piece is an upsert on the key it
 * already had. Spelled ONCE, here, because both ends need it: the server files
 * pieces under it and drops a row's by it, and a reader that wanted to look one
 * up would have to agree.
 */
export const sayingKey = (piece: Pick<Saying, "of" | "at">): string =>
  `${piece.of}#${piece.at}`

/**
 * Where a piece ENDS in its row's text — the offset the NEXT piece of that row
 * starts at.
 *
 * One line, spelled here for {@link sayingKey}'s reason and a sharper one: it
 * is the whole of what both ends decide with. The server merges a piece into
 * the one it is holding exactly when the new one starts where the held one
 * ends, and the reader folds a piece onto a row exactly when it ends past what
 * the row already has. Two spellings of that arithmetic is the day one of them
 * is off by a character and a paragraph comes out with a syllable missing.
 */
export const sayingEnd = (piece: Pick<Saying, "at" | "text">): number =>
  piece.at + piece.text.length

/**
 * How often the server lets a growing row's pieces onto the wire, and how
 * often the panel re-renders one.
 *
 * ONE NUMBER for the two ends, because they are one cadence. Each chunk an
 * agent sends arrives as its own event, so a piece per chunk is a websocket
 * frame per chunk — six hundred of them for a five-paragraph answer, each one a
 * write on a link that paces them by round trips. Time-coalesced, a turn is a
 * few dozen frames carrying the same bytes, and the panel's markdown is
 * re-parsed a few times a second however fast the tokens land.
 *
 * A tenth of a second is chosen the way a frame budget is: fast enough that
 * text appears to flow, slow enough that the socket and the markdown parser
 * are not being asked about single characters. It bounds LATENCY, never
 * content — a row that has stopped growing is published at once, so the last
 * word of an answer never waits on a clock.
 */
export const SAYING_MS = 120

/**
 * Which of a tool call's four statuses mean it HAS NOT COME BACK.
 *
 * Here, beside the field, because BOTH ENDS ask it and they must not answer
 * differently. The server asks when a turn ends — which of its calls were
 * abandoned, and so must be marked {@link ToolEntry.stranded} — and the browser
 * asks to decide whether to draw a live rail under a spawn and a ticking
 * duration on a frame. Two spellings of one four-word vocabulary is one of them
 * being missed the day ACP grows a fifth status, and the way that shows up is a
 * server marking a call finished while a panel goes on timing it.
 *
 * `pending` is a RUNNING state, which is the one thing here that is not
 * obvious: the adapter announces EVERY tool call with it, so it means
 * "announced" rather than "not started". The writer always writes a status, so
 * there is no absent case to treat as the same thing. Anything spelled some
 * other way is not something this protocol will call running.
 */
export const isRunningStatus = (status: ToolStatus): boolean =>
  status === "pending" || status === "in_progress"

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

/**
 * ONE CONVERSATION, by the only three things every agent says about one.
 *
 * The panel is IN one of these ({@link ChatState}'s `session`), and the picker
 * LISTS them ({@link SessionInfo}) — two readings of one fact, which is why the
 * fields are written once here and extended there rather than restated.
 */
export const Conversation = Schema.Struct({
  id: Schema.String,
  /** What the agent named it. `null` until it has decided — a fresh session
   *  says its id first and its name later. */
  title: Schema.NullOr(Schema.String),
  /** ISO 8601, which is why the list can be sorted as strings. */
  updatedAt: Schema.NullOr(Schema.String),
})
export type Conversation = typeof Conversation.Type

/**
 * One of the stored conversations, as the picker lists them — and WHOSE it is.
 *
 * The agent is on the ROW rather than on a group around it, because it is a
 * fact about the conversation and travels wherever the row does: a session id
 * means nothing to the other agent (asking opencode to load a Claude id gets a
 * refusal), so the id and the agent that can open it are one value. Drawing the
 * list in groups is the client's arrangement of that fact, not the fact.
 *
 * It arrived when the list stopped being one agent's. The panel talks to one
 * agent at a time, and the list used to be asked of exactly that one — so every
 * conversation you had with the OTHER agent disappeared from view the moment
 * you started a chat with this one, and the only way back was to start a new
 * chat with the first just so the list would name them again.
 *
 * The panel's OWN conversation is a {@link Conversation} and not one of these:
 * which agent it belongs to is already the panel's `talking`, and a second
 * copy of that on the row beside it would be a fact with two spellings free to
 * disagree.
 */
export const SessionInfo = Schema.Struct({
  ...Conversation.fields,
  /** One of {@link AGENTS}' ids. */
  agent: Schema.String,
})
export type SessionInfo = typeof SessionInfo.Type

/**
 * An agent that could not be asked what it has stored, and why.
 *
 * The list spans every installed agent, so "could not ask" stopped being a
 * question about the whole call and became a question about ONE ROW OF THE
 * ROSTER: one agent broken must not take the other's conversations off the
 * screen — that is the shape of the bug the fan-out exists to fix — and it must
 * not be silent either, because an absent list drawn as *no stored
 * conversations* is a claim about somebody's disk standing in for never having
 * reached it. Both halves are the same rule, one layer apart.
 */
export const Unreachable = Schema.Struct({
  /** One of {@link AGENTS}' ids. */
  agent: Schema.String,
  /** The agent's own reason, as a person reads it. */
  why: Schema.String,
})
export type Unreachable = typeof Unreachable.Type

/** What every installed agent has stored here — and which of them could not be
 *  asked. Two arrays rather than a failure, because the answer to "what
 *  conversations are there" is partial rather than absent when one agent is
 *  broken. */
export const Listed = Schema.Struct({
  /** Merged newest-first, each row saying whose it is. */
  sessions: Schema.Array(SessionInfo),
  unreachable: Schema.Array(Unreachable),
})
export type Listed = typeof Listed.Type

/**
 * EVERY AGENT olai knows how to talk to, and what a person reads.
 *
 * HERE, on the wire, because it is the one vocabulary BOTH ENDS keep a table
 * over and neither owns: the server's roster says how to find each of them and
 * how to read its frames (`../../chat/src/agents/roster.ts`), and the client
 * draws a mark for each and — when NONE of them is installed, which is the one
 * moment nothing can be sent — says where to get one
 * (`../../web/src/client/chat/NoAgent.tsx`). Two tables keyed alike, in two
 * packages that never otherwise meet, is exactly the contract that breaks
 * silently: adding a third agent server-side would leave the face that explains
 * agents quietly not mentioning it.
 *
 * A RECORD, so both tables are `{ [K in AgentId]: … }` and the type checker is
 * what enforces coverage — the same arrangement `@olai/format`'s `FILE_KINDS`
 * and `MARKS` already make for their own cross-package names, and for the same
 * reason. What is NOT here is anything either end can answer alone: how to find
 * an agent, how to read its wire, what mark to draw, where to download it.
 *
 * The NAME travels on the wire too ({@link AgentChoice}), and that is not this
 * table being ignored: a browser draws what the server SENT, because the server
 * is what knows which agents are actually here. This is the fallback for the
 * face drawn when nothing was sent, and the one spelling both sides use.
 */
export const AGENTS = {
  claude: { name: "Claude Code" },
  opencode: { name: "opencode" },
} as const

/** One of them. Every table over agents is keyed by this. */
export type AgentId = keyof typeof AGENTS

/**
 * ONE AGENT a conversation can be with — a row of the picker, and, once one is
 * chosen, who the header names beside the model.
 *
 * TWO FIELDS AND NO MORE. What to spawn, how to read its wire, where it was
 * found: all of that stays on the server (`../../chat/src/agents/roster.ts`),
 * because a browser that knew what to spawn would be a browser that could ask
 * for it. What crosses is a NAME to draw and an ID to send back.
 *
 * The ICON is not here either, and that is the same decision read from the
 * other side: which mark to draw for an agent is a fact about the drawing, so
 * the client keeps the marks and looks them up by id, with a generic one for an
 * agent it has no mark for (`../../web/src/client/chat/AgentMark.tsx`). A
 * server sending an icon would be a server shipping artwork over a websocket to
 * be told what a shape is.
 */
export const AgentChoice = Schema.Struct({
  /** Stable and never shown: `claude`, `opencode`. What a picker sends back,
   *  what a memory writes down, and what the client draws a mark by. */
  id: Schema.String,
  /** What a person reads. */
  name: Schema.String,
})
export type AgentChoice = typeof AgentChoice.Type

/**
 * WHO the panel is talking to — or that it is waiting to be told which.
 *
 * ONE MEMBER RATHER THAN THREE, and that is the shape carrying the rule instead
 * of a comment reminding somebody of it. Written flat it was an agent, a
 * boolean for "is the panel asking", and a boolean for "does this agent take a
 * message into a running turn" — three fields whose validity depended on each
 * other and on nothing enforceable. Two of the eight combinations were lies a
 * reader could be handed: a panel ASKING which agent while naming one, and a
 * `steers` that answered for an agent that was not there. Both are now
 * unspellable, which is cheaper than both being untrue.
 *
 * `null` is the third state and needs no arm: the panel is talking to nobody
 * and is not asking either — no agent is installed at all, or the first frame
 * has not arrived, or a subprocess is being swapped for another.
 */
export const Talking = Schema.Union([
  /** The agent this conversation is with. */
  Schema.Struct({
    kind: Schema.Literal("agent"),
    /** {@link AgentChoice}'s two fields, spelled here rather than nested: what
     *  a reader wants off this is a name and a mark, and `talking.agent.name`
     *  would be a box around one fact. */
    id: Schema.String,
    name: Schema.String,
    /**
     * Whether a message sent WHILE A TURN RUNS goes into that turn.
     *
     * True and what you type lands in the turn the agent is already running,
     * which is the only moment saying it is worth anything; false and the agent
     * QUEUES it behind the turn and reaches it when that turn is over. Opencode
     * is the second (it has no steering method at all), and the composer says
     * so rather than looking identical and behaving differently — a degradation
     * a person can see is one they can work with.
     *
     * ON THE AGENT because it is a fact ABOUT one. Beside it, on the state, it
     * was a field a reader could ask with nobody to answer for.
     */
    steers: Schema.Boolean,
  }),
  /**
   * Several agents are installed and nobody has said which this conversation is
   * with, so the panel holds none until somebody does.
   *
   * NEVER with one agent installed. A one-row question is friction with no
   * answer behind it, and every olai before this one was in exactly that state;
   * what a person gets instead is the header naming the agent they are talking
   * to, which is the part they did not have.
   */
  Schema.Struct({ kind: Schema.Literal("asking") }),
])
export type Talking = typeof Talking.Type

/** The agent a conversation is with, or `null` — the narrowing every reader of
 *  {@link ChatState.talking} wants, written once so that "is there an agent" is
 *  asked the same way in the header, the composer and the panel's own choice of
 *  body. */
export const agentIn = (
  state: { readonly talking: Talking | null },
): Extract<Talking, { kind: "agent" }> | null =>
  state.talking?.kind === "agent" ? state.talking : null

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
 * The agent is there and there is NO CONVERSATION, because opening one was
 * REFUSED — and why.
 *
 * ITS OWN FACT rather than a sixth `status`, for `asking`'s reason and a
 * sharper version of it: the two things are true at the same time. The agent
 * answered, so it is running and the header says so; what failed is a
 * conversation, and a panel that folded that into `gone` would be reporting a
 * dead process because a live one said no — which is exactly the confusion the
 * three-valued `Gone` (`../../chat/src/agent.ts`) exists to end, met again one
 * layer up. `booting` cannot carry it either: this is a state that has SETTLED,
 * and it settles until somebody presses something.
 *
 * `null` on every panel that has a conversation, which is nearly all of them,
 * and on every panel that has no agent to ask (`status: "off"` — nothing was
 * refused, because nothing was attempted).
 *
 * WHAT IT DOES NOT CARRY is how to try again. That is the server's, kept beside
 * the reason the way an undelivered message's prompt is kept beside its row
 * ({@link ../../chat/src/transcript.ts}): a browser reconstructing the attempt
 * would be a browser deciding which conversation to open, and it does not know
 * which one was asked for — a boot picks its own.
 */
export const Unopened = Schema.Struct({
  /** The agent's own words, verbatim. Never a category: "this agent does not
   *  keep conversations" and "no such session" are different sentences and a
   *  reader can act on the difference. */
  why: Schema.String,
  /** WHICH conversation could not be opened, for the sentence — a stored one's
   *  title, or its id where it has no title. `null` where what failed was
   *  opening ANY conversation: a fresh one, or a boot that chose for itself. */
  what: Schema.NullOr(Schema.String),
})
export type Unopened = typeof Unopened.Type

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
   *   - `thinking` — a turn is in flight. Sending is still allowed and is not
   *     deferred by it: the message goes in the transcript and STRAIGHT to the
   *     agent, which steers it into the turn it is already running. A person
   *     who has thought of the next thing should not have to hold it in their
   *     head until an agent is ready for it — and should not have it held for
   *     them somewhere they cannot see.
   *   - `gone` — the agent is not there. `trouble` says why, and the next
   *     prompt retries the boot.
   *   - `off` — no ACP agent is configured. The panel still DRAWS and says so,
   *     naming the variable that would give it one: a capability that is
   *     silently absent cannot be told apart from one that is broken. The
   *     server serves the outlines either way.
   */
  status: Schema.Literals(["off", "booting", "idle", "thinking", "gone"]),
  /** The session the server is in, or `null` between sessions. WHOSE it is
   *  is `talking` below, which is the panel's one answer to that. */
  session: Schema.NullOr(Conversation),
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
  /**
   * WHICH agents this machine has, in the order the picker draws them.
   *
   * Detected on the server when it started (the human's ruling: no list to
   * maintain, no path to set for an agent that is simply installed), and sent
   * whole because it is what the picker IS. Empty only in {@link CHAT_OFF} —
   * with no agent at all there is no chat, and the panel draws the face that
   * says so and says how to install one.
   */
  roster: Schema.Array(AgentChoice),
  /**
   * WHO the panel is talking to, or that it is waiting to be told — see
   * {@link Talking}, which is where the three facts this used to be became one.
   *
   * A conversation is bound to ONE agent for its life (ruled 2026-08-21), and
   * the note this directory keeps writes the id down beside the session id, so
   * reopening a conversation talks to the agent that has it.
   *
   * `null` while the panel is talking to nobody and asking nobody: no agent is
   * installed at all, the first frame has not arrived, or one subprocess is
   * being swapped for another.
   */
  talking: Schema.NullOr(Talking),
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
  /** The agent is running and would not open a conversation — see
   *  {@link Unopened}. `null` on every panel that has one.
   *
   *  Deliberately NOT `trouble`, which is drawn inside the transcript and
   *  cleared by the next turn that comes back. There is no transcript to draw
   *  it in and no next turn to clear it: what a reader is owed here is the
   *  panel's whole body saying what happened and offering the one thing that
   *  can change it. */
  unopened: Schema.NullOr(Unopened),
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
  roster: [],
  talking: null,
  asking: 0,
  trouble: null,
  unopened: null,
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
