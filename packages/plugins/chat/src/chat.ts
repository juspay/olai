/**
 * One conversation, and the surface it is served through.
 *
 * This is deliberately the state machine for ONE panel. {@link ./scoped.ts}
 * composes one for each acquired node scope and one ordinary root panel; this
 * lower layer knows nothing about that scheduling. A panel is still never per
 * browser connection: every browser watching it sees the same transcript, so
 * a second tab needs no catch-up protocol — it subscribes to the same
 * collection and gets the conversation in its first frame.
 *
 * This file is the join, and it is the only place that knows both halves:
 * `@kolu/acp-client`'s `agent.ts` speaks ACP and emits typed events;
 * `@kolu/acp-harness`'s `transcript.ts`
 * turns those into rows; the surface members below are how a browser sees them.
 * Nothing above knows an agent exists, and nothing below knows a browser does.
 *
 * It BUILDS the agent rather than being handed one, and that is what keeps
 * `session/update` a word this package is the last to say: a caller passes the
 * ROSTER it detected and the directory to run in, never a protocol object. The
 * seam for a scripted agent is one level further out and more honest for it —
 * `KOLU_ACP_AGENT` pointed at a script, which is how the e2e suite drives every
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
 *   - **the activation's own note** ({@link ./memory.ts}) may name the agent a
 *     conversation was last entered with. It is transient — this machine-local
 *     document's model record is the durable half — so a restart does not read
 *     it. What a restart DOES bring back is the set of conversations that were
 *     live, reopened by the scheduler from the record it writes as they move
 *     ({@link ./scoped.ts}'s `Chat.start`, {@link ./live.ts}).
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
import type { Advertised, ToolServer } from "@olai/plugin-api/services"

import { type Attached, type AttachChunk, CHAT_OFF, type ChatEntry, type ChatState, type Wake, type NodeContext, type Listed, type Talking } from "olai-plugin-chat/wire"
import type { PlanStep } from "@kolu/acp/wire"

import { type OpFailure } from "@olai/format"
import { type AskAnswer } from "@kolu/acp/wire"
import { BusyFailure, type NodeAgent, UsageFailure } from "@olai/format"
import { emitter } from "@olai/log"
import { Effect, Fiber, References, Semaphore } from "effect"

import * as AcpAgent from "@kolu/acp-client"
import {
  type Change,
  type Harness,
  type HarnessChange,
  type HarnessOptions,
  HarnessRefused,
  type HarnessState,
  HarnessUnavailable,
  holding,
  type HttpServer,
  joined,
  type Opening,
  type RowHead,
  says,
  startHarness,
  type TurnEnded,
} from "@kolu/acp-harness"
import type { Conversing, Overheard, Sessions } from "./sessions.ts"
import { choiceOf, here, offBecause, type Installed, type Roster } from "./agents/roster.ts"
import * as Attachments from "./attachments.ts"
import * as Context from "./context.ts"
import type { Stored } from "@kolu/acp-client"
import { lastSaid } from "./heard.ts"
import type { Json } from "./json.ts"
import * as Listings from "./listings.ts"
import type { Models } from "@kolu/acp-client"
import { annotated } from "./prompt.ts"
import type { Probe } from "@kolu/acp-client"
import type { Scoped, Scopes } from "./scopes.ts"
import { succeeded } from "./succession.ts"
import { remindingFor, teachingFor } from "./teaching.ts"
import { sameWatching, watching } from "./watching.ts"

/** One conversation a plugin may wake, optionally narrowed to a node scope. */
export interface WakeScope {
  readonly current: () => boolean
  readonly agent: string
  readonly session: string
  readonly pick: import("./json.ts").Json
}

/**
 * WHICH CONVERSATION — the pair, because a session id means nothing to the
 * wrong agent.
 *
 * Olai's own identity for a conversation, spelled the way {@link ./memory.ts}
 * and `@olai/surface`'s `SessionInfo` already spell it rather than minted a
 * second time. It is what a held body is addressed to (`@kolu/acp-harness`'s
 * `holding`, which is generic over the address precisely because kolu has one
 * conversation and olai has a table of them).
 */
export interface Addressed {
  readonly agent: string
  readonly session: string
}

/**
 * How many bodies ONE plugin may have waiting for ONE conversation before the
 * oldest is dropped.
 *
 * A count and not a byte budget, because what a body costs is the plugin's
 * business and what this end can honestly bound is how many of them it is
 * holding. Thirty-two is far past the number a coalescing plugin ever reaches
 * — a plugin that keys its sentences holds exactly one — so the cap only ever
 * bites on a plugin that is ringing without one, which is the case worth
 * bounding.
 *
 * NO ELISION LINE when it bites. Saying "and 4 more" would be core composing a
 * sentence, which is the one thing the doorbell's whole shape refuses.
 */
export const SLOTS = 32

/**
 * ... and how many CONVERSATIONS are held for at all, evicted
 * least-recently-held-for.
 *
 * The other unbounded axis: a plugin scoped to conversations a person has long
 * since stopped opening would otherwise grow one list per conversation for the
 * life of the process. The same rule {@link ./scopes.ts} evicts a pick by, and
 * for the same reason — membership of an agent's session list is not proof of
 * anything, so the only safe eviction order is the one this end can see.
 *
 * BOTH CAPS ARE OLAI'S, handed to a holding that keeps neither by default:
 * kolu holds one slot per watched terminal for one conversation, and the watch
 * list is its bound.
 */
const CONVERSATIONS = 32

/** Everything one conversation needs. Pooling, eviction and per-node
 * credentials belong to the scheduler above this constructor. */
export interface PanelOptions {
  /** A scheduler may lend an already-running engine for a directory listing. */
  readonly runningSessions?: (agent: string) => Effect.Effect<ReadonlyArray<Stored>, AcpAgent.AgentGone> | null
  /**
   * The WHOLE standing table, already detected ({@link ./agents/roster.ts}).
   * Detecting it is the caller's move — it is the caller that owns this
   * process's environment — and what a detected one looks like is ours.
   *
   * ## A THUNK, and it used to be an array
   *
   * An engine is a PLUGIN, and a plugin can be turned off at the panel while
   * the serve runs. Captured, this list was a boot snapshot: switching the
   * claude row off left claude in the picker, and picking it still WORKED,
   * because the id was looked up in the same frozen array. That is the defect
   * a person meets — the switch says the plugin is off and the panel goes on
   * offering it.
   *
   * Every reading of it is now at the moment it is asked: what the picker
   * draws, what an id off the wire is resolved against, and the one-agent
   * shortcut. {@link Panel.enginesMoved} is what tells this module the table
   * has changed, because a thunk nobody re-reads is a snapshot with extra
   * steps.
   *
   * ## THE WHOLE TABLE, and the folds are ours
   *
   * It used to answer `ReadonlyArray<Installed>` — the FILTERED reading —
   * which is what made an absent engine invisible at the boundary: the caller
   * knew why and could not say. What this file reads off it is still the
   * `here` rows ({@link rowFor}, the listings fan-out, the one-agent
   * shortcut); what it PUBLISHES is every row, because the picker is the one
   * reader that greys an absence rather than dropping it, and the sentence a
   * `not-here` row carries is the engine's own.
   *
   * ## IT MAY NOW ANSWER EMPTY, where the array never could
   *
   * This said: *NEVER EMPTY — a caller that found nothing builds no chat at
   * all, and a chat with an empty roster would be a panel that can never answer
   * anything, holding a subprocess-shaped hole.* The first half still holds and
   * is still the caller's rule: nothing builds a panel that has never had an
   * agent. What is new is that a panel which HAD one can watch its last engine
   * leave, and the honest face for that is the one the state machine already
   * carries — `off`, with `no-engine`, which is the same sentence a serve
   * composed without an engine row shows. {@link Panel.enginesMoved} enters it
   * and leaves it again when a row comes back.
   */
  readonly roster: () => Roster
  /** Where to start it: the served directory, exactly. An agent keys its
   *  stored sessions by the directory it was started in, which is what makes
   *  them findable at all — and it is what olai's own note of WHICH of them
   *  the panel was in is keyed by ({@link ./memory.ts}), which is what makes
   *  "the conversation you were last in" survive a restart. */
  readonly cwd: string
  /** WHERE THE MODEL A PERSON CHOSE IS WRITTEN DOWN, so a switch survives a
   *  restart. The scheduler supplies one shared instance so it can route boot
   *  before any panel starts; omitting it is a panel whose model pin is the
   *  agent's own. Handed straight to the conversation, which is the only end
   *  that can tell a SWITCH from the agent re-asserting its pin at the door. */
  readonly models?: Models
  /** THIS DIRECTORY'S REMEMBERED CONVERSATION — which one it was last in and
   *  on which model, so a restart opens that one rather than whichever the
   *  agent has most recently.
   *
   *  REQUIRED, and that is the whole of the argument for the keyword: an
   *  activation's cache is SHARED by every panel the scheduler builds
   *  (`./scoped.ts` mints one and hands it to all of them), so a panel that
   *  quietly made its own when the field was missing would be a second answer
   *  to "what does this activation remember" — reachable only by forgetting to
   *  pass one, which is exactly when it would be wrong. A caller that wants a
   *  panel to remember nothing durable says so in words
   *  ({@link ./memory.ts}'s `volatile`). */
  readonly memory: AcpAgent.Memory
  /** The internal MCP server to hand the session, or nothing yet. A THUNK,
   *  because its address is not known until the listener has bound and the
   *  session is opened after that. */
  readonly tools: () => ToolServer | null
  /** The OPTIONAL servers to look for, once per conversation — whatever else
   *  this host turns out to be running (`@kolu/acp-client`'s `probes.ts`). A THUNK, and
   *  carried through to `@kolu/acp-client`'s `agent.ts` untouched: what is on the list is the
   *  composition root.s business, and so is WHEN the list is settled — a serve
   *  whose integrations are fibers answers a different list per conversation, so
   *  this side holds no copy of one. Omitting it is a chat that asks this
   *  machine nothing. */
  readonly advertised?: (server: string, tool: string) => Advertised | null
  readonly probes?: () => Effect.Effect<ReadonlyArray<Probe>>
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
   * strip draws no row, and {@link Panel.scope} refuses. That is the state every
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
  /**
   * EVERY HOW MANY MESSAGES A NODE AGENT IS REMINDED OF ITS WRITING RULE
   * (`./settings.ts`'s `remind-every`, `./teaching.ts`'s `REMINDER`) — the
   * setting as decoded, handed in by the composition root that read it.
   *
   * `0` — or absent — never reminds, which is every test in this package
   * unless it says otherwise and a serve whose person turned it off.
   */
  readonly remindEvery?: number
  /**
   * WHERE THIS CHAT'S AGENTS COMPACT THEIR OWN CONVERSATION, in tokens of
   * context (`./settings.ts`'s `auto-compact` and `compact-at`, as
   * `compactingPolicy` decodes them) — handed in, like {@link remindEvery},
   * by the composition root that read the settings.
   *
   * Read at each bring-up: an engine whose registration can be told
   * (`Installed.compacting`) is opened with the leg and the extra `unset` it
   * answers for this number. `null` — or absent — tells no engine anything,
   * and an engine that cannot be told is opened as registered either way.
   */
  readonly compactAt?: number | null
  /** Publish the state cell. Called on every change; the surface dedups. */
  readonly onState: (state: ChatState) => void
  /** Publish transcript changes — ALL THREE of the things one carries: rows
   *  upserted by key, removes for a session that was replaced, and the text
   *  APPENDED to a row already there, which is what a chunk of a streaming
   *  answer is and moves no row at all (`@kolu/acp-harness`'s `transcript.ts`,
   *  and `says` for
   *  the question "does this change say anything"). Naming two of the three is
   *  what this comment used to do and what the guard below used to ask, and it
   *  cost every token of every answer. */
  readonly onTranscript: (change: Change<ChatEntry>) => void
}

/** One conversation and one ACP process. The scheduler adds the node-pool
 * reading; this lower seam has no pretend empty pool of its own. */
