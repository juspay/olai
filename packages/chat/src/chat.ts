/**
 * The one conversation, and the surface it is served through.
 *
 * olai is a single-user app, so there is ONE session (resolved 2026-08-09): not
 * one per tab, not one per outline. Every browser watching sees the same
 * transcript, which is why nothing here is per-connection and why a second tab
 * needs no catch-up protocol — it subscribes to the same collection and gets
 * the conversation in its first frame.
 *
 * This file is the join, and it is the only place that knows both halves:
 * {@link ./agent.ts} speaks ACP and emits typed events; {@link ./transcript.ts}
 * turns those into rows; the surface members below are how a browser sees them.
 * Nothing above knows an agent exists, and nothing below knows a browser does.
 *
 * It BUILDS the agent rather than being handed one, and that is what keeps
 * `session/update` a word this package is the last to say: a caller passes the
 * ROSTER it detected and the directory to run in, never a protocol object. The
 * seam for a scripted agent is one level further out and more honest for it —
 * `OLAI_ACP_AGENT` pointed at a script, which is how the e2e suite drives every
 * turn it asserts on, and which exercises the subprocess and the wire that an
 * injected object would replace with an assumption.
 *
 * ## WHICH agent, and when it starts
 *
 * A conversation is bound to ONE agent, chosen when it is created (the human's
 * ruling, 2026-08-21; several agents in one conversation is out of scope,
 * permanently). So this file holds AT MOST ONE agent at a time and starts it
 * when a conversation needs it — there is nothing for a second subprocess to do
 * while the panel is in somebody else's conversation, and a pool of idle ACP
 * agents is a pool of idle language-model sessions.
 *
 * Where the choice comes from, in order:
 *
 *   - **one installed agent is not a choice.** The panel talks to it and says
 *     which it is, in the header, beside the model. Asking a one-row question
 *     is friction with no answer behind it, and every olai before this one was
 *     in exactly that state.
 *   - **the note this directory left** ({@link ./memory.ts}) names the agent
 *     the panel was last talking to, so a restart comes back to the
 *     conversation it was in rather than to a question.
 *   - **otherwise the panel ASKS**, and holds no conversation until somebody
 *     answers ({@link Talking}'s `asking` arm). A default remembered ACROSS
 *     conversations is exactly what was ruled out: the question is per chat.
 *
 * Four decisions worth naming:
 *
 *   - **a turn is accepted, not awaited.** `send` answers the moment the prompt
 *     is on the wire; what happens next arrives on the transcript, so every open
 *     tab stays in step and a five-minute turn is not a five-minute call. The
 *     turn runs on its own fiber, and the `thinking` state is what says so —
 *     for as long as ANY of them is running, because a message typed while the
 *     agent works is a second prompt the agent holds behind the first
 *     ({@link Turn}).
 *   - **what is typed goes out IMMEDIATELY, always, as ONE VERB, and this file
 *     holds nothing.** Every send is a plain `session/prompt`, busy or idle:
 *     an idle agent starts on it, and a busy one holds it behind the turn it is
 *     working on and gets to it next, in order. The queue is the AGENT'S, which
 *     is the whole of the difference from the queue that used to be here — a
 *     mid-turn prompt went into an array, waited for the turn to end, and was
 *     thrown away by the next cancel, destroying user words with no copy
 *     anywhere (the transcript is not persisted; the agent's own session is the
 *     persistence, and a message that never reached the session was never in
 *     it). Deleting it (#194) was right. Making STEERING the only delivery in
 *     its place was not: a steer pre-empts, pre-empting means aborting, and a
 *     message that only meant to be next in line was tearing down whatever the
 *     agent was doing — a `/compact`, most visibly, which died with an aborted
 *     request every time (`compact-lost-to-steer`, the human's screenshot).
 *     So steering is the gesture somebody makes ON PURPOSE now, and this file
 *     never learns what the agent is busy with.
 *   - **a message the agent has not started on says so, on its own row**
 *     (`queued`), and stops saying it when the turns in front of it end. That
 *     is this end's own fact about its own turns, not a claim about the agent's
 *     insides — and it is the visible half of holding nothing: the words are at
 *     the agent, in the conversation, where a person can see them waiting.
 *     Delivery that genuinely fails is said on the same row — `delivery`, and
 *     retryable by a person and by nobody else where a retry is honest —
 *     because the alternative to holding words out of sight is not dropping
 *     them, it is showing them.
 *   - **the refusals the ops layer produces are OURS to render.** The agent gets
 *     the structured detail in its tool result, but what it then says about it
 *     is prose. So the MCP layer tells us about every refusal and it lands in
 *     the transcript as data — which is what makes "a refused write shows its
 *     detail in chat" true regardless of how the agent phrases it.
 *   - **a pasted picture is a PATH by the time it gets here.** The bytes were
 *     written to the conversation's own tmp directory as they arrived
 *     ({@link ./attachments.ts}), and what a prompt carries is where they
 *     landed — so the whole path from browser to agent stays a string, and the
 *     one place that knows otherwise is the module that owns that directory.
 */

import {
  type AgentChoice,
  type AskAnswer,
  type Attached,
  type AttachChunk,
  CHAT_OFF,
  type ChatEntry,
  type ChatState,
  type Wake,
  type NodeContext,
  type OpFailure,
  type Listed,
  type Talking,
} from "@olai/surface"
import { BusyFailure, type NodeAgent, UsageFailure } from "@olai/format"
import { emitter } from "@olai/log"
import { Effect, Fiber, Semaphore } from "effect"

import * as AcpAgent from "./agent.ts"
import type { Conversing, Overheard, Sessions } from "./sessions.ts"
import type { Installed } from "./agents/roster.ts"
import * as Attachments from "./attachments.ts"
import * as Context from "./context.ts"
import * as Deliveries from "./deliveries.ts"
import type { AgentEvent } from "./events.ts"
import { lastSaid } from "./heard.ts"
import * as Listings from "./listings.ts"
import * as Memory from "./memory.ts"
import { annotated } from "./prompt.ts"
import type { Probe } from "./probes.ts"
import type { Fault, Faulted, Scopes } from "./scopes.ts"
import { succeeded } from "./succession.ts"
import { teachingFor } from "./teaching.ts"
import { type Change, says, Transcript } from "./transcript.ts"
import { type Turn, Turns } from "./turns.ts"
import { sameWatching, watching } from "./watching.ts"

export type { ToolServer } from "./agent.ts"

export interface Options {
  /** Which agents this machine has, already detected
   *  ({@link ./agents/roster.ts}). Detecting them is the caller's move — it is
   *  the caller that owns this process's environment — and what a detected one
   *  looks like is ours.
   *
   *  NEVER EMPTY: a caller that found nothing builds no chat at all, and what
   *  a browser gets is the panel's `off` face, which says so and says how to
   *  install one. A chat with an empty roster would be a panel that can never
   *  answer anything, holding a subprocess-shaped hole. */
  readonly roster: ReadonlyArray<Installed>
  /** Where to start it: the served directory, exactly. An agent keys its
   *  stored sessions by the directory it was started in, which is what makes
   *  them findable at all — and it is what olai's own note of WHICH of them
   *  the panel was in is keyed by ({@link ./memory.ts}), which is what makes
   *  "the conversation you were last in" survive a restart. */
  readonly cwd: string
  /** The internal MCP server to hand the session, or nothing yet. A THUNK,
   *  because its address is not known until the listener has bound and the
   *  session is opened after that. */
  readonly tools: () => AcpAgent.ToolServer | null
  /** The OPTIONAL servers to look for, once per conversation — whatever else
   *  this host turns out to be running ({@link ./probes.ts}). A THUNK, and
   *  carried through to {@link ./agent.ts} untouched: what is on the list is the
   *  composition root.s business, and so is WHEN the list is settled — a serve
   *  whose integrations are fibers answers a different list per conversation, so
   *  this side holds no copy of one. Omitting it is a chat that asks this
   *  machine nothing. */
  readonly probes?: () => ReadonlyArray<Probe>
  /**
   * WHERE THE DOORBELL PICKS ARE KEPT — which conversations somebody pointed a
   * plugin's doorbell at, and at which file ({@link ./scopes.ts}).
   *
   * HANDED IN rather than built here, unlike {@link ./memory.ts} next door, and
   * the difference is who the record is ABOUT. The memory note is this panel's
   * own fact about itself — which conversation it was in — so a composition root
   * passing it down would be a second place that knows where olai keeps things.
   * A scope is a fact about a PLUGIN and this package has no plugins: the root
   * is what composes them, what refuses a name no plugin here answers to, and
   * what hands each of them the door onto this table. Building it here would
   * put the read on a boot that has no plugin to read it for.
   *
   * `null` — or absent — is a chat that keeps none: every doorbell is off, the
   * strip draws no row, and {@link Chat.scope} refuses. That is the state every
   * test in this package is in, and it is the honest one for a serve composed
   * without plugins at all.
   */
  readonly scoping?: Scopes | null
  /**
   * WHAT OLAI HAS OVERHEARD EACH CONVERSATION DO ({@link ./sessions.ts}) —
   * which sessions have been taught their contract, and what each last said.
   *
   * HANDED IN rather than built here, for `scoping` above's reason: it is one
   * of the records a composition root already opens per served directory, and
   * building it here would put the read on a boot that has nothing to read it
   * for.
   *
   * `null` — or absent — is a chat that keeps none: nothing is taught, nothing
   * is written down, and the panel is exactly the panel it was before node
   * agents existed. That is the state every test in this package is in unless
   * it says otherwise.
   */
  readonly overheard?: Sessions | null
  /**
   * WHICH NODE AGENT A CONVERSATION BELONGS TO — the vault's OWN reading of one
   * (`@olai/format`'s {@link NodeAgent}), never a shape this package declares —
   * or `null` for a conversation no node claims, which is nearly every
   * conversation.
   *
   * ASKED OF WHOEVER HOLDS THE VAULT, because the pointer IS in the vault: a
   * node's `agent-session` property carries the session it is talking through,
   * so "whose conversation is this" became a question about outlines, and this
   * package has never seen one. The composition root holds the set and answers
   * from its roster reading (`@olai/server`'s `agents.ts`).
   *
   * A THUNK for {@link Options.tools}' reason and one more: the answer moves on
   * every published revision — the node is renamed, its subtree grows, its
   * property is taken off — and a value handed in at construction would be a
   * charter frozen at boot. Nothing is taught for `null`, which covers a
   * pointer left on a node that has since been trashed or lost its property:
   * telling an agent its memory is a node that is not there is worse than
   * telling it nothing.
   */
  readonly agentAt?: (to: Conversing) => NodeAgent | null
  /** Publish the state cell. Called on every change; the surface dedups. */
  readonly onState: (state: ChatState) => void
  /** Publish transcript changes — ALL THREE of the things one carries: rows
   *  upserted by key, removes for a session that was replaced, and the text
   *  APPENDED to a row already there, which is what a chunk of a streaming
   *  answer is and moves no row at all ({@link ./transcript.ts}, and `says` for
   *  the question "does this change say anything"). Naming two of the three is
   *  what this comment used to do and what the guard below used to ask, and it
   *  cost every token of every answer. */
  readonly onTranscript: (change: Change) => void
}

