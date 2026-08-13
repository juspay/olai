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
 * Three decisions worth naming:
 *
 *   - **a turn is accepted, not awaited.** `send` answers the moment the prompt
 *     is on the wire; what happens next arrives on the transcript, so every open
 *     tab stays in step and a five-minute turn is not a five-minute call. The
 *     turn runs on its own fiber, and the `thinking` state is what says so.
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
  type OpFailure,
  type SessionInfo,
} from "@olai/surface"
import { BusyFailure, UsageFailure } from "@olai/format"
import { Effect, Fiber, Semaphore } from "effect"

import type { Adapter } from "./adapter.ts"
import * as AcpAgent from "./agent.ts"
import * as Attachments from "./attachments.ts"
import type { AgentEvent } from "./events.ts"
import { type Change, Transcript } from "./transcript.ts"

export type { ToolServer } from "./agent.ts"

export interface Options {
  /** Which agent to start, already resolved from the environment
   *  ({@link ./adapter.ts}). Resolving it is the caller's move — it is the
   *  caller who knows there is a `--no-agent` flag or an env var — and what a
   *  resolved one looks like is ours. */
  readonly adapter: Adapter
  /** Where to start it: the served directory, exactly. An agent keys its
   *  stored sessions by the directory it was started in, and that is what
   *  makes "the conversation you were last in" survive a restart. */
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
  /** Prompt the agent with what was typed, and with the pictures already
   *  attached to this conversation — by the paths {@link Chat.attach}
   *  answered with, which are re-checked here before any of them reaches a
   *  prompt. */
  readonly send: (
    text: string,
    attachments: ReadonlyArray<string>,
  ) => Effect.Effect<void, OpFailure>
  /** One chunk of a picture into the conversation's own tmp directory,
   *  answering with where the whole file is and what it is called there. See
   *  {@link ./attachments.ts}. */
  readonly attach: (
    chunk: AttachChunk,
  ) => Effect.Effect<Attached, OpFailure>
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
    /** The turn in flight, so a second `send` knows to queue behind it and a
     *  cancel has something to aim at. */
    let turn: Fiber.Fiber<unknown, unknown> | null = null
    /** Typed while a turn was running, in the order it was typed. Drained by
     *  the turn's own fiber as it ends — see {@link begin}. */
    const queue: Array<string> = []
    /** One session change at a time: a load and a new-session racing each other
     *  would leave the transcript holding half of each. */
    const switching = yield* Semaphore.make(1)
    /** Everything the agent has said, counted. See {@link receive}. */
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
      // How much this agent has said, ever. Read by {@link cancel} and by
      // nothing else: what it needs is not a count but a CHANGE, and a
      // monotonic counter answers "has anything arrived since I looked" with
      // no clock to read and nothing to reset.
      heard++
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
            }),
          )
          return
        case "asked":
          publish(transcript.ask(event.id, event.message, event.fields))
          move({ asking: asking() })
          return
        case "askSettled":
          publish(transcript.settleAsk(event.id, event.outcome))
          move({ asking: asking() })
          return
        case "commands":
          move({ commands: event.commands })
          return
        case "model":
          move({ model: event.name })
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
          move({ session: null, commands: [], asking: asking() })
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
     * Send, or QUEUE — and which one is not the sender's problem.
     *
     * An agent holds the floor for minutes at a time, and a person watching it
     * work thinks of the next thing well before it is finished. Refusing that
     * message made them hold it in their head and come back; the panel even
     * turned the box off while it did, so the thought had nowhere to go at all.
     * Everything typed is accepted, in the order it was typed, and the turns
     * run one after another.
     *
     * A queued message is a ROW the moment it is sent — it is what was said,
     * and the order is the order it will be asked in. What the count on the
     * state adds is only that the agent has not reached it yet, which is a fact
     * about the agent rather than about the message.
     */
    const send = (
      text: string,
      attachments: ReadonlyArray<string>,
    ): Effect.Effect<void, OpFailure> =>
      Effect.gen(function*() {
        const said = text.trim()
        // A picture on its own IS a message — "what is this" with a
        // screenshot under it is the usual way of asking — so an empty box is
        // only empty when nothing is attached to it either.
        if (said === "" && attachments.length === 0) {
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
        publish(
          transcript.add(
            "user",
            said,
            attachments.length === 0
              ? {}
              : { attachments: attachments.map(Attachments.nameOf) },
          ),
        )

        const prompt = Attachments.promptWith(said, attachments)
        if (turn !== null) {
          queue.push(prompt)
          move({ queued: queue.length, trouble: null })
          return
        }
        yield* begin(prompt)
      })

    /** Run one prompt as a turn, and take the next one waiting when it ends.
     *
     *  Accepted, not awaited: the turn runs on its own fiber and reports
     *  through the transcript, so a five-minute turn is not a five-minute
     *  call. The queue is drained from INSIDE that fiber, which is what makes
     *  "one turn at a time" true without anything having to poll for it. */
    const begin = (prompt: string): Effect.Effect<void> =>
      Effect.gen(function*() {
        move({ status: "thinking", trouble: null, queued: queue.length })

        const running = yield* Effect.forkDetach(
          Effect.gen(function*() {
            const outcome = yield* Effect.result(agent.prompt(prompt))
            publish(transcript.settle())
            if (outcome._tag === "Failure") {
              // The agent is not there, so the queue is not going anywhere
              // either. Saying how many were dropped beats leaving them to be
              // sent by whatever comes back.
              dropQueue("the agent stopped")
              publish(transcript.add("notice", outcome.failure.message))
              move({ status: "gone", trouble: outcome.failure.message })
              return
            }
            if (outcome.success === "cancelled") {
              // Cancelling means stop, and a queue that carried on afterwards
              // would be the panel deciding it knew better.
              dropQueue("cancelled")
              publish(transcript.add("notice", "cancelled"))
            }
            // A turn that came back is the proof that whatever went wrong
            // before has stopped being true. Leaving the banner up after it
            // would make the panel report a state it can see it is not in.
            move({ status: "idle", trouble: null })
          }).pipe(
            Effect.ensuring(Effect.sync(() => {
              turn = null
            })),
            // AFTER the fiber's own `ensuring`, so `turn` is already null and
            // the next `begin` is starting from the same state a fresh one
            // would. Recursion, one turn deep at a time.
            Effect.andThen(Effect.suspend(() => {
              const next = queue.shift()
              return next === undefined
                ? Effect.sync(() => move({ queued: 0 }))
                : begin(next)
            })),
          ),
        )
        turn = running
      })

    /**
     * Stop the turn — and say so when it DOES NOT STOP.
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
      const quietSince = heard
      yield* Effect.forkDetach(Effect.gen(function*() {
        yield* Effect.sleep(CANCEL_GRACE)
        // A DIFFERENT turn is a turn that ended and was replaced, which is the
        // cancel having worked; `null` is the same. Comparing the fiber rather
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

    /** Forget what is waiting, and say so. Called wherever the thing they were
     *  queued behind has stopped meaning what it meant. */
    const dropQueue = (why: string): void => {
      if (queue.length === 0) return
      const dropped = queue.length
      queue.length = 0
      publish(
        transcript.add(
          "notice",
          `${dropped} queued message${dropped === 1 ? "" : "s"} dropped — ${why}`,
        ),
      )
      move({ queued: 0 })
    }

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
          dropQueue("this conversation is being left")
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
        const running = turn
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