export interface Panel {
  /** The transcript as it stands — what a fresh subscription is seeded with. */
  readonly entries: () => ReadonlyMap<string, ChatEntry>
  readonly state: () => ChatState
  /**
   * THE ENGINE TABLE HAS MOVED — a plugin offering one was turned on or off
   * while this panel was running.
   *
   * ## Why this exists at all
   *
   * {@link PanelOptions.roster} is a live reading, and a live reading nobody
   * re-reads is a snapshot with extra steps: the picker is a PUBLISHED value,
   * so something has to say when to publish it again. This is that something,
   * and the caller that knows is the one holding the registration — the acquire
   * and the release both already run at exactly the right moment, so there is no
   * second place to keep in step.
   *
   * ## The two things it does, and the second is the ruling
   *
   * It republishes the roster, which is what puts a row into the picker or takes
   * it out.
   *
   * And IT ENDS A CONVERSATION WHOSE ENGINE HAS LEFT. That is the paper's
   * boundary rule applied where it lands: a registration is REVERTED where an
   * emission — a file another program reads, a message already sent — is
   * compensated or withheld, and a spawned ACP child is a process olai owns
   * exclusively and can stop, so it is inside the boundary. And it is the
   * invariant the whole loader surface rests on: a row somebody switched off and
   * a row with `on: no` in `_olai/Settings.olai` are ONE state. Under a policy with all rows off without claude
   * there is no claude conversation, so a moment after switching claude off
   * there must not be one either — a panel still talking to it would be the
   * switch saying one thing and the product doing another.
   *
   * IT IS AN EFFECT because stopping an agent is: the subprocess is asked to go
   * and waited for, exactly as a swap waits ({@link ./chat.ts}'s `using`).
   *
   * IDEMPOTENT, and asked far more often than it matters: every register and
   * every release of any engine calls it, including the ones for engines this
   * panel is not talking to and the ones that change nothing. What it does in
   * that case is compare two lists and return.
   */
  readonly enginesMoved: Effect.Effect<void>
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
   * ... and OLAI REPLACED ONE WITH ANOTHER — write down WHICH conversation took
   * this one's place, as the full `{agent, session}` pair, for the *fresh
   * session* affordance. Fresh start may hand the node to another engine, so
   * the pair is what the successor is named by: an id with no engine could
   * not say whose.
   *
   * It logs rather than refuses, the way every other write to this record
   * does, and what a lost write costs here is one old session coming back as
   * a conversation nobody claims — offered back to the node that had just
   * left it, which somebody can see and nothing acts on.
   */
  readonly replaced: (to: Conversing, by: Conversing) => Effect.Effect<void>
  /**
   * THE SET MOVED — ask {@link PanelOptions.agentAt} again, and publish if the
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
   *  attached to this conversation — by the paths {@link Panel.attach}
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
    /**
     * WHAT ANOTHER ROW WANTS THIS CONVERSATION TOLD, as `[olai] ` lines its
     * caller has already spelled (`./teaching.ts`'s `lines`).
     *
     * A plugin that opens a conversation to do a job — a plugin builder, and
     * whatever asks next — has a preamble: what the job is, where the thing
     * being built lives, which files are its. Those sentences belong UNDER the
     * first message beside the contract a node agent is taught, for the reason
     * the contract is there at all: they are olai's words about the
     * conversation rather than the person's, and a reader must be able to tell
     * which is which.
     *
     * SPENT ONLY WHERE THE CONTRACT IS, which is what makes "once" free. These
     * lines join {@link ./teaching.ts}'s on the message that TEACHES, under the
     * same `Overheard.taught` mark and the same notice — so a second send, a
     * reopened conversation or a caller that passes them again says nothing
     * twice. A conversation no node claims is taught nothing and hears no
     * preamble either; a row that wants one has opened a node agent's
     * conversation through core's `conversations` key.
     */
    preamble?: ReadonlyArray<string>,
  ) => Effect.Effect<void, OpFailure>
  /** One chunk of a picture into the conversation's own tmp directory,
   *  answering with where the whole file is and what it is called there. See
   *  {@link ./attachments.ts}. */
  readonly attach: (
    chunk: AttachChunk,
  ) => Effect.Effect<Attached, OpFailure>
  /** Deliver a message the agent would not take, again — `id` is the `user`
   *  row's own key. The prompt is the one that failed, kept beside that row
   *  (`@kolu/acp-harness`'s `transcript.ts`) with its pictures and node lines, so what lands
   *  is the same message rather than a browser's reconstruction of it. Refuses
   *  when that row is not waiting to be sent, which two tabs can genuinely
   *  race. */
  readonly resend: (id: string) => Effect.Effect<void, OpFailure>
  /**
   * SIGN IN — with a method the agent advertised (`@kolu/acp/wire`'s
   * `AuthMethod`), or with `null` for the chooser.
   *
   * The chooser is the panel's own: `/login` was pressed and the row that lists
   * the methods goes up, which is all this does. A named method is the AGENT's
   * work, and it is FORKED — a terminal method is a person pasting a code into a
   * process that may live for minutes, so nothing about this call waits for it.
   * What the row shows in between arrives as `signIn` events, and what happens
   * at the end is {@link signedIn}.
   */
  readonly signIn: (method: string | null) => Effect.Effect<void, OpFailure>
  /** One line to the process a terminal sign-in is running — the code it asked
   *  for. Refuses when nothing is waiting for one. */
  readonly signInInput: (text: string) => Effect.Effect<void, OpFailure>
  /** Stop it, or dismiss a finished attempt's row. The row goes either way,
   *  which is what a person pressing *cancel* asked for. */
  readonly signInCancel: Effect.Effect<void, OpFailure>
  readonly setSetting: (agent: string, session: string, config: string, value: string | boolean) => Effect.Effect<void, OpFailure>
  readonly setModel: (agent: string, session: string, value: string) => Effect.Effect<void, OpFailure>
  /**
   * WRITE DOWN THAT SOMEBODY HAS READ THE LINE THIS CONVERSATION'S AGENT LAST
   * SAID — `at` being the ISO instant that was on screen
   * ({@link ./sessions.ts}'s `Sessions.seen`).
   *
   * ON THE PANEL, beside the turn-boundary write that puts the line there, and
   * for the same reason: this is the other half of ONE record keyed on ONE
   * conversation, and the panel is the object that owns that conversation's half
   * of it. It is NOT the place that decides whether a caller may name this
   * conversation — that is the scheduler's matching, once ({@link Chat.seen}) —
   * so a panel that is handed a pair writes it.
   *
   * IT REFUSES NOTHING, deliberately, unlike every verb around it: nobody made a
   * gesture and there is nobody to tell, so a record that will not write is SAID
   * IN THE LOG and carried on ({@link ./sessions.ts} argues the discipline).
   * What never happens is a success reported over a write that did not occur.
   * Its declared failure is the one every conversation verb here carries, and
   * the refusal a stale tab meets is the door's, one level up.
   */
  readonly seen: (to: Conversing, at: string) => Effect.Effect<void, OpFailure>
  readonly cancel: Effect.Effect<void, OpFailure>
  /** Start a fresh conversation with the named agent
   *  ({@link ./agents/roster.ts}). The agent is an ARGUMENT because every new
   *  chat asks which one — there is no default to fall back on, and a verb that
   *  could be called without one would be a place for a default to grow. */
  /** The optional node binding completion stays with an auth-refused retry. */
  readonly newSession: (agent: string, completed?: Effect.Effect<void, OpFailure>) => Effect.Effect<void, OpFailure>
  /** Answer the question the panel is holding: THIS is the agent, now open the
   *  conversation you would have opened.
   *
   *  Not {@link Panel.newSession} with the same argument, and the difference is
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
   *  this panel to that agent, the way {@link Panel.newSession} does. */
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
  readonly liveSessions: (agent: string) => Effect.Effect<ReadonlyArray<Stored>, AcpAgent.AgentGone> | null
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
    /** This plugin's opaque picks, with authority for the exact stored choice. */
    readonly scopes: () => ReadonlyArray<WakeScope>
    /** Which scopes hear a claim at one node. A single panel has only manual
     * whole-file scopes; the scheduler above adds nearest-node precedence. */

    /**
     * ONE MACHINE-MARKED MESSAGE INTO ONE CONVERSATION.
     *
     * WRITE-ONLY AND IT CANNOT FAIL. There is no arm here a caller would answer
     * differently: a body that could not be handed over is HELD, and a body
     * held is not a failure — it is the second of three arms and the ordinary
     * one while a turn is running. The caller is a watcher sink with nowhere to
     * put a refusal, which is why {@link Panel.send}'s vocabulary is deliberately
     * not borrowed here.
     *
     * THREE ARMS, decided in one step: this panel's own conversation with an
     * idle agent takes it as a turn; a running turn HOLDS it until the turn
     * boundary; a conversation nobody is in holds it until somebody opens it.
     * Which arm it took is not reported back.
     */
    readonly deliver: (
      to: { readonly agent: string; readonly session: string; readonly current?: () => boolean },
      say: () => string | null,
      options?: {
        /** Bodies sharing a key, WHILE STILL HELD, replace each other in place —
         *  see `@kolu/acp-harness`'s `holding.ts`. A body with no key never replaces. */
        readonly coalesce?: string
        /** Whether this body is OLAI'S OWN TURN — see
         *  `@olai/plugin-api`'s `Deliveries.deliver`, which argues the option,
         *  and {@link ChatState.sleep} for what the panel does with it. */
        readonly sleep?: true
      },
    ) => Effect.Effect<void>
    /**
     * TAKE BACK THIS PLUGIN'S UNDELIVERED WORDS for one conversation.
     *
     * WHAT IT IS FOR: a caller that hands over a body and then stops being there
     * — a fiber whose scope is closing — has no way to know whether the body was
     * handed to the agent or is still waiting for a boundary that may come days
     * later. A doorbell does not care: its body is a fresh derivation of what is
     * standing, so a later delivery says everything the lost one would have. A
     * MACHINE TURN does care, which is why this verb exists: a sleep delivery
     * that fires next week would run as a turn with no hold on the quiet window,
     * nobody observing it, no memo and no commit
     * (`olai-plugin-chat`'s `server/sleep.ts`).
     *
     * THE SAME VERB A CLEARED DOORBELL USES (`@kolu/acp-harness`'s `holding.ts`'s `dropped`),
     * reached from the other end: there a person took the words away, here the
     * caller that wrote them is going. Nothing is lost by it, for the reason
     * above — and a body that was already HANDED is not in the holding at all,
     * so this cannot unsay anything the agent has seen.
     */
    readonly withdraw: (to: Addressed) => Effect.Effect<void>
  }
  /** THIS conversation wakes on THAT file, for that plugin's doorbell — or, with
   *  `file: null`, on nothing. The one write behind the strip's scope control.
   *  Refuses when this chat keeps no scopes at all, and when the record will not
   *  take the write: a pick that did not stick is a thing the person who just
   *  made the gesture needs told. */
  readonly scope: (
    to: { readonly agent: string; readonly session: string },
    plugin: string,
    pick: import("./json.ts").Json,
  ) => Effect.Effect<ReadonlyArray<Scoped>, OpFailure>
  /** Refresh this panel after the shared picks changed, dropping deliveries
   * for every replaced, cleared or evicted pick. */
  readonly refreshWakes: (left: ReadonlyArray<Scoped>) => void
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
  readonly stopWithReason: (reason: AcpAgent.StopReason) => Effect.Effect<void>
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
      && JSON.stringify(row.pick) === JSON.stringify(was.pick)
      && row.waiting === was.waiting

  })
/**
 * How long an agent may say NOTHING after a cancel before the panel says so.
 *
 * A window on silence rather than on the turn: an agent still streaming is
 * still working towards the stop it was asked for however long that takes
 * ({@link Panel.cancel} owns that argument), so this is only how long a
 * genuinely quiet one gets before somebody is told. Short enough that a person
 * who pressed a button is not left wondering, long enough that the gap between
 * two chunks of ordinary streaming is never mistaken for it.
 *
 * It is a floor on being TOLD and never a deadline on the agent: nothing here
 * kills anything or cancels anything twice.
 */
const CANCEL_GRACE = "5 seconds"

/** WHO this panel is talking to: the roster row a person picked, and the one
 *  conversation started from it. A named pair rather than an inline object
 *  because three things take one — the slot, the delivery decision, and the
 *  turn that a silence has to name the agent of. */
interface Bound {
  readonly row: Installed
  readonly harness: Harness<ChatEntry>
}

/**
 * WHAT A NODE AGENT'S MESSAGE CARRIES ABOUT TO GO OUT: the lines, whether they
 * are the contract, and the conversation they are for.
 *
 * ONE VALUE rather than facts a send holds side by side, and the pairing is
 * the whole of what it buys: the lines are built from one read of the binding
 * table and the session record, and the mark written down afterwards has to be
 * about the conversation that read named — not about whichever one the panel
 * is in a beat later. Two separate reads is exactly how a session swapped
 * mid-send would leave a conversation marked taught that never heard a word.
 *
 * THE LINES MAY BE EMPTY, and that is most messages: a node agent's message
 * that carries neither the contract nor the reminder is still COUNTED, because
 * the count is what says which later message the reminder rides
 * ({@link ./sessions.ts}'s `Overheard.taken`).
 */
interface Teaching {
  readonly to: Addressed
  /** The contract, the reminder, or nothing — verbatim what rides under the
   *  message and what the notice shows. */
  readonly lines: ReadonlyArray<string>
  /** These lines ARE the contract, so this message marks the session `taught`
   *  — the record's own name for the fact, handed straight to `took`. */
  readonly taught: boolean
}

/**
 * What a turn that produced nothing is told to a person.
 *
 * A function rather than a template at the one place it is used, because what
 * it is is the whole of what this end KNOWS: the agent was asked, it answered
 * that the turn was over, and nothing came back — which is what an agent that
 * cannot reach a model looks like from the other side of a pipe, and there is
 * no frame anywhere that says so out loud — on the wires that fail quietly;
 * an agent that answers an unreachable provider with a JSON-RPC error takes
 * the refusal arm instead and never reaches this. The sentence a person meets
 * is asserted where they would meet it
 * (`packages/plugins/chat/e2e/features/choosing_an_agent.feature`, against a
 * scripted agent that ends a turn having said nothing).
 *
 * It names WHO was silent because a panel with two agents installed is a panel
 * where "the agent" is a question, and it says where to look rather than what
 * to type: the credentials are the agent's own business (`opencode auth
 * login`, a key in its config, a token in the environment), and this process
 * cannot tell which of them is missing. The ENVIRONMENT is named explicitly
 * because it is the trap this bug was reported from — olai's own environment is
 * what a spawned agent inherits, and a systemd user unit's is not a login
 * shell's ({@link ../../../website/docs/running.md}).
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
 * ONE SPELLING for the writer that keeps that rule ({@link Panel.replaced}).
 * Why it does not refuse: it runs AFTER the half of its gesture that mattered
 * has already landed, so a refusal here would be telling somebody their turn
 * failed when it did not. What a lost write costs is the sentence that rides
 * with it ({@link replaceLost}), which is the half worth saying out loud.
 *
 * `undefined` is a chat composed with no record at all, which is the state
 * every test in this package is in unless it says otherwise.
 *
 * NOT the two writes that have to know the OUTCOME — the teaching's own
 * ({@link contracted}) and the last-said one ({@link saidHere}): a frame and
 * a notice are published off the back of those, so their failures are not
 * just worth a sentence, they decide what may be shown.
 */
const noting = (
  write: Effect.Effect<void, AcpAgent.MemoryFailure> | undefined,
  why: (failure: AcpAgent.MemoryFailure) => string,
): Effect.Effect<void> =>
  write === undefined ? Effect.void : Effect.gen(function*() {
    const done = yield* Effect.result(write)
    if (done._tag === "Failure") yield* Effect.logWarning(why(done.failure))
  })

/** ... and what each of them costs when it is lost, said where the write is
 *  rather than at the call site: the sentence is about this record, and the
 *  gesture that made the write is a package away. */
const tookLost = (teach: Teaching, failure: AcpAgent.MemoryFailure): string =>
  teach.taught
    ? `a node agent was taught its contract and it could not be written down ` +
      `(${failure.why}) — the next message in this session will say it again`
    : `a node agent's message could not be counted (${failure.why}) — ` +
      `its writing rule is reminded one message later than it would have been`

const replaceLost = (failure: AcpAgent.MemoryFailure): string =>
  `a node agent was given a fresh session and what it replaced could not be written down ` +
  `(${failure.why}) — the new session is bound, and the old one comes back as a chat ` +
  `no node claims`

/** WHAT A ROW OLAI MINTED ITSELF IS CALLED — the prefix its ids wear, so a row
 *  this panel wrote can be told from one the conversation did without asking
 *  either of them. Two readers: the minting, and the wipe that takes them with
 *  the conversation they were about. */
const OURS = "olai:"

/** ... and what a lost note of WHICH conversation this directory is in costs:
 *  nothing anybody is waiting on, and the next boot adopting whichever one the
 *  agent has most recently instead of the one somebody was in. */
const remembranceLost = (failure: AcpAgent.MemoryFailure): string =>
  `which conversation this directory was in could not be written down (${failure.why}) — ` +
  `a restart opens whichever one this agent has most recently`

/**
 * WHAT ONE BRING-UP OPENS THIS ROW WITH — its registered leg and adapter, or,
 * when this chat says where to compact ({@link PanelOptions.compactAt}) and
 * the engine can be told ({@link Installed.compacting}), the leg the engine
 * answers for that number and the adapter with the variables it names taken
 * away AS WELL AS its own: the engine's `unset` is extended, never replaced,
 * so what it strips for every spawn is still stripped.
 *
 * Either half missing is the row as registered, so an engine that cannot be
 * told is opened exactly as it was before the setting existed.
 */
const openingOf = (
  row: Installed,
  compactAt: number | null,
): Pick<Installed, "leg" | "adapter"> => {
  if (compactAt === null || row.compacting === undefined) return row
  const compacting = row.compacting(compactAt)
  return {
    leg: compacting.leg,
    adapter: { ...row.adapter, unset: [...(row.adapter.unset ?? []), ...compacting.unset] },
  }
}