export interface Chat {
  /** The transcript as it stands — what a fresh subscription is seeded with. */
  readonly entries: () => ReadonlyMap<string, ChatEntry>
  readonly state: () => ChatState
  /**
   * WHAT OLAI HAS OVERHEARD, as this machine's record holds it
   * ({@link ./sessions.ts}) — empty for a chat built without one.
   *
   * A DOOR ONTO THE TABLE rather than an answer about the roster, and the split
   * is the same one `doorFor` above makes: a roster ROW is the vault's
   * `prop:agent-session` reading — which node, which engine, which session —
   * with the last line olai heard that session say joined onto it, and this
   * package has never seen an outline. The composition root holds both halves
   * and does the join (`@olai/server`'s `agents.ts`); what it needs from here
   * is the half only here has.
   *
   * SYNCHRONOUS, like the scope rows beside it, because the join runs inside a
   * cell connector with no Effect around it.
   */
  readonly overheard: () => ReadonlyArray<Overheard>
  /**
   * A CHAT WAS GIVEN A HOME — write down that this conversation was ASSIGNED to
   * a node agent rather than opened for one ({@link ./sessions.ts}).
   *
   * The other half of the gesture that writes the pointer onto a node, and it
   * is here because the record is: the composition root holds the ops layer and
   * this file holds what olai overheard, exactly as they hold the two halves of
   * the roster (`@olai/server`'s `assignSession`).
   *
   * WHAT IT DECIDES is which contract that session is taught on its next
   * message ({@link ./teaching.ts}): an assigned chat is told to bank what it
   * knows into the subtree, because its transcript is the only copy of it.
   *
   * IT NEVER REFUSES. A mark that could not be written is a session taught the
   * ordinary contract instead of the migration one — a worse sentence, not a
   * lost assignment — and the property, which is the assignment, has already
   * landed by the time this is called. So it logs, the way every other write to
   * this record does.
   */
  readonly assigned: (to: Conversing) => Effect.Effect<void>
  /**
   * ... and OLAI REPLACED ONE WITH ANOTHER — write down which conversation took
   * this one's place, for the *fresh session* affordance.
   *
   * Same shape and same silence as {@link Chat.assigned}, and what a lost write
   * costs here is one old session appearing under Unassigned as a conversation
   * nobody claims, which somebody can see and nothing acts on.
   */
  readonly replaced: (to: Conversing, by: string) => Effect.Effect<void>
  /**
   * THE SET MOVED — ask {@link Options.agentAt} again, and publish if the
   * answer changed.
   *
   * `ChatState.bound` is the vault's answer to *whose conversation is this*,
   * and since the human's 2026-09-02 ruling the vault is where that answer can
   * MOVE: somebody edits a property, or the `•••` verb writes one. Everything
   * else this state carries moves on the panel's own clock, so this is the one
   * member a caller has to push.
   *
   * IDEMPOTENT AND CHEAP — one lookup, and a publish only when the node id
   * differs. The composition root calls it on every published revision
   * (`@olai/server`'s `runtime.ts`), which is a revision per keystroke landing
   * in an outline, so answering nothing is the case it is written for.
   */
  readonly reread: () => void
  /** Prompt the agent with what was typed, with the pictures already
   *  attached to this conversation — by the paths {@link Chat.attach}
   *  answered with, which are re-checked here before any of them reaches a
   *  prompt — and with the nodes the message is ABOUT.
   *
   *  The nodes arrive RESOLVED: a caller hands over what the set says they
   *  are, because this package has no set to ask. Which is the layering the
   *  manifest already states (`chat` does not depend on `ops`), read from the
   *  other side — the composition root resolves the ids the browser armed and
   *  this turns them into a line of the prompt. */
  readonly send: (
    text: string,
    attachments: ReadonlyArray<string>,
    context: ReadonlyArray<NodeContext>,
    /** INTERRUPT the turn in flight with this rather than take a place behind
     *  it — the one deliberate gesture, and false is the default because
     *  waiting is. It costs nothing where there is nothing to interrupt or no
     *  agent that takes an interruption: the message is the plain prompt it
     *  would have been. */
    steer?: boolean,
  ) => Effect.Effect<void, OpFailure>
  /** One chunk of a picture into the conversation's own tmp directory,
   *  answering with where the whole file is and what it is called there. See
   *  {@link ./attachments.ts}. */
  readonly attach: (
    chunk: AttachChunk,
  ) => Effect.Effect<Attached, OpFailure>
  /** Deliver a message the agent would not take, again — `id` is the `user`
   *  row's own key. The prompt is the one that failed, kept beside that row
   *  ({@link ./transcript.ts}) with its pictures and node lines, so what lands
   *  is the same message rather than a browser's reconstruction of it. Refuses
   *  when that row is not waiting to be sent, which two tabs can genuinely
   *  race. */
  readonly resend: (id: string) => Effect.Effect<void, OpFailure>
  readonly cancel: Effect.Effect<void, OpFailure>
  /** Start a fresh conversation with the named agent
   *  ({@link ./agents/roster.ts}). The agent is an ARGUMENT because every new
   *  chat asks which one — there is no default to fall back on, and a verb that
   *  could be called without one would be a place for a default to grow. */
  readonly newSession: (agent: string) => Effect.Effect<void, OpFailure>
  /** Answer the question the panel is holding: THIS is the agent, now open the
   *  conversation you would have opened.
   *
   *  Not {@link Chat.newSession} with the same argument, and the difference is
   *  the whole of why both exist. A boot that could not say which agent to
   *  start has not decided to start a NEW conversation — it has been stopped
   *  before it could adopt the one this directory was in. So the answer opens
   *  the remembered conversation for that agent, or its most recent, or a fresh
   *  one where it has none; the `+ new` button is the verb that always means a
   *  fresh one. */
  readonly chooseAgent: (agent: string) => Effect.Effect<void, OpFailure>
  /** Move to one of the stored conversations — WITH the agent whose it is,
   *  because the list spans every installed agent and a session id means
   *  nothing to the wrong one. Opening another agent's conversation switches
   *  this panel to that agent, the way {@link Chat.newSession} does. */
  readonly loadSession: (agent: string, id: string) => Effect.Effect<void, OpFailure>
  /** Try the refused OPEN again — the one `ChatState.unopened` is about. It
   *  takes no argument because the attempt is kept here, beside the reason:
   *  a boot picks its own conversation, so a caller naming one would be asking
   *  for something nobody asked for. Refuses when nothing is waiting. */
  readonly reopen: Effect.Effect<void, OpFailure>
  /** EVERY installed agent's stored conversations here, merged newest-first,
   *  each row saying whose it is — and which agents could not be asked. Never
   *  refuses, because the answer is PARTIAL rather than absent when one agent
   *  is broken: its conversations are missing and it is named, and the other's
   *  are still on the screen. */
  readonly sessions: Effect.Effect<Listed>
  /** Answer the question `id`, or — with `null` — decline it. Both refuse if
   *  that question has stopped waiting, which is a thing two open tabs can
   *  genuinely race and a person deserves to be told about. */
  readonly answer: (
    id: string,
    answers: ReadonlyArray<AskAnswer> | null,
  ) => Effect.Effect<void, OpFailure>
  /**
   * THE DOOR ONE PLUGIN'S DOORBELL REACHES THROUGH — its own conversations, and
   * the one write-only verb into them (`@olai/plugin-api`'s `Deliveries`).
   *
   * ## Why a door per plugin, and not the two members it replaced
   *
   * This used to be `scopes()` (every pick, whole) beside `deliverTo(to, body,
   * from, …)` (the name passed in), with the composition root filtering one and
   * supplying the other. Both halves of that were the same mistake said twice:
   * the root was doing the KEYING, in another package, for an interface whose
   * whole safety property is that the keying happens somewhere a plugin cannot
   * reach. What a plugin is handed is now readable off this package's own
   * exports rather than only by reading a composition root.
   *
   * THE NAME IS CLOSED OVER AND NEVER TAKEN FROM THE CALLER, which is the
   * anti-spoofing property stated where it is now enforced. A plugin cannot ask
   * for another's conversations, because the filter is behind this closure; and
   * it cannot sign another's name onto a row that reaches the agent, because
   * `deliver` has no argument for one. It becomes the row's `rang`
   * ({@link ../../surface/src/chat.ts}).
   *
   * It answers for a plugin this panel has never heard of the way it answers
   * for one nobody scoped: an empty list and a `deliver` that holds. There is no
   * registry here and deliberately none — core knows a plugin's name and
   * nothing else about it, and a door that refused an unknown name would be a
   * second place a plugin roster had to be kept.
   */
  readonly doorFor: (plugin: string) => {
    /**
     * The conversations THIS plugin's doorbell was pointed at, each with the
     * file a person picked. SYNCHRONOUS, because the blob it feeds is built in
     * a plain `.map` and read from a watcher sink with no Effect around it.
     *
     * A ROW WHOSE DOORBELL CANNOT WATCH WHAT IT NAMES IS NOT ON THIS LIST
     * ({@link Chat.faults}) — the file is gone, or it is served and is not a
     * kind this plugin reads — and that omission is the boundary between the
     * two things a quiet conversation can mean, kept by construction rather
     * than by care. There is nothing to derive and nothing to ring about; and
     * anything else a plugin does per scope — a heartbeat saying it is alive and the subject is
     * quiet, most of all — must not fire for a conversation whose scope is
     * broken, because "alive and quiet" and "watching nothing" are the two
     * sentences this whole feature exists to keep apart. Neither end has to
     * remember that: the row is simply not here.
     */
    readonly scopes: () => ReadonlyArray<{
      readonly agent: string
      readonly session: string
      readonly file: string
    }>
    /**
     * ONE MACHINE-MARKED MESSAGE INTO ONE CONVERSATION.
     *
     * WRITE-ONLY AND IT CANNOT FAIL. There is no arm here a caller would answer
     * differently: a body that could not be handed over is HELD, and a body
     * held is not a failure — it is the second of three arms and the ordinary
     * one while a turn is running. The caller is a watcher sink with nowhere to
     * put a refusal, which is why {@link Chat.send}'s vocabulary is deliberately
     * not borrowed here.
     *
     * THREE ARMS, decided in one step: this panel's own conversation with an
     * idle agent takes it as a turn; a running turn HOLDS it until the turn
     * boundary; a conversation nobody is in holds it until somebody opens it.
     * Which arm it took is not reported back.
     */
    readonly deliver: (
      to: { readonly agent: string; readonly session: string },
      say: () => string | null,
      options?: {
        /** Bodies sharing a key, WHILE STILL HELD, replace each other in place —
         *  see {@link ./deliveries.ts}. A body with no key never replaces. */
        readonly coalesce?: string
      },
    ) => Effect.Effect<void>
  }
  /** THIS conversation wakes on THAT file, for that plugin's doorbell — or, with
   *  `file: null`, on nothing. The one write behind the strip's scope control.
   *  Refuses when this chat keeps no scopes at all, and when the record will not
   *  take the write: a pick that did not stick is a thing the person who just
   *  made the gesture needs told. */
  readonly scope: (
    to: { readonly agent: string; readonly session: string },
    plugin: string,
    file: string | null,
  ) => Effect.Effect<void, OpFailure>
  /**
   * WHICH SCOPED FILES A DOORBELL CAN STILL WATCH — asked of every published
   * revision, and answered with the conversations whose doorbell JUST BROKE.
   *
   * ## The defect this exists to make impossible
   *
   * A person scopes a conversation to `lanes.olai`. Somebody renames the file.
   * The doorbell derives per revision and walks a file that is not there, so it
   * derives nothing — forever — while the strip goes on drawing the control as
   * ON. Nothing is wrong anywhere a person can see, and the conversation is
   * silent in exactly the way a conversation with nothing to report is silent.
   * QUIET-AND-FINE AND QUIET-BECAUSE-BROKEN MUST NOT LOOK ALIKE, and after the
   * hand-run fleet watch is retired this is the only thing standing between
   * them.
   *
   * ## THE SECOND WAY IN, and it is the same silence by a different door
   *
   * The file is right there and is not something that doorbell can read: a
   * `.md` under a wake that derives its set from a file's NODES. The picker
   * offered every served file until the kinds were declared
   * (`@olai/plugin-api`'s `PluginServerHalf.wake.kinds`), so this is a state a
   * record on disk can be in and a gesture cannot reach any more — and a
   * picker-only fix would have left it exactly as silent as the rename was.
   * Same walk, same one signal, same row off the plugin's door; a different
   * cause and therefore a different sentence.
   *
   * ## WHO DETECTS AND WHO SPEAKS
   *
   * Core detects, because core owns both halves of both questions: the served
   * set is a fact about the vault, WHICH KINDS a doorbell can watch is a
   * declaration its plugin handed the composition root, and the pick is a row
   * in this package's own record. Core says NOTHING, because a sentence about
   * somebody's terminals is a sentence core may not compose — what goes into
   * the conversation is the string the plugin DECLARED for that cause
   * (`@olai/plugin-api`'s `PluginServerHalf.wake.faults`),
   * carried verbatim through the door {@link Chat.doorFor} already hands out.
   * This member is the join between those two and composes nothing itself.
   *
   * ## A JUDGEMENT rather than the paths that went missing
   *
   * The caller holds a revision and can answer "can this doorbell watch this
   * path" in a binary search plus a lookup; it cannot hand over a list of what
   * broke without either a second member here or a walk of the whole directory
   * per revision. The picks are the small side — at most a few dozen — so the
   * walk is over them and the judgement comes in. That is `@olai/format`'s
   * `conventions.ts` argument, spent here for its reason rather than copied.
   *
   * ## Exactly once, and quiet on the way back
   *
   * What comes back is the fine→faulted edge only ({@link ./scopes.ts}'s
   * `Scoped.fault`): a second revision with the same fault standing answers
   * with nothing, and a restart with the mark already on the record answers
   * with nothing, so a rename is one sentence rather than one per revision or
   * one per boot. A file that COMES RIGHT unmarks the row, the plugin's door
   * starts listing it again, and nobody is told — one signal per fault, and the
   * strip is where the recovery shows.
   *
   * ## It cannot fail, because nobody is standing at the screen
   *
   * The caller is a revision connector, not a gesture. A record that will not
   * take the mark is one warning and no rows — the discipline the boot read
   * keeps ({@link ./scopes.ts}) and the exact opposite of {@link Chat.scope},
   * which refuses because somebody is waiting to hear whether their pick stuck.
   * Nothing is marked when the write fails, so the same edge is still there for
   * the next revision to find.
   */
  readonly faults: (
    /** What is wrong with one row's file for one row's doorbell — the served
     *  set and the plugin's declared kinds, asked as one question, answered
     *  `null` for the file that doorbell can watch. */
    judge: (plugin: string, file: string) => Fault | null,
    /** Whether a fault on this plugin's row can be SAID. A row nobody can be
     *  told about is left unmarked, so the one signal is not spent by a serve
     *  that has no doorbell to lose. */
    sayable: (plugin: string) => boolean,
  ) => Effect.Effect<ReadonlyArray<Faulted>>
  /** Told by the MCP layer about a write it refused, so the panel can draw the
   *  refusal rather than the agent's account of it. */
  readonly recordRefusal: (
    tool: string,
    failure: OpFailure,
  ) => Effect.Effect<void>
  /** Boot the agent in the background. A failure is not fatal: the panel shows
   *  it and the next prompt tries again, exactly as a crash does. */
  readonly start: Effect.Effect<void>
  readonly stop: Effect.Effect<void>
}


/**
 * TWO WAKE READINGS, THE SAME OR NOT — the guard on a publish that would
 * otherwise ride every revision in the vault.
 *
 * Four scalar fields over at most a few rows, compared in order, because the
 * rows come out of one walk over one table and their order is that table's.
 * `sameWatching` beside it keeps the same discipline for the same reason: the
 * chat cell declares no `equals`, so a `move` with nothing new in it is a whole
 * `ChatState` on the wire of every open tab.
 */
const sameWake = (
  a: ReadonlyArray<Wake>,
  b: ReadonlyArray<Wake>,
): boolean =>
  a.length === b.length
  && a.every((row, at) => {
    const was = b[at]
    return was !== undefined
      && row.name === was.name
      && row.file === was.file
      && row.waiting === was.waiting
      && row.fault === was.fault
  })
/**
 * How long an agent may say NOTHING after a cancel before the panel says so.
 *
 * A window on silence rather than on the turn: an agent still streaming is
 * still working towards the stop it was asked for however long that takes
 * ({@link Chat.cancel} owns that argument), so this is only how long a
 * genuinely quiet one gets before somebody is told. Short enough that a person
 * who pressed a button is not left wondering, long enough that the gap between
 * two chunks of ordinary streaming is never mistaken for it.
 *
 * It is a floor on being TOLD and never a deadline on the agent: nothing here
 * kills anything or cancels anything twice.
 */
const CANCEL_GRACE = "5 seconds"

/**
 * What a person is told when their own cancel overtook their own message.
 *
 * The words are kept and the row is retryable, like every other way a steer
 * fails to land — but the reason is worth saying differently, because this one
 * is not the agent's doing. Both buttons are on screen at once by design, and
 * pressing them in quick succession is a coherent thing to want: say the next
 * thing, then decide the whole turn was wrong. What must not happen is the
 * message quietly starting the turn back up.
 */
const CANCELLED_UNDER_IT =
  "the turn was stopped before this reached it — the message below is still yours to send"

/**
 * WHY a message did not land: the reading and the sentence, as ONE value.
 *
 * Not two parameters. `key`, `prompt` and `why` are all strings, so a call site
 * handing them over in the wrong order compiles and draws somebody's prompt as
 * the reason it failed — and the classification is not independent of the
 * sentence anyway: they are one account of one failure.
 *
 * An {@link AcpAgent.AgentGone} IS one of these, structurally, which is the
 * point rather than a coincidence — the two lanes that already have a failure
 * pass it whole, and the one case that has none (a person's own cancel
 * overtaking their own message) writes the pair out where a reader can see both
 * halves at once.
 */
/** WHO this panel is talking to: the roster row a person picked, and the agent
 *  module started from it. A named pair rather than an inline object because
 *  three things take one now — the slot, the delivery decision, and the turn
 *  that a silence has to name the agent of. */
interface Bound {
  readonly row: Installed
  readonly agent: AcpAgent.Agent
}

interface Undelivered {
  readonly gone: AcpAgent.Gone
  readonly why: string
}

/**
 * A CONTRACT ABOUT TO GO OUT: the lines, and the conversation they are for.
 *
 * ONE VALUE rather than two facts a send holds side by side, and the pairing is
 * the whole of what it buys: the lines are built from one read of the binding
 * table, and the mark written down afterwards has to be about the conversation
 * that read named — not about whichever one the panel is in a beat later. Two
 * separate reads is exactly how a session swapped mid-send would leave a
 * conversation marked taught that never heard a word.
 */
interface Teaching {
  readonly to: Deliveries.Addressed
  readonly lines: ReadonlyArray<string>
}

/**
 * WHAT EACH KIND OF FRAME IS EVIDENCE OF — the one table two questions are
 * answered from.
 *
 * Two things ask "has the agent said anything since I looked", and they are not
 * the same question. Exactly one frame kind separates them, and getting that
 * one wrong is the bug this table was written for:
 *
 *   - **`shown`** is what a person can SEE — prose, tool frames, questions.
 *     {@link begin} asks it of a turn at both of its endings: *did these words
 *     produce anything?* A turn that ends having shown none of these has said
 *     nothing, whatever else went over the wire, and the panel used to draw
 *     exactly that — nothing — over the message somebody had just sent.
 *   - **`arrived`** is anything that could only have come from the other end of
 *     the pipe, drawn or not. {@link cancel} asks it of a turn it has told to
 *     stop: *is this process still alive down there?* A zero-token usage frame
 *     answers that — something is reading its input and reporting — and answers
 *     nothing at all about the first question. It IS the auth-failure signature:
 *     opencode with no provider key sends a lone `usage_update {used:0}` and
 *     then a SUCCESSFUL `end_turn`, so the one frame that arrived was the one
 *     that meant nothing had. One count serving both meant a message that never
 *     reached a model was neither marked unsent nor spoken about.
 *   - **`neither`** is everything olai says ABOUT the agent rather than
 *     anything the agent said: a boot that failed, a process that exited, a
 *     session that ended. A `model` announcement is one of these too — it
 *     arrives when a SESSION opens as readily as when a turn starts.
 *
 * A RECORD over the closed vocabulary rather than two sets, because
 * {@link ./events.ts} is closed on purpose and this is a question every member
 * has to answer. Sets are opt-in: a member added later would default to
 * `neither` in silence, and the two ways that goes wrong are a turn accused of
 * silence for something it drew, and a silent turn nobody is told about. The
 * record makes a new member fail to compile until somebody answers.
 */
const EVIDENCE: { readonly [K in AgentEvent["_tag"]]: "shown" | "arrived" | "neither" } = {
  said: "shown",
  tool: "shown",
  asked: "shown",
  usage: "arrived",
  // A replay is the agent saying what it said BEFORE this turn, so it is
  // evidence the pipe is alive and evidence of nothing about these words.
  userSaid: "arrived",
  replayStarted: "arrived",
  replayEnded: "arrived",
  askSettled: "neither",
  commands: "neither",
  // The handshake, which is olai asking rather than the agent volunteering —
  // and which happens before any turn, so it could not be evidence about one.
  advertised: "neither",
  servers: "neither",
  model: "neither",
  session: "neither",
  sessionTitled: "neither",
  sessionOver: "neither",
  gone: "neither",
  trouble: "neither",
}

/**
 * What a turn that produced nothing is told to a person.
 *
 * A function rather than a template at the one place it is used, because what
 * it is is the whole of what this end KNOWS: the agent was asked, it answered
 * that the turn was over, and nothing came back — which is what an agent that
 * cannot reach a model looks like from the other side of a pipe, and there is
 * no frame anywhere that says so out loud. The sentence a person meets is
 * asserted where they would meet it (`features/choosing_an_agent.feature`,
 * against a scripted agent that answers exactly the way opencode does with no
 * key).
 *
 * It names WHO was silent because a panel with two agents installed is a panel
 * where "the agent" is a question, and it says where to look rather than what
 * to type: the credentials are the agent's own business (`opencode auth
 * login`, a key in its config, a token in the environment), and this process
 * cannot tell which of them is missing. The ENVIRONMENT is named explicitly
 * because it is the trap this bug was reported from — olai's own environment is
 * what a spawned agent inherits, and a systemd user unit's is not a login
 * shell's ({@link ../../../docs/running.md}).
 */
const silence = (agent: string): string =>
  `${agent} ended the turn without saying anything. That is what an agent that ` +
  `cannot reach a model looks like from here — check that it is signed in and ` +
  `that its provider key is set in the environment olai itself runs in, then ` +
  `send again.`

/**
 * A WRITE TO THIS MACHINE'S RECORD, ATTEMPTED — and its failure logged rather
 * than handed to anybody ({@link ./sessions.ts}'s own rule for its writers).
 *
 * ONE SPELLING for every writer that keeps that rule: the two migration marks
 * ({@link Chat.assigned}, {@link Chat.replaced}) and the teaching's own
 * ({@link contracted}). What they share is why none of them refuses — each runs
 * AFTER the half of its gesture that mattered has already landed, so a refusal
 * here would be telling somebody their assignment, or their turn, failed when
 * it did not. What differs is one sentence, which is the argument
 * ({@link taughtLost} and the two beside it): a lost write costs something
 * different each time, and that is the half worth saying out loud.
 *
 * `undefined` is a chat composed with no record at all, which is the state
 * every test in this package is in unless it says otherwise.
 *
 * NOT the last-said write, which is deliberately not a caller: that one has to
 * know whether the write LANDED, because a frame is published off the back of
 * it ({@link saidHere}).
 */
const noting = (
  write: Effect.Effect<void, Memory.MemoryFailure> | undefined,
  why: (failure: Memory.MemoryFailure) => string,
): Effect.Effect<void> =>
  write === undefined ? Effect.void : Effect.gen(function*() {
    const done = yield* Effect.result(write)
    if (done._tag === "Failure") yield* Effect.logWarning(why(done.failure))
  })

