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
 * adapter it resolved and the directory to run it in, never a protocol object.
 * The seam for a scripted agent is one level further out and more honest for
 * it — `OLAI_ACP_AGENT` pointed at a script, which is how the e2e suite drives
 * every turn it asserts on, and which exercises the subprocess and the wire
 * that an injected object would replace with an assumption.
 *
 * Four decisions worth naming:
 *
 *   - **a turn is accepted, not awaited.** `send` answers the moment the prompt
 *     is on the wire; what happens next arrives on the transcript, so every open
 *     tab stays in step and a five-minute turn is not a five-minute call. The
 *     turn runs on its own fiber, and the `thinking` state is what says so.
 *   - **what is typed goes out IMMEDIATELY, always, and this file holds
 *     nothing.** A message sent while a turn runs is STEERED into that turn
 *     ({@link ./agent.ts}'s `steer`), so the agent hears it while it is still
 *     working — which is the only moment saying it is worth anything. There
 *     used to be a queue here: a mid-turn prompt went into an array, waited for
 *     the turn to end, and was thrown away by the next cancel. That destroyed
 *     user words with no copy anywhere — the transcript is not persisted, the
 *     agent's own session is the persistence, and a message that never reached
 *     the session was never in it. The queue is gone rather than fixed, and
 *     with it the reason a cancel had anything to decide: everything typed has
 *     already been delivered, so cancel means stop the agent and nothing else.
 *     Delivery that genuinely fails is said ON THE ROW — `delivery`, and
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
  type AskAnswer,
  type Attached,
  type AttachChunk,
  CHAT_OFF,
  type ChatEntry,
  type ChatState,
  type NodeContext,
  type OpFailure,
  type SessionInfo,
} from "@olai/surface"
import { BusyFailure, UsageFailure } from "@olai/format"
import { Effect, Fiber, Semaphore } from "effect"

import type { Adapter } from "./adapter.ts"
import * as AcpAgent from "./agent.ts"
import * as Attachments from "./attachments.ts"
import * as Context from "./context.ts"
import type { AgentEvent } from "./events.ts"
import * as Memory from "./memory.ts"
import { type Change, Transcript } from "./transcript.ts"

export type { ToolServer } from "./agent.ts"

export interface Options {
  /** Which agent to start, already resolved from the environment
   *  ({@link ./adapter.ts}). Resolving it is the caller's move — it is the
   *  caller who knows there is a `--no-agent` flag or an env var — and what a
   *  resolved one looks like is ours. */
  readonly adapter: Adapter
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
  /** Publish the state cell. Called on every change; the surface dedups. */
  readonly onState: (state: ChatState) => void
  /** Publish transcript changes: upserts by key, and removes for a session
   *  that was replaced. */
  readonly onTranscript: (change: Change) => void
}

