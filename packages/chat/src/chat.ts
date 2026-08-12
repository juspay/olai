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

    const publish = (change: Change) => {
      if (change.upserts.length === 0 && change.removes.length === 0) return
      options.onTranscript(change)
    }

    const move = (next: Partial<ChatState>) => {
      state = { ...state, ...next }
      options.onState(state)
    }

    /** The agent's events, as rows and as state. The one place the vocabulary
     *  of {@link ./events.ts} is consumed. */
    const receive = (event: AgentEvent): void => {
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
              locations: event.locations,
            }),
          )
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
          move({ session: null, commands: [] })
          return
        case "replayStarted":
          publish(transcript.clear())
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
      cancel: agent.cancel,
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