/** ... and what each of them costs when it is lost, said where the write is
 *  rather than at the call site: the sentence is about this record, and the
 *  gesture that made the write is a package away. */
const taughtLost = (failure: Memory.MemoryFailure): string =>
  `a node agent was taught its contract and it could not be written down ` +
  `(${failure.why}) — the next message in this session will say it again`

const assignLost = (failure: Memory.MemoryFailure): string =>
  `a chat was assigned to a node agent and that it was ASSIGNED could not be written down ` +
  `(${failure.why}) — the pointer landed, and the session will be taught the ordinary ` +
  `contract rather than the one that asks it to bank what it knows`

const replaceLost = (failure: Memory.MemoryFailure): string =>
  `a node agent was given a fresh session and what it replaced could not be written down ` +
  `(${failure.why}) — the new session is bound, and the old one will show under Unassigned ` +
  `as a conversation no node claims`

export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    /**
     * Where this panel writes down what it was in, and what it reads back at a
     * boot.
     *
     * Built here rather than handed in, exactly like the tmp directory pasted
     * pictures land in: both are somewhere on this machine that belongs to
     * THIS panel about THIS directory, and a composition root passing either
     * one down would be a second place that knows where olai keeps things.
     * Keyed by the served DIRECTORY and by nothing else, so two servers over
     * two directories remember two panels — and two servers over ONE directory
     * are one panel as far as this is concerned, last one in wins, which is
     * the honest answer for a single-user app rather than a race worth a port
     * in the key.
     *
     * READ IN TWO PLACES now, which is new and is the shape of the fact rather
     * than a duplication: this file reads the AGENT out of it, because which
     * subprocess to start is a question that comes before there is one to ask,
     * and {@link ./agent.ts} reads the conversation and the model out of it,
     * because those are facts about a session only the thing holding one can
     * act on. One writer per field, and the write is the agent's.
     */
    const memory = Memory.forDirectory(options.cwd)
    const tell = yield* Effect.annotateLogs(emitter, { surface: "chat" })

    /** One agent, built from the roster row that named it. The handler is
     *  passed in because the two are mutually referential: the agent needs
     *  somewhere to send its events, and the thing that consumes them needs the
     *  agent to drive. */
    const spawn = (row: Installed, onEvent: (event: AgentEvent) => void) =>
      AcpAgent.make({
        id: row.id,
        leg: row.leg,
        command: row.adapter.command,
        args: row.adapter.args,
        env: row.adapter.env,
        cwd: options.cwd,
        tools: options.tools,
        probes: options.probes,
        memory,
        onEvent,
      })

    const transcript = new Transcript()
    /** The conversation's own tmp directory, for pictures pasted into it.
     *  Emptied when a conversation is left and when the chat stops. */
    const files = Attachments.make()
    /** WHO a roster row is, as the browser hears it: the picker's rows. The
     *  ADAPTER and the LEG stay on this side of the wire, because a browser that
     *  knew what to spawn would be a browser that could ask for it. */
    const said = (row: Installed): AgentChoice => ({ id: row.id, name: row.name })

    /**
     * WHAT AN AGENT HAS SAID ABOUT ITSELF before it has said anything: nothing.
     *
     * The state a freshly bound agent is in for the length of a handshake, and
     * the honest one — a panel that has not been told cannot offer an
     * interruption on somebody's behalf, or promise a person their words will
     * be got to. Both directions of being wrong here are cheap and only one of
     * them is: a control that appears a moment late costs a click; a control
     * that was there before the agent said it took one is a person pressing
     * *interrupt* at an agent that will refuse it.
     */
    const SAYS_NOTHING = { steers: false, queues: false } as const

    /**
     * ... and what the CURRENT agent has said, once it has.
     *
     * Beside {@link talking} rather than inside it because the two move at
     * different times and for different reasons: WHO this panel is talking to
     * is decided when somebody picks, and WHAT that agent can do is decided at
     * the handshake, which is a subprocess and a round trip later. Kept here it
     * is one assignment per boot; folded into `talking` it would be a field
     * every writer of that member had to remember not to flatten.
     */
    let advertises: { readonly steers: boolean; readonly queues: boolean } = SAYS_NOTHING

    /**
     * Whether THIS CONVERSATION has ever held a message behind a running turn.
     *
     * IT WITHDRAWS THE INTERRUPTION, and it is the one place in this file that
     * works around somebody else's defect rather than stating a rule of its
     * own. The pinned adapter leaves a turn's `session/prompt` unanswered
     * forever if a `_session/steering` is injected into any turn of a session
     * that has once held a queued one — the steered words run and stream, and
     * only a cancel ends the turn. Verified on the wire with no olai in it:
     * fresh sessions steer cleanly, one sequential turn steers cleanly, two
     * steer cleanly, and one QUEUED turn earlier in the session poisons every
     * steer after it.
     *
     * AND IT IS NOT THE WHOLE OF THE DEFECT. A session in which a turn armed
     * a `Monitor` hangs the same way with nothing ever queued, so this latch
     * is still OPEN — `queuedHere` false, the interruption still offered. Widening it is a
     * change to what the panel OFFERS rather than a fact about the adapter,
     * so it waits on a ruling. The measurement — every history tried, both
     * pins, and the pristine run that says whose bug it is — is written once,
     * in `acp/patches/README.md`, because it is a fact about the pin.
     *
     * Before this PR the combination was unreachable — olai never sent a
     * mid-turn `session/prompt` on this leg — so the queue is what makes it
     * reachable, and the queue is the default. The human ruled the guard in:
     * offer nothing that hangs the conversation, and take the safe direction
     * when a stale tab asks for one anyway (a plain prompt, which is what the
     * message was going to be).
     *
     * WHAT IT COSTS is said out loud because it is not small: after one message
     * typed during a turn, this conversation has no interruption for the rest
     * of its life. `+ new` and opening a stored conversation both clear it,
     * because it is the SESSION the adapter poisons — which is also why it is
     * dropped on {@link AgentEvent}'s `sessionOver` rather than on anything
     * about the agent.
     *
     * AND A TURN A DOORBELL STARTED IS A TURN LIKE ANY OTHER, which is the one
     * thing this paragraph gained with the second doorbell and the one a reader
     * would otherwise get wrong. {@link offer} is shaped so a doorbell's OWN
     * body is never the message that queues — it declines to hand anything over
     * while a turn is running, and `deliveries.test.ts` pins that. What it
     * cannot do is stop a doorbell's turn from being the turn a PERSON then
     * types behind: the boundary flush starts one at an agent that has just
     * gone idle, and a message sent into it queues and spends the latch exactly
     * as it would behind anybody else's turn.
     *
     * That is not a leak to be plugged, and the shape that would plug it is the
     * wrong one: the adapter is poisoned by a session having HELD a queued
     * prompt at all, so a conversation that went on advertising the control
     * because the turn in front was a machine's would be offering an
     * interruption that hangs it. What is owed is saying so — a person who
     * scoped this conversation opted it into machine-started turns, and `+ new`
     * is how the control comes back.
     *
     * It goes when the adapter is FIXED, which is not the same as when the
     * pin moves: the 0.66.0 → 0.70.0 bump moved it four releases and #1039
     * stayed open. 0.70.0 → 0.73.0 is a different swallow (#958, candidate
     * #1065), not this latch. `acp/patches/README.md` is where each bump
     * records whether it re-measured this.
     */
    let queuedHere = false

    /** ... and as the panel's own `talking`, which carries two things more:
     *  what this agent SAID it can do ({@link advertises}) and whether an
     *  interruption is still on offer here ({@link queuedHere}), which is what
     *  the composer offers and promises out of. */
    const bound = (row: Installed): Talking => ({
      kind: "agent",
      id: row.id,
      name: row.name,
      queues: advertises.queues,
      // BOTH HALVES, in the one bit the composer reads: the agent said it
      // takes an interruption, AND this conversation is one where taking it
      // still ends. A client deriving that from two fields would be a second
      // copy of a rule this end already knows, which is the argument
      // `../../web/src/client/chat/busy.ts` makes for every decision like it.
      steers: advertises.steers && !queuedHere,
    })

    /** Who this panel is talking to, said again — the one door for everything
     *  that changes what is ON OFFER without changing who is answering: a
     *  handshake landing, a message taking its place in the agent's queue, a
     *  conversation ending. Nothing to say when nobody is bound. */
    const rebind = (): void => {
      const at = talking
      if (at !== null) move({ talking: bound(at.row) })
    }

    // The cell's own default, with the two fields that differ: an agent is
    // being started, and the roster is this machine's. Restating the others
    // here would be a second place to remember when the state gains one.
    let state: ChatState = {
      ...CHAT_OFF,
      status: "booting",
      roster: options.roster.map(said),
    }
    /** The agent this panel is talking to and the row it came from, or `null`
     *  while it is talking to none — before the first choice, and in the beat
     *  between one agent being stopped and its replacement handshaking. */
    let talking: Bound | null = null
    /** The server is going away. Read by {@link using}, which must not start an
     *  agent after the one thing that stops them has run: a subprocess spawned
     *  then is one nothing will ever kill. */
    let closing = false
    /** The turns in flight — usually none or one, and more only for an agent
     *  that queues a mid-turn message instead of steering it. Every question
     *  anybody asks about them, and why they are a set, is {@link ./turns.ts}. */
    const turns = new Turns()
    /** WHAT A DOORBELL SAID THAT IS NOT AT THE AGENT YET, per conversation —
     *  memory only, capped, and never on a disk ({@link ./deliveries.ts}). It
     *  is not the queue that was deleted, and that module's header is where the
     *  difference is argued. */
    const held = Deliveries.holding()
    /**
     * Whether the cancel a person last pressed has been said out loud yet.
     *
     * A cancel stops EVERY turn in flight, so each of them answers `cancelled`
     * — and the whole point of the press was one decision, so it is worth one
     * line in the conversation. Which turn gets to say it cannot be the rule:
     * the answers come back in the agent's own order, and the pinned adapter
     * answers for a turn it had merely queued as readily as for the one it was
     * running.
     *
     * Reset by {@link cancel}, which is the only thing that makes a press
     * exist. It says nothing about a turn the agent cancelled on its own —
     * there is no press for that to be a duplicate of, and a notice about it is
     * news.
     */
    let stopSaid = false
    /** One session change at a time: a load and a new-session racing each other
     *  would leave the transcript holding half of each. */
    const switching = yield* Semaphore.make(1)
    /**
     * ONE AGENT BOUND AT A TIME — the permit {@link using} takes for itself.
     *
     * Its own rather than {@link switching}'s, and that is not tidiness: the
     * two verbs that open a conversation already hold that one, but a BOOT does
     * not — it runs on its own fiber while the listener serves pages, which is
     * the whole reason a page is not waiting on an agent. Read the other way
     * round: a boot that took the directory's permit would hold it for as long
     * as an agent takes to hand-shake, and `stop` waits on that same permit to
     * empty this conversation's tmp directory — so a shutdown during a boot
     * waited out the boot's whole deadline. (It does; the server tests time out
     * on it.)
     *
     * What it guards is exactly the read-then-write in {@link using}: two
     * callers seeing the same `talking === null` and both spawning an agent
     * module, with only one of them ever stopped and the other left holding an
     * ACP subprocess nothing will ever talk to.
     */
    const binding = yield* Semaphore.make(1)
    /** One delivery decision at a time — see {@link deliver}. Deciding which
     *  lane a message takes means reading whether a turn is running, and taking
     *  that lane means writing it; two sends interleaving between the two would
     *  start two turns where the panel can only report one. Its own permit
     *  rather than {@link switching}'s, because that one is held across a
     *  three-megabyte attachment chunk and a send should not queue behind a
     *  picture. */
    const sending = yield* Semaphore.make(1)
    /**
     * ONE CONVERSATION BEING OPENED, and everything that means something INSIDE
     * a conversation waits for it.
     *
     * The window is the seconds between pressing an agent and having something
     * to type into: a subprocess starts, a handshake runs, a session is asked
     * for and a stored one REPLAYS. The box is deliberately not locked while
     * that happens — a message typed then is a message somebody means — so the
     * window is a person's ordinary next keystroke rather than a race anybody
     * has to arrange.
     *
     * What it used to cost was the message's own row. {@link send} writes the
     * words into the transcript before anything is on the wire, and a replay
     * CLEARS the transcript ({@link receive}'s `replayStarted`) — so a message
     * sent into that gap had its row wiped by the conversation it was going
     * into, and what a person was left looking at was an answer with no
     * question above it, or nothing at all. Against an agent that answers both
     * opens at once it costs more than that: two conversations opened, two
     * deliveries, and the panel in whichever finished last.
     *
     * ITS OWN PERMIT, and not one of the three that were already here:
     *
     *   - **{@link switching}** is held across a three-megabyte attachment
     *     chunk, and a send must not queue behind a picture (its own note says
     *     so).
     *   - **{@link binding}** is about which agent this panel is talking to,
     *     which is settled long before the conversation is open.
     *   - **{@link sending}** is one delivery decision at a time, which is a
     *     rule between two sends rather than between a send and an open.
     *
     * A concurrent send WAITS here rather than being refused, which is the
     * whole answer: there is nothing to tell somebody, because the conversation
     * their message belongs in is the one being opened.
     */
    const opening = yield* Semaphore.make(1)
    /** Everything the agent has said FOR ITSELF, counted — everything
     *  {@link EVIDENCE} calls `arrived` or `shown`. Read by {@link cancel}. */
    let heard = 0
    /** ... and the narrow one: everything a person can SEE it say — what
     *  {@link EVIDENCE} calls `shown`. Read by {@link begin}. */
    let shown = 0

    /** A change that says nothing is not published — asked of the change
     *  itself ({@link ./transcript.ts}'s `says`) rather than by naming its
     *  fields here. This line used to name two of the three, which meant every
     *  chunk of every streaming answer was dropped and the paragraph appeared,
     *  whole, when the turn ended. */
    const publish = (change: Change) => {
      if (!says(change)) return
      options.onTranscript(change)
    }

    const move = (next: Partial<ChatState>) => {
      state = { ...state, ...next }
      options.onState(state)
    }

    /**
     * How many questions are still waiting on a person, COUNTED off the rows
     * rather than tallied beside them.
     *
     * A question being open is already written down — it is the row whose
     * outcome is `null`, which is the thing the panel draws and the thing the
     * transcript's own tests are about. A counter kept alongside would be that
     * same fact in a second place, staying right only for as long as every
     * future writer remembered both.
     */
    const asking = (): number => {
      let waiting = 0
      for (const entry of transcript.entries().values()) {
        if (entry.kind === "ask" && entry.ask.outcome === null) waiting++
      }
      return waiting
    }

    /** ... and WHAT THIS CONVERSATION STILL HAS OUT — the background tasks it
     *  armed and the agents it sent, read off the rows for the same reason and
     *  published under the same rule. The projection itself is over values and
     *  lives beside its own tests ({@link ./watching.ts}); what belongs to this
     *  file is only which rows to ask it about.
     *
     *  ... published only when it MOVED. Unlike a question, a task is reported
     *  on by frames that arrive several times a turn and mostly say nothing
     *  about it, and a cell republished per tool frame is a cell every open tab
     *  pays for saying what it already said.
     *
     *  A LIST, so "moved" is a comparison rather than a number: the three
     *  fields are what the strip draws, and a task whose name or stamp has not
     *  changed is not news to it. */
    const watched = (): void => {
      const out = watching(transcript.entries())
      if (!sameWatching(out, state.watching)) move({ watching: out })
    }

    /**
     * WHICH CONVERSATION THIS PANEL IS IN, as the pair a delivery is addressed
     * to — `null` when it is in none.
     *
     * Two fields out of two places, because a conversation is
     * `(agent, session)` and this file holds those halves apart: WHO is being
     * talked to is {@link talking}, and WHICH of that agent's conversations is
     * open is the cell's own `session`. A doorbell is addressed to the pair, so
     * this is where the two are put back together — once, rather than at each of
     * the four places that ask.
     */
    const conversationOf = (): Deliveries.Addressed | null => {
      const at = talking
      const open = state.session
      return at === null || open === null ? null : { agent: at.row.id, session: open.id }
    }

    /**
     * WHICH NODE AGENT A CONVERSATION BELONGS TO, by the node's own id — `null`
     * for one no node claims, which is nearly every conversation.
     *
     * The conversation is an ARGUMENT with a default for {@link wakeOf}'s
     * reason exactly: the two places that publish this around a session
     * CHANGING know the answer before `state.session` does, and would otherwise
     * read the conversation before last.
     *
     * ASKED OF THE VAULT EVERY TIME rather than held beside the state, so there
     * is nothing here to invalidate and nothing to reload: the pointer is a
     * PROPERTY, and the answer is whatever the last published revision of the
     * set says. This member is recomputed when a session opens or ends, so a
     * property somebody moves under an open conversation lands the next time
     * one does.
     */
    const boundTo = (
      to: Deliveries.Addressed | null = conversationOf(),
    ): string | null => (to === null ? null : options.agentAt?.(to)?.id ?? null)

    /**
     * WHAT THIS MESSAGE HAS TO TEACH, or nothing at all — the standing
     * instruction a node agent's session is given ONCE
     * ({@link ./teaching.ts}, which argues the channel).
     *
     * THREE WAYS TO ANSWER NOTHING, and every one of them is the ordinary case
     * for somebody: no record at all — a serve composed without one, which is
     * also what keeps a chat that CANNOT write the mark from teaching the same
     * session on every message; a session already taught, which is every
     * message after the first; and a conversation no node claims, which is
     * nearly every conversation and also a pointer left on a record that has
     * been trashed or has lost its property.
     *
     * THE ANSWER CARRIES THE CONVERSATION IT IS FOR, which is what makes it one
     * value rather than two facts a send has to keep in step: the lines and
     * "whose contract these are" are decided in the same breath, off one read,
     * and the mark that goes to disk afterwards is written against THAT
     * conversation rather than against whichever one the panel has come to be
     * in ({@link contracted}).
     *
     * WHICH OF THE TWO CONTRACTS comes off the same row the `taught` mark does,
     * in one read: a session somebody ASSIGNED to a node is told to bank what
     * its transcript knows, and one olai opened for a node is told the standing
     * law alone ({@link ./teaching.ts}'s `Arrival`). Two reads of that row would
     * be two answers to one question, and the second could be taken after a
     * write that moved it.
     */
    const teaching = (): Teaching | null => {
      const to = conversationOf()
      const overheard = options.overheard
      if (to === null || overheard === undefined || overheard === null) return null
      const row = overheard.at(to)
      if (row?.taught === true) return null
      const node = options.agentAt?.(to) ?? null
      if (node === null) return null
      return { to, lines: teachingFor(node, row?.assigned === true ? "assigned" : "opened") }
    }

    /**
     * ... and SAYING that it went, and remembering it — the two halves of "the
     * contract is out", together, because they are one event and used to be
     * able to disagree.
     *
     * SAID AND MARKED ONLY WHERE THE MESSAGE WAS TAKEN, which is what the row's
     * own delivery mark answers. A prompt that never reached an agent taught it
     * nothing: a session marked taught over one would go the rest of its life
     * believing it had been told, and a NOTICE left standing over one is a
     * conversation visibly quoting a contract the agent never heard. What this
     * cannot see is a turn that fails LATER — the agent had the words and died
     * on them — and that is the honest limit of a synchronous check: the words
     * went, so the contract went with them, and whether the agent finished
     * reading is not a thing anything here can answer.
     *
     * THE NOTICE IS VERBATIM and never a summary: two spellings of one
     * instruction is a panel claiming a contract that is not the one that went
     * out, so the row carries the same value the prompt was built from. A
     * NOTICE, because that is what it is — olai's own words about this
     * conversation, in the row kind every other sentence of olai's takes.
     *
     * THE CONVERSATION IS HANDED IN, and it is the one the LINES were built
     * for ({@link Teaching}) rather than whichever one the panel is in by the
     * time this runs. Re-reading it here would be a second answer to "who was
     * taught" a beat after the first, and the two differ in exactly the case
     * that matters — a session swapped under a send — where it would mark a
     * conversation taught that never heard a word.
     *
     * THE WRITE IS FORKED AND DETACHED and the saying is not: the row belongs
     * in the transcript now, in this send's own order, while the disk write is
     * behind a gesture that has already been answered — and its failure is a
     * LOG rather than a refusal ({@link ./sessions.ts}), because the cost of
     * losing it is one contract taught twice, which is not worth taking a send
     * away from somebody over.
     */
    const contracted = (teach: Teaching, key: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        const overheard = options.overheard
        if (overheard === undefined || overheard === null) return
        const row = transcript.entries().get(key)
        if (row === undefined || row.kind !== "user" || row.delivery !== undefined) return
        publish(transcript.add("notice", teach.lines.join("\n")))
        yield* Effect.forkDetach(noting(overheard.teach(teach.to), taughtLost))
      })

    /**
     * WHAT THIS CONVERSATION'S AGENT LAST SAID, written down against the
     * CONVERSATION so the door on its node's row has a line when nobody is
     * looking at it ({@link ./heard.ts}).
     *
     * AT THE TURN BOUNDARY and nowhere else: a paragraph is hundreds of chunks
     * and a line taken mid-turn is a prefix. Nothing at all for a conversation
     * no node claims, which is where it costs nothing.
     */
    const saidHere = (): Effect.Effect<void> =>
      Effect.gen(function*() {
        const to = conversationOf()
        const overheard = options.overheard
        if (to === null || overheard === undefined || overheard === null) return
        // NOTHING AT ALL FOR A CONVERSATION NO NODE CLAIMS, asked of the vault
        // rather than of the record: what the line is FOR is a door on a node's
        // row, so a conversation with no node has nowhere to draw it and the
        // write would be a row kept for nobody.
        if (options.agentAt?.(to) == null) return
        // THE LINE AND ITS OWN INSTANT, both off the row ({@link ./heard.ts}).
        // The clock is deliberately not read here: this runs at EVERY turn
        // boundary, and a turn that added no prose re-offers the line before
        // it — so a stamp taken now would say *just now* about words from an
        // hour ago, on the one member whose name is what olai HEARD.
        const said = lastSaid(transcript.entries())
        if (said === null) return
        const done = yield* Effect.result(overheard.said(to, said))
        if (done._tag === "Failure") {
          yield* Effect.logWarning(
            `what a node agent last said could not be written down ` +
              `(${done.failure.why}) — its door draws the line before this one`,
          )
          return
        }
        // ... AND A FRAME, so the door actually gets the line.
        //
        // The roster is re-assembled on every chat frame, which is the door the
        // composition root republishes it through (`@olai/server`'s
        // `runtime.ts`) — and this write is FORKED off the turn boundary, so it
        // lands AFTER the frame that turn published. Without this the line sat
        // on the disk until something unrelated moved the panel, and a door
        // whose agent had just answered drew blank for as long as nobody
        // switched conversations.
        //
        // AN IDENTICAL STATE, deliberately: nothing about the panel changed,
        // and what moved is the other half of a cell this package cannot see.
        // Both cells' `equals` swallow a frame that said nothing (the chat's
        // and the roster's), so the cost of the case where the line was already
        // written down is one comparison.
        move({})
      })

    /**
     * WHAT THIS CONVERSATION'S DOORBELLS ARE, for the strip — and the ONE
     * writer of that cell.
     *
     * A projection over two facts this file already holds, published through
     * {@link move} like every other thing the panel knows: the picks
     * ({@link ./scopes.ts}) say which doorbells are on and on what file, and the
     * held bodies ({@link ./deliveries.ts}) say how many of each plugin's
     * sentences are waiting. Nothing else writes `wake`, which is what keeps the
     * runtime's own rule intact — it moves what the store and the chat decided
     * onto the wire, and there is no overlay anywhere for this cell.
     *
     * The conversation is an ARGUMENT with a default, because the two places
     * that publish it around a session CHANGING know the answer before the cell
     * does: the `session` event is what sets `state.session`, and `sessionOver`
     * is what clears it, so both would otherwise read the conversation before
     * last. Every other caller takes the default.
     *
     * ROWS ONLY FOR THIS CONVERSATION. A pick for a conversation nobody is in is
     * still kept and still rung — it is the strip that draws one panel.
     */
    const wakeOf = (
      to: Deliveries.Addressed | null = conversationOf(),
    ): ChatState["wake"] => {
      if (to === null) return []
      const counted = held.counts(to)
      return (options.scoping?.rows() ?? [])
        .filter((row) => row.agent === to.agent && row.session === to.session)
        // `name` and NOT `plugin`, and that is not a style choice: the chat
        // cell declares `arrayKey: "name"`, which reaches every array at every
        // depth and merges by POSITION any whose elements do not carry it
        // ({@link ../../surface/src/index.ts}).
        .map((row) => ({
          name: row.plugin,
          file: row.file,
          waiting: counted.get(row.plugin) ?? 0,
          // THE FAULT TRAVELS, AND SO DOES ITS CAUSE, so the control can stop
          // drawing as enabled and can say which of the two things happened
          // ({@link Chat.faults}). NULLABLE on the wire where the record carries
          // the word-or-absent: the wire is a decoded value a browser reads per
          // frame, and an optional key there would be one more state for a face
          // to have an opinion about. The two unions are held equal by this
          // line and by the type checker rather than by a shared literal.
          fault: row.fault ?? null,
        }))
    }

    /** The agent's events, as rows and as state. The one place the vocabulary
     *  of {@link ./events.ts} is consumed. */
    const receive = (event: AgentEvent): void => {
      // How much this agent has said, ever, under BOTH readings of "said".
      // What every reader needs is not a count but a CHANGE — has anything
      // arrived since I looked — and a monotonic counter answers that with no
      // clock to read and nothing to reset. {@link cancel} asks the wide one
      // about an agent that was told to stop; {@link begin} asks the narrow one
      // about a turn, either way it ended. ONE lookup on the path every frame
      // of every conversation takes ({@link EVIDENCE}).
      const evidence = EVIDENCE[event._tag]
      if (evidence !== "neither") heard++
      if (evidence === "shown") shown++
      switch (event._tag) {
        case "said":
          publish(transcript.say(event.text))
          return
        case "userSaid":
          // A replay only: live, we put the user's own message in ourselves
          // when the turn was accepted — whole, because we have the whole of it
          // before anything is on the wire. A replay does not arrive whole, so
          // the chunks accumulate the way the agent's own prose does.
          publish(transcript.userSaid(event.text))
          return
        case "tool": {
          const change = transcript.tool(event.id, {
            title: event.title,
            status: event.status,
            detail: event.detail,
            progress: event.progress,
            diffs: event.diffs,
            wrote: event.wrote,
            locations: event.locations,
            parent: event.parent,
            spawned: event.spawned,
            armed: event.armed,
          })
          if (
            !says(change)
            && event.armed?.report !== undefined
            && event.title === undefined
            && event.status === undefined
          ) {
            tell(Effect.logDebug(
              `task-notification for ${event.id} has no announced row; report dropped`,
            ))
          }
          publish(change)
          // A tool frame is the only frame that can arm a background task, send
          // an agent out, or report the end of either — and only a frame that
          // says something about one of the three fields the list is made of can
          // move it, which is a small fraction of the frames a turn sends. The
          // list is a walk of the rows (`asking` next door makes the argument
          // for that), so the walk is worth not taking per progress chunk of
          // every call.
          //
          // `spawned` is the one that had to be ADDED with the strip's second
          // kind, and it is not covered by `status`: a spawn is announced
          // `pending` and a frame carrying only `_meta.claudeCode.subagent`
          // moves nothing else. Left out, an agent reached the strip late — on
          // whatever unrelated frame happened to carry a status next — which for
          // a fan-out is the whole of the stretch anybody is watching.
          if (
            event.armed !== undefined || event.spawned !== undefined
            || event.status !== undefined
          ) watched()
          return
        }
        case "asked":
          publish(transcript.ask(event.id, event.message, event.fields, event.parent))
          move({ asking: asking() })
          return
        case "askSettled":
          publish(transcript.settleAsk(event.id, event.outcome))
          move({ asking: asking() })
          return
        case "commands":
          move({ commands: event.commands })
          return
        case "advertised":
          advertises = { steers: event.steers, queues: event.queues }
          // ON `talking`, because it is a fact about WHO this panel is talking
          // to and that is the one member that answers for an agent. A frame
          // with nobody bound is a handshake that finished after its agent was
          // swapped out, and there is nobody for it to be about.
          rebind()
          return
        case "servers":
          // A fact about the conversation, so it lands on the cell beside the
          // model and the commands rather than as a row: a notice scrolls away
          // and this is true for as long as the session is.
          move({ servers: event.servers })
          return
        case "model":
          move({ model: event.name })
          return
        case "usage":
          // Beside the model, on the cell, for the model's own reason: it is a
          // standing property of the conversation rather than something that
          // HAPPENED in it. Several arrive per turn and the newest wins — the
          // agent is revising a number it already told us, not adding a second.
          move({ usage: event.usage })
          return
        case "session": {
          // A conversation is open, so nothing is waiting to be opened again.
          // HERE rather than in the two verbs that can open one, because this
          // is the event both of them end in — and because a BOOT opens one
          // without either of them being called at all.
          opened()
          const at = talking
          const now = at === null ? null : { agent: at.row.id, session: event.id }
          move({
            status: state.status === "thinking" ? "thinking" : "idle",
            session: { id: event.id, title: event.title, updatedAt: null },
            // WHICH NODE AGENT THIS CONVERSATION BELONGS TO, in the same breath
            // and for the doorbells' reason below: the binding is per
            // conversation, so the node that was true a moment ago was about a
            // different one — and a header naming the last conversation's node
            // over this one's is the one wrong thing this member can say.
            bound: boundTo(now),
            trouble: null,
            unopened: null,
            // WHICH DOORBELLS THIS CONVERSATION HAS ON, said in the same breath
            // the conversation itself is — the picks are per conversation, so
            // the row that was true a moment ago was about a different one.
            // The pair is spelled out because `state.session` is what this very
            // move is setting.
            wake: wakeOf(now),
          })
          // ... AND WHATEVER WAS HELD FOR IT GOES IN NOW, on its own fiber and
          // NEVER from here. This arm is reached from INSIDE the `opening`
          // permit — `entered` emits it synchronously from within the open —
          // and a semaphore is not reentrant, so a flush taken here would
          // deadlock the open it is part of. The two verbs that open a
          // conversation flush after that permit RELEASES ({@link changeSession}
          // and the boot arm below), which is the same moment one beat later
          // and the only one that is safe.
          return
        }
        case "sessionTitled":
          if (state.session === null) return
          move({ session: { ...state.session, title: event.title } })
          return
        case "sessionOver":
          // The panel shows ONE conversation, so asking for a new one empties
          // it. A break line under the old rows was tried and is not what "new
          // conversation" means to the person who pressed it: the agent's
          // context is gone, nothing above the line can be followed up, and a
          // transcript you cannot refer to is history the panel is keeping for
          // its own sake. A LOAD clears too, in the replay that follows. Only a
          // DEAD agent leaves the rows where they are — nobody asked for that,
          // and the `gone` notice explains them.
          if (event.why === "new") publish(transcript.clear())
          // The servers go with the session they were handed TO. The next one
          // is probed fresh and says so before it opens; leaving the last
          // one's roster up in between would be the panel answering "which
          // servers does this conversation have?" about a conversation that no
          // longer exists — and, for a dead agent, about one nobody is in.
          // The usage goes with the session it was usage OF. A fresh
          // conversation has spent nothing and a loaded one has spent whatever
          // it spent; either way the number from the last one is about a
          // context that no longer exists, and leaving it up would be the
          // panel answering "should I compact?" about somebody else.
          // ... and the INTERRUPTION comes back, because what withdrew it was
          // this session's own history: the adapter's queue bookkeeping is
          // per-session, so a fresh conversation and a stored one opened are
          // both clean ({@link queuedHere}). Said in the same breath as the
          // session going, since it is the same fact.
          queuedHere = false
          move({
            session: null,
            // ... and so does the node this conversation belonged to. A panel
            // between sessions belongs to nobody: the BINDING is untouched on
            // disk, keyed by the conversation, and a session reopened comes
            // back to its own node — but a header naming the last one's node
            // over a panel with no conversation in it would be claiming an
            // association that has nothing to hold it. `null` because
            // `state.session` is only nulled by this very move.
            bound: null,
            commands: [],
            asking: asking(),
            watching: watching(transcript.entries()),
            servers: [],
            usage: null,
            // ... and the doorbell rows go with the conversation they were
            // about. The PICKS are untouched — they are on disk, keyed by the
            // conversation, and a conversation reopened comes back with its own
            // — but a strip drawing the last one's file over the next one would
            // be the inheritance the ruling forbids. `null` because
            // `state.session` is only nulled by this very move.
            wake: wakeOf(null),
          })
          rebind()
          return
        case "replayStarted":
          publish(transcript.clear())
          watched()
          // Emptying the rows is one of the three things that can change how
          // many questions are open, so it is one of the three that recounts.
          // Every clear is preceded by the agent withdrawing what was waiting,
          // so this is belt to that brace rather than the only strap — but the
          // count is a function of the rows, and that should be true at every
          // point the rows move rather than at the two it usually moves at.
          move({ asking: asking() })
          return
        case "replayEnded":
          publish(transcript.settle())
          // ... and the strip with it, for the reason the two turn boundaries
          // below recount: settling STRANDS, an agent is strandable where a
          // background task is not, and a replayed conversation whose last turn
          // left somebody out would otherwise open with a dead subagent on the
          // strip and a clock ticking under it.
          watched()
          return
        case "gone":
          // ABANDON rather than settle, and this is the one place the
          // difference matters: a turn ending leaves an armed task alone,
          // because the task outlives the turn and the harness will report its
          // end. A dead agent reports nothing ever again — so the tasks it left
          // out there are abandoned like every other call it never came back
          // for, and the live faces on those rows go out with it.
          publish(transcript.abandon())
          watched()
          publish(transcript.add("notice", event.why))
          // Through the same door the two open verbs use, so a refusal that was
          // about a LIVE agent does not outlive the process it was about.
          wentAway(event.why)
          return
        case "trouble":
          publish(transcript.add("notice", event.message))
          move({ trouble: event.message })
          return
      }
    }