export interface Chat {
  /** The transcript as it stands — what a fresh subscription is seeded with. */
  readonly entries: () => ReadonlyMap<string, ChatEntry>
  readonly state: () => ChatState
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
  readonly newSession: Effect.Effect<void, OpFailure>
  readonly loadSession: (id: string) => Effect.Effect<void, OpFailure>
  readonly sessions: Effect.Effect<ReadonlyArray<SessionInfo>, OpFailure>
  /** Answer the question `id`, or — with `null` — decline it. Both refuse if
   *  that question has stopped waiting, which is a thing two open tabs can
   *  genuinely race and a person deserves to be told about. */
  readonly answer: (
    id: string,
    answers: ReadonlyArray<AskAnswer> | null,
  ) => Effect.Effect<void, OpFailure>
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
interface Undelivered {
  readonly gone: AcpAgent.Gone
  readonly why: string
}

/**
 * Which events are THE AGENT WORKING, as against olai's own reports about it.
 *
 * Two questions are answered by "has this agent said anything since", and
 * neither of them means "has anything at all happened" — a boot that failed, a
 * subprocess that exited, a session that ended are all things said ABOUT the
 * agent by this process. Counting those was harmless while {@link Chat.cancel}
 * was the only reader (it looks at a live turn, where they do not arrive), and
 * is not harmless now that {@link begin} reads the same counter to ask whether
 * a failed turn ever reached the agent: an unreachable agent emits a `trouble`
 * on its way to refusing, which would otherwise read as the agent speaking.
 *
 * The four are prose, tool frames, questions and usage — everything a turn
 * produces that could only have come from the other end of the pipe. A `model`
 * announcement is deliberately not one: it arrives when a SESSION opens as
 * readily as when a turn starts.
 */
const SPOKE: ReadonlySet<AgentEvent["_tag"]> = new Set([
  "said",
  "tool",
  "asked",
  "usage",
])

/**
 * The turn in flight, as a TICKET rather than as a fiber handle.
 *
 * It exists because the fiber does not, yet: the ticket is written down before
 * the fork, so there is no window in which a turn is running and nothing says
 * so. The fiber is filled in a moment later, for the one caller that has to
 * interrupt it.
 *
 * Its real job is IDENTITY. A turn that ends reports where it stands — idle,
 * or gone — and a turn that was superseded must report nothing, or a settling
 * turn would talk over the one that replaced it. Comparing the ticket is what
 * separates "the turn I am is still the turn" from "some turn ended", which a
 * status flag cannot answer and a null check gets wrong exactly when it
 * matters.
 */
interface Turn {
  fiber: Fiber.Fiber<unknown, unknown> | null
  /**
   * Somebody asked THIS turn to stop.
   *
   * It outlives the turn on purpose, because the thing that needs it is a
   * steer still on the wire: a message aimed at a turn a person then cancelled
   * comes back "nothing to steer", which is indistinguishable from the turn
   * having simply ended — unless the ticket it was aimed at remembers being
   * stopped. Without that, the two are the same answer and the message starts
   * a fresh turn the person just pressed a button to end.
   */
  stopped: boolean
}

export const make = (options: Options): Effect.Effect<Chat, never, never> =>
  Effect.gen(function*() {
    // A FACTORY over the handler, because the two are mutually referential:
    // the agent needs somewhere to send its events, and the thing that
    // consumes them needs the agent to drive.
    const spawn = (onEvent: (event: AgentEvent) => void) =>
      AcpAgent.make({
        command: options.adapter.command,
        args: options.adapter.args,
        cwd: options.cwd,
        tools: options.tools,
        // Built here rather than handed in, exactly like the tmp directory
        // pasted pictures land in: both are somewhere on this machine that
        // belongs to THIS conversation about THIS directory, and a composition
        // root passing either one down would be a second place that knows
        // where olai keeps things. Keyed by the served DIRECTORY and by
        // nothing else, so two servers over two directories remember two
        // panels — and two servers over ONE directory are one panel as far as
        // this is concerned, last one in wins, which is the honest answer for
        // a single-user app rather than a race worth a port in the key.
        memory: Memory.forDirectory(options.cwd),
        onEvent,
      })

    const transcript = new Transcript()
    /** The conversation's own tmp directory, for pictures pasted into it.
     *  Emptied when a conversation is left and when the chat stops. */
    const files = Attachments.make()
    // The cell's own default, with the one field that differs: an agent is
    // being started. Restating the other four here would be a second place to
    // remember when the state gains a fifth.
    let state: ChatState = { ...CHAT_OFF, status: "booting" }
    /** The turn in flight, so a second `send` knows to STEER rather than start
     *  one and a cancel has something to aim at. See {@link Turn}. */
    let turn: Turn | null = null
    /** One session change at a time: a load and a new-session racing each other
     *  would leave the transcript holding half of each. */
    const switching = yield* Semaphore.make(1)
    /** One delivery decision at a time — see {@link deliver}. Deciding which
     *  lane a message takes means reading whether a turn is running, and taking
     *  that lane means writing it; two sends interleaving between the two would
     *  start two turns where the panel can only report one. Its own permit
     *  rather than {@link switching}'s, because that one is held across a
     *  three-megabyte attachment chunk and a send should not queue behind a
     *  picture. */
    const sending = yield* Semaphore.make(1)
    /** Everything the agent has said FOR ITSELF, counted. See {@link receive}
     *  and {@link SPOKE}. */
    let heard = 0

    const publish = (change: Change) => {
      if (change.upserts.length === 0 && change.removes.length === 0) return
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
        if (entry.kind === "ask" && entry.ask?.outcome === null) waiting++
      }
      return waiting
    }

    /** The agent's events, as rows and as state. The one place the vocabulary
     *  of {@link ./events.ts} is consumed. */
    const receive = (event: AgentEvent): void => {
      // How much this agent has said, ever. What its two readers need is not a
      // count but a CHANGE — has anything arrived since I looked — and a
      // monotonic counter answers that with no clock to read and nothing to
      // reset. {@link cancel} asks it about an agent that was told to stop;
      // {@link begin} asks it about a turn that failed.
      if (SPOKE.has(event._tag)) heard++
      switch (event._tag) {
        case "said":
          publish(transcript.say(event.text))
          return
        case "userSaid":
          // A replay only: live, we put the user's own message in ourselves
          // when the turn was accepted.
          publish(transcript.add("user", event.text))
          return
        case "tool":
          publish(
            transcript.tool(event.id, {
              title: event.title,
              status: event.status,
              detail: event.detail,
              progress: event.progress,
              diffs: event.diffs,
              wrote: event.wrote,
              locations: event.locations,
              parent: event.parent,
              spawned: event.spawned,
            }),
          )
          return
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
        case "servers":
          // A fact about the conversation, so it lands on the cell beside the
          // model and the commands rather than as a row: a notice scrolls away
          // and this is true for as long as the session is.
          move({ missing: event.missing })
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
        case "session":
          move({
            status: state.status === "thinking" ? "thinking" : "idle",
            session: { id: event.id, title: event.title, updatedAt: null },
            trouble: null,
          })
          return
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
          // The missing servers go with the session they were missing FROM.
          // The next one is probed fresh and says so before it opens; leaving
          // the last one's answer up in between would be the panel reporting a
          // conversation that no longer exists — and, for a dead agent, one
          // nobody is in.
          // The usage goes with the session it was usage OF. A fresh
          // conversation has spent nothing and a loaded one has spent whatever
          // it spent; either way the number from the last one is about a
          // context that no longer exists, and leaving it up would be the
          // panel answering "should I compact?" about somebody else.
          move({
            session: null,
            commands: [],
            asking: asking(),
            missing: [],
            usage: null,
          })
          return
        case "replayStarted":
          publish(transcript.clear())
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
          return
        case "gone":
          publish(transcript.settle())
          publish(transcript.add("notice", event.why))
          move({ status: "gone", trouble: event.why })
          return
        case "trouble":
          publish(transcript.add("notice", event.message))
          move({ trouble: event.message })
          return
      }
    }

    const agent = yield* spawn(receive)

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
     * message made them hold it in their head and come back; queueing it made
     * the panel hold it for them, out of sight, until the turn it should have
     * changed was over — and then a cancel threw it away. Both were the same
     * mistake: treating a message typed DURING a turn as a message about the
     * next one.
     *
     * So it goes to the agent now, and where "now" lands depends on the agent
     * rather than on this file: an idle one gets a prompt and a working one is
     * STEERED ({@link deliver}). Either way the row is written first and the
     * words are on screen before anything is on the wire.
     */
    const send = (
      text: string,
      attachments: ReadonlyArray<string>,
      context: ReadonlyArray<NodeContext>,
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
        for (const path of attachments) yield* files.claim(path)

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

        const prompt = Attachments.promptWith(
          Context.promptWith(said, context),
          attachments,
        )
        yield* deliver(row.key, prompt)
      })