export const makePanel = (options: PanelOptions): Effect.Effect<Panel, never, never> =>
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
     * and `@kolu/acp-client`'s `agent.ts` reads the conversation and the model out of it,
     * because those are facts about a session only the thing holding one can
     * act on. One writer per field, and the write is the agent's.
     */
    const memory = options.memory
    const tell = yield* Effect.annotateLogs(emitter, { surface: "chat" })

    /** THE ONE MCP SERVER OLAI HANDS WHATEVER IT STARTS — its own tool face,
     *  with the bearer line composed here because it is olai's: the thing at
     *  the other end carries the headers it was given rather than deciding how
     *  somebody else's route lets a caller in. Whatever else this host turns
     *  out to be running arrives through the probes beside it.
     *
     *  ONE COMPOSITION FOR BOTH ENDS. A conversation is handed this list and
     *  so is the probe below, and the two differ in nothing — a second
     *  spelling of the same entry is a second place for the header, the name
     *  or the scheme to be wrong, in a value that decides whether an agent can
     *  reach olai's own tools at all.
     */
    const ownServers = (): ReadonlyArray<HttpServer> => {
      const own = options.tools()
      return own === null ? [] : [{
        kind: "http" as const,
        name: own.name,
        url: own.url,
        headers: { Authorization: `Bearer ${own.token}` },
      }]
    }

    /**
     * A CLIENT THIS PANEL IS NOT TALKING THROUGH — the one thing olai still
     * starts an `@kolu/acp-client` agent for by itself, and it is a QUESTION
     * rather than a conversation: what has this engine got stored here.
     *
     * Everything a person says goes through `@kolu/acp-harness` instead
     * ({@link using}), which spawns its own child. So this takes no event
     * handler — a replay from an agent nobody is talking to has no business in
     * the transcript on screen, and the only verb asked of it brings the
     * process up without opening a session — and its `purpose` is the one it
     * can have, which is what tells the two kinds of child apart in a log.
     */
    const logContext = yield* Effect.service(References.CurrentLogAnnotations)
    const probeFor = (row: Installed) =>
      AcpAgent.make({
        id: row.id,
        leg: row.leg,
        command: row.adapter.command,
        args: row.adapter.args,
        env: row.adapter.env,
        // ... AND WHAT IT MUST NOT SEE, which is the same row's data read from
        // the other direction: `env` can only add, and an adapter that guesses
        // something off the environment it is started in says here which
        // variables to take away (`@kolu/acp/engine`'s `Adapter.unset`).
        unset: row.adapter.unset,
        cwd: options.cwd,
        // OLAI'S OWN SERVER FIRST, as the one entry the client is handed, and
        // the probed ones after it (`@kolu/acp-client`'s `mcpServersOf`) —
        // which is the order a person reads the roster in ({@link ownServers}).
        tools: ownServers,
        probes: options.probes,
        advertised: options.advertised,
        memory,
        models: options.models,
        onEvent: () => {},
      }).pipe(Effect.annotateLogs({ ...logContext, purpose: "session list" }))

    /**
     * THE CONVERSATION AS THIS PANEL HOLDS IT — the rows `@kolu/acp-harness`
     * publishes as deltas, folded into one map, and the rows olai mints itself
     * ({@link ours}).
     *
     * A COPY, deliberately, and the one a fresh subscription is seeded with:
     * the harness publishes what MOVED, because a streaming answer is one row
     * and six hundred pieces and publishing the whole of it per piece puts the
     * sum of its prefixes on the wire. Somebody has to hold the sum, and it is
     * the end that answers {@link Panel.entries} — which is also the end that
     * counts the questions, reads the strip off the rows and takes the agent's
     * last line off them.
     *
     * It is not persisted and never was: the agent's own session is the
     * persistence, and a second copy on a disk would be a second thing to be
     * wrong.
     */
    const rows = new Map<string, ChatEntry>()
    /** The conversation's own tmp directory, for pictures pasted into it.
     *  Emptied when a conversation is left and when the chat stops. */
    const files = Attachments.make()

    /** ... and as the panel's own `talking`, which carries what the agent said
     *  it can do beside who it is — what the composer offers and promises out
     *  of.
     *
     *  READ OFF THE CONVERSATION ITSELF ({@link conversation}) rather than
     *  copied beside it: these three are the harness's own account of what
     *  this agent advertised at its handshake, and a copy would be a second
     *  place for them to be wrong — one that has to be emptied by hand at
     *  every swap, and that answers for the agent before last wherever
     *  somebody forgets.
     *
     *  NOTHING, before a conversation has said anything, and that is the
     *  honest state of an agent that has not spoken yet: a panel that has not
     *  been told cannot offer an interruption on somebody's behalf, or promise
     *  a person their words will be got to. Both directions of being wrong
     *  here are cheap and only one of them is: a control that appears a moment
     *  late costs a click; a control that was there before the agent said it
     *  took one is a person pressing *interrupt* at an agent that will refuse
     *  it.
     *
     *  `steers` ARRIVES WITH BOTH HALVES ALREADY IN IT — the agent advertised
     *  steering, AND this conversation has not spent its latch on a message
     *  held behind a running turn. The latch is the conversation's own, because
     *  the defect it works around is the pinned adapter's: a session that has
     *  once queued a prompt never settles a steered turn again, and `+ new` or
     *  a stored conversation opened is how the control comes back. A panel
     *  deriving that bit from two fields would be a second copy of a rule the
     *  conversation already keeps. */
    const bound = (row: Installed): Talking => ({
      kind: "agent",
      id: row.id,
      name: row.name,
      queues: conversation?.queues ?? false,
      steers: conversation?.steers ?? false,
      // ... AND WHAT IT CAN BE SIGNED IN WITH, which is the third thing this
      // member answers for and the only one a person PRESSES rather than reads:
      // an agent that offered no way in shows no `/login` at all, exactly as an
      // agent that offered no commands shows no command list.
      methods: conversation?.methods ?? [],
    })

    // The cell's own default, with the two fields that differ: an agent is
    // being started, and the roster is this machine's. Restating the others
    // here would be a second place to remember when the state gains one.
    let state: ChatState = {
      ...CHAT_OFF,
      uploadScope: files.scope(),
      status: "idle",
      talking: { kind: "asking" },
      roster: options.roster().map(choiceOf),
    }
    /** The agent this panel is talking to and the row it came from, or `null`
     *  while it is talking to none — before the first choice, and in the beat
     *  between one agent being stopped and its replacement handshaking. */
    let talking: Bound | null = null
    /** The server is going away. Read by {@link using}, which must not start an
     *  agent after the one thing that stops them has run: a subprocess spawned
     *  then is one nothing will ever kill. */
    let closing = false
    /** The conversation's own account of itself, as the harness last published
     *  it — `null` until one has been opened, which is what every projection
     *  below reads through. */
    let conversation: HarnessState | null = null
    /**
     * WHAT A DOORBELL SAID THAT IS NOT AT THE AGENT YET, per conversation —
     * memory only, capped on both axes, and never on a disk.
     *
     * `@kolu/acp-harness`'s `holding`, which is where this module went when the
     * two products turned out to hold the same thing: a body is held while a
     * turn is running or while nobody is in the conversation it is for, bodies
     * sharing a key replace each other IN PLACE so arrival order survives the
     * replacing, and the pairing of that key is with the SENDER so two plugins'
     * `digest`es cannot swallow each other. It is not the queue that was
     * deleted (#194): that argument is about words a person typed and has no
     * second copy of, and a doorbell's body is a derivation of state that is
     * still true, so whatever derived it rings again.
     *
     * THE VALUE IS A THUNK AND A FLAG. The words are asked for at the moment
     * they are written ({@link offer}), because a body that waited through a
     * turn is about a world that has had a turn to move; the flag says the turn
     * it becomes is OLAI'S OWN (`@olai/plugin-api`'s `Deliveries.deliver`), and
     * it rides the value because the body can wait.
     */
    const held = holding<Addressed, { readonly say: () => string | null; readonly sleep: boolean }>({
      keyOf: (to) => JSON.stringify([to.agent, to.session]),
      slots: SLOTS,
      conversations: CONVERSATIONS,
    })
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
    /**
     * EVERYTHING THE CONVERSATION HAS PUBLISHED SINCE THIS PANEL CAME UP,
     * counted — every change of either kind, drawn or not.
     *
     * What a reader needs is never a total but a CHANGE — has anything arrived
     * since I looked — and a monotonic counter answers that with no clock to
     * read and nothing to reset. {@link cancel} asks it of an agent it has told
     * to stop: a conversation still reporting anything at all is one still
     * working towards the stop it was asked for, and one that has gone silent
     * with a cancel outstanding is the case nobody could see before.
     */
    let heard = 0

    /** A change that says nothing is not published — asked of the change
     *  itself (`@kolu/acp-harness`'s `says`) rather than by naming its fields
     *  here. This line used to name two of the three, which meant every chunk
     *  of every streaming answer was dropped and the paragraph appeared,
     *  whole, when the turn ended. */
    const publish = (change: Change<ChatEntry>) => {
      if (!says(change)) return
      if (!replaying) {
        options.onTranscript(change)
        return
      }
      // A CONVERSATION BEING LEFT GOES AT ONCE, and what is held is only what
      // replaces it: the rows a reader is looking at have stopped being true
      // the moment the one they belong to is gone, and a panel that held the
      // emptying until the replay had arrived would be drawing somebody else's
      // conversation for the length of an open.
      if (change.removes.length > 0) {
        options.onTranscript({ upserts: [], removes: change.removes, appends: [] })
      }
    }

    /**
     * ONE CHANGE INTO THIS PANEL'S OWN COPY, and then out to whoever is
     * watching.
     *
     * THE APPENDS LAND HERE TOO, which is the half a caller forgets: the
     * conversation publishes a chunk as the text and the offset it belongs at,
     * and the row it grows is published whole only when something else moves
     * it. A copy that applied only the upserts would hand a late-joining tab a
     * paragraph that stopped at the last whole row.
     */
    const fold = (change: Change<ChatEntry>): void => {
      // A WIPE TAKES THIS PANEL'S OWN ROWS WITH IT. The conversation clears
      // the rows IT minted — a new session, or the one a load empties before
      // its replay — and it has never heard of the ones olai wrote
      // ({@link ours}). Those are words ABOUT the conversation being left, so
      // they go in the same breath: a notice explaining a chat nobody is in
      // any more is the inheritance a `clear` exists to prevent. Asked as
      // "does this change remove every row the conversation holds", which is
      // what a wipe is and what a single row disappearing is not.
      const theirs = [...rows.keys()].filter((id) => !id.startsWith(OURS))
      const wipe = change.removes.length > 0
        && theirs.length > 0
        && theirs.every((id) => change.removes.includes(id))
      const removes = wipe
        ? [...change.removes, ...[...rows.keys()].filter((id) => id.startsWith(OURS))]
        : change.removes
      for (const row of change.upserts) rows.set(row.id, row)
      for (const id of removes) rows.delete(id)
      for (const piece of change.appends) {
        const row = rows.get(piece.of)
        if (row === undefined) continue
        rows.set(piece.of, {
          ...row,
          text: `${row.text.slice(0, piece.at)}${piece.text}`,
        })
      }
      publish(wipe ? { ...change, removes } : change)
    }

    /** How many rows olai itself has minted, for the ids it mints them under
     *  ({@link ours}). */
    let minted = 0

    /**
     * OLAI'S OWN ROW IN THE CONVERSATION — a sentence about this panel, or the
     * detail of a write its ops layer refused.
     *
     * MINTED HERE rather than through the harness, and the reason is the row
     * that matters most: the thing worth saying loudest is usually that there
     * is NO conversation — a boot that could not read this directory's note, an
     * engine that would not start — and there is no harness then to say it
     * with. The id is this panel's own (`olai:N`) so it cannot collide with one
     * the conversation minted, and the `seq` follows the last row there is, so
     * it sorts where it happened.
     *
     * A REFUSAL is the same act for the same reason read from the other end:
     * the agent is handed the structured detail in its tool result, and what it
     * then says about it is prose — so the refusal lands as data, which is what
     * makes "a refused write shows its detail in chat" true however the agent
     * phrases it.
     */
    const ours = (
      content:
        | { readonly kind: "notice"; readonly text: string }
        | { readonly kind: "refusal"; readonly text: string; readonly refusal: OpFailure },
    ): void => {
      minted += 1
      let last = -1
      for (const row of rows.values()) last = Math.max(last, row.seq)
      fold({
        upserts: [{ ...content, id: `${OURS}${minted}`, seq: last + 1, since: new Date().toISOString() }],
        removes: [],
        appends: [],
      })
    }

    /**
     * WHETHER A CONVERSATION IS STILL BEING OPENED — and what it replays is
     * published ONCE, when it has arrived, rather than as it arrives.
     *
     * A `session/load` re-sends the whole conversation before it answers, and
     * olai KEEPS those frames (`whenReplayed: "keep"`): this panel is the only
     * copy of the conversation there is, so they are the record rather than a
     * poorer second one. Published as they came, every tab drew that history a
     * few rows a frame — a long conversation typed itself out again and the
     * pane followed it down the screen for seconds. Nobody is reading a
     * conversation that has not finished opening, so the rows are folded into
     * this panel's copy as they arrive and handed over whole when the open
     * settles, which is one frame for every reader — the shape a tab that joins
     * afterwards already gets from its snapshot.
     *
     * The CLEAR that starts one is not held: the conversation being left goes
     * at once, and what is held is only what replaces it. So the change that
     * ends the hold is every row there is and no removes — nothing was
     * published while the copy was empty.
     *
     * HELD ACROSS THE WHOLE OPEN and dropped on every way out of one — the
     * conversation answered, refused, or the child dying under it — which is
     * what {@link opened} is for: a hold that outlived its open would be a
     * panel that has stopped publishing.
     */
    let replaying = false
    const landed = (): void => {
      replaying = false
      publish({ upserts: [...rows.values()], removes: [], appends: [] })
    }

    /**
     * ... AND AN OPEN THAT DID NOT HAPPEN LEAVES NO CONVERSATION BEHIND, but
     * keeps every word SAID about it.
     *
     * A `session/load` re-emits the whole transcript BEFORE it answers, so an
     * open refused after the replay — a permission mode the agent would not
     * take, a signature it wanted first — leaves this end holding the rows of a
     * conversation it is not in. Nothing was published while the open was held,
     * so they go by being dropped.
     *
     * A NOTICE IS NOT ONE OF THEM, whoever minted it. What was SAID about the
     * attempt — this panel's own sentence about a note it could not read, or
     * the conversation's about an open the agent refused — is the only account
     * of it a person can read, and it is about the attempt rather than about
     * the conversation that did not open. So the history goes and the
     * sentences stay.
     *
     * ASKED BY KIND and not by the prefix olai's own rows wear ({@link ours}),
     * which is the one thing worth writing down here: BOTH ends mint notices,
     * and the refusal that explains this very failure is usually the
     * CONVERSATION'S — a prefix test would take it away with the replay it is
     * about, which `agent.mode.test.ts` is the proof of.
     */
    const unopenedRows = (before: ReadonlySet<string>): void => {
      for (const [id, row] of [...rows]) {
        if (!before.has(id) && row.kind !== "notice") rows.delete(id)
      }
      replaying = false
    }

    /**
     * ... AND THE TWO OF THEM AS ONE BRACKET AROUND AN OPEN, which is what
     * both places that open a conversation actually want.
     *
     * The rule is that publishing is held from the moment an open starts until
     * it has landed or been given up on, and that what the panel held BEFORE
     * the attempt is what an open that did not happen leaves behind. Written
     * out at each caller it was the same four lines twice, with the before-set
     * remembered by hand; here the remembering and the releasing cannot come
     * apart.
     */
    const replayed = <E>(open: Effect.Effect<void, E>) =>
      Effect.gen(function*() {
        replaying = true
        const before = new Set(rows.keys())
        const outcome = yield* Effect.result(open)
        if (outcome._tag === "Failure") unopenedRows(before)
        else landed()
        return outcome
      })

    const move = (next: Partial<ChatState>) => {
      state = { ...state, ...next, uploadScope: files.scope() }
      options.onState(state)
    }

    /** WHAT THIS CONVERSATION STILL HAS OUT — the background tasks it armed
     *  and the agents it sent, read off the rows rather than tallied beside
     *  them. A list kept alongside would be that same fact in a second place,
     *  staying right only for as long as every future writer remembered both.
     *  The projection itself is over values and lives beside its own tests
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
      const out = watching(rows)
      if (!sameWatching(out, state.watching)) move({ watching: out })
    }

    /**
     * WHICH CONVERSATION THIS PANEL IS IN, as the pair a delivery is addressed
     * to — `null` when it is in none.
     *
     * Two fields out of two places, because a conversation is
     * `(agent, session)` and this file holds those halves apart: WHO is being
     * talked to is {@link talking}, and WHICH of that agent's conversations is
     * open is the conversation's own ({@link conversation}'s `sessionId`). A
     * doorbell is addressed to the pair, so this is where the two are put back
     * together — once, rather than at each of the four places that ask.
     *
     * OFF THE CONVERSATION RATHER THAN OFF THE PUBLISHED CELL, which is the
     * one thing worth saying about these three lines: `state.session` is this
     * same fact after a `move`, so a reader that took it would answer with the
     * conversation before last for the length of an open — and what is
     * addressed in that window is a doorbell's held words.
     */
    const conversationOf = (): Addressed | null => {
      const at = talking
      const open = conversation?.sessionId ?? null
      return at === null || open === null ? null : { agent: at.row.id, session: open }
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
      to: Addressed | null = conversationOf(),
    ): string | null => (to === null ? null : options.agentAt?.(to)?.id ?? null)

    /**
     * WHAT THIS MESSAGE HAS TO TEACH — the standing instruction a node agent's
     * session is given ONCE, the one-line reminder every Nth message after it,
     * or no lines at all ({@link ./teaching.ts}, which argues the channel) —
     * or no answer at all, for a message that is not a node agent's.
     *
     * TWO WAYS TO ANSWER NOTHING, and each is the ordinary case for somebody:
     * no record — a serve composed without one, which is also what keeps a
     * chat that CANNOT write the mark from teaching the same session on every
     * message; and a conversation no node claims, which is nearly every
     * conversation and also a pointer left on a record that has been trashed
     * or has lost its property. Neither is counted, and neither is reminded.
     *
     * EVERY NODE AGENT'S MESSAGE IS ANSWERED, with empty lines for most of
     * them, because every one of them is COUNTED: the count is what says which
     * later message carries the reminder, and a message that is not counted
     * would push every reminder after it one message late.
     *
     * THE ANSWER CARRIES THE CONVERSATION IT IS FOR, which is what makes it one
     * value rather than two facts a send has to keep in step: the lines and
     * "whose contract these are" are decided in the same breath, off one read,
     * and the mark that goes to disk afterwards is written against THAT
     * conversation rather than against whichever one the panel has come to be
     * in ({@link contracted}).
     *
     * WHETHER THIS IS THE REMINDER'S MESSAGE comes off the same row the
     * `taught` mark does, in one read: the count on that row says which
     * message this is. Two reads of that row would be two answers to one
     * question, and the second could be taken after a write that moved it.
     */
    const teaching = (preamble: ReadonlyArray<string> = []): Teaching | null => {
      const to = conversationOf()
      const overheard = options.overheard
      if (to === null || overheard === undefined || overheard === null) return null
      const node = options.agentAt?.(to) ?? null
      if (node === null) return null
      const row = overheard.at(to)
      const teaches = row?.taught !== true
      // THIS MESSAGE'S NUMBER in the session, the teaching's own being the
      // first — so the reminder rides the Nth, the 2Nth, … and never the
      // message that already carries the whole contract.
      const every = options.remindEvery ?? 0
      const reminds = !teaches && every > 0 && ((row?.taken ?? 0) + 1) % every === 0
      // ...AND THE CALLER'S OWN LINES RIDE WITH THE CONTRACT, under it: the
      // standing law first, because it is what the conversation IS, and the
      // job it was opened for after. They go where the contract goes, so the
      // mark that stops the contract being said twice stops these too
      // ({@link Panel.send}'s `preamble` argues the whole arrangement), and a
      // message that merely REMINDS carries none of them — the reminder is one
      // line of law, not a second briefing.
      const lines = teaches
        ? [...teachingFor(node), ...preamble]
        : reminds ? remindingFor(node) : []
      // ...AND WHICH CHANNEL THIS ENGINE'S STANDING PROMPT RIDES, which is the
      // engine's own answer and not an assumption of this file's
      // (`@kolu/acp/engine`'s `PromptChannel`). The switch is EXHAUSTIVE on
      // purpose: every engine olai ships rides the first turn, because ACP has
      // no system prompt on any wire — and the day one grows a real slot, the
      // arm added there is a `tsc` error HERE rather than a branch on an
      // engine's id somewhere in core. The reminder rides with the contract:
      // it is the same law, and an engine whose contract went into a slot
      // would want its reminder decided in the same arm.
      //
      // NO AGENT BOUND IS NOT AN ARM OF THAT, and it used to be spelled as one:
      // `talking?.row.prompt.kind ?? "first-turn"` put core's own guess where an
      // engine's answer goes, and it was the hole in the promise above — the day
      // a second channel exists the compiler would flag the switch and say
      // nothing about the `??`, which would go on quietly meaning first-turn for
      // an engine nobody had asked. There is nothing to teach with no agent
      // bound anyway, so the answer is that there is no teaching.
      if (talking === null) return null
      switch (talking.row.prompt.kind) {
        case "first-turn":
          return { to, lines, taught: teaches }
      }
    }

    /**
     * ... and SAYING that it went, and remembering it — the two halves of "the
     * contract is out", together, because they are one event and used to be
     * able to disagree. The same act COUNTS every node agent's message, and
     * says the reminder where one went: one write per message, which carries
     * the `taught` mark too on the message that taught.
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
     * THE MARK FIRST, and the notice only where it landed: a notice is the
     * report OF the mark, so the fact has to exist before it is read out —
     * the other way round, a failed write was a LOG under a contract the pane
     * had already been shown, which is the one shape a restart says twice
     * over. It runs as the delivery's FIRST ACT ({@link begin}), inside the
     * fork that starts the turn: the write is awaited ahead of the prompt's
     * answer shape, so an answer row cannot outrun the notice of THIS message
     * on the arm that has an answer coming after it — where the prompt it
     * starts the turn for has not yet been sent. A send into a turn that was
     * ALREADY in the air — the steer arm, or a queued spot behind one —
     * runs the very same act into a conversation whose answer stream is mid-
     * flow: a chunk of the running turn can cross the window, and the notice
     * is the row under it, not before everything. What EVERY arm has by
     * construction is the half that was the bug: the mark before its notice,
     * and the send let go of only after the WRITE ({@link begin}'s hail),
     * so the next send's `teaching()` reads `taught` in the mirror.
     *
     * And the WRITE ITSELF is gated on the row twice, once per fact it asks
     * of it ({@link contracted}'s body, which says why): answered rows are
     * out on the way IN, and on the way OUT the conversation may no longer
     * be the one the mark now speaks for.
     *
     * Its failure is still a LOG rather than a refusal
     * ({@link ./sessions.ts}), and what the failure costs changed with the
     * order: the contract or the reminder rides a LATER message instead — a
     * telling delayed, never one duplicated — which is still not worth taking
     * a send away from somebody over.
     */
    const contracted = (teach: Teaching, key: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        const overheard = options.overheard
        if (overheard === undefined || overheard === null) return
        // FIRST READ, gating the MARK on the send being unmarked for now: a
        // send that already had its answer taught nobody anything, whatever
        // `teaching()` believed when the prompt was built.
        const row = rows.get(key)
        if (row === undefined || row.kind !== "user" || row.delivery !== undefined) return
        const done = yield* Effect.result(overheard.took(teach.to, teach.taught))
        if (done._tag === "Failure") {
          yield* Effect.logWarning(tookLost(teach, done.failure))
          return
        }
        // A COUNTED MESSAGE THAT CARRIED NOTHING has no notice to say.
        if (teach.lines.length === 0) return
        // SECOND READ, the line before the notice it is gating, so the
        // check-and-append are the one thing this fork can make of them: no
        // await between, and no permit held — the fork has none. The write
        // in between is the window, and what covers it by construction is
        // `begin`'s ticket: `turns.open` precedes this fork, so `changeSession`
        // refuses on `turns.busy` for the life of the write — the
        // person-side's door against exactly this. What no ticket stops is
        // the agent-side's own half: `sessionOver`'s clear checks nothing —
        // it mostly cannot happen mid-turn, because a switch offers it only
        // where the ticket is away, but its event answers the AGENT, not the
        // permit. A row gone here means the conversation was REPLACED — the
        // mark is then kept for the conversation that was, which is the
        // contract that was said; the notice belongs to the pane it was said
        // TO, which is the one that went. The one place in this function that
        // knows both things is the line that asks both questions again.
        const after = rows.get(key)
        if (after === undefined || after.kind !== "user" || after.delivery !== undefined) return
        ours({ kind: "notice", text: teach.lines.join("\n") })
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
        const said = lastSaid(rows)
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
     * held bodies (`@kolu/acp-harness`'s `holding.ts`) say how many of each plugin's
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
      to: Addressed | null = conversationOf(),
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
          pick: row.pick,
          waiting: counted.get(row.plugin) ?? 0,

        }))
    }

    /**
     * THE PLAN, WHICH IS THE ONE THING THE CONVERSATION SAYS AS A ROW AND THIS
     * PANEL DRAWS AS A CELL.
     *
     * `@kolu/acp-harness` keeps the agent's plan at one key for the life of a
     * session — each update replaces the whole thing and an empty one removes
     * it — because kolu draws it in the column. Olai draws it under the agent
     * line instead ({@link ChatState.plan}), and has never declared a `plan`
     * row, so the row is taken out of the change here and turned into the cell
     * it belongs on. It is the one kind this panel reads rather than shows, and
     * the cast below is what says so: the conversation is generic over OLAI'S
     * row union, and this is the row it writes that the union does not name.
     *
     * The key is remembered rather than spelled, so the removal that empties a
     * plan is recognised without this end knowing what the conversation files
     * one under.
     */
    let planAt: string | null = null

    /**
     * WHOSE TURN IS OLAI'S OWN — the row id of the pass a doorbell started with
     * `sleep`, or `null`.
     *
     * Kept here because the mark lives exactly as long as that turn does
     * ({@link ChatState.sleep}), and the thing that says a turn ended is now a
     * change rather than a fiber this file is holding: a question asked inside
     * a pass must not go on being suppressed once the pass is over.
     */
    let sleepTurn: string | null = null

    /**
     * THE PANEL'S ONE WORD, read off the conversation's phase.
     *
     * Three of olai's five statuses are this end's own and are not derived
     * here: `off` is a serve with no engine at all, `booting` is an open this
     * file has in flight ({@link changeSession}), and `gone` is an agent that
     * is not there. What is left is the pair a reader watches move — and
     * `asking` is not a status of olai's, because a question is true AT THE
     * SAME TIME as the turn that is blocked on it ({@link ChatState.asking}
     * counts those separately).
     *
     * A CONVERSATION THE AGENT REFUSED IS NOT A DEAD AGENT, which is the one
     * place this reading parts company with the conversation's own: the
     * harness calls a refused open `offline` because it has no session to be
     * in, and the subprocess it kept is precisely the one a sign-in has to run
     * against (`@kolu/acp-harness`'s `refusedOpen`). Drawn as `gone`, the
     * panel would take itself down between the refusal and the signature —
     * taking the sign-in row, the retry and the fold with it, on every state
     * frame the attempt publishes. The agent ANSWERED, so it is there, and the
     * refusal has a face of its own ({@link ChatState.unopened}).
     */
    const facing = (now: HarnessState): ChatState["status"] =>
      now.phase === "offline"
        ? now.refusal !== null && talking?.harness.alive() === true
          ? "idle"
          : "gone"
        : now.phase === "starting"
        ? "booting"
        : now.phase === "idle"
        ? "idle"
        : "thinking"

    /** WHAT THE PICKER CHOOSES FROM, which is the model control's own row read
     *  as a list — the same `configOptions` entry the client built the row out
     *  of, so a second advertisement of the same choices would be one more
     *  place for them to disagree. */
    const choices = (now: HarnessState): ChatState["models"] =>
      now.options.find((one) => one.kind === "model")?.choices
        .map((one) => ({ value: one.value, name: one.label })) ?? []

    /**
     * THE SIGN-IN THIS PANEL DRAWS, out of the one the conversation publishes.
     *
     * THREE ARMS WHERE THE CONVERSATION HAS ONE ROW, and the fold is the
     * panel's own: what olai draws is the ATTEMPT — a command it is running,
     * or a page the agent opened — and the chooser is what there is when no
     * attempt is in flight, whoever put the row up. The methods are not read
     * off here at all: they are on `talking`, where they say whether `/login`
     * is offered at all ({@link bound}).
     *
     * A method's LABEL is looked up in that same advertisement, because the
     * attempt names the method by its id and a person reads a name.
     *
     * AND A CHOOSER SOMEBODY CLOSED STAYS CLOSED, which is this panel's own
     * answer and not the conversation's: the conversation keeps the agent's
     * offer standing after a cancel, on the reading that the refusal behind it
     * still stands (`@kolu/acp-harness`'s `signInCancel`) — and it does, which
     * is why the REFUSAL is still on screen. But *get this off my screen* is
     * half of what a person means by pressing cancel, so the row is this
     * panel's to take down ({@link signInCancel}) and this is what keeps the
     * next state frame from putting it straight back. Only the chooser: an
     * ATTEMPT is something new happening, and a refused open or a person
     * asking again brings the offer back at the door each of them goes
     * through.
     */
    let dismissed = false

    const signingIn = (now: HarnessState): ChatState["signIn"] => {
      const attempt = now.signIn?.attempt ?? null
      if (now.signIn === null) return null
      if (attempt === null) return dismissed ? null : { kind: "choosing" }
      const label = now.methods.find((one) => one.id === attempt.method)?.name ?? attempt.method
      // A LINK IS THE AGENT'S OWN FLOW — it opened a page and is waiting on it
      // — and anything else is a command this end ran, whose output IS the
      // story of what happened.
      return attempt.link !== null
        ? {
          kind: "agent",
          method: attempt.method,
          label,
          link: attempt.link,
          why: attempt.state === "failed" ? attempt.output : null,
        }
        : {
          kind: "terminal",
          method: attempt.method,
          label,
          output: attempt.output,
          running: attempt.state === "running",
          code: attempt.code,
          why: null,
        }
    }

    /** WHICH CONVERSATION THE CELL IS ALREADY REPORTING, so that entering one
     *  can be told from reporting on the one that is open. */
    let reported: string | null = null

    /**
     * EVERYTHING THE CONVERSATION KNOWS ABOUT ITSELF, ONTO THE CELL — one
     * projection, run on every state change rather than a field per event.
     *
     * The harness publishes its state WHOLE, because it is small and a patch of
     * it would be a second thing to get right; this is the other half of that
     * bargain. What is NOT here is everything the panel knows that the
     * conversation does not: which engines this machine has, which agent was
     * picked, what a boot could not read, what a doorbell is holding.
     *
     * THE PAIR IS READ OFF THE CONVERSATION and handed to both readers that
     * need it ({@link conversationOf}), rather than taken from `state.session`
     * a line later: the pair is what a doorbell is addressed to and what a
     * node binding is keyed by, and this very move is the thing that changes
     * it. Reading it back out of the cell would be answering with the
     * conversation before last.
     */
    const projecting = (): void => {
      const now = conversation
      const at = talking
      if (now === null || at === null) return
      const to = conversationOf()
      // A CONVERSATION ENTERED, as against one being reported on again — the
      // one thing this projection cannot read off the state it is handed,
      // because every other field of it is true for as long as the
      // conversation is. What it decides is the two faces an open takes DOWN:
      // a refusal that has stopped being true, and the banner of whatever went
      // wrong before it. Asked on the id, so the verbs that open one and the
      // boot that adopts one all answer it the same way.
      const entered = to !== null && to.session !== reported
      reported = to === null ? null : to.session
      // ... and a conversation entered is a chooser nobody has closed: the row
      // a person dismissed was about the conversation that would not open.
      if (entered) dismissed = false
      move({
        ...(entered ? { unopened: null, trouble: null } : {}),
        // `off` is the one face this does not touch: a serve whose last engine
        // was switched off has no conversation to report, and the sentence it
        // is showing is about the roster rather than about an agent.
        ...(state.status === "off" ? {} : { status: facing(now) }),
        talking: bound(at.row),
        session: to === null ? null : { id: to.session, title: now.title, updatedAt: null },
        // ... AND WHICH NODE AGENT THIS CONVERSATION BELONGS TO, in the same
        // breath, for the doorbells' reason below: the binding is per
        // conversation, so the node that was true a moment ago was about a
        // different one — and a header naming the last conversation's node over
        // this one's is the one wrong thing this member can say.
        bound: boundTo(to),
        // ... and the doorbell rows go with the conversation they are about.
        // The PICKS are untouched — they are on disk, keyed by the conversation
        // — but a strip drawing the last one's file over the next one would be
        // the inheritance the human ruled out.
        wake: wakeOf(to),
        model: now.model === null ? null : now.model.name,
        models: choices(now),
        settings: now.options,
        commands: now.commands,
        servers: now.servers,
        usage: now.usage,
        identity: now.identity,
        asking: now.openAsks.length,
        signIn: signingIn(now),
        // ... AND A TURN THAT IS RUNNING IS WHERE A STOPPED ONE STOPS BEING
        // NEWS. `cancelled` is the verdict on the turn that just ENDED and is
        // read a turn at a time by the pass that writes a node agent's memo
        // (`server/sleep.ts`), so a verdict left standing makes every later
        // pass over that node a cancelled one — the loop warns, retries, and
        // warns again, for ever, over a node nobody stopped twice. A turn in
        // flight is the next turn's `begin` as the conversation reports it
        // ({@link ChatState.cancelled}), which is the moment the last one's
        // ending stopped being the thing this panel is saying.
        ...(now.busySince === null ? {} : { cancelled: false }),
      })
    }

    /**
     * WHAT THE CONVERSATION SAYS, as the panel's rows and the panel's state —
     * the one place `@kolu/acp-harness`'s vocabulary is consumed.
     *
     * THREE KINDS AND NOTHING ELSE. Rows travel as deltas, because a streaming
     * answer is one row and six hundred pieces; state travels whole; and a TURN
     * ENDING is its own report, because what a product does about one is not
     * readable off either of the other two — `cancelled` is a turn somebody
     * STOPPED rather than one that finished, and a turn that produced nothing
     * is a delivery that failed even though the agent answered.
     */
    const onChange = (change: HarnessChange<ChatEntry>): void => {
      // How much has arrived, ever. What every reader needs is not a total but
      // a CHANGE — has anything come since I looked — and a monotonic counter
      // answers that with no clock to read and nothing to reset
      // ({@link cancel} is the reader).
      heard++
      if (change.kind === "state") {
        conversation = change.state
        projecting()
        return
      }
      if (change.kind === "turn") {
        ended(change)
        return
      }
      // THE PLAN COMES OUT FIRST, before anything is folded: it is a cell here
      // and a row there ({@link planAt}).
      const upserts: Array<ChatEntry> = []
      let plan: ReadonlyArray<PlanStep> | null = null
      for (const row of change.upserts as ReadonlyArray<ChatEntry | (RowHead & { kind: "plan"; steps: ReadonlyArray<PlanStep> })>) {
        if (row.kind === "plan") {
          planAt = row.id
          plan = row.steps
          continue
        }
        upserts.push(row)
      }
      const removes = change.removes.filter((id) => id !== planAt)
      if (planAt !== null && removes.length !== change.removes.length) {
        planAt = null
        plan = []
      }
      fold({ upserts, removes, appends: change.appends })
      if (plan !== null) move({ plan })
      // THE PROJECTION OVER THE ROWS, recounted only where a row moved: a
      // chunk of a streaming answer moves none of them, and this is a walk of
      // the whole map. How many questions are OPEN is not read here at all —
      // the conversation counts those itself and publishes them with every
      // state frame ({@link projecting}), and a second walk for the same cell
      // would be the same fact in two places.
      if (upserts.length === 0 && removes.length === 0) return
      watched()
    }
    /** The roster row with that id, or `null` — the one place a name off the
     *  wire is turned into something startable. A browser that asks for an
     *  agent this machine does not have is a STALE TAB rather than a fault, so
     *  it is refused in words rather than crashed on. Only the `here` rows
     *  resolve: a `not-here` row's id is one this machine cannot start, and
     *  the greyed picker never sends it. */
    const rowFor = (id: string): Installed | null =>
      here(options.roster()).find((row) => row.id === id) ?? null

    /** ONE LINE FROM THE CONVERSATION, with what it was said ABOUT as its
     *  annotations.
     *
     *  The pair is the shape every logger in that half takes — a record, then
     *  a sentence — and the record is not decoration: a `chat agent exited`
     *  line carries which session it was and WHY the child went, which is how
     *  a reaped scope is told from a crash in a log. Flattening it into the
     *  sentence, or dropping it, is how both facts stop being searchable. */
    const logging = (
      at: (message: string) => Effect.Effect<void>,
      about: unknown,
      said?: string,
    ): Effect.Effect<void> =>
      said === undefined
        ? at(String(about))
        : Effect.annotateLogs(
          at(said),
          typeof about === "object" && about !== null ? about as Record<string, unknown> : {},
        )

    /** ... and the three levels of them, into olai's own logger with this
     *  panel's annotations on them — the one place `@kolu/acp-harness` says
     *  anything that is not a row or a state. */
    const harnessLog = {
      info: (about: unknown, said?: string) => tell(logging(Effect.logInfo, about, said)),
      warn: (about: unknown, said?: string) => tell(logging(Effect.logWarning, about, said)),
      error: (about: unknown, said?: string) => tell(logging(Effect.logError, about, said)),
    }

    /** WORK THIS PANEL STARTS BESIDE A CHANGE IT WAS HANDED — the turn-boundary
     *  write and the doorbell flush, which are Effects reached from a callback
     *  that is not one. Through {@link aside}, so the panel's own stop can
     *  still interrupt them, and through the emitter, which is what carries
     *  this panel's log annotations into whatever they say. */
    const alongside = (work: Effect.Effect<void>): void => tell(aside(work))

    /**
     * WHAT A TOOL CALL IS, AS OLAI READS IT — the product's half of the row,
     * and the only thing about a call that is not the protocol's.
     *
     * THREE THINGS, and each is a different kind of answer:
     *
     *   - the agent's own PANES for a `terminal/*` call, which arrive as a
     *     frame carrying nothing else. They are the call's own output as it
     *     runs, so they are the row's and nobody else's.
     *   - WHAT OLAI ADVERTISES THE CALL AS. A frame is one row however many
     *     calls it made, so the row is composed rather than picked: a Code Mode
     *     `execute` that ran three of olai's tools is three advertised titles
     *     on one line, and a row that showed the first of them would be
     *     claiming the other two did not happen. The OWNER is taken only where
     *     they agree — two plugins' tools in one script is one row that is not
     *     either of theirs, so it draws neither one's face rather than half of
     *     one — and the REPLY is single-call only, because that is the wire
     *     rather than a choice: a script returns ONE value, and which of three
     *     calls it belongs to is not said anywhere.
     *   - the ENGINE'S OWN SPELLING of the call, which is `untilNamed`'s whole
     *     reason: it is taken while the row has no name and never again, so the
     *     friendly title that arrives with the ownership a frame later cannot
     *     be overwritten by the raw label repeating itself.
     *   - WHAT IS WORTH FOLDING UNDER IT, which for a call of olai's own is
     *     what was ASKED and never the answer again: the reply is drawn by the
     *     owning plugin's own face, and a fold repeating it underneath says the
     *     same thing twice. The conversation's default fold is the call's input
     *     AND its output together (`@kolu/acp-client`'s `detailOf`, which can
     *     only leave the output out for a call it was TOLD olai owns — and the
     *     harness builds its agent without that advertisement, since olai's
     *     ownership is read here instead). So the fold is written here, on
     *     every frame of the call, because the harness's own `detail` is
     *     applied before this reading and would otherwise bring the answer back
     *     with the frame that settles the call.
     *
     * A call nothing recognised answers nothing at all, which is what lets a
     * background task's own report stay a report rather than minting a card for
     * a call nobody made.
     */
    const readCall: HarnessOptions<ChatEntry>["readCall"] = (frame, held) => {
      if (frame.terminals !== undefined) return { extra: { terminals: frame.terminals } }
      const owned = frame.mcp.map((one) => options.advertised?.(one.server, one.tool) ?? null)
      const ours = owned.length > 0 && owned.every((one) => one !== null)
        ? {
          title: [...new Set(owned.map((one) => one!.title))].join(" · "),
          owner: new Set(owned.map((one) => one!.owner)).size === 1 ? owned[0]!.owner : undefined,
        }
        : null
      const reply = ours === null || frame.mcp.length !== 1 ? undefined : frame.answer as Json
      const named = frame.called === undefined ? {} : { untilNamed: { called: frame.called } }
      // HOW THIS CALL'S QUESTION REACHES A PERSON — the one thing olai reads
      // off a frame for a call that is NOT one of its own: the agent's built-in
      // "ask the human" tool belongs to no plugin here, and the row it would
      // draw sits directly above the form it opened
      // ({@link ./wire/members.ts}'s `ToolEntry.asksThroughForm`). So it is
      // written on both arms below rather than only on the owned one.
      const asking = frame.asksThroughForm === true ? { asksThroughForm: true as const } : undefined
      if (ours === null) {
        return asking === undefined && frame.called === undefined
          ? undefined
          : { ...(asking === undefined ? {} : { extra: asking }), ...named }
      }
      // THE INPUT ALONE, as the agent wrote it — or what this call was last
      // read as, for the frame that carries only the answer: the arming frame
      // is where the arguments are, so a reading taken off the frame in front
      // of us alone would empty the fold at the moment the call settles.
      const asked = frame.input === undefined || frame.input === null
        ? held?.detail
        : JSON.stringify(frame.input, null, 2)
      return {
        extra: {
          // THE NAME OLAI GIVES IT, which arrives with the ownership and
          // replaces the engine's raw label exactly once: every later frame of
          // this call composes the same title out of the same advertisement.
          text: ours.title,
          ...(ours.owner === undefined ? {} : { row: ours.owner }),
          ...(reply === undefined ? {} : { reply }),
          ...(asked === undefined ? {} : { detail: asked }),
          ...asking,
        },
        ...named,
      }
    }

    /** ... and WRITING DOWN which conversation this directory is in, with the
     *  model under it. The CALLER'S now: the conversation is told which one to
     *  open and remembers nothing itself, so the note a boot reads back is
     *  written here, at the one moment the answer changes. */
    const remembering = (): Effect.Effect<void, AcpAgent.MemoryFailure> | undefined => {
      const at = talking
      const now = conversation
      if (at === null || now === null || now.sessionId === null) return undefined
      return memory.remember({
        agent: at.row.id,
        session: now.sessionId,
        model: now.model?.id ?? null,
      })
    }

    /**
     * A TURN ENDED, and what this panel makes of it.
     *
     * The rows are already written and the state is already published — the
     * conversation reports a turn after both — so what is left here is the
     * three facts a PRODUCT keeps about a turn, none of which is readable off
     * a row:
     *
     *   - **it was CANCELLED**, which is a turn somebody STOPPED rather than
     *     one that finished. `idle` with no trouble is exactly what a turn that
     *     ENDED looks like, so a pass watching this conversation would record a
     *     stopped rewrite as a finished sleep ({@link ChatState.cancelled}).
     *   - **it SAID NOTHING**, which is not a turn that went well: the agent
     *     answered that the turn was over and nothing came back, which is what
     *     an agent that cannot reach a model looks like from here. The banner
     *     STAYS UP, unlike every other ending, because there is nothing else on
     *     screen to say this happened.
     *   - **it did not land**, where the agent refused it or nothing ever
     *     answered. The row says so itself; what the banner adds is the reason,
     *     where no caller was waiting to be told one.
     *
     * AND IT IS THE TURN BOUNDARY, which is where two of this panel's own
     * writes belong: the line a node agent's door draws comes off the rows once
     * the paragraph is closed, and a doorbell's held words go in at the first
     * moment an idle agent can take them. Both are forked, so nothing about a
     * turn ending waits on a permit a send may be holding.
     */
    const ended = (turn: TurnEnded): void => {
      const at = talking
      // HOW THE TURN ENDED, as the facts a reader of this panel keeps.
      let outcome: Partial<ChatState> = {}
      if (turn.outcome === "cancelled") {
        outcome = { cancelled: true, trouble: null }
      } else if (turn.outcome === "ended" && turn.silent && at !== null) {
        const why = silence(at.row.name)
        ours({ kind: "notice", text: why })
        outcome = { trouble: why }
      } else if (turn.outcome === "ended") {
        // A turn that came back is the proof that whatever went wrong before
        // has stopped being true.
        outcome = { trouble: null }
      } else if (turn.why !== null) {
        outcome = { trouble: turn.why }
      }
      // THE PASS'S MARK GOES WITH THE TURN IT DESCRIBES, and in the SAME state
      // as how that turn ended. A question asked inside a sleep must not go on
      // being suppressed after the turn that asked it is over — and a reader
      // that sees the mark come off is reading the verdict in that one frame
      // (`server/sleep.ts`), so a mark dropped a frame before its outcome reads
      // a turn that died as one that finished.
      if (sleepTurn === turn.row) {
        sleepTurn = null
        outcome = { ...outcome, sleep: false }
      }
      move(outcome)
      alongside(saidHere())
      alongside(flushing)
    }
    /**
     * THE CONVERSATION THIS PANEL WAS IN IS OVER, and everything that was true
     * of it goes with it.
     *
     * One place rather than a list repeated at each caller: the rows are what
     * an agent said and what the OTHER agent said is not this conversation's
     * history; the servers were handed to the session they were handed TO; the
     * usage was usage OF it; and the node and the doorbell rows are keyed by
     * the pair, so drawing the last one's over the next one would be the
     * inheritance the human ruled out.
     *
     * Only a SWAP needs it. A conversation replaced inside one process is
     * cleared by the conversation itself (olai's `whenNewSession: "clear"`, and
     * a load clears before the replay that refills the panel), and a DEAD agent
     * leaves its rows exactly where they are — nobody asked for them to go, and
     * the notice under them explains them.
     */
    const left = (): void => {
      publish({ upserts: [], removes: [...rows.keys()], appends: [] })
      rows.clear()
      planAt = null
      move({
        session: null,
        settings: [],
        plan: [],
        bound: null,
        commands: [],
        asking: 0,
        watching: [],
        servers: [],
        usage: null,
        wake: wakeOf(null),
        // ... AND THE SIGN-IN ROW GOES WITH THE PROCESS THAT OFFERED IT. The
        // attempt it draws is the outgoing agent's, and the conversation kills
        // a login with its own scope (`@kolu/acp-harness`'s `stop`) — so a row
        // left up offers buttons on behalf of a subprocess that no longer
        // exists. The conversation says so itself in one last frame, which
        // this panel cannot read: `talking` is already `null` by the time it
        // arrives ({@link projecting} answers about a panel that is talking to
        // somebody), so the one place that knows the agent is leaving says it.
        signIn: null,
        // ... AND SO DOES THE ACCOUNT IT NAMED, for the same reason read one
        // field over: the chip is what the agent said about ITSELF, and the
        // agent has been stopped. A panel still naming an account describes a
        // subprocess that is not there.
        identity: null,
      })
    }

    /**
     * ... AND THE AGENT GOES WITH IT — the whole of what unbinding one is, in
     * the one place both callers reach.
     *
     * Three things stop being true together and must stop together: the cached
     * listings are about a conversation nobody can reach any more, this panel
     * is talking to nobody, and the subprocess is ASKED to go rather than
     * dropped. Written out at each site it was five statements in one order
     * held by a comment that said "the same sequence, for the same reasons" —
     * which is the rule living in prose rather than in code.
     *
     * The REASON is the only thing that differs, and it is not decoration: a
     * switched agent and a plugin switched off are two different things to
     * find in a log beside one child's exit.
     *
     * NOT what {@link stopWithReason} does, deliberately: a panel that is
     * going away keeps its rows and forgets no listing, because there is
     * nobody left to draw either.
     */
    const unbind = (at: Bound, why: AcpAgent.StopReason): Effect.Effect<void> =>
      Effect.gen(function*() {
        listings.forget(at.row.id)
        talking = null
        conversation = null
        left()
        yield* Effect.promise(() => at.harness.stop(why))
      })

    /**
     * WHERE THIS AGENT READS ITS SIGNATURE, in the one sentence that names it
     * (`@kolu/acp-harness`, which puts it in front of a person who was told
     * nobody is signed in).
     *
     * OLAI KNOWS NO CREDENTIAL STORE and deliberately names none: each engine's
     * is its own business — `opencode auth login`, a key in a config file, a
     * token in the environment — and this process cannot tell which of them an
     * agent read. What it CAN say truthfully is the thing that is true of every
     * one of them and is the trap this comes from: a spawned agent inherits
     * olai's own environment, and a systemd user unit's is not a login shell's
     * ({@link ../../../website/docs/running.md}).
     */
    const SIGNED_IN_FROM = "the environment olai itself runs in"

    /**
     * The conversation for this row, OPENED — and the agent that was talking
     * before it stopped, where it was somebody else.
     *
     * One agent at a time, which is the shape of the ruling: a conversation is
     * bound to one, and the panel holds one conversation. A second live
     * subprocess would be a second language-model session held open for a
     * conversation nobody is looking at.
     *
     * SPAWN AND OPEN ARE ONE CALL now, because they are one sequence whose
     * order is a protocol fact: `startHarness` spawns, hands shakes, opens or
     * resumes, applies the leg's permission mode and the remembered model, and
     * stops the child itself if any of it fails — so a refusal cannot leave an
     * adapter running for every retry. Which conversation to open is the one
     * argument ({@link Opening}): a boot ADOPTS (the remembered one, else the
     * most recent, else fresh), a picker names one, and `+ new` asks for a
     * fresh one.
     *
     * UNDER ITS OWN PERMIT ({@link binding}), which every caller reaches
     * through this function rather than having to remember: the verbs that open
     * a conversation hold {@link switching} as well, and a BOOT holds neither,
     * so the guard that matters has to be here. Two callers interleaving would
     * leave the panel talking to one agent and drawing another's name, and,
     * worse, would spawn two children with only one of them ever stopped.
     */
    const using = (
      row: Installed,
      opens: Opening,
    ): Effect.Effect<void, HarnessRefused | HarnessUnavailable> =>
      binding.withPermit(Effect.gen(function*() {
        // A SHUTDOWN has already taken the agent this would replace, and a
        // subprocess started after it is one nothing will ever stop.
        if (closing) {
          return yield* Effect.fail(new HarnessUnavailable("the server is shutting down"))
        }
        // WHICH CONVERSATION THIS IS FOR, before it is asked for and whichever
        // way this open is served: a refusal is answered by the same line under
        // every open ({@link refusedOpen}), and the one thing that line cannot
        // work out for itself is what was being opened.
        attempting = opens.kind === "resume" ? opens.id : null
        const already = talking
        // THE SAME AGENT KEEPS ITS PROCESS, and what moves is which
        // conversation it is in: a new session and a stored one opened are both
        // verbs of the conversation's own, and a panel that respawned an
        // adapter for either would pay a handshake — and a second
        // language-model session — for a thing the one it has already does. The
        // rows, the model, the usage and the servers go with the session the
        // conversation leaves, because the conversation says so.
        if (already !== null && already.row.id === row.id && already.harness.alive()) {
          listings.forget(already.row.id)
          opened()
          switch (opens.kind) {
            case "fresh":
              yield* Effect.tryPromise({
                try: () => already.harness.newSession(),
                catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
              })
              break
            case "resume":
              yield* Effect.tryPromise({
                try: () => already.harness.loadSession(opens.id),
                catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
              })
              break
            case "adopt":
              // THE CONVERSATION IT IS IN IS THE ONE A BOOT WOULD HAVE ADOPTED.
              // Nothing to open: this is the answer to "which agent", and this
              // agent is already answering.
              break
          }
          conversation = already.harness.state()
          projecting()
          yield* noting(remembering(), remembranceLost)
          return
        }
        if (already !== null) {
          // WHAT IT HAS STORED HAS MOVED, and it stops being the agent we ask
          // afresh every time: this panel has just spent a conversation in it
          // (a fresh one minted, a stored one retitled), so anything kept about
          // it from before is a list that does not name the conversation
          // somebody was just in — the exact complaint the fan-out answers.
          yield* unbind(already, "agent switched")
        }
        // ... and the three that do NOT go with a session, because they are
        // about the AGENT: the model is a different agent's answer, a refused
        // open was about a process that is gone, and a banner about it with it.
        //
        // WHAT THE LAST AGENT SAID ABOUT ITSELF IS NOT NEWS ABOUT THIS ONE
        // either, and nothing here has to remember that: `talking`'s three
        // advertised fields are read off the conversation ({@link bound}),
        // which has just been emptied with the agent that was in it.
        opened()
        move({
          // WHO, and — because it is one member — no longer a question that
          // could still be being asked while it names somebody.
          talking: bound(row),
          model: null,
          trouble: null,
          // ... AND A SIGN-IN ROW ABOUT SOMEBODY ELSE GOES WITH IT. The attempt
          // it drew was the outgoing agent's, and that agent has just been
          // stopped — so a row left up would offer buttons on behalf of a
          // process that no longer exists, on the strength of an advertisement
          // from another one.
          signIn: null,
        })
        /**
         * THE BRING-UP CAN BE GIVEN UP ON, which is a thing only the
         * conversation can do and so a thing it is told
         * (`@kolu/acp-harness`'s `HarnessOptions.abandonWhen`).
         *
         * Spawning the adapter, shaking hands and opening are one promise, and
         * a promise does not notice an interrupt: this panel opens a
         * conversation INSIDE the reading that asked for it (`./scoped.ts`),
         * and a reader that goes away a beat later — a tab re-subscribing, a
         * page that was taken down — interrupts the fiber waiting here while
         * the open carries on. What that costs is not a wasted handshake: an
         * open LAUNCHES every MCP server the session was composed with and
         * spends the agent's own record of the conversation, for nobody.
         *
         * So the fiber's own signal goes over with it. The conversation stops
         * its process the moment the signal aborts and opens nothing, under
         * the same word the scope that went away is released with — a reader
         * leaving is its scope being released, and the log line a person finds
         * should say so.
         */
        const spawn = openingOf(row, options.compactAt ?? null)
        const made = yield* Effect.tryPromise({
          try: (signal) =>
            startHarness<ChatEntry>({
              // THE LEG AND THE SPAWN THIS BRING-UP USES, which are the row's
              // own unless this chat tells the engine where to compact
              // ({@link openingOf}).
              leg: spawn.leg,
              adapter: spawn.adapter,
              cwd: options.cwd,
              configDir: SIGNED_IN_FROM,
              // OLAI'S OWN SERVER, as the one entry handed over, and whatever
              // else this host turns out to be running after it (`probes`).
              // The bearer line is composed HERE because it is olai's: the
              // conversation carries the headers it was given rather than
              // deciding how somebody else's route lets a caller in.
              mcpServers: ownServers(),
              probes: options.probes,
              // NOTHING FOR THE CONVERSATION TO TEACH. Olai's standing words
              // are a node agent's contract, decided per message against a
              // binding that moves ({@link teaching}), and they ride under the
              // person's own words in the body this file composes. So the slot
              // is empty and the session is told it has already been taught —
              // the honest way of saying this end owes it nothing.
              teaching: "",
              taught: true,
              log: harnessLog,
              opens,
              // WHO THIS CONVERSATION IS WITH, as this machine's roster names
              // it: the client files its notes and annotates its log lines
              // under this id, and the records they land in are keyed by the
              // engine a person installed
              // (`@kolu/acp-harness`'s `HarnessOptions.agent`).
              agent: row.id,
              // ... AND WHERE THE MODEL A PERSON CHOSE LIVES. Handed over in
              // place of `model`, which is the pin as ONE value read once: the
              // record answers for every conversation this harness opens and
              // takes every move back, so a switch survives a restart without
              // this end reading a pin or putting one back. The client is the
              // only end that can tell a SWITCH from the agent re-asserting
              // its own pin at the door, and this is the durable place it
              // never had to put one.
              ...(options.models === undefined ? {} : { models: options.models }),
              readCall,
              // The row's NAME comes off the advertisement in `readCall`'s own
              // `extra`, which is why no `retitle` rule is passed: olai's
              // friendly title is composed afresh from the same advertisement
              // on every frame of the call rather than taken once.
              // OLAI'S FOUR, and the whole of what this panel is: a new session
              // CLEARS, because this panel is the only copy of the conversation
              // there is; its rows are numbered from zero and start again after
              // a wipe, because a browser reads a row's `seq` as how many are
              // behind it; a conversation the agent cannot come back to is
              // REPORTED rather than quietly replaced by a different one; and a
              // replay is KEPT, because nothing else here holds those rows.
              whenNewSession: "clear",
              numbering: "restarts",
              whenLoadRefused: "report",
              whenReplayed: "keep",
              // ... AND WHEN THIS END STOPS WANTING IT ({@link abandonWhen}).
              abandonWhen: { signal, reason: "scope released" },
              onChange,
            }),
          catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
        })
        talking = { row, harness: made }
        conversation = made.state()
        projecting()
        // THE AGENT SAID NO, AND IS STILL RUNNING — the one refusal a bring-up
        // keeps its child for, and the one it does not THROW: an open refused
        // for want of a signature leaves the subprocess up, because that
        // subprocess is the one the sign-in has to run against, and the
        // conversation publishes what it was told rather than raising it
        // (`@kolu/acp-harness`'s `refusedOpen`, and `HarnessState.refusal`).
        //
        // SO THE PANEL ASKS, after what the conversation does know about itself
        // is on the cell. A harness handed back with a refusal on it is not a
        // conversation: nothing opened, `sessionId` is null, and a caller that
        // read the return alone would call the open landed — write the node's
        // binding, flush a doorbell's held words into a conversation that does
        // not exist, and leave a person looking at a composer with no account
        // of why nothing happens. Failing here is what puts the refusal, the
        // retry and the sign-in row on screen, by the same line under every
        // other refused open ({@link refusedOpen}).
        if (conversation.refusal !== null) {
          return yield* Effect.fail(
            new HarnessRefused(conversation.refusal, "signed-out", false),
          )
        }
        yield* noting(remembering(), remembranceLost)
      }))

    /**
     * THE ENGINE TABLE MOVED — see {@link Panel.enginesMoved}, which carries the
     * argument for both halves of this.
     *
     * UNDER THE SAME PERMIT AS A SWAP, and for the identical reason: this is the
     * third place a bound agent can be stopped, and two of them interleaving
     * would leave the panel drawing one agent's name while another's subprocess
     * is the one that got stopped. Everything here reads or writes `talking`,
     * which is exactly what `binding` exists to serialize.
     */
    const enginesMoved: Effect.Effect<void> = binding.withPermit(Effect.gen(function*() {
      // `roster` rather than `rows`: this file's `rows` is the conversation,
      // and one word for two tables is how a reader ends up asking the wrong
      // one what happened.
      const roster = options.roster()
      const startable = here(roster)
      const at = talking
      // WHOSE ENGINE HAS LEFT — asked of the LIVE list rather than of anything
      // remembered, because the list is the only thing that moved. Only the
      // `here` rows count: an engine that went from installed to not is a
      // conversation this machine can no longer start, which is the same
      // leaving as a plugin switched off.
      const orphaned = at !== null && !startable.some((row) => row.id === at.row.id)
      if (at !== null && orphaned) {
        // THE SWAP'S OWN SEQUENCE, reached through the one verb that IS it
        // ({@link unbind}) — the only thing that differs is the word this
        // child's exit is logged under.
        yield* unbind(at, "plugin disabled")
      }
      // ...AND THE FACE, which is one decision over two facts: whether anything
      // is left to talk to at all, and whether the conversation this panel was
      // in survived.
      //
      // NO ENGINE AT ALL WINS over the conversation having ended, because it is
      // the bigger and more actionable sentence: a person whose last engine row
      // is off wants to be told there is no agent here, not that this particular
      // conversation stopped. It is the same face and the same `no-engine` word
      // a serve composed without an engine row shows, which is the invariant
      // this whole lane rests on — switched off and never named are one state.
      const because = offBecause(roster)
      if (because !== null) {
        move({
          roster: roster.map(choiceOf),
          status: "off",
          off: because,
          talking: null,
          model: null,
          trouble: null,
        })
        return
      }
      move({
        roster: roster.map(choiceOf),
        // COMING BACK is `idle` and not the status it left: `off` is the only
        // state the panel can be in that a returning row invalidates, and what
        // is true afterwards is a panel with a picker and no conversation, which
        // is what `idle` with nobody bound draws.
        ...(state.status === "off"
          ? { status: "idle" as const, off: null, talking: { kind: "asking" as const } }
          : {}),
        ...(orphaned
          ? {
            status: "gone" as const,
            talking: null,
            model: null,
            // THE PLUGIN'S DEPARTURE IN WORDS, because `gone` alone is a face
            // with no account of itself and the three ways of getting there
            // read very differently to somebody who was mid-conversation.
            trouble: at === null
              ? null
              : `${at.row.name} was switched off at the plugins panel, so this `
                + `conversation ended. Turning it back on lets you start another.`,
          }
          : {}),
      })
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
     * true: one installed agent is not a choice; a note this activation holds
     * names the agent a conversation was last entered with, and entering that
     * conversation without asking is what the note is for; anything else is a
     * question nobody here may answer on somebody's behalf. The note is not
     * durable, so a restart does not reach this line at all — the scheduler
     * reopens the conversations that were live before it ({@link ./scoped.ts}'s
     * `Chat.start`).
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
      // ONE READ, held: the table is live now, so asking it twice in one
      // decision is two answers to one question — and this one branches on the
      // length and then takes the element, which is exactly the shape that goes
      // wrong when a row leaves between the two.
      //
      // THE FOLD IS `here`, because "one installed agent is not a choice" is a
      // question about what can be STARTED: a lone `not-here` row beside it is
      // a picker that greys an option rather than a second choice, and a table
      // of nothing but `not-here` rows is the `off` face, not a shortcut.
      const rows = here(options.roster())
      const only = rows.length === 1 ? rows[0] ?? null : null
      if (only !== null) return only
      const held = yield* Effect.catchTag(
        memory.recall,
        "MemoryFailure",
        (failure) =>
          Effect.sync(() => {
            ours({
              kind: "notice",
              text: `the agent this directory was last talking to could not be read (${failure.why}) — ` +
                `asking which one to use instead`,
            })
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
      move({ status: conversation?.phase === "working" || conversation?.phase === "asking" ? "thinking" : "idle" })
    }

    /** A verb that OPENS a conversation with a named agent — the three steps
     *  the two of them share, and the part that is easy to get subtly wrong:
     *  the stale-tab refusal, the agent switch, and the permit that makes the
     *  switch and the open one step. What each verb says for itself is the
     *  one line that differs. */
    const openWith = (
      id: string,
      opens: Opening,
      completed?: Effect.Effect<void, OpFailure>,
    ): Effect.Effect<void, OpFailure> =>
      withRow(id, (row) => changeSession(using(row, opens), completed))

    /** WHAT THE AGENT THIS PANEL IS TALKING TO HAS STORED HERE, asked of the
     *  conversation rather than of a second process: the one it is already
     *  holding is the one whose list this is, and starting a probe copy of the
     *  very agent somebody is talking to would be a second language-model
     *  session opened to answer a question about the first. Its refusal wears
     *  the listing module's own vocabulary, which is the client's. */
    const storedIn = (harness: Harness<ChatEntry>): Effect.Effect<ReadonlyArray<Stored>, AcpAgent.AgentGone> =>
      Effect.tryPromise({
        try: () => harness.sessions(),
        catch: (cause) =>
          new AcpAgent.AgentGone({
            gone: "unreachable",
            why: cause instanceof Error ? cause.message : String(cause),
          }),
      })

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
     * up the process without opening a session (`@kolu/acp-client`'s `agent.ts`'s
     * `onProcess`), so nothing is entered and the directory's note is not
     * rewritten by a question about it.
     */
    const listings = yield* Listings.make({
      // THE `here` FOLD: a listing fans out to agents this machine can start,
      // and a `not-here` row has nothing stored to ask. The fold happens HERE
      // rather than in `./listings.ts` because the table and its meaning are
      // this file's to narrow — the listing module is handed startable rows.
      roster: () => here(options.roster()),
      running: (row) => {
        const at = talking
        return at !== null && at.row.id === row.id
          ? storedIn(at.harness)
          : options.runningSessions?.(row.id) ?? null
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
            return { stored: yield* storedIn(at.harness), keep: false }
          }
          const borrowed = options.runningSessions?.(row.id)
          if (borrowed != null) return { stored: yield* borrowed, keep: false }
          const probe = yield* probeFor(row)
          // STOPPED whichever way the question went, INTERRUPTION included. A
          // probe left running is the same stray process one line up, arrived
          // at from the other direction.
          const stored = yield* Effect.ensuring(probe.sessions, probe.stopWithReason("session list complete"))
          return { stored, keep: true }
        })),
      now: () => Date.now(),
    })

    /** A verb that needs somebody to talk to. Refused in words when there is
     *  nobody — the panel is drawing the picker, and what the caller asked for
     *  is a thing to do IN a conversation. */
    const onConversation = <A>(
      use: (harness: Harness<ChatEntry>) => Promise<A>,
    ): Effect.Effect<A, OpFailure> =>
      Effect.suspend(() => {
        const at = talking
        return at === null
          ? Effect.fail(
            new UsageFailure({
              reason: "no agent has been chosen for this chat yet — pick one to start",
            }),
          )
          : Effect.tryPromise({
            try: () => use(at.harness),
            catch: (cause) => asFailure(cause),
          })
      })

    /** A conversation's refusal, as something a caller can render — ONE
     *  translation, used by every verb. `busy` is the honest kind for an agent
     *  that is not there: it is not available right now, and the next prompt
     *  retries the boot. A refusal the agent ANSWERED is the agent speaking,
     *  and its sentence is what a person reads. */
    const asFailure = (cause: unknown): OpFailure =>
      cause instanceof HarnessRefused
        ? new UsageFailure({ reason: cause.why })
        : new BusyFailure({
          reason: cause instanceof Error ? cause.message : String(cause),
        })
    /**
     * WHAT THIS PANEL SENT, BY THE ROW IT WAS SENT ON — the body, kept for the
     * one verb that may need it again.
     *
     * The prompt rather than the row: the row carries the pictures' NAMES and
     * the prompt carries their paths, so a retry rebuilt from the screen would
     * be a different message wearing the same words ({@link resend}). A
     * delivery that LANDED drops its entry, so what is kept is only what a
     * person may still be offered a button under.
     */
    const outgoing = new Map<string, string>()

    /**
     * Send. Not "send or queue" — SEND, whatever the agent is doing.
     *
     * An agent holds the floor for minutes at a time, and a person watching it
     * work thinks of the next thing well before it is finished. Refusing that
     * message made them hold it in their head and come back; queueing it HERE
     * made the panel hold it for them, out of sight, until the turn it should
     * have changed was over — and then a cancel threw it away. Both were the
     * same mistake, and neither is what happens now: the words go out as a
     * plain prompt and the AGENT holds them behind the turn it is working on,
     * which is why nothing here has to know what that turn is.
     *
     * WHICH LANE THEY TAKE IS THE CONVERSATION'S, not this file's. A steer is
     * the asked-for exception; an agent that advertises steering without a
     * queue takes a busy send that way whether it was asked or not; a message
     * with files is never steered; a steer aimed at a turn somebody CANCELLED
     * under it is refused rather than quietly started afresh; and a message
     * sent behind a running turn is marked `queued` until the agent picks it
     * up. All of that moved with the turns (`@kolu/acp-harness`), and so did
     * every mark a row takes when a delivery does not land. What is left here
     * is olai's half: what the words are ABOUT, and what rides under them.
     */
    const send = (
      text: string,
      attachments: ReadonlyArray<string>,
      context: ReadonlyArray<NodeContext>,
      steer = false,
      preamble: ReadonlyArray<string> = [],
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
        // and "a replay fills the panel" stop contradicting each other: a row
        // minted into that gap is a row the conversation it was going into
        // takes away.
        yield* opening.withPermit(Effect.gen(function*() {
          const at = talking
          if (at === null) {
            return yield* new UsageFailure({
              reason: "no agent has been chosen for this chat yet — pick one to start",
            })
          }
          // WHAT A NODE AGENT IS TOLD — the contract if this conversation
          // belongs to one and has not been told yet, the reminder on its Nth
          // message — INSIDE the permit, with the delivery it rides under.
          //
          // It was asked outside once, and that was the one thing on this path
          // that had no business being: a send that PARKS on the permit while a
          // session switch completes is an ordinary event with two tabs open,
          // and the contract addressed before the wait was delivered into the
          // conversation that arrived after it. Both halves went wrong at once
          // — the notice, the row and the prompt landed in the NEW conversation
          // carrying the OLD one's node, and the mark was written onto the old
          // binding, which then spent the rest of its life believing it had
          // been taught. That is exactly what {@link Teaching} pairs the lines
          // with a conversation to prevent.
          const teach = teaching(preamble)
          // WHAT GOES TO THE AGENT, which is not what the ROW records. `body`
          // is the person's words with olai's lines under them, the nodes the
          // message was about, and the paths of the pictures; `text` is the
          // words alone, because that is what a person reads back and what
          // *send again* sends ({@link ./prompt.ts} owns the one rule for
          // putting lines under a message).
          const body = Attachments.promptWith(
            Context.promptWith(annotated(said, teach?.lines ?? []), context),
            attachments,
          )
          const sent = yield* sending.withPermit(Effect.tryPromise({
            try: () =>
              at.harness.prompt({
                text: said,
                body,
                extra: {
                  // The file NAMES: the tmp path is for the agent, and what a
                  // reader wants off the row is which picture went with which
                  // message.
                  ...(attachments.length === 0
                    ? {}
                    : { attachments: attachments.map(Attachments.nameOf) }),
                  // The nodes as the set answered for them, in the row rather
                  // than only in the prompt: what the message was ABOUT is part
                  // of what was said, so it survives a reload and reaches the
                  // other tab like everything else here.
                  ...(context.length === 0 ? {} : { context }),
                },
                // OLAI'S PICTURES TRAVEL AS PATHS IN THE BODY, which is the
                // whole of its transport and is unchanged: the bytes were
                // written to this conversation's own tmp directory as they
                // arrived ({@link ./attachments.ts}) and the agent reads them
                // off the disk they are on. So there is nothing here for the
                // conversation's own attachment machinery to carry, and the
                // caps and refusals it keeps are about blocks olai never sends.
                files: [],
              }, steer),
            catch: (cause) => asFailure(cause),
          }))
          outgoing.set(sent.rowId, body)
          // ... AND THE CONTRACT IS SAID AND MARKED, both halves together and
          // both only where the message it rode under was TAKEN
          // ({@link contracted}).
          if (teach !== null) yield* contracted(teach, sent.rowId)
        }))
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
      to: Addressed,
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
      /** Whether this turn is olai's own — carried rather than inferred from
       *  `from`, so a plugin named `sleep` cannot become one
       *  (`@olai/plugin-api`'s `Deliveries.deliver`). */
      sleep: boolean,
    ): Effect.Effect<"handed" | "held" | "nothing"> =>
      opening.withPermit(Effect.gen(function*() {
        const at = talking
        const now = at === null ? null : at.harness.state()
        // NOT THIS PANEL'S CONVERSATION — no agent bound, none open, or one
        // that is somebody else's. There is exactly one conversation this
        // process can prompt, so every other conversation's bodies wait for
        // somebody to open them.
        if (
          at === null || now === null || now.sessionId === null
          || at.row.id !== to.agent || now.sessionId !== to.session
        ) return "held"
        return yield* sending.withPermit(Effect.gen(function*() {
          // ASKED OF THE CONVERSATION ITSELF, now, rather than of the state
          // this panel last published: the re-read is only worth anything if it
          // is the live one, and a published frame is a beat old.
          if (at.harness.state().busySince !== null) return "held" as const
          const body = say()
          // NOTHING LEFT TO SAY. The subject settled while the body waited, so
          // there is no row — and the caller drops the slots rather than asking
          // again forever.
          if (body === null) return "nothing" as const
          // MARKED, and marked by core from the registry binding: the plugin
          // never supplies its own name ({@link ../../surface/src/chat.ts}'s
          // `rang`). The ROW is this end's to compose — a turn it starts is one
          // the conversation mints the row it is handed — and it takes every
          // delivery mark a person's message does.
          // THE PASS'S MARK GOES UP FIRST, before the row and the turn it is
          // about: the conversation publishes `working` the instant the turn
          // opens, and a watcher that saw a turn start without the mark on it
          // would read olai's own pass as somebody's message — a question
          // alerted on that nobody is there to answer
          // ({@link ChatState.sleep}).
          if (sleep) move({ sleep: true })
          const started = yield* Effect.result(Effect.tryPromise({
            try: () => at.harness.hostTurn({ kind: "user", text: body, rang: from }, body),
            catch: (cause) => asFailure(cause),
          }))
          // A CONVERSATION THAT WOULD NOT TAKE IT IS ONE THAT IS HOLDING IT:
          // the body stays where it was and the next boundary tries again,
          // which is the same answer a running turn gives. There is nobody to
          // report a refusal to — a watcher sink has nowhere to put one — which
          // is why this answer is three-valued rather than four.
          if (started._tag === "Failure") {
            if (sleep) move({ sleep: false })
            return "held" as const
          }
          outgoing.set(started.success.rowId, body)
          // ... and the mark now belongs to a TURN, which is what takes it off
          // again however that turn ends ({@link ended}).
          if (sleep) sleepTurn = started.success.rowId
          return "handed" as const
        }))
      }))

    /**
     * The held bodies for one conversation, offered as ONE message.
     *
     * ONE PLUGIN AT A TIME — the one whose body has been waiting longest — and
     * all of that plugin's held bodies together, joined whole with a blank line
     * between them (`@kolu/acp-harness`'s `holding.ts`'s `joined`). Not every plugin's
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
    const flush = (to: Addressed): Effect.Effect<void> =>
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
          const batch = waiting.filter((slot) => slot.from === oldest.from)
          // THE WORDS ARE NOT ASKED FOR HERE. {@link offer} asks them, past its
          // own two permits, at the instant before the row is written — so a
          // batch whose turn is still running is not composed and thrown away,
          // and a plugin counting its own deliveries never counts an ask that
          // did not land.
          const arm = yield* offer(to, () => joined(batch, (body) => body.say()), oldest.from, oldest.value.sleep)
          if (arm === "held") return
          // `"handed"` wrote a row; `"nothing"` found every body settled and
          // wrote none. Both take the slots — the second so the next pass does
          // not ask them again and get the same silence — and both keep the
          // strip's count honest.
          held.took(to, batch)
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
     * A plugin's sentence, into a conversation. See {@link Panel.deliverTo}.
     *
     * IT ALWAYS HOLDS FIRST, and then flushes. Two arms written out separately
     * — offer, and hold if that fails — would be two orders: a body offered past
     * bodies already waiting for the same conversation arrives BEFORE them,
     * which is the plugin's own sentences read out of the order it wrote them
     * in. Held-then-flushed there is one lane and one place the coalescing rule
     * is applied, and the idle arm still costs exactly one turn.
     */
    const deliverTo = (
      to: Addressed,
      say: () => string | null,
      from: string,
      how?: { readonly coalesce?: string; readonly sleep?: true },
    ): Effect.Effect<void> =>
      Effect.gen(function*() {
        held.hold(to, from, { say, sleep: how?.sleep === true }, how?.coalesce)
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
     * (`@kolu/acp-client`'s `agent.ts`) and mapped here like every other verb's refusal.
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
      const running = conversation?.busySince != null
      yield* onConversation((harness) => harness.cancel())
      if (!running) return
      // WHETHER ANYTHING HAS ARRIVED SINCE, counted off the changes the
      // conversation publishes ({@link heard}) rather than off a clock: an
      // agent that is still streaming tool progress is working towards the stop
      // it was asked for and will take it when its step returns, and one that
      // has gone silent with a cancel outstanding is the case nobody could see
      // before. The two want opposite things said about them.
      const quietSince = heard
      yield* aside(Effect.gen(function*() {
        yield* Effect.sleep(CANCEL_GRACE)
        // A conversation with nothing in flight is one whose cancel worked.
        if (conversation?.busySince == null) return
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
        // TAKING THE PROMPT IS ONE STEP WITH READING IT, under the same permit
        // a send takes, and that is what makes a second click a refusal rather
        // than a second send: whichever press gets there first leaves with the
        // words, and the other finds nothing waiting.
        const prompt = yield* sending.withPermit(Effect.sync(() => {
          const waiting = outgoing.get(id)
          if (waiting !== undefined) outgoing.delete(id)
          return waiting ?? null
        }))
        if (prompt === null) {
          return yield* new UsageFailure({
            reason: "that message is not waiting to be sent — it went, or its conversation did",
          })
        }
        // THE SAME ROW, SENT AGAIN, which is why this is the conversation's own
        // verb rather than a fresh prompt: the words a person can see are the
        // ones that go, the marks come off the row they are on, and a row the
        // conversation does not hold as undelivered is refused — so a retry
        // cannot mint a second copy of somebody's message.
        //
        // NEVER AS AN INTERRUPTION, whatever the original send was: a retry is
        // a person asking for a message to go, not for a turn to be broken
        // into, and the turn the first attempt was aimed at is over — that is
        // usually why there is a retry at all.
        //
        // The kept prompt carries whatever contract lines the FIRST attempt
        // assembled ({@link send}'s `annotated`), so the agent hears them when
        // this one finally goes — but if that attempt's write never landed,
        // nothing re-tries the mark here: the retell rides the NEXT message,
        // exactly the price {@link contracted}'s failed write pays, rather than
        // a mark attempted under whoever the panel belongs to by then.
        const went = yield* Effect.result(
          onConversation((harness) => harness.sendAgain(id, prompt, [])),
        )
        if (went._tag === "Failure") {
          // THE WORDS GO BACK WHERE THEY WERE. The one thing this must never do
          // is make a message disappear on its way to failing again, and the row
          // is still there saying it did not go.
          outgoing.set(id, prompt)
          return yield* Effect.fail(went.failure)
        }
      }))

    /**
     * An OPEN that the agent refused, and what it would take to try it again.
     *
     * The other half of a `ChatState.unopened`, kept HERE for the reason a
     * refused message's prompt is kept beside its row
     * (`@kolu/acp-harness`'s `transcript.ts`):
     * a face offering a retry with nothing behind it draws a button that
     * refuses, and an attempt with no face is a failure nobody can see. Neither
     * is constructible while the two are written and dropped together —
     * {@link refusedOpen} writes both, and {@link opened} drops both.
     *
     * The EFFECT rather than a description of it, because "which conversation"
     * is not always a thing anybody named: a boot adopts its own, and a
     * description would be this file re-deciding that on a retry.
     */
    let unopened: { readonly again: Effect.Effect<void, HarnessRefused | HarnessUnavailable>; readonly completed?: Effect.Effect<void, OpFailure> } | null = null

    /**
     * WHICH CONVERSATION THE OPEN IN FLIGHT IS FOR — the id the verb asked for,
     * or `null` for one that picks its own.
     *
     * Held rather than passed, because the two open paths could not both pass
     * it: a picker's load is given an id, and a BOOT adopts one nobody named.
     * This is the same line under both, so a refusal is answered the same way
     * however it was reached.
     */
    let attempting: string | null = null
    /** The agent said no to opening a conversation. The panel says so, with
     *  the agent's own words and the offer to try again — and stays IDLE,
     *  because the agent answered and is therefore running ({@link
     *  ../../surface/src/chat.ts}'s `Unopened`). */
    /**
     * WHETHER THIS REFUSAL IS SOMETHING A SIGN-IN WOULD FIX — the conversation's
     * own reading of it ({@link HarnessRefused}'s `signIn`, taken off the
     * protocol's code and the agent's error data rather than off its prose),
     * and the half that needs the AGENT to have offered a way in.
     *
     * BOTH HALVES, and the second is not a formality: an agent can say
     * "authenticate first" and then advertise no method at all (a credential
     * file somebody has to create by hand, an agent whose auth is its own
     * environment), and a row with no buttons on it is a panel asking a person
     * to do something it cannot help with. Those refusals stay what they were —
     * the agent's own words, with a retry — which is also what happens for
     * every refusal that is not about a signature at all.
     */
    const askingToSignIn = (cause: HarnessRefused): boolean =>
      cause.signIn !== "no" && (conversation?.methods.length ?? 0) > 0

    const refusedOpen = (
      failure: HarnessRefused,
      again: Effect.Effect<void, HarnessRefused | HarnessUnavailable>,
      completed?: Effect.Effect<void, OpFailure>,
    ): void => {
      unopened = { again, completed }
      // WHAT WAS REFUSED, as an address — which is the whole of the second
      // claim below. `talking` is the agent that answered: an open that never
      // reached one fails `unreachable` and is not this face at all.
      const at = talking
      const what = at === null || attempting === null
        ? null
        : { agent: at.row.id, session: attempting }
      // `trouble` is left alone deliberately: it is drawn inside the transcript
      // and cleared by the next turn, and there is neither a transcript to draw
      // it in nor a next turn to clear it. The face is what says this.
      //
      // THE SERVERS GO, for `sessionOver`'s reason met from the other side. The
      // roster is composed and announced BEFORE `session/new` is asked — it is
      // the very list that call is handed (`@kolu/acp-client`'s `agent.ts`) — so an open
      // that comes back a NO leaves a strip answering "which servers does this
      // conversation have?" about a conversation that does not exist. Empty
      // means "there is no conversation" on this member
      // ({@link ../../surface/src/chat.ts}), and this is one of the two faces
      // where that is true.
      move({
        status: "idle",
        // ... AND THE ONE CLASSIFICATION A FACE MAY BRANCH ON, where the agent
        // answered a `session/load` with ACP's `-32002` (`@kolu/acp-client`'s
        // `agent.ts`'s `missingOf`). `why` is still the agent's own sentence
        // and still what is shown; this says that asking for the SAME
        // conversation again can only ever get the same answer, which is the
        // difference between a body with a retry on it and a body with a way
        // out ({@link ./browser/chat/Unopened.tsx}).
        unopened: {
          why: failure.message,
          what: attempting,
          ...(failure.missing === true ? { cause: { kind: "missing" as const } } : {}),
        },
        // ... AND WHOSE CONVERSATION IT WAS, which is the way OUT of this face
        // and used to be dropped exactly here. A node agent's *fresh session*
        // is drawn only where the header knows the node
        // ({@link ./browser/agents/History.tsx}), the node is `bound`, and
        // `bound` was written only where a conversation OPENED — so the one
        // face that needs the way out was the one face with no node on it. The
        // gesture is unchanged and so is its warning: what changes is that it
        // is on screen when a person is stuck.
        //
        // A conversation no node claims answers `null` here, which is what it
        // answered before and what nearly every conversation is.
        bound: boundTo(what),
        servers: [],
        // ... AND THE WAY OUT OF THIS FACE, when the way out is a signature.
        // The row goes up beside the refusal it explains rather than instead of
        // it: what the agent said is still what happened, and the buttons are
        // what a person can do about it. `Try again` stays where it is, and is
        // honest — the retry is exactly what signing in makes work.
        //
        // A REFUSAL IS ALWAYS NEWS, so a chooser somebody closed over the LAST
        // one comes back with this one ({@link signingIn}): they asked for this
        // open, and this is what it would take.
        signIn: askingToSignIn(failure) ? { kind: "choosing" } : null,
      })
      dismissed = false
    }

    /**
     * SIGN IN — the chooser, or one method of it ({@link Panel.signIn}).
     *
     * THE CHOOSER IS THE PANEL'S AND THE ATTEMPT IS THE AGENT'S, which is the
     * split this whole member is built on: pressing `/login` asks for a row and
     * has nothing to do with any process, while running a method is the agent
     * spawning one and reporting on it. So the first arm is a `move` and nothing
     * else, and the second is a fork — the attempt may last minutes, and what
     * happens while it runs arrives as `signIn` events (`@kolu/acp-client`'s `agent.ts`).
     *
     * WHAT HAPPENS AT THE END is {@link signedIn}, and only on success: a failed
     * attempt leaves its own row on screen (the output IS the failure), and a
     * cancelled one leaves nothing, which the panel has already done.
     */

    const signIn = (method: string | null): Effect.Effect<void, OpFailure> =>
      Effect.suspend(() => {
        const at = talking
        if (at === null) {
          return Effect.fail(
            new UsageFailure({
              reason: "no agent has been chosen for this chat yet — pick one to start",
            }),
          )
        }
        // SOMEBODY IS ASKING, so a row they closed earlier is not the answer to
        // this press ({@link signingIn}).
        dismissed = false
        if (method === null) {
          // THE CHOOSER IS A ROW THE CONVERSATION PUTS UP, signed in or not,
          // and one already on screen — the agent's own, or a running attempt —
          // is left exactly as it is.
          at.harness.askSignIn()
          projecting()
          return Effect.void
        }
        return aside(Effect.gen(function*() {
          const outcome = yield* Effect.tryPromise({
            try: () => at.harness.signIn(method),
            catch: (cause) => asFailure(cause),
          })
          if (outcome !== "signed-in") return
          yield* Effect.catch(signedIn(at), (failure) =>
            Effect.sync(() => move({ trouble: failure.reason })))
        }).pipe(Effect.catch((failure) =>
          Effect.sync(() => move({ trouble: failure.reason }))
        )))
      })
    /**
     * ... AND THE CONVERSATION COMES BACK, because the process at the other end
     * has just been told who it is.
     *
     * REOPENING RATHER THAN CARRYING ON, which is the shape Zed's flow has and
     * the shape the protocol asks for: the session on the wire was opened by an
     * agent that had not been signed in yet, and a `/model`, a provider and a
     * resume all hang off that agent's own auth state. What is opened is the
     * conversation this panel was in — RESUME, by its own id, so the words
     * somebody had typed are still theirs (the composer's draft is keyed by the
     * conversation, and a fresh id would drop them) — or, when the refusal was
     * at the OPEN and there is no conversation to come back to, whatever that
     * open requested. A pending open retains its exact operation and binding
     * completion; a refused fresh start must never adopt a stored conversation.
     *
     * A failure is a NOTICE and not a second row: the sign-in itself worked,
     * which is the thing the person pressed, and what did not work is the
     * conversation — which already has faces of its own.
     */
    const signedIn = (at: Bound): Effect.Effect<void, OpFailure> =>
      Effect.suspend(() => {
        const waiting = unopened
        if (waiting !== null) return changeSession(waiting.again, waiting.completed)
        const session = state.session?.id ?? state.unopened?.what ?? null
        return openWith(
          at.row.id,
          session === null ? { kind: "adopt", memory } : { kind: "resume", id: session },
        )
      })


    /** One line to the process a terminal sign-in is running
     *  ({@link Panel.signInInput}). A refusal from the agent is the caller's to
     *  read: nothing is waiting for a line, or the sign-in is one the AGENT
     *  runs and there is no process to type into. */
    const signInInput = (text: string): Effect.Effect<void, OpFailure> =>
      onConversation((harness) => harness.signInInput(text))

    /**
     * ... AND OUT OF IT ({@link Panel.signInCancel}).
     *
     * The ROW goes first and unconditionally, because both things a person means
     * by pressing it are about the row: stop this, and get it off my screen. The
     * agent is told after, and what it does with the news depends on what it has
     * — a running process is killed, an agent-side attempt has its question
     * handed back, and a finished attempt has nothing to stop at all. A cancel
     * with no agent bound still clears the row, since the row is this panel's.
     */
    const signInCancel: Effect.Effect<void, OpFailure> = Effect.suspend(() => {
      const at = talking
      // ... AND IT STAYS OFF, which the row's own `move` cannot promise by
      // itself: the conversation keeps the agent's offer standing where the
      // refusal behind it stands, and the next state frame would draw it again
      // ({@link signingIn} is where this is read).
      dismissed = true
      move({ signIn: null })
      return at === null
        ? Effect.void
        : Effect.asVoid(Effect.tryPromise({
          try: () => at.harness.signInCancel(),
          catch: (cause) => asFailure(cause),
        }))
    })

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
      move({
        status: "gone",
        trouble: why,
        unopened: null,
        servers: [],
        // ... AND A SIGN-IN GOES WITH THE PROCESS IT WAS ABOUT. The agent
        // stopped emitting anything when it died, so nothing else will ever
        // move this row — and buttons that press nothing are how somebody
        // finds out. The attempt itself died with the subprocess
        // (`@kolu/acp-client`'s `agent.ts`
        // kills a login with its scope).
        signIn: null,
      })
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
      what: Effect.Effect<void, HarnessRefused | HarnessUnavailable>,
      completed?: Effect.Effect<void, OpFailure>,
    ): Effect.Effect<void, OpFailure> =>
      switching.withPermit(
        Effect.gen(function*() {
          if (conversation?.busySince != null) {
            return yield* new BusyFailure({
              reason: "a turn is running; cancel it before switching conversations",
            })
          }
          // The pictures went with it. They exist so that a prompt in THIS
          // conversation can name them, and no prompt in the next one will.
          yield* files.discard
          /**
           * WHAT THIS OPEN IS BEING TRIED INSTEAD OF, where it is being tried
           * instead of anything: the face a refusal left up, and the status it
           * left behind it. Read BEFORE the panel says `booting`, because that
           * is the first thing this verb makes untrue.
           */
          const resting = state.unopened === null ? null : state.status
          move({ status: "booting" })
          // HELD ACROSS THE WHOLE OPEN, not around it ({@link replayed}): what
          // a send has to wait for is the replay, which is the last thing to
          // happen and the thing that fills the panel ({@link opening}).
          const outcome = yield* replayed(opening.withPermit(what)).pipe(
            /**
             * AN OPEN NOBODY WAITED FOR LEAVES THE PANEL AS IT FOUND IT.
             *
             * The attempt is TAKEN before it is run — `reopen` empties the
             * slot, and every other open calls {@link opened} on its way in —
             * so a refusal arms it again ({@link refusedOpen}) and a landing
             * drops it for good. An open that is given up on does neither:
             * the reader that asked for it went away (`./scoped.ts` opens one
             * inside the reading), and what is left is the one pair this file
             * says must not be constructible — a face offering a retry with
             * nothing behind it, whose button can only ever answer *no
             * conversation is waiting to be opened*.
             *
             * So the attempt goes back where it was, with the status that was
             * drawn over it. Only where the refusal is still the panel's face:
             * an open that landed has already cleared it ({@link projecting}),
             * and a fresh conversation that was abandoned was never a retry of
             * anything — arming one there would be the same lie read the other
             * way round.
             */
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                if (resting === null || unopened !== null || state.unopened === null) return
                unopened = { again: what, ...(completed === undefined ? {} : { completed }) }
                move({ status: resting })
              })
            ),
          )
          if (outcome._tag === "Failure") {
            // THE AGENT SAID NO, as against there being no agent to say it —
            // a {@link HarnessRefused} and nothing else. It is running, it just
            // will not open this; the panel says that rather than reporting a
            // dead process, and holds what it would take to ask again.
            if (outcome.failure instanceof HarnessRefused) {
              refusedOpen(outcome.failure, what, completed)
            } else {
              wentAway(outcome.failure.message)
            }
            return yield* Effect.fail(asFailure(outcome.failure))
          }
          if (completed !== undefined) yield* completed
          settled()
          // ... AND WHATEVER A DOORBELL HELD FOR THE CONVERSATION JUST OPENED
          // GOES IN, as its first message.
          //
          // HERE and not where the conversation reports that it is open: that
          // report arrives from INSIDE the permit released one line above —
          // the open publishes it synchronously — and {@link opening} is not
          // reentrant, so a flush taken there would block the fiber already
          // holding it and the open would never complete. This is the same
          // moment one beat later, outside the permit, and it is the only safe
          // one.
          yield* aside(flushing)
        }),
      )

    /**
     * WORK THIS PANEL STARTED BESIDE ITS OWN FIBER, and the handle on it.
     *
     * Five things here fork: a turn-boundary write, a doorbell flush at three
     * moments, and the watcher that says a cancel has gone quiet. None of them
     * is anybody's to WAIT for — a send may be holding a permit one of them
     * wants — and every one of them was `Effect.forkDetach`, which attaches to
     * the GLOBAL scope: the panel's stop could not reach them, so they went on
     * over a conversation that had ended.
     *
     * They are the panel's now. The fork still detaches — the point of forking
     * is that nothing about this turn waits on them — and what changed is that
     * `stopWithReason` knows where they are.
     */
    const beside = new Set<Fiber.Fiber<void, unknown>>()
    const aside = <E>(work: Effect.Effect<void, E>): Effect.Effect<void> =>
      Effect.gen(function*() {
        const running: Fiber.Fiber<void, E> = yield* Effect.forkDetach(
          Effect.ensuring(work, Effect.sync(() => { beside.delete(running) })),
        )
        beside.add(running)
      })

    const setSetting = (agent: string, session: string, config: string, value: string | boolean): Effect.Effect<void, OpFailure> => opening.withPermit(sending.withPermit(Effect.gen(function*() {
        if (state.status !== "idle" || talking?.row.id !== agent || state.session?.id !== session) {
          return yield* new UsageFailure({ reason: "wait for this conversation to be idle before changing its settings" })
        }
        yield* onConversation((harness) => harness.setOption(config, String(value)))
      })))

    /**
     * WHAT SOMEBODY HAS READ, written on the same row the line itself is on
     * ({@link ./sessions.ts}'s `Sessions.seen`, {@link Panel.seen}).
     *
     * THE PANEL IS HANDED A PAIR THE MATCHER ALREADY NAMED FOR IT
     * ({@link Chat.seen}), so it does NOT ask again whether this conversation is
     * the one it is in: a second copy of that rule here would be spelled in
     * different words (`talking?.row.id` over this panel's state rather than
     * `agentIn` over the panel) and could drift from the one the door matches
     * by, which is a conversation marked read that nobody was looking at.
     * `state.status` is deliberately not consulted either: unlike
     * {@link setSetting}, reading a line is not a change to the agent's settings
     * and a turn in flight does not make it wrong.
     *
     * A RECORD THAT WILL NOT WRITE IS LOGGED AND CARRIED ON, for
     * {@link Panel.seen}'s reason: the caller is a tab that will try again when
     * what it is looking at moves, and the alternative — a refusal nobody asked
     * for — would be a person's sidebar reporting an error about their own
     * attention.
     */
    const seen = (to: Conversing, at: string): Effect.Effect<void> => Effect.gen(function*() {
      const overheard = options.overheard
      if (overheard === undefined || overheard === null) return
      const done = yield* Effect.result(overheard.seen(to, at))
      if (done._tag === "Failure") {
        yield* Effect.logWarning(
          `what a person had read could not be written down (${done.failure.why}) — ` +
            `that conversation goes on saying it has something new`,
        )
      }
    })

    const stopWithReason = (reason: AcpAgent.StopReason) => Effect.gen(function*() {
      closing = true
      // End the transport before joining work which may be waiting on it. The
      // conversation stops its own turns with the child: a turn still on the
      // wire ends a moment later, and nothing it would have said is published
      // after the stop.
      //
      // WITH THE REASON, which is not decoration: the line a person reads when
      // a child goes is the client's own, and a reaped scope, a switched agent
      // and a shutdown are three different things to find in a log. It is
      // carried through the conversation rather than said beside it, so there
      // is one account of one exit.
      const at = talking
      talking = null
      conversation = null
      if (at !== null) yield* Effect.promise(() => at.harness.stop(reason))
      // ...AND EVERY OTHER FIBER THIS PANEL STARTED, which is what
      // {@link aside} exists to make possible. They used to be
      // `Effect.forkDetach` — the GLOBAL scope, so a stopped panel's
      // turn-boundary write, doorbell flush or cancel watcher went on running
      // with nothing left that could stop it. Interrupted rather than joined:
      // each of them is work ABOUT a conversation that is ending, and a
      // doorbell flush for a panel nobody can read again is not worth the wait.
      const alongside = [...beside]
      beside.clear()
      for (const fiber of alongside) yield* Fiber.interrupt(fiber)
      // Registered as a finalizer of the serve scope, so this is also what
      // takes the pasted pictures with the server when it shuts down. Behind
      // the same permit as everything else that touches the directory: a
      // chunk still being written is a write into a directory this line is
      // about to remove.
      yield* switching.withPermit(files.discard)
    })

    return {
      entries: () => rows,
      refreshWakes: (left) => {
        for (const row of left) held.dropped(row, row.plugin)
        const wake = wakeOf()
        if (!sameWake(wake, state.wake)) move({ wake })
      },
      state: () => state,
      enginesMoved,
      overheard: () => options.overheard?.rows() ?? [],
      // THE REPLACED ENGINE'S CACHED LISTING IS STALE NOW, and nothing else
      // will invalidate it: a fresh start on a node that already had one never
      // switches `talking` (the seat opens the new conversation in the slot
      // already running the node's engine), so the agent whose session this
      // just stopped being current would serve its old rows for up to fifteen
      // seconds. Forget it here so the next listing re-asks.
      replaced: (to, by) => Effect.gen(function*() {
        listings.forget(to.agent)
        yield* noting(options.overheard?.supersede(to, by), replaceLost)
      }),
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
      signIn,
      signInInput,
      signInCancel,
      // A cancel the agent never took is a refusal like any other, and the
      // click that asked for it is what hears about it — the same treatment
      // `sessions` gets, and for the same reason: a verb that could not be
      // done says so where it was asked.
      cancel,
      setSetting,
      // ... AND WRITTEN DOWN BY THE END THAT ASKED, which is not this one: the
      // request goes through the client, and the client files what the agent
      // CONFIRMED against this conversation in the store handed over with it
      // ({@link PanelOptions.models}, passed to the harness above). A write
      // here would be a second one, filing the PICKER'S word for the same
      // model where the agent's own spelling already went — and the two
      // spellings are exactly what the put-back has to translate between.
      setModel: (agent, session, value) =>
        setSetting(agent, session, talking?.row.leg.models?.config ?? "", value),
      // NOT under a permit, and not gated on the panel being idle: this changes
      // nothing about the agent, and a conversation that is mid-answer is
      // exactly the one somebody is reading (`seen` above argues the rest).
      seen,
      // WITH the agent that was chosen, always: every new chat asks, so there
      // is no arm here that picks one. An id off a stale tab is refused in
      // words rather than started.
      newSession: (id: string, completed) => openWith(id, { kind: "fresh" }, completed),
      // The answer to the panel's own question, which is not the same verb: a
      // boot that stopped to ask has not asked for a NEW conversation, so what
      // this opens is the one that agent's own boot would have adopted —
      // {@link Panel.chooseAgent}. `boot` is idempotent and picks its own, which
      // is why it is also what a refused one is retried with.
      chooseAgent: (id: string) => openWith(id, { kind: "adopt", memory }),
      // WITH the agent whose conversation it is, because the list spans all of
      // them now: a row picked out of it may belong to the agent this panel is
      // not talking to, and opening it is a change of agent as well as of
      // conversation. `openWith` is what {@link Panel.newSession} already goes
      // through, so the switch, the stale-tab refusal and the permit are the
      // same ones — the only thing that differs is what is opened at the end.
      loadSession: (agentId: string, id: string) =>
        Effect.suspend(() => {
          const at = talking
          // THE SAME PROCESS, where it is the same agent and it is still there:
          // moving to another of its conversations is a verb of the
          // conversation's own, and a panel that respawned an adapter to do it
          // would pay a handshake for a switch. Another agent's conversation is
          // another subprocess by construction, which is what `openWith` is.
          return at !== null && at.row.id === agentId && at.harness.alive()
            ? changeSession(Effect.suspend(() => {
              attempting = id
              return Effect.tryPromise({
                try: () => at.harness.loadSession(id),
                catch: (cause) => cause as HarnessRefused | HarnessUnavailable,
              })
            }))
            : openWith(agentId, { kind: "resume", id })
        }),
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
        return changeSession(waiting.again, waiting.completed)
      }),
      // ... WEARING THE SUPERSESSIONS OLAI ITSELF MADE ({@link
      // ./succession.ts}). The overlay is here, at the one door every reader of
      // a listing comes through, so the migration list, the panel's *past
      // sessions* and the picker's own superseded line cannot come to disagree
      // about which conversations a node agent has had.
      liveSessions: (agent) => talking !== null && talking.row.id === agent ? storedIn(talking.harness) : null,
      sessions: Effect.map(
        listings.all,
        (listed) => succeeded(listed, options.overheard?.rows() ?? []),
      ),
      answer: (id, answers) =>
        Effect.flatMap(
          onConversation((harness) => harness.answer(id, answers)),
          (took) =>
            took ? Effect.void : Effect.fail(
              new UsageFailure({
                reason: "that question is not waiting any more — it was answered or withdrawn",
              }),
            ),
        ),

      // ONE CLOSURE PER PLUGIN, and the name is in it rather than in an
      // argument — see {@link Panel.doorFor}. Both halves of the keying live
      // here, in the module that owns the mark, so neither is a thing a
      // composition root does on the way past.
      doorFor: (plugin) => {
        const scopes = (): ReadonlyArray<WakeScope> =>
          (options.scoping?.rows() ?? [])
            .filter((row) => row.plugin === plugin)
            // The `plugin` column goes on the way out: a door is already
            // ABOUT one plugin, so carrying its name back to it would be the
            // caller's own question answered a second time.
            .map((row) => options.scoping!.recipient(row))
        return {
          scopes,
          deliver: (to, say, how) => deliverTo(to, say, plugin, how),
          withdraw: (to) =>
            Effect.sync(() => {
              held.dropped(to, plugin)
              // ...AND THE STRIP'S COUNT WITH IT, when this panel is the one
              // drawing that conversation: the same republish a cleared doorbell
              // does, and the same guard against a frame that says nothing new.
              const wake = wakeOf()
              if (!sameWake(wake, state.wake)) move({ wake })
            }),
        }
      },
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
       * the same pair {@link Panel.loadSession} takes and for the same stated
       * reason.
       *
       * The read-back is not an overlay: this ends in `move`, so what the strip
       * draws next comes through the one publisher every other chat verb
       * publishes through.
       */
      scope: (to, plugin, pick) =>
        Effect.gen(function*() {
          const scoping = options.scoping ?? null
          if (scoping === null) {
            return yield* new UsageFailure({
              reason: "this chat keeps no doorbells: no plugin here rings a conversation",
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
          // Drop existing work eagerly. The choice changes when persistence
          // succeeds; deliveries admitted during that write still belong to the
          // old choice. The successful write revokes their recipients, and the
          // second drop below removes any bodies queued during the write.
          // A failed write preserves the choice and costs only a re-derivation.
          held.dropped(to, plugin)
          const left = yield* Effect.mapError(
            scoping.set(to, plugin, pick),
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
          return left
        }),

      recordRefusal: (tool: string, failure: OpFailure) =>
        Effect.sync(() => {
          ours({ kind: "refusal", text: `\`${tool}\` was refused`, refusal: failure })
        }),
      start: Effect.gen(function*() {
        // Eager, on the server's own start, because the panel is meant to show
        // your last conversation before anybody types into it. The listener is
        // already serving while this runs. The EFFECT settles with the boot so
        // a scheduler above this panel can route a session whose identity was
        // not knowable until `session/new` answered; the scheduler decides
        // whether its whole boot belongs on a detached fiber.
        yield* Effect.gen(function*() {
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
          const outcome = yield* replayed(
            opening.withPermit(using(chosen, { kind: "adopt", memory })),
          )
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
            // Trying again is the boot itself, which adopts and re-opens.
            if (outcome.failure instanceof HarnessRefused) {
              refusedOpen(outcome.failure, using(chosen, { kind: "adopt", memory }))
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
          yield* aside(flushing)
        })
      }),
      stop: stopWithReason("shutdown"),
      stopWithReason,
    }
  })