/** The roster row with that id, or `null` — the one place a name off the
     *  wire is turned into something startable. A browser that asks for an
     *  agent this machine does not have is a STALE TAB rather than a fault, so
     *  it is refused in words rather than crashed on. */
    const rowFor = (id: string): Installed | null =>
      options.roster.find((row) => row.id === id) ?? null

    /**
     * The agent for this row, started if it is not the one already talking —
     * and the previous one STOPPED if it was somebody else.
     *
     * One agent at a time, which is the shape of the ruling: a conversation is
     * bound to one, and the panel holds one conversation. A second live
     * subprocess would be a second language-model session held open for a
     * conversation nobody is looking at.
     *
     * The transcript goes with the process. Rows are what an agent said, and
     * what the OTHER agent said is not this conversation's history — so they
     * are cleared here rather than left to the incoming agent's own
     * `replayStarted`, which would leave a beat in which the old agent's
     * answers sit under the new one's header. Everything else about the last
     * conversation goes for the same reason it goes when a session ends: the
     * model, the room left in a context that no longer exists, the servers that
     * conversation was short of.
     *
     * UNDER ITS OWN PERMIT ({@link binding}), which every caller reaches
     * through this function rather than having to remember: the two verbs that
     * open a conversation hold {@link switching} as well, and a BOOT holds
     * neither, so the guard that matters has to be here. Two callers
     * interleaving would leave the panel talking to one agent and drawing
     * another's name, and, worse, would spawn two agent modules with only one
     * of them ever stopped.
     */
    const using = (row: Installed): Effect.Effect<AcpAgent.Agent, AcpAgent.AgentGone> =>
      binding.withPermit(Effect.gen(function*() {
        // A SHUTDOWN has already taken the agent this would replace, and a
        // subprocess started after it is one nothing will ever stop.
        if (closing) {
          return yield* new AcpAgent.AgentGone({
            gone: "unreachable",
            why: "the server is shutting down",
          })
        }
        const already = talking
        if (already !== null && already.row.id === row.id) return already.agent
        if (already !== null) {
          // WHAT IT HAS STORED HAS MOVED, and it stops being the agent we ask
          // afresh every time: this panel has just spent a conversation in it
          // (a fresh one minted, a stored one retitled), so anything kept about
          // it from before is a list that does not name the conversation
          // somebody was just in — the exact complaint the fan-out answers.
          listings.forget(already.row.id)
          talking = null
          // THROUGH THE EVENT, not through a second list of what a conversation
          // ending costs. Stopping an agent deliberately emits nothing (a
          // `gone` about a process somebody asked to stop would be a lie), so
          // the swap has to say it — and saying it here is the difference
          // between one place that knows which fields go with a session and
          // two that have to be kept in step.
          receive({ _tag: "sessionOver", why: "new" })
          yield* already.agent.stop
        }
        // ... and the three that do NOT go with a session, because they are
        // about the AGENT: the model is a different agent's answer, a refused
        // open was about a process that is gone, and a banner about it with it.
        opened()
        // WHAT THE LAST AGENT SAID ABOUT ITSELF IS NOT NEWS ABOUT THIS ONE.
        // Reset before the state below rather than after, because that state
        // reads it: a panel that kept the outgoing agent's answers would offer
        // an interruption on an agent that has not handshaken yet, on the
        // strength of what a different subprocess once advertised.
        advertises = SAYS_NOTHING
        move({
          // WHO, and — because it is one member — no longer a question that
          // could still be being asked while it names somebody.
          talking: bound(row),
          model: null,
          trouble: null,
        })
        const made = yield* spawn(row, receive)
        talking = { row, agent: made }
        return made
      }))

    /** A verb that names an agent. An id that is not on this machine is a
     *  STALE TAB — the roster it was drawn from has moved, or the browser was
     *  open across a restart — so it is refused in words rather than started. */
    const withRow = <A>(
      id: string,
      use: (row: Installed) => Effect.Effect<A, OpFailure>,
    ): Effect.Effect<A, OpFailure> =>
      Effect.suspend(() => {
        const row = rowFor(id)
        return row === null
          ? Effect.fail(
            new UsageFailure({
              reason: `there is no agent called \`${id}\` on this machine`,
            }),
          )
          : use(row)
      })

    /**
     * WHICH agent this panel comes up talking to, or `null` for "ask".
     *
     * The three-line rule from the header, in the order that makes each line
     * true: one installed agent is not a choice; a note this directory left
     * names the agent the panel was in a conversation WITH, and coming back to
     * that conversation is the whole point of the note; and anything else is a
     * question nobody here may answer on somebody's behalf.
     *
     * A NOTE THAT NAMES AN AGENT THIS MACHINE NO LONGER HAS reads as no note at
     * all — uninstalling an agent is not a reason to refuse to open the panel,
     * and the conversation behind that id is not reachable by anything left
     * here anyway.
     *
     * A memory that cannot be READ is a notice and a question, never a failure:
     * the panel works without one, exactly as it did before there was one.
     */
    const startsWith: Effect.Effect<Installed | null> = Effect.gen(function*() {
      const only = options.roster.length === 1 ? options.roster[0] ?? null : null
      if (only !== null) return only
      const held = yield* Effect.catchTag(
        memory.recall,
        "MemoryFailure",
        (failure) =>
          Effect.sync(() => {
            publish(transcript.add(
              "notice",
              `the agent this directory was last talking to could not be read (${failure.why}) — ` +
                `asking which one to use instead`,
            ))
            return null
          }),
      )
      return held === null ? null : rowFor(held.agent)
    })

    /**
     * A conversation is open, and whatever was in flight while it opened is
     * still in flight.
     *
     * NOT `idle`, which is what this was and what it is right about only when
     * nothing was sent in between. Opening a conversation takes real time — a
     * subprocess starts, a session is asked for, a stored one replays — and the
     * box is deliberately not locked while it does, so a prompt typed in that
     * window is accepted and starts a turn ({@link ./chat.ts}'s header says why
     * nothing is held). Stamping `idle` over that turn is the panel reporting a
     * state it can see it is not in: the composer stops saying the agent is
     * working while the agent is working, and the cancel button goes away from
     * under the person who was about to press it.
     *
     * Reachable before an agent was something a person picked — a boot is an
     * open too — and now it is ordinary: choosing an agent STARTS a subprocess,
     * which is the longest that window has ever been.
     */
    const settled = (): void => {
      move({ status: turns.busy ? "thinking" : "idle" })
    }

    /** A verb that OPENS a conversation with a named agent — the three steps
     *  the two of them share, and the part that is easy to get subtly wrong:
     *  the stale-tab refusal, the agent switch, and the permit that makes the
     *  switch and the open one step. What each verb says for itself is the
     *  one line that differs. */
    const openWith = (
      id: string,
      use: (agent: AcpAgent.Agent) => Effect.Effect<void, AcpAgent.AgentGone>,
      /** WHICH conversation, for the sentence a refusal draws — `null` for a
       *  verb that opens whichever the agent picks. */
      named: string | null = null,
    ): Effect.Effect<void, OpFailure> =>
      withRow(id, (row) => changeSession(Effect.flatMap(using(row), use), named))

    /**
     * What every installed agent has stored here — the question, answerable.
     *
     * WHAT THIS FILE SUPPLIES is the only part of it this file is the authority
     * on: which agent is already running, and how to start one that is not.
     * What it COSTS to ask, how long an answer is worth keeping, and what to
     * say about an agent that could not be asked are {@link ./listings.ts}'s —
     * none of those is a fact about a chat panel, and all of them are facts
     * that will change.
     *
     * A PROBE ENTERS NO CONVERSATION and says nothing into this one. Its events
     * go nowhere — a replay from an agent nobody is talking to has no business
     * in the transcript on screen — and `sessions` is the one verb that brings
     * up the process without opening a session ({@link ./agent.ts}'s
     * `onProcess`), so nothing is entered and the directory's note is not
     * rewritten by a question about it.
     */
    const listings = yield* Listings.make({
      roster: options.roster,
      running: (row) => {
        const at = talking
        return at !== null && at.row.id === row.id ? at.agent.sessions : null
      },
      // UNDER {@link binding}, the permit that says one agent is bound at a
      // time — because this is the other place a subprocess is started, and a
      // swap is the window in which nobody can say which agent is bound. While
      // {@link using} stops the old module and spawns the new one, `talking` is
      // `null`, so `running` above answers "not the bound one" for EVERY row —
      // the incoming one included — and a listing that took that answer would
      // start a second copy of the very agent being bound.
      aside: (row) =>
        binding.withPermit(Effect.gen(function*() {
          // THE SAME RULE {@link using} KEEPS, because it is the same hazard:
          // an agent spawned after `stop` has run is one nothing will ever
          // kill, and `stop` does not know about a probe. A question about
          // stored conversations is not worth a stray process, so it is
          // refused.
          if (closing) {
            return yield* new AcpAgent.AgentGone({
              gone: "unreachable",
              why: "the server is shutting down",
            })
          }
          // READ AGAIN, now that no swap can be in flight. `running` was asked
          // before the permit — it has to be, because the whole point of that
          // lane is to cost no permit at all — and the answer can have gone
          // stale in exactly one way: this row became the bound agent while we
          // queued. Asking the live one is then both cheaper and truer than
          // starting a second of it.
          const at = talking
          if (at !== null && at.row.id === row.id) {
            // NOT WORTH KEEPING: the agent this panel is talking to is the one
            // whose list this panel is changing.
            return { stored: yield* at.agent.sessions, keep: false }
          }
          const probe = yield* spawn(row, () => {})
          // STOPPED whichever way the question went, INTERRUPTION included. A
          // probe left running is the same stray process one line up, arrived
          // at from the other direction.
          const stored = yield* Effect.ensuring(probe.sessions, probe.stop)
          return { stored, keep: true }
        })),
      now: () => Date.now(),
    })

    /** A verb that needs somebody to talk to. Refused in words when there is
     *  nobody — the panel is drawing the picker, and what the caller asked for
     *  is a thing to do IN a conversation. */
    const onAgent = <A>(
      use: (agent: AcpAgent.Agent) => Effect.Effect<A, OpFailure>,
    ): Effect.Effect<A, OpFailure> =>
      Effect.suspend(() => {
        const at = talking
        return at === null
          ? Effect.fail(
            new UsageFailure({
              reason: "no agent has been chosen for this panel yet — pick one to start",
            }),
          )
          : use(at.agent)
      })

    /** An agent failure, as something a caller can render — ONE translation,
     *  used by every verb. Three call sites used to answer this differently
     *  (`busy` here, `not-found` there), which made "what kind of refusal is a
     *  dead agent" a question with three answers. `busy` is the honest one: the
     *  agent is not available right now, and the next prompt retries the boot. */
    const asFailure = (gone: AcpAgent.AgentGone): OpFailure =>
      new BusyFailure({ reason: gone.why })

    /**
     * Send. Not "send or queue" — SEND, whatever the agent is doing.
     *
     * An agent holds the floor for minutes at a time, and a person watching it
     * work thinks of the next thing well before it is finished. Refusing that
     * message made them hold it in their head and come back; queueing it HERE
     * made the panel hold it for them, out of sight, until the turn it should
     * have changed was over — and then a cancel threw it away. Both were the
     * same mistake, and neither is what happens now.
     *
     * ONE VERB, ONE LANE: it goes out as a plain `session/prompt`, busy or
     * idle. An idle agent starts on it; a busy one holds it behind the turn it
     * is working on and gets to it next, in order, which it does itself — this
     * file keeps no queue and never learns what the agent is busy WITH. That
     * last part is the whole of the `/compact` fix: a compaction is a turn like
     * any other from here, so a message sent during one waits for it instead of
     * tearing it down.
     *
     * `steer` is the deliberate exception and the only one — an INTERRUPTION,
     * asked for by a gesture somebody had to make on purpose
     * ({@link deliver}). Either way the row is written first and the words are
     * on screen before anything is on the wire.
     */
    const send = (
      text: string,
      attachments: ReadonlyArray<string>,
      context: ReadonlyArray<NodeContext>,
      steer = false,
    ): Effect.Effect<void, OpFailure> =>
      Effect.gen(function*() {
        const said = text.trim()
        // A picture on its own IS a message — "what is this" with a
        // screenshot under it is the usual way of asking — and so is a node on
        // its own, for the same reason and by the same rule: a box is only
        // empty when nothing was aimed at the conversation with it.
        if (said === "" && attachments.length === 0 && context.length === 0) {
          return yield* new UsageFailure({ reason: "there is nothing to send" })
        }
        // A path is not authority: it arrived over the wire, and the only ones
        // that mean anything are the ones this conversation wrote. The check
        // and what it says when it fails belong to the directory's own module.
        //
        // OUTSIDE the permit below and all at once: each claim is a
        // `realpath`, nothing is written by one, and a conversation being
        // opened has no business queueing behind somebody else's filesystem.
        yield* Effect.forEach(attachments, files.claim, { concurrency: "unbounded" })

        // BEHIND WHATEVER IS OPENING A CONVERSATION ({@link opening}), which is
        // what makes "the words are on screen from the moment you send them"
        // and "a replay empties the transcript" stop contradicting each other.
        // The permit covers the ROW as well as the delivery, deliberately: a
        // row written before the replay is a row the replay takes away.
        yield* opening.withPermit(Effect.gen(function*() {
          // WHAT A NODE AGENT IS TOLD, if this conversation belongs to one and
          // has not been told yet — INSIDE the permit, with the delivery it
          // rides under.
          //
          // It was asked outside, and that was the one thing on this path that
          // had no business being: a send that PARKS on the permit while a
          // session switch completes is an ordinary event with two tabs open,
          // and the contract addressed before the wait was delivered into the
          // conversation that arrived after it. Both halves went wrong at once
          // — the notice, the row and the prompt landed in the NEW conversation
          // carrying the OLD one's node, and the mark was written onto the old
          // binding, which then spent the rest of its life believing it had
          // been taught. That is exactly what {@link Teaching} pairs the lines
          // with a conversation to prevent; the pair held from build to mark
          // and was broken between build and DELIVER.
          //
          // Nothing is lost by moving it: `teaching()` is two synchronous
          // in-memory reads and `annotated` is pure. `files.claim` above is the
          // only thing on this path that earned its place outside — each claim
          // is a `realpath`, and a conversation being opened has no business
          // queueing behind somebody else's filesystem.
          const teach = teaching()
          const prompt = Attachments.promptWith(
            Context.promptWith(annotated(said, teach?.lines ?? []), context),
            attachments,
          )
          // The user's own message goes in FIRST and from the server, so both
          // tabs see it and a send that fails does not leave one behind. What
          // the ROW carries is the file NAMES: the tmp path is for the agent,
          // and a reader wants to see which picture went with which message.
          const row = transcript.user(said, {
            ...(attachments.length === 0
              ? {}
              : { attachments: attachments.map(Attachments.nameOf) }),
            // The nodes as the set answered for them, in the row rather than
            // only in the prompt: what the message was ABOUT is part of what
            // was said, so it survives a reload and reaches the other tab like
            // everything else here.
            ...(context.length === 0 ? {} : { context }),
          })
          publish(row.change)
          yield* deliver(row.key, prompt, steer)
          // ... AND THE CONTRACT IS SAID AND MARKED, both halves together and
          // both only where the message it rode under was TAKEN
          // ({@link contracted}).
          //
          // AFTER the delivery rather than before the row, which is two
          // corrections in one. A send the agent refused used to leave the
          // notice standing — a conversation visibly quoting a contract the
          // agent never took, with the mark rightly withheld beside it, so the
          // transcript and the record said different things. And the ORDER is
          // truer this way round: the lines ride UNDER the person's words in
          // the prompt ({@link ./prompt.ts}'s `annotated`), so a notice under
          // the message is what actually went out, where one above it was the
          // panel arranging the message for the reader.
          if (teach !== null) yield* contracted(teach, row.key)
        }))
      })

    /**
     * Get one prompt to the agent NOW, whatever it is doing — and, when that
     * cannot be done, leave the words with the person who typed them.
     *
     * THE ORDINARY LANE IS THE ONLY LANE unless somebody asked otherwise: a
     * plain `session/prompt`, which starts a turn this file owns whether or not
     * another is already running. What the agent does with a second one is the
     * agent's own business — it holds it behind the first and runs it next, in
     * order — and that is the point: nothing here has to know what the running
     * turn IS, so a `/compact` is waited for exactly as a grep is.
     *
     * STEERING IS THE ASKED-FOR EXCEPTION, and every condition on it is a
     * condition on the ASK: somebody made the interrupting gesture, the agent
     * advertised that it takes one, and there is a turn in flight to put it in.
     * Any of those missing and this is a plain prompt — which is the safe
     * direction and the only one it fails in, since the message goes either
     * way. It is aimed at the turn the agent is ON ({@link Turns.head}), which
     * with several in flight is the oldest: interrupting the one it is working
     * on is what interrupting means, and the ones behind it have not started.
     *
     * A steer that lands starts NOTHING here — the words are in a turn this
     * file already owns — so the row is not queued behind anything and the
     * transcript says nothing about it.
     *
     * UNDER A PERMIT, because the first thing it does is read which lane to take
     * and the last thing it does is take it. Two tabs sending at an idle agent
     * both read `head === null` otherwise, and both start a turn: the second
     * ticket replaces the first, whose end is then correctly silenced as a turn
     * that was superseded — so a real turn would end with the panel saying
     * nothing about it. The ticket answers WHICH turn is speaking; it was never
     * going to answer how many may start, and narrowing that window is not
     * closing it. The permit is held for one round trip: `begin` forks rather
     * than awaiting a turn, and a steer answers as soon as the message is on the
     * agent's input.
     *
     * WHAT THE PERMIT DOES NOT COVER IS CANCEL, and it must not: a person who
     * has sent a message and then thought better of the whole turn is pressing
     * the one button that has to work while something else is in flight. So a
     * steer can be overtaken — cancel wins the pipe, the turn ends, and the
     * steer comes back saying there was nothing to steer. That answer is the
     * same one the settle race gives, and the two want opposite things done:
     * one is a turn that finished on its own and the message becomes an
     * ordinary prompt; the other is a turn a person STOPPED, and starting a
     * fresh one with the message they sent into it would be the panel
     * un-cancelling on their behalf. The ticket the steer was aimed at is what
     * tells them apart — see {@link Turn.stopped}.
     */
    const deliver = (
      key: string,
      prompt: string,
      steer: boolean,
    ): Effect.Effect<void> =>
      sending.withPermit(Effect.gen(function*() {
        const at = talking
        if (at === null) {
          // Unreachable from the panel — there is no box to type into while
          // nobody has been chosen — and said on the ROW rather than thrown,
          // because these are somebody's words and the rule for words that did
          // not go is the same however they failed to.
          return undeliverable(key, prompt, {
            gone: "unreachable",
            why: "no agent has been chosen for this panel yet",
          })
        }
        const agent = at.agent
        // WHICH turn this steer is aimed at, kept rather than re-read: by the
        // time it answers, it may be over. The one the agent is working on,
        // which is the oldest — the ones behind it are waiting at the agent and
        // interrupting a turn that has not started is nothing at all.
        const aimed = turns.head
        // NOBODY IS INTERRUPTED BY ACCIDENT. Without the gesture this is a
        // plain prompt, mid-turn or not, and the agent takes it in its turn —
        // which is what every send did on opencode all along and what every
        // send does everywhere now. And nobody is interrupted on an agent that
        // never said it could be, or in a conversation where interrupting
        // would not END ({@link queuedHere}): both are what the composer drew
        // its control from, and a send arriving with the flag set anyway — a
        // stale tab, a tab that queued in another window — falls through to
        // the plain prompt it was going to be rather than being refused. That
        // is the safe direction, and the only one this file fails in.
        if (steer && aimed !== null && advertises.steers && !queuedHere) {
          const steered = yield* Effect.result(agent.steer(prompt))
          if (steered._tag === "Failure") {
            // WHICH failure it was is the agent's reading, not ours: it is the
            // wire that knows whether anything answered, and this is the one
            // fact the row's two faces are drawn out of.
            return undeliverable(key, prompt, steered.failure)
          }
          if (steered.success === "taken") {
            // Delivered, and into the turn a person could see running — so a
            // banner about the last thing that went wrong is a banner about
            // something the agent has visibly moved on from.
            return move({ trouble: null })
          }
          // The agent ANSWERED — "nothing to steer" — so nothing took the
          // message, which is a refusal however the turn came to be over.
          if (aimed.stopped) {
            return undeliverable(key, prompt, { gone: "refused", why: CANCELLED_UNDER_IT })
          }
        }
        yield* begin(at, key, prompt)
      }))

    /**
     * The message did not land, said on the row it was typed into — in the ONE
     * of two ways this end can honestly say it.
     *
     * A REFUSAL is a certainty: nothing took the message, and this end can say
     * so — the agent answered no (a method it does not have, a session it does
     * not know, a turn its own sender had stopped), or there was nothing to ask
     * at all (no process, no session open). The row keeps the prompt
     * ({@link ./transcript.ts}) and offers *send again*, because nothing
     * happened and asking again is honest.
     *
     * The ROW's two faces are two where {@link ./agent.ts}'s `Gone` is three,
     * and the fold is deliberate: those two arms differ in whether the agent is
     * still there, which is a fact about the CONVERSATION and not about these
     * words. A message that did not go did not go.
     *
     * SILENCE is not. The steer went out, the deadline passed, and an agent
     * that took the message and then went quiet is indistinguishable from one
     * that never took it. So the row says exactly that and offers NOTHING to
     * press: a retry here would hand somebody a duplicate they had no way to
     * predict. The words stay on screen, which was always the promise — what is
     * missing is the certainty, not the message.
     *
     * The distinction is not made here and never was ours to make: it is
     * {@link ./agent.ts}'s `Gone`, decided at the wire, where "did anything
     * answer" is a fact rather than a guess. This file used to infer it from a
     * comment.
     *
     * A silence also goes in as a NOTICE, which a refusal does not need. Both
     * put the reason on the banner, and the banner is cleared by the next turn
     * that comes back — fine for a row that goes on saying *not sent* with a
     * button under it, and not fine for the one thing nobody will act on: what
     * happened to those words is a fact about the conversation, so it belongs
     * in the conversation.
     */
    const undeliverable = (key: string, prompt: string, failed: Undelivered): void => {
      markUndelivered(key, prompt, failed.gone)
      if (failed.gone === "unanswered") publish(transcript.add("notice", failed.why))
      move({ trouble: failed.why })
    }

    /** WHICH mark the row takes — the whole of the difference, in one place
     *  because both delivery lanes reach it: a refusal keeps the prompt beside
     *  the row and hands a person the button that sends it again; a silence
     *  keeps nothing, which is what makes the button unofferable rather than
     *  merely undrawn ({@link ./transcript.ts}).
     *
     *  SILENCE is the arm that is named, and the other is everything else. The
     *  question this answers is "may I honestly offer these words again", and
     *  exactly one of `Gone`'s three values says no to it — so naming the two
     *  that say yes would be this line having an opinion about which ways a
     *  message can fail to go, which is the thing it does not have to have. */
    const markUndelivered = (key: string, prompt: string, gone: AcpAgent.Gone): void => {
      publish(
        gone === "unanswered" ? transcript.unanswered(key) : transcript.refused(key, prompt),
      )
    }

    /**
     * Run one prompt as a turn.
     *
     * Accepted, not awaited: the turn runs on its own fiber and reports through
     * the transcript, so a five-minute turn is not a five-minute call.
     *
     * The ticket is written down BEFORE the fork and the fiber is filled in
     * after, so a turn is on the record from the instant it starts rather than
     * from whenever the fork returns. That NARROWS the window a concurrent
     * send would read to decide between prompting and steering; what CLOSES it
     * is {@link deliver}'s permit, because no amount of narrowing makes a
     * read-then-write atomic and the ticket was never the mechanism for that.
     *
     * What the ticket is for is IDENTITY: the fiber's own reports are gated on
     * still BEING the turn, because a turn that settled while its replacement
     * was starting has nothing true left to say about where the conversation
     * stands, and saying it anyway would mark a thinking panel idle.
     *
     * It is handed the ROW as well as the prompt, because a prompt is a
     * delivery like a steer is: a turn that never started because the agent was
     * not there took nobody's message anywhere, and the words deserve the same
     * account of themselves ({@link undeliverable}).
     *
     * ## ENTER IT HOLDING `sending`, and that is a precondition rather than a habit
     *
     * The first thing this reads is `turns.busy`, and on `true` it LATCHES
     * {@link queuedHere} — permanently, for the life of the conversation. That
     * read is only stable while nothing else may call `turns.open`, which is
     * exactly what the {@link sending} permit buys: both callers ({@link
     * deliver} and {@link offer}) hold it across their own decision and this
     * call, so no turn can appear between the two.
     *
     * A THIRD CALLER THAT DID NOT WOULD SPEND SOMEBODY'S INTERRUPT, silently
     * and for good, on a turn that was not running when it looked. It is
     * written here rather than only at the callers because that is where a
     * third one would read, and because the cost of getting it wrong is a
     * control that never comes back rather than an error anybody sees.
     */
    const begin = (
      at: Bound,
      key: string,
      prompt: string,
    ): Effect.Effect<void> =>
      Effect.gen(function*() {
        /** A turn was ALREADY running when this one started — which, since
         *  every send is a plain prompt, is what any message typed while the
         *  agent works is. The agent holds this one behind that one. */
        const alongside = turns.busy
        if (alongside) {
          yield* Effect.logInfo("message queued behind a running turn").pipe(
            Effect.annotateLogs({
              agent: at.row.id,
              ...(state.session === null ? {} : { session: state.session.id }),
            }),
          )
          // ... AND THE INTERRUPTION IS WITHDRAWN FROM THIS CONVERSATION, from
          // this moment on ({@link queuedHere}): the adapter cannot settle a
          // turn it steers once a session has queued, and a control that hangs
          // the conversation is not one to draw. Said once — the panel is told
          // when it becomes true, not once per message after that.
          if (!queuedHere) {
            queuedHere = true
            rebind()
          }
        }
        const ticket = turns.open(key)
        // ... AND THE ROW SAYS SO, which is the half a person can see. It is
        // the only thing standing between "I pressed send and nothing is
        // happening" and knowing the words are at the agent with a turn in
        // front of them — and it is a statement about THIS end's own turns
        // (one went out, none has started on it), never a guess at what the
        // agent is doing with it. It comes off below, when the turns in front
        // of it end.
        if (alongside) publish(transcript.queued(key))
        // The rows go first, and the order is the point. A dead agent's rows
        // are deliberately left where they are, so this turn is starting over a
        // transcript that may hold calls the last one abandoned — and the panel
        // is about to be told a turn is in flight. Said in the other order,
        // there is a frame in which every one of those calls is drawn as work
        // in progress again ({@link ./transcript.ts}'s `begins`).
        //
        // NOT WHEN A TURN IS STILL RUNNING, though: what `begins` does is mark
        // what the LAST turn walked away from, and a turn that is still going
        // has walked away from nothing. Its calls are live, and stranding them
        // because somebody typed a second message would be the panel saying a
        // running grep had been abandoned.
        // ... and STRANDING TAKES THINGS OFF THE STRIP, which is why the recount
        // is here beside it rather than only on the frames the agent sends. A
        // background task is exempt from stranding by construction
        // ({@link ./transcript.ts}'s `#strand`), so while the strip carried only
        // tasks its membership could move on a tool frame and on nothing else,
        // and one gate covered it. An AGENT is not exempt: a spawn its turn
        // walked away from is over, and nothing after this point will ever say
        // so on a frame — so a strip that was not recounted here would carry a
        // dead subagent, with a clock ticking under it in every open tab, for
        // the rest of the conversation.
        if (!alongside) {
          publish(transcript.begins())
          watched()
        }
        move({ status: "thinking", trouble: null })
        // How much the agent had SHOWN before this turn was asked for — the
        // narrow count ({@link EVIDENCE}), and it answers one question in both
        // directions the turn can end. On a turn that FAILED: whether the
        // prompt demonstrably arrived, since an agent that streamed so much as
        // a thought was working on it. On a turn that SUCCEEDED: whether
        // anything came of it at all. A count answers "has anything arrived"
        // with no clock to read.
        const quietSince = shown

        /**
         * Nothing a person can see has arrived since this turn was asked for.
         *
         * A function rather than a value because it is read at the END of the
         * turn, and `shown` moves throughout it.
         *
         * IT IS THE CONVERSATION'S COUNT, not this turn's, and it cannot be
         * anything else: a frame names no turn on any wire olai speaks, so
         * which of two turns in flight drew a row is not a fact this end has.
         * What that costs is one direction only, which is why it is the right
         * approximation: a turn that really was silent while a sibling was
         * talking goes unremarked (nothing is claimed), and a turn that drew
         * something is never accused of silence. Several turns at once is the
         * ordinary shape now — a message typed while the agent works is one —
         * and this errs towards saying nothing about all of them.
         */
        const quiet = (): boolean => shown === quietSince

        const running = yield* Effect.forkDetach(
          Effect.gen(function*() {
            const outcome = yield* Effect.result(at.agent.prompt(prompt))
            // Whether this turn was the LAST one running. The notices go in
            // either way — they are things that happened, and they happened —
            // and only the state is withheld: a turn that ends while another is
            // still going has nothing true left to say about where the
            // conversation stands, and saying it anyway would mark a thinking
            // panel idle.
            //
            // Left the set HERE rather than in the `ensuring` below, because
            // every line under this one is asking whether anything is still
            // running and the answer has to already be true.
            const current = turns.leave(ticket)
            // ... and so is the SETTLE, for `begins`' reason read from the
            // other end: a turn that ends while another is still running must
            // not strand the running turn's calls. The last one out settles,
            // and settling is idempotent over rows that have already stopped.
            //
            // EVERY turn closes its own paragraph, though, which is the half of
            // settling that is true whoever else is running: the agent's prose
            // grows the row that is open, so a turn that ended without closing
            // one leaves the NEXT turn's first words on the end of its last
            // sentence — two answers in one paragraph, with the question
            // between them somewhere above.
            publish(current ? transcript.settle() : transcript.stopSaying())
            // ... and the strip is recounted with it, for `begins`' reason one
            // turn-boundary over: settling is the OTHER place a spawn can be
            // stranded, and a stranded spawn is one the strip must stop
            // carrying.
            if (current) {
              watched()
              // ... AND IT IS WHERE A NODE AGENT'S DOOR GETS ITS LINE. The
              // paragraph is closed by the settle above, so this is the first
              // moment the agent's last word is a whole sentence rather than a
              // prefix ({@link saidHere}). Forked for `flushing`'s reason and
              // silent for a conversation no node claims, which is nearly all
              // of them.
              yield* Effect.forkDetach(saidHere())
              // ... AND THE TURN BOUNDARY IS WHERE A DOORBELL'S WORDS GET IN.
              // `turns.leave` answered TRUE, which is exactly "the set emptied"
              // ({@link ./turns.ts}), so this is the first moment since the body
              // was held at which an idle agent can take it — and it is the
              // moment for EVERY way a turn can end, a cancel included: a
              // cancelled turn is still a boundary, and a person who wants the
              // doorbell to stop clears the file.
              //
              // FORKED, so nothing about this turn's ending waits on a permit a
              // send may be holding. DETACHED, because the fiber that reaches
              // this line is itself detached and about to finish.
              yield* Effect.forkDetach(flushing)
            }
            // WHOEVER THE AGENT IS ON NOW HAS STOPPED WAITING. This turn is
            // over, so the message behind it is the one being worked on — and
            // this row is not waiting for anything either, however it ended.
            //
            // Both, and in this order, because they are two different rows in
            // the ordinary case and the same row in none of them. Asked of the
            // SET rather than remembered, so a message that was third in line
            // keeps saying so until the two in front of it have really gone
            // ({@link ./turns.ts}'s `head`).
            publish(transcript.taken(key))
            const next = turns.head
            if (next !== null) publish(transcript.taken(next.key))
            if (outcome._tag === "Failure") {
              publish(transcript.add("notice", outcome.failure.message))
              // A turn that produced NOTHING is a delivery that failed, and it
              // is said on the row like any other ({@link markUndelivered}) —
              // a refusal where the agent said no or was never reached at all,
              // a silence where the pipe died with the prompt on it.
              //
              // An agent that SAID something first is the case this must not
              // touch, and the reason this file used to mark nothing here: it
              // demonstrably had the prompt and worked on it, so a row calling
              // that undelivered would contradict the answer sitting above it.
              // What has changed is that "did it arrive" is now answerable —
              // by the turn's own silence, and by `Gone` where it is not.
              if (quiet()) markUndelivered(key, prompt, outcome.failure.gone)
              // WHETHER THERE IS STILL AN AGENT, which is a different question
              // from whether the turn ran and is answered by the same value: a
              // turn the agent REFUSED is a turn that ended — the process is
              // there, it just spoke, the conversation is open, and the next
              // prompt goes to it. Everything else is this end unable to reach
              // one, and the panel says so.
              //
              // Both readings used to be `refused`, so a turn an agent answered
              // an error to left a live agent's panel saying `not running` — in
              // a conversation it was still in — until some later turn happened
              // to succeed.
              const alive = outcome.failure.gone === "refused"
              if (current) {
                move({ status: alive ? "idle" : "gone", trouble: outcome.failure.message })
              }
              return
            }
            // Cancelling means stop, and it means only that: everything typed
            // reached the agent when it was typed, so there is nothing left
            // here for a cancel to decide the fate of. The messages BEHIND the
            // stopped turn are the agent's — held in its own queue, in its own
            // order — and this end does not reach into it. (What the pinned
            // adapter does with them is its own answer, and it is the honest
            // one: the words run. Verified on the wire, 2026-08-24.)
            //
            // ONE NOTICE PER PRESS, and it belongs to the PRESS rather than to
            // a turn: a cancel stops the conversation, so every turn in flight
            // comes back `cancelled` — including a message that was still
            // waiting behind the running one, which the pinned adapter answers
            // that way while running its words anyway (verified on the wire).
            // A person who pressed one button wants to be told once, and the
            // order the answers come back in is the agent's, so *which* turn
            // says it cannot be the rule.
            //
            // A `cancelled` NOBODY ASKED FOR is always news, which is the other
            // half of the same test: the agent stopped a turn on its own, and
            // there is no press for the notice to be a duplicate of.
            //
            // AND IT IS THE ONE SILENCE THAT IS ACCOUNTED FOR, which is why it
            // returns rather than falling through: a turn somebody stopped
            // before it said anything has a notice about it already, and the
            // arm below would put a second one under it blaming the agent for
            // obeying.
            if (outcome.success === "cancelled") {
              if (!ticket.stopped || !stopSaid) {
                stopSaid = ticket.stopped
                publish(transcript.add("notice", "cancelled"))
              }
              if (current) move({ status: "idle", trouble: null })
              return
            }
            // A TURN THAT SAID NOTHING is not a turn that went well, and until
            // this arm existed it was drawn as one: the agent answered
            // `end_turn`, the panel went idle, and what a person got back for
            // their message was an empty space under it. That is what an agent
            // which cannot reach a model looks like from here — opencode with
            // no provider key sends one zero-token usage frame and then a
            // SUCCESSFUL end_turn, with no error anywhere on the wire — and it
            // is the one failure the panel had no face for at all.
            //
            // Said for EVERY agent rather than for the one it was found on: a
            // turn with nothing in it is nothing to read whoever produced it,
            // and no agent has a reason to end one. It costs an ordinary turn
            // nothing — a turn that said anything at all skips it.
            //
            // The banner STAYS UP, unlike every other ending here, because
            // there is nothing else on screen to say this happened: a notice
            // scrolls with the transcript and the next thing a person does is
            // send again.
            if (quiet()) {
              const why = silence(at.row.name)
              publish(transcript.add("notice", why))
              if (current) move({ status: "idle", trouble: why })
              return
            }
            // A turn that came back is the proof that whatever went wrong
            // before has stopped being true. Leaving the banner up after it
            // would make the panel report a state it can see it is not in.
            if (current) move({ status: "idle", trouble: null })
          }).pipe(
            // Belt to the brace above: the body leaves the set on its own way
            // out, and an INTERRUPT (a shutdown, a conversation change) never
            // reaches that line.
            Effect.ensuring(Effect.sync(() => {
              turns.leave(ticket)
            })),
          ),
        )
        ticket.fiber = running
      })

    /**
     * ONE ATOMIC ARM-DECISION for a doorbell's words: hand them over, or say
     * they are still held.
     *
     * ## Both permits, in {@link send}'s own order
     *
     * {@link opening} first, because the question "is this body's conversation
     * the one on screen" is only answerable when no conversation is being
     * opened — a replay CLEARS the transcript, so a row written into that gap is
     * a row the conversation it was going into takes away. Then {@link sending},
     * because the question "is the agent busy" is a read that is only true for
     * as long as nothing else may write it.
     *
     * ## The `turns.busy` re-read is INSIDE `sending`, and that is the whole
     * design
     *
     * {@link begin} sets {@link queuedHere} the first time a prompt goes out
     * ALONGSIDE a running turn, and what that costs is stated where it is set:
     * after one message queued, this conversation has no interruption for the
     * rest of its life. It is a human control, spent by a human gesture. A
     * doorbell body that landed mid-turn would spend it with nobody having typed
     * anything, invisibly and permanently.
     *
     * So this is not a check that is CAREFUL, it is a check that cannot be
     * raced: `turns.open` is only ever called from inside `sending`
     * ({@link begin}, reached from {@link deliver} and from here and from
     * nowhere else), so `busy` cannot go false→true between the read below and
     * the {@link begin} under it. A doorbell prompt is therefore NEVER
     * `alongside`, and therefore never flips the latch — by construction rather
     * than by timing. `deliveries.test.ts` holds it rather than trusting this
     * paragraph.
     *
     * ## {@link begin} DIRECTLY, and never {@link deliver}
     *
     * A steer PRE-EMPTS, and pre-empting means aborting whatever the agent is
     * doing. There is no gesture behind a doorbell, so there is nothing here
     * that could have asked for one — and `deliver` is the function that decides
     * whether to steer. Calling it and passing `false` would leave a `true`
     * one line away from a machine.
     *
     * ## What "handed" means, exactly
     *
     * That the prompt is on ITS way, not that it is on the wire: `begin` forks,
     * and the row is the durable account of what became of it — marked
     * undelivered on the row, with its fate drawn, exactly as a person's own
     * send is. That is the same guarantee `send` gives and the reason the answer
     * here is two-valued rather than three.
     */
    const offer = (
      to: Deliveries.Addressed,
      /**
       * The words, ASKED HERE and nowhere earlier — past the identity check,
       * past `turns.busy`, under both permits, at the last instant before the
       * row is written.
       *
       * IT USED TO BE A STRING the caller had already composed, and the caller
       * had no way to know whether it would be handed over: a body composed for
       * a conversation whose turn was running came back `"held"` and was thrown
       * away, to be composed again at the boundary. A plugin counting its own
       * deliveries therefore counted asks that never landed — which is a
       * heartbeat's window silenced by a message nobody got
       * ({@link ../../plugin-kolu/src/doorbell.ts}'s ledger). Asking here makes
       * "the thunk was asked" and "the words went in" the same event, which is
       * what {@link ../../plugin-api/src/plugin.ts}'s `Deliveries.deliver` has
       * always claimed.
       */
      say: () => string | null,
      from: string,
    ): Effect.Effect<"handed" | "held" | "nothing"> =>
      opening.withPermit(Effect.gen(function*() {
        const at = talking
        // NOT THIS PANEL'S CONVERSATION — no agent bound, none open, or one
        // that is somebody else's. There is exactly one conversation this
        // process can prompt, so every other conversation's bodies wait for
        // somebody to open them.
        if (
          at === null || state.session === null
          || at.row.id !== to.agent || state.session.id !== to.session
        ) return "held"
        return yield* sending.withPermit(Effect.gen(function*() {
          if (turns.busy) return "held" as const
          const body = say()
          // NOTHING LEFT TO SAY. The subject settled while the body waited, so
          // there is no row — and the caller drops the slots rather than asking
          // again forever.
          if (body === null) return "nothing" as const
          // MARKED, and marked by core from the registry binding: the plugin
          // never supplies its own name ({@link ../../surface/src/chat.ts}'s
          // `rang`).
          const row = transcript.user(body, { rang: from })
          publish(row.change)
          yield* begin(at, row.key, body)
          return "handed" as const
        }))
      }))

    /**
     * The held bodies for one conversation, offered as ONE message.
     *
     * ONE PLUGIN AT A TIME — the one whose body has been waiting longest — and
     * all of that plugin's held bodies together, joined whole with a blank line
     * between them ({@link ./deliveries.ts}'s `joined`). Not every plugin's
     * bodies in one message, because the row carries ONE `rang` and a row marked
     * with one plugin's name carrying another's paragraph would be exactly the
     * signature the mark exists to prevent. A second plugin's bodies go at the
     * next boundary, which the turn this one starts produces.
     *
     * WHAT IS TAKEN IS WHAT WAS OFFERED, by identity: a coalescing replace that
     * landed while this was on the wire wrote a new slot into that position, and
     * clearing the list wholesale would drop words nobody ever saw.
     *
     * On `"held"` nothing moves at all and the next boundary tries again.
     */
    const flush = (to: Deliveries.Addressed): Effect.Effect<void> =>
      Effect.gen(function*() {
        // A LOOP, because a batch that has entirely settled writes no row — and
        // no row is no turn, and no turn is no next boundary. One plugin's
        // bodies going quiet would otherwise strand a SECOND plugin's behind
        // them until something unrelated produced a boundary, which on a quiet
        // conversation is never. Latent while one tenant rings; the day a second
        // one delivers it is a message that never arrives.
        for (;;) {
          const waiting = held.waiting(to)
          const oldest = waiting[0]
          if (oldest === undefined) return
          const mine = waiting.filter((slot) => slot.from === oldest.from)
          // THE WORDS ARE NOT ASKED FOR HERE. {@link offer} asks them, past its
          // own two permits, at the instant before the row is written — so a
          // batch whose turn is still running is not composed and thrown away,
          // and a plugin counting its own deliveries never counts an ask that
          // did not land.
          const arm = yield* offer(to, () => Deliveries.joined(mine), oldest.from)
          if (arm === "held") return
          // `"handed"` wrote a row; `"nothing"` found every body settled and
          // wrote none. Both take the slots — the second so the next pass does
          // not ask them again and get the same silence — and both keep the
          // strip's count honest.
          held.took(to, mine)
          move({ wake: wakeOf() })
          // ONE ROW PER BOUNDARY, but a batch that said nothing is not a row:
          // where it settled, the loop goes on to the plugin behind it rather
          // than waiting for a boundary this pass never produced.
          if (arm === "handed") return
        }
      })

    /**
     * ... for whichever conversation this panel is in NOW.
     *
     * A suspend rather than a value, because every caller forks it and what it
     * is about is decided when it RUNS: a turn ending and a conversation opening
     * are both moments at which the answer has just changed.
     */
    const flushing: Effect.Effect<void> = Effect.suspend(() => {
      const to = conversationOf()
      return to === null ? Effect.void : flush(to)
    })

    /**
     * A plugin's sentence, into a conversation. See {@link Chat.deliverTo}.
     *
     * IT ALWAYS HOLDS FIRST, and then flushes. Two arms written out separately
     * — offer, and hold if that fails — would be two orders: a body offered past
     * bodies already waiting for the same conversation arrives BEFORE them,
     * which is the plugin's own sentences read out of the order it wrote them
     * in. Held-then-flushed there is one lane and one place the coalescing rule
     * is applied, and the idle arm still costs exactly one turn.
     */
    const deliverTo = (
      to: Deliveries.Addressed,
      say: () => string | null,
      from: string,
      how?: { readonly coalesce?: string },
    ): Effect.Effect<void> =>
      Effect.gen(function*() {
        held.hold(to, from, say, how?.coalesce)
        // The strip's count moves the moment the body is held, which is the
        // panel's own rule: the alternative to holding words out of sight is
        // not dropping them, it is showing that they are waiting.
        //
        // ONLY WHEN THE COUNT THIS PANEL DRAWS IS THE ONE THAT MOVED.
        // {@link wakeOf} projects over the conversation this panel is IN, and
        // filters the picks to that pair — so a body held for any OTHER
        // conversation recomputes an array identical to the one already on the
        // cell. That is the COMMON case rather than an edge one: the whole
        // point of holding is that a doorbell rings conversations nobody is
        // sitting in. The chat cell declares no `equals`, so every `move` ships
        // a whole `ChatState` frame to every open tab, and a frame that says
        // nothing is still a frame every tab decodes.
        //
        // The flush below covers the other direction: when a body really does
        // land, the count it was raising comes back down and {@link flush}
        // publishes that itself.
        const here = conversationOf()
        if (here !== null && here.agent === to.agent && here.session === to.session) {
          move({ wake: wakeOf() })
        }
        yield* flush(to)
      })

    /**
     * Stop the turn — and say so when it DOES NOT STOP.
     *
     * STOP THE AGENT AND NOTHING ELSE, which is the whole of what it means now:
     * everything typed went to the agent as it was typed, so there is no
     * second question here about what to do with the messages behind it. There
     * used to be — a cancel dropped the queue, out loud, and out loud is not the
     * same as out of harm's way: what a person read was a notice counting the
     * sentences they had just lost.
     *
     * The refusal channel is the easy half and it was missing: `agent.cancel`
     * used to swallow the notification's own failure, so a cancel that could
     * not be put on the wire typed as a success. That is fixed at the source
     * ({@link ./agent.ts}) and mapped here like every other verb's refusal.
     *
     * It is not the half a person sees. A cancel is a NOTIFICATION: it is
     * written and never answered, and under Bun a pipe reports nothing back to
     * the writer even when the reader has gone (checked, both for a closed
     * stdin and for a process that has exited). So the write succeeding is not
     * evidence of anything, and every way this actually fails — an agent that
     * stopped reading, one that read it and carried on, one whose adapter
     * dropped it — looks identical from here: the button was pressed, and the
     * turn goes on streaming.
     *
     * The only honest evidence is the TURN, and it is TWO facts rather than
     * one. A turn that is still running after the grace is not by itself an
     * agent ignoring anything: a cancel arrives between a turn's own steps, so
     * an adapter in the middle of a long grep or a file write honours it when
     * that step returns, and a clock alone would call every one of those dead.
     * What separates them is whether the agent is still SAYING anything. One
     * that is streaming tool progress is working and will stop when it can;
     * one that has gone silent with a cancel outstanding is the case nobody
     * could see before — and the two want opposite things said about them.
     *
     * So: the same turn, AND nothing heard since the cancel went out. A
     * counter rather than a timestamp because what is being asked is "has
     * anything arrived", which needs no clock. It lands on `trouble` rather
     * than as a refusal because by then nobody is waiting on the click, and it
     * is cleared by the turn ending (`begin`, and the settle in the turn's own
     * fiber) — a state the panel can see it is not in is a state it must not
     * report.
     */
    const cancel: Effect.Effect<void, OpFailure> = Effect.gen(function*() {
      const running = turns.busy
      yield* onAgent((agent) => Effect.mapError(agent.cancel, asFailure))
      if (!running) return
      // Marked AFTER the cancel is on the wire rather than before, because a
      // cancel that could not be delivered stopped nothing — and on EVERY
      // ticket, for the reason {@link ./turns.ts} gives. What reads the mark is
      // a steer still in flight against one of these turns: it is about to come
      // back "nothing to steer", and this is the only thing that says the
      // reason was a person rather than the turn finishing. It outlives the
      // turn, which is the point — by then the ticket is all that is left of it.
      const asked = turns.stopping()
      // ... and this press has not been spoken about yet. Reset HERE, beside
      // the marking and under nothing: `stopping` is what makes a press exist,
      // so it is the one moment "has this been said" can honestly go back to
      // no.
      stopSaid = false
      const quietSince = heard
      yield* Effect.forkDetach(Effect.gen(function*() {
        yield* Effect.sleep(CANCEL_GRACE)
        // A turn that has LEFT the set is one that ended, which is the cancel
        // having worked. Asking about the tickets this press was about, rather
        // than about the status, is what makes the second press of the button
        // about the turns it was pressed for.
        if (asked.every((ticket) => !turns.has(ticket))) return
        // ...and an agent that has said anything since is one still working
        // towards the stop it was asked for, which is not a thing to accuse
        // anybody of.
        if (heard !== quietSince) return
        move({
          trouble:
            "the agent was asked to stop and has said nothing since — the turn below is still running",
        })
      }))
    })

    /**
     * Try an undelivered message again, on a person's say-so.
     *
     * The prompt is the one that failed rather than one rebuilt from the row:
     * the row carries the pictures' NAMES and the prompt carries their paths,
     * so a retry read off the screen would be a different message wearing the
     * same words.
     *
     * A retry that fails again leaves the row exactly as it was — still there,
     * still retryable, with the new reason on the banner — because the one
     * thing this must never do is make words disappear on their way to
     * failing. That falls out of unmarking FIRST: `deliver` marks it again on
     * the one path that marks anything, rather than this deciding not to
     * unmark it and having a second opinion about what happened.
     *
     * TAKING the prompt is one step with reading it, under {@link deliver}'s
     * own permit, and that is what makes a second click a refusal rather than
     * a second send: whichever press gets there first leaves with the prompt,
     * and the other finds nothing waiting. Two clicks both reading a non-null
     * prompt before either unmarked would send the message twice, which is the
     * one outcome an undelivered row must not be able to produce.
     */
    const resend = (id: string): Effect.Effect<void, OpFailure> =>
      // BEHIND WHATEVER IS OPENING A CONVERSATION, for {@link send}'s reason
      // and in its smaller shape. Pressing *send again* inside a boot window
      // takes the words off the row before `replayStarted` empties the
      // transcript and delivers them after — so the row that carried them is
      // gone and what is left is an answer with no question above it. It is
      // the same invariant: everything that means something INSIDE a
      // conversation waits for the conversation.
      opening.withPermit(Effect.gen(function*() {
        const prompt = yield* sending.withPermit(Effect.sync(() => {
          const waiting = transcript.undelivered(id)
          if (waiting !== null) publish(transcript.sent(id))
          return waiting
        }))
        if (prompt === null) {
          return yield* new UsageFailure({
            reason: "that message is not waiting to be sent — it went, or its conversation did",
          })
        }
        // NEVER AS AN INTERRUPTION, whatever the original send was: a retry is
        // a person asking for a message to go, not for a turn to be broken
        // into, and the turn the first attempt was aimed at is over — that is
        // usually why there is a retry at all.
        yield* deliver(id, prompt, false)
      }))

    /**
     * An OPEN that the agent refused, and what it would take to try it again.
     *
     * The other half of a `ChatState.unopened`, kept HERE for the reason a
     * refused message's prompt is kept beside its row ({@link ./transcript.ts}):
     * a face offering a retry with nothing behind it draws a button that
     * refuses, and an attempt with no face is a failure nobody can see. Neither
     * is constructible while the two are written and dropped together —
     * {@link refusedOpen} writes both, and {@link opened} drops both.
     *
     * The EFFECT rather than a description of it, because "which conversation"
     * is not always a thing anybody named: a boot adopts its own, and a
     * description would be this file re-deciding that on a retry.
     */
    let unopened: { readonly again: Effect.Effect<void, AcpAgent.AgentGone> } | null = null

    /** The agent said no to opening a conversation. The panel says so, with
     *  the agent's own words and the offer to try again — and stays IDLE,
     *  because the agent answered and is therefore running ({@link
     *  ../../surface/src/chat.ts}'s `Unopened`). */
    const refusedOpen = (
      failure: AcpAgent.AgentGone,
      what: string | null,
      again: Effect.Effect<void, AcpAgent.AgentGone>,
    ): void => {
      unopened = { again }
      // `trouble` is left alone deliberately: it is drawn inside the transcript
      // and cleared by the next turn, and there is neither a transcript to draw
      // it in nor a next turn to clear it. The face is what says this.
      //
      // THE SERVERS GO, for `sessionOver`'s reason met from the other side. The
      // roster is composed and announced BEFORE `session/new` is asked — it is
      // the very list that call is handed ({@link ./agent.ts}) — so an open
      // that comes back a NO leaves a strip answering "which servers does this
      // conversation have?" about a conversation that does not exist. Empty
      // means "there is no conversation" on this member
      // ({@link ../../surface/src/chat.ts}), and this is one of the two faces
      // where that is true.
      move({ status: "idle", unopened: { why: failure.message, what }, servers: [] })
    }

    /** ... and a conversation is open, so neither half of that is true any
     *  more. Called wherever one is entered, which is the only thing that can
     *  make it untrue. */
    const opened = (): void => {
      unopened = null
    }

    /**
     * THE AGENT IS NOT THERE — it never started, it died, the handshake failed.
     *
     * The other answer to "the open did not happen", and the one that takes a
     * refusal with it: `unopened` says *the agent is running and would not open
     * a conversation*, and the first half of that stops being true here. A
     * refusal left standing over a dead process is the panel's body saying the
     * agent answered while its own header says the agent is gone — the same
     * shape of lie this PR exists to end, one state later.
     *
     * Three callers and one rule: the two verbs that open a conversation, and
     * the process exiting on its own.
     */
    const wentAway = (why: string): void => {
      opened()
      // ... and the servers go here too, which is the same fact through the
      // other door: this is the OTHER answer to "the open did not happen", and
      // an open that reached the wire announced a roster on its way. On the
      // ordinary path — the process exiting — `sessionOver` has already emptied
      // it and this is a no-op; the path it is not a no-op on is a verb whose
      // open never came back, where the roster describes an attempt rather than
      // a conversation. Written in both halves of the pair because they are one
      // rule, and a pair where only one half remembers is how the other one
      // ends up forgetting.
      move({ status: "gone", trouble: why, unopened: null, servers: [] })
    }

    /**
     * Move to another conversation. The `done` frame of a cancelled turn
     * follows on its own — the agent decides how a turn ended, and a cancel
     * that raced the end of one must not claim otherwise.
     *
     * `what` is taken TWICE — run, and kept for a retry where it was refused —
     * which is what makes "try again" mean the thing that was asked for rather
     * than the thing this file would pick.
     */
    const changeSession = (
      what: Effect.Effect<void, AcpAgent.AgentGone>,
      /** WHICH conversation, for the sentence a refusal draws. `null` for a
       *  fresh one, which is nobody's by name. */
      named: string | null = null,
    ): Effect.Effect<void, OpFailure> =>
      switching.withPermit(
        Effect.gen(function*() {
          if (turns.busy) {
            return yield* new BusyFailure({
              reason: "a turn is running; cancel it before switching conversations",
            })
          }
          // The pictures went with it. They exist so that a prompt in THIS
          // conversation can name them, and no prompt in the next one will.
          yield* files.discard
          move({ status: "booting" })
          // HELD ACROSS THE WHOLE OPEN, not around it: what a send has to wait
          // for is the replay, which is the last thing to happen and the thing
          // that empties the transcript ({@link opening}).
          const outcome = yield* opening.withPermit(Effect.result(what))
          if (outcome._tag === "Failure") {
            // THE AGENT SAID NO, as against there being no agent to say it —
            // `refused` and only `refused` ({@link ./agent.ts}'s `Gone`). It is
            // running, it just will not open this; the panel says that rather
            // than reporting a dead process, and holds what it would take to
            // ask again.
            if (outcome.failure.gone === "refused") {
              refusedOpen(outcome.failure, named, what)
            } else {
              wentAway(outcome.failure.message)
            }
            return yield* asFailure(outcome.failure)
          }
          settled()
          // ... AND WHATEVER A DOORBELL HELD FOR THE CONVERSATION JUST OPENED
          // GOES IN, as its first message.
          //
          // HERE and not in {@link receive}'s `session` arm, which is where the
          // fact actually lands: that arm runs INSIDE the permit released one
          // line above — `entered` emits it synchronously from within the open
          // — and {@link opening} is not reentrant, so a flush taken there would
          // block the fiber already holding it and the open would never
          // complete. This is the same moment one beat later, outside the
          // permit, and it is the only safe one.
          yield* Effect.forkDetach(flushing)
        }),
      )

    return {
      entries: () => transcript.entries(),
      state: () => state,
      overheard: () => options.overheard?.rows() ?? [],
      // THE TWO MARKS THE MIGRATION GESTURES LEAVE, and both are written the
      // way everything else in this record is: behind a gesture that has
      // already been answered, logging what it could not write rather than
      // taking the gesture away from somebody ({@link ./sessions.ts}).
      assigned: (to) => noting(options.overheard?.assign(to), assignLost),
      replaced: (to, by) => noting(options.overheard?.supersede(to, by), replaceLost),
      // THE SET'S ANSWER, ASKED AGAIN. `move` is what publishes, and it is
      // guarded on the value rather than called unconditionally: this runs per
      // revision, the state cell is what the whole panel redraws from, and a
      // frame per keystroke that said the same thing would be the cost of a
      // feature nobody is looking at.
      reread: () => {
        const now = boundTo()
        if (now !== state.bound) move({ bound: now })
      },
      send,
      // Under the SAME permit as a session change, because the two touch one
      // directory: a chunk that found the conversation's directory a moment
      // before `discard` removed it would be writing into a directory being
      // deleted underneath it. Serialized, the two orders are both whole — an
      // upload finishes into the conversation it began in, or it starts in the
      // one that replaced it — and neither is half of each. One chunk is a
      // three-megabyte write, so the permit is held for milliseconds, not for
      // an upload. It also makes the collision suffix sound within a process:
      // two tabs pasting `shot.png` at the same moment cannot both pick it.
      attach: (chunk) => switching.withPermit(files.receive(chunk)),
      resend,
      // A cancel the agent never took is a refusal like any other, and the
      // click that asked for it is what hears about it — the same treatment
      // `sessions` gets, and for the same reason: a verb that could not be
      // done says so where it was asked.
      cancel,
      // WITH the agent that was chosen, always: every new chat asks, so there
      // is no arm here that picks one. An id off a stale tab is refused in
      // words rather than started.
      newSession: (id: string) => openWith(id, (agent) => agent.newSession),
      // The answer to the panel's own question, which is not the same verb: a
      // boot that stopped to ask has not asked for a NEW conversation, so what
      // this opens is the one that agent's own boot would have adopted —
      // {@link Chat.chooseAgent}. `boot` is idempotent and picks its own, which
      // is why it is also what a refused one is retried with.
      chooseAgent: (id: string) => openWith(id, (agent) => agent.boot),
      // NAMED by the id the browser pressed, which is the only thing this end
      // has before the load answers — a title would be the picker's word for a
      // conversation, and the picker is exactly what this refusal takes off the
      // screen. The agent's own reason sits beside it either way.
      // WITH the agent whose conversation it is, because the list spans all of
      // them now: a row picked out of it may belong to the agent this panel is
      // not talking to, and opening it is a change of agent as well as of
      // conversation. `openWith` is what {@link Chat.newSession} already goes
      // through, so the switch, the stale-tab refusal and the permit are the
      // same ones — the only thing that differs is what is opened at the end.
      loadSession: (agentId: string, id: string) =>
        openWith(agentId, (agent) => agent.loadSession(id), id),
      /**
       * The refused OPEN, tried again — whichever it was.
       *
       * The prompt-retry's shape one level up ({@link resend}), and its rule:
       * IT TAKES. Reading the attempt and emptying the slot are one step, so
       * whichever press gets there first leaves with it and the other finds
       * nothing waiting and is told so. Two presses that both read a non-null
       * attempt would both open — and for a refused `newSession` that is a
       * second fresh conversation wiping the first, which is the one outcome a
       * retry must not be able to produce.
       *
       * SYNCHRONOUS, inside the suspend, which is what makes the take atomic:
       * `changeSession`'s permit cannot be borrowed for it (a semaphore is not
       * reentrant, and `changeSession` takes that permit itself), and it would
       * be the wrong permit anyway — the window is between reading the slot and
       * queueing on it, which is over before either press awaits anything.
       *
       * WHAT IS NOT TAKEN IS THE FACE. The cell keeps its reason until
       * `changeSession` rewrites it, so a retry that fails again leaves the
       * panel exactly as it was — still saying why, still offering the button —
       * and one that lands clears both halves at the door a conversation is
       * entered by ({@link opened}).
       */
      reopen: Effect.suspend(() => {
        const waiting = unopened
        if (waiting === null) {
          return Effect.fail(
            new UsageFailure({
              reason: "no conversation is waiting to be opened — one is open, or none was refused",
            }),
          )
        }
        unopened = null
        return changeSession(waiting.again, state.unopened?.what ?? null)
      }),
      // ... WEARING THE SUPERSESSIONS OLAI ITSELF MADE ({@link
      // ./succession.ts}). The overlay is here, at the one door every reader of
      // a listing comes through, so the migration list, the panel's *past
      // sessions* and the picker's own superseded line cannot come to disagree
      // about which conversations a node agent has had.
      sessions: Effect.map(
        listings.all,
        (listed) => succeeded(listed, options.overheard?.rows() ?? []),
      ),
      answer: (id, answers) =>
        onAgent((agent) =>
          Effect.flatMap(
            agent.answer(id, answers),
            (took) =>
              took ? Effect.void : Effect.fail(
                new UsageFailure({
                  reason: "that question is not waiting any more — it was answered or withdrawn",
                }),
              ),
          )),

      // ONE CLOSURE PER PLUGIN, and the name is in it rather than in an
      // argument — see {@link Chat.doorFor}. Both halves of the keying live
      // here, in the module that owns the mark, so neither is a thing a
      // composition root does on the way past.
      doorFor: (plugin) => ({
        scopes: () =>
          (options.scoping?.rows() ?? [])
            // ... AND NOT A ROW THAT IS NOT BEING WATCHED. There is nothing to watch,
            // so there is nothing for this plugin to derive — and everything a
            // plugin does PER SCOPE stops with it, which is the point: a
            // heartbeat that fired for a broken scope would be the panel saying
            // "alive and quiet" about a doorbell that is watching nothing. The
            // filter is how those two are kept apart by construction rather
            // than by every caller remembering ({@link Chat.faults}).
            .filter((row) => row.plugin === plugin && row.fault === undefined)
            // The `plugin` column goes on the way out: a door is already
            // ABOUT one plugin, so carrying its name back to it would be the
            // caller's own question answered a second time.
            .map(({ agent, file, session }) => ({ agent, file, session })),
        deliver: (to, say, how) => deliverTo(to, say, plugin, how),
      }),
      /**
       * A person pointed a doorbell at a file — or took it off one.
       *
       * IT REFUSES rather than becoming a notice, and that is the difference
       * between this and every other thing that fails quietly around here: a
       * pick is a gesture somebody just made, and a pick that did not stick is a
       * thing they need told. The boot's read is the opposite case and stays the
       * opposite way round ({@link ./scopes.ts}) — nobody is standing at the
       * screen when that one fails.
       *
       * WHICH conversation is an ARGUMENT rather than "whichever is open": the
       * panel's own session can move under a picker somebody left open (a boot
       * opens one with no verb called at all), and a pick attached to a
       * conversation a person was not looking at is worse than a refusal. It is
       * the same pair {@link Chat.loadSession} takes and for the same stated
       * reason.
       *
       * The read-back is not an overlay: this ends in `move`, so what the strip
       * draws next comes through the one publisher every other chat verb
       * publishes through.
       */
      scope: (to, plugin, file) =>
        Effect.gen(function*() {
          const scoping = options.scoping ?? null
          if (scoping === null) {
            return yield* new UsageFailure({
              reason: "this panel keeps no doorbells: no plugin here rings a conversation",
            })
          }
          // A SCOPE WRITE DISOWNS WHAT THE OLD SCOPE WAS HOLDING — every scope
          // write, and this is the whole rule rather than a case.
          //
          // A CLEAR is the obvious half: a sentence arriving because it was
          // queued before the clear would be the control lying about itself,
          // and {@link wakeOf} hangs the count on the very row the write
          // removes, so the warning goes in the same frame the words stop being
          // visible. A RE-POINT disowns them for a sharper reason: the body
          // names the file it was derived from, so it would land under a
          // control that says it is watching a different one — and the plugin
          // will not re-derive it, because the terminals it named need not be
          // claimed in the new file at all.
          //
          // FIRST, BEFORE THE WRITE, because the write is filesystem I/O and a
          // turn ending in that window would flush a body the person has
          // already disowned. Dropping early is safe in the one direction it
          // can be wrong: a held body is a fresh derivation of what is standing
          // ({@link ./deliveries.ts}), so a drop under a write that then fails
          // costs a re-derivation on the plugin's next tick, where a drop that
          // came too late costs a sentence nobody can account for.
          held.dropped(to, plugin)
          const left = yield* Effect.mapError(
            scoping.set(to, plugin, file),
            (failure) => new BusyFailure({ reason: failure.why }),
          )
          // ... AND SO DOES A WRITE THAT PUSHED SOMEBODY ELSE OUT. The cap
          // evicts the least recently touched row, and that row's conversation
          // is one nobody is looking at — so it is the one case where a
          // doorbell can go quiet with no gesture behind it, and the bodies it
          // was holding would otherwise sit until that conversation next opened
          // and arrive from a doorbell its strip now draws as off.
          for (const row of left) held.dropped(row, row.plugin)
          move({ wake: wakeOf() })
        }),
      /**
       * A revision, judged against the picks. See {@link Chat.faults} for what
       * it is for; what is here is the three things this package owns about it.
       *
       * IT ANSWERS EMPTY FOR A PANEL WITH NO SCOPE TABLE, rather than refusing:
       * a serve composed without plugins has no picks to break, and a caller
       * driving this off every revision has nowhere to put a refusal for a
       * question that was never applicable.
       *
       * A WRITE THAT FAILS IS A WARNING AND NO ROWS. Nobody is standing at the
       * screen — this is a revision and not a gesture — so it takes the boot
       * read's arm and not {@link Chat.scope}'s. Nothing is marked when the
       * write fails ({@link ./scopes.ts}), so the same edge is still there next
       * revision and the only cost is a delay.
       *
       * ...AND THE STRIP IS REPUBLISHED, through the one publisher every other
       * chat verb publishes through: {@link wakeOf} reads the same rows this
       * just marked, so the control stops drawing as enabled in the same frame
       * the sentence goes out. Unconditionally, and not only when something
       * fell — a HEALED row moves the cell too, and it is the arm with nothing
       * else to announce it.
       */
      faults: (served, sayable) =>
        Effect.gen(function*() {
          const scoping = options.scoping ?? null
          if (scoping === null) return []
          const fell = yield* Effect.result(scoping.faults(served, sayable))
          if (fell._tag === "Failure") {
            yield* Effect.logWarning(
              `a doorbell's file is no longer served and the record would not take the mark ` +
                `(${fell.failure.why}) — the conversation is not told yet, and the next ` +
                `revision tries again`,
            )
            return []
          }
          // ONLY WHEN THE ROWS ACTUALLY MOVED, and this guard is not an economy.
          // This runs on EVERY published revision — every keystroke somebody
          // saves anywhere in the vault — and the chat cell declares no
          // `equals`, so an unconditional `move` here would ship a whole
          // `ChatState` (roster, commands, servers, usage, watching, wake) to
          // every open tab on every revision, for a value that is the same
          // value. `watched()` above keeps the same discipline for the same
          // reason.
          if (!sameWake(wakeOf(), state.wake)) move({ wake: wakeOf() })
          return fell.success
        }),
      recordRefusal: (tool: string, failure: OpFailure) =>
        Effect.sync(() => {
          publish(transcript.refuse(`\`${tool}\` was refused`, failure))
        }),
      start: Effect.gen(function*() {
        // Eager, on the server's own start, because the panel is meant to show
        // your last conversation before anybody types into it. On its own
        // fiber: pages serve while it happens, and a boot that fails changes
        // nothing — the next prompt retries it exactly as a crash does.
        yield* Effect.forkDetach(
          Effect.gen(function*() {
            const chosen = yield* startsWith
            if (chosen === null) {
              // NOBODY IS CHOSEN and nobody will be chosen for you: the panel
              // asks, and holds no conversation until it is answered. IDLE
              // rather than `booting`, because nothing is happening — this is
              // a state that has settled, and it settles until somebody presses
              // something.
              move({ status: "idle", talking: { kind: "asking" } })
              return
            }
            // Serialized against every other way an agent is bound by
            // {@link using}'s own permit, and NOT by the directory's: this boot
            // runs while the listener serves pages, and a shutdown must not
            // queue behind it.
            // The other place a conversation is opened, and the one no click
            // reaches. It takes {@link opening} for the reason the two verbs do
            // — a page is served while this runs, so somebody can be typing
            // into a panel whose conversation is still being replayed — and
            // deliberately NOT the directory's permit, so a shutdown does not
            // queue behind a boot.
            const outcome = yield* opening.withPermit(Effect.result(
              Effect.flatMap(using(chosen), (agent) => agent.boot),
            ))
            if (outcome._tag === "Failure") {
              // A warning rather than an error: the panel is already showing
              // this, and the next prompt retries the boot exactly as a crash
              // does. Nothing has stopped.
              yield* Effect.logWarning(outcome.failure.message).pipe(
                Effect.annotateLogs({ agent: chosen.id }),
              )
              // The same distinction the session verbs make, at the other place
              // a conversation is opened: an agent that ANSWERED the open with
              // a no is running, and a boot that never reached one is not.
              // What a boot was trying to open is nobody's by name — it adopts
              // its own — so the face names no conversation, and trying again
              // is the boot itself, which is idempotent and re-opens.
              if (outcome.failure.gone === "refused") {
                refusedOpen(outcome.failure, null, Effect.flatMap(using(chosen), (a) => a.boot))
              } else {
                wentAway(outcome.failure.message)
              }
              return
            }
            settled()
            // ... and the other place a conversation is opened flushes for the
            // same reason and at the same point: after the permit, never from
            // inside the event ({@link changeSession}). A BOOT is how a doorbell
            // reaches the conversation this directory was last in without
            // anybody pressing anything.
            yield* Effect.forkDetach(flushing)
          }),
        )
      }),
      stop: Effect.gen(function*() {
        closing = true
        // EVERY turn, not the newest ({@link ./turns.ts}).
        const running = turns.drain().flatMap((ticket) => ticket.fiber ?? [])
        for (const fiber of running) yield* Fiber.interrupt(fiber)
        const at = talking
        talking = null
        if (at !== null) yield* at.agent.stop
        // Registered as a finalizer of the serve scope, so this is also what
        // takes the pasted pictures with the server when it shuts down. Behind
        // the same permit as everything else that touches the directory: a
        // chunk still being written is a write into a directory this line is
        // about to remove.
        yield* switching.withPermit(files.discard)
      }),
    }
  })