    /**
     * Get one prompt to the agent NOW, whatever it is doing — and, when that
     * cannot be done, leave the words with the person who typed them.
     *
     * A working agent is STEERED, which hands the message to the turn already
     * running and starts nothing; everything else PROMPTS, which starts a turn
     * this file owns. The ordinary prompt is the fall-through rather than a
     * second branch, because the two ways of reaching it are the same ending: an
     * agent that was idle when we looked, and one that turned out to be idle
     * when the steer got there. That second one is the RACE — olai steers only
     * while it believes a turn is running, and the agent can settle in between —
     * and the agent says so rather than inventing a turn ({@link
     * ./interpret.ts}'s `STEER_WHEN_IDLE`).
     *
     * UNDER A PERMIT, because the first thing it does is read which lane to take
     * and the last thing it does is take it. Two tabs sending at an idle agent
     * both read `turn === null` otherwise, and both start a turn: the second
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
    const deliver = (key: string, prompt: string): Effect.Effect<void> =>
      sending.withPermit(Effect.gen(function*() {
        // WHICH turn this steer is aimed at, kept rather than re-read: by the
        // time it answers, `turn` may be null, or somebody else's.
        const aimed = turn
        if (aimed !== null) {
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
        yield* begin(key, prompt)
      }))

    /**
     * The message did not land, said on the row it was typed into — in the ONE
     * of two ways this end can honestly say it.
     *
     * A REFUSAL is a certainty: something answered no while the message had
     * taken no effect — a method the agent does not have, a session it does not
     * know, a process that was not there, a turn its own sender had stopped.
     * The row keeps the prompt ({@link ./transcript.ts}) and offers *send
     * again*, because nothing happened and asking again is honest.
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
     *  merely undrawn ({@link ./transcript.ts}). */
    const markUndelivered = (key: string, prompt: string, gone: AcpAgent.Gone): void => {
      publish(
        gone === "refused" ? transcript.refused(key, prompt) : transcript.unanswered(key),
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
     */
    const begin = (key: string, prompt: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        const ticket: Turn = { fiber: null, stopped: false }
        turn = ticket
        // The rows go first, and the order is the point. A dead agent's rows
        // are deliberately left where they are, so this turn is starting over a
        // transcript that may hold calls the last one abandoned — and the panel
        // is about to be told a turn is in flight. Said in the other order,
        // there is a frame in which every one of those calls is drawn as work
        // in progress again ({@link ./transcript.ts}'s `begins`).
        publish(transcript.begins())
        move({ status: "thinking", trouble: null })
        // How much the agent had said before this turn was asked for. What it
        // answers, on a turn that FAILED, is whether the prompt demonstrably
        // arrived — an agent that streamed so much as a thought was working on
        // it — which is the one thing a failed turn cannot say about itself.
        // The same evidence {@link cancel} reads, for the same reason: a count
        // answers "has anything arrived" with no clock to read.
        const quietSince = heard

        const running = yield* Effect.forkDetach(
          Effect.gen(function*() {
            const outcome = yield* Effect.result(agent.prompt(prompt))
            publish(transcript.settle())
            // Whether this turn is still THE turn. The notices go in either
            // way — they are things that happened, and they happened — and
            // only the state is withheld.
            const current = turn === ticket
            if (outcome._tag === "Failure") {
              publish(transcript.add("notice", outcome.failure.message))
              // A turn that produced NOTHING is a delivery that failed, and it
              // is said on the row like any other ({@link markUndelivered}) —
              // a refusal where the agent was never reached at all (no
              // process, no session), a silence where the pipe died with the
              // prompt on it.
              //
              // An agent that SAID something first is the case this must not
              // touch, and the reason this file used to mark nothing here: it
              // demonstrably had the prompt and worked on it, so a row calling
              // that undelivered would contradict the answer sitting above it.
              // What has changed is that "did it arrive" is now answerable —
              // by the turn's own silence, and by `Gone` where it is not.
              if (heard === quietSince) markUndelivered(key, prompt, outcome.failure.gone)
              if (current) move({ status: "gone", trouble: outcome.failure.message })
              return
            }
            // Cancelling means stop, and it means only that now: everything
            // typed reached the agent when it was typed, so there is nothing
            // left here for a cancel to decide the fate of.
            if (outcome.success === "cancelled") {
              publish(transcript.add("notice", "cancelled"))
            }
            // A turn that came back is the proof that whatever went wrong
            // before has stopped being true. Leaving the banner up after it
            // would make the panel report a state it can see it is not in.
            if (current) move({ status: "idle", trouble: null })
          }).pipe(
            Effect.ensuring(Effect.sync(() => {
              if (turn === ticket) turn = null
            })),
          ),
        )
        ticket.fiber = running
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
      const asked = turn
      yield* Effect.mapError(agent.cancel, asFailure)
      if (asked === null) return
      // Written on the TICKET, and after the cancel is on the wire rather than
      // before, because a cancel that could not be delivered stopped nothing.
      // What reads it is a steer still in flight against this same turn: it is
      // about to come back "nothing to steer", and this is the only thing that
      // says the reason was a person rather than the turn finishing. It
      // outlives the turn, which is the point — by then the ticket is all that
      // is left of it.
      asked.stopped = true
      const quietSince = heard
      yield* Effect.forkDetach(Effect.gen(function*() {
        yield* Effect.sleep(CANCEL_GRACE)
        // A DIFFERENT turn is a turn that ended and was replaced, which is the
        // cancel having worked; `null` is the same. Comparing the ticket rather
        // than the status is what makes the second press of the button about
        // the turn it was pressed for.
        if (turn !== asked) return
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
      Effect.gen(function*() {
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
        yield* deliver(id, prompt)
      })

    /** Move to another conversation. The `done` frame of a cancelled turn
     *  follows on its own — the agent decides how a turn ended, and a cancel
     *  that raced the end of one must not claim otherwise. */
    const changeSession = (
      what: Effect.Effect<void, AcpAgent.AgentGone>,
    ): Effect.Effect<void, OpFailure> =>
      switching.withPermit(
        Effect.gen(function*() {
          if (turn !== null) {
            return yield* new BusyFailure({
              reason: "a turn is running; cancel it before switching conversations",
            })
          }
          // The pictures went with it. They exist so that a prompt in THIS
          // conversation can name them, and no prompt in the next one will.
          yield* files.discard
          move({ status: "booting" })
          const outcome = yield* Effect.result(what)
          if (outcome._tag === "Failure") {
            move({ status: "gone", trouble: outcome.failure.message })
            return yield* asFailure(outcome.failure)
          }
          move({ status: "idle" })
        }),
      )

    return {
      entries: () => transcript.entries(),
      state: () => state,
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
      newSession: changeSession(agent.newSession),
      loadSession: (id: string) => changeSession(agent.loadSession(id)),
      sessions: Effect.catch(
        Effect.map(agent.sessions, (stored) =>
          stored.map((entry): SessionInfo => ({
            id: entry.id,
            title: entry.title,
            updatedAt: entry.updatedAt,
          }))),
        (gone) => Effect.fail(asFailure(gone)),
      ),
      answer: (id, answers) =>
        Effect.flatMap(
          agent.answer(id, answers),
          (took) =>
            took ? Effect.void : Effect.fail(
              new UsageFailure({
                reason: "that question is not waiting any more — it was answered or withdrawn",
              }),
            ),
        ),

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
            const outcome = yield* Effect.result(agent.boot)
            if (outcome._tag === "Failure") {
              // A warning rather than an error: the panel is already showing
              // this, and the next prompt retries the boot exactly as a crash
              // does. Nothing has stopped.
              yield* Effect.logWarning(outcome.failure.message)
              move({ status: "gone", trouble: outcome.failure.message })
              return
            }
            move({ status: "idle" })
          }),
        )
      }),
      stop: Effect.gen(function*() {
        const running = turn?.fiber ?? null
        turn = null
        if (running !== null) yield* Fiber.interrupt(running)
        yield* agent.stop
        // Registered as a finalizer of the serve scope, so this is also what
        // takes the pasted pictures with the server when it shuts down. Behind
        // the same permit as everything else that touches the directory: a
        // chunk still being written is a write into a directory this line is
        // about to remove.
        yield* switching.withPermit(files.discard)
      }),
    }
  })
