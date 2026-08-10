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
 * Two decisions worth naming:
 *
 *   - **a turn is accepted, not awaited.** `send` answers the moment the prompt
 *     is on the wire; what happens next arrives on the transcript, so every open
 *     tab stays in step and a five-minute turn is not a five-minute call. The
 *     turn runs on its own fiber, and the `thinking` state is what says so.
 *   - **the refusals the ops layer produces are OURS to render.** The agent gets
 *     the structured detail in its tool result, but what it then says about it
 *     is prose. So the MCP layer tells us about every refusal and it lands in
 *     the transcript as data — which is what makes "a refused write shows its
 *     unfinished children in chat" true regardless of how the agent phrases it.
 */

import { CHAT_OFF, type ChatEntry, type ChatState, type OpFailure, type SessionInfo } from "@olai/surface"
import { BusyFailure, UsageFailure } from "@olai/format"
import { Effect, Fiber, Semaphore } from "effect"

import type { Adapter } from "./adapter.ts"
import * as AcpAgent from "./agent.ts"
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
  readonly log: (message: string) => void
}

export interface Chat {
  /** The transcript as it stands — what a fresh subscription is seeded with. */
  readonly entries: () => ReadonlyMap<string, ChatEntry>
  readonly state: () => ChatState
  readonly send: (text: string) => Effect.Effect<void, OpFailure>
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
        log: options.log,
      })

    const transcript = new Transcript()
    // The cell's own default, with the one field that differs: an agent is
    // being started. Restating the other four here would be a second place to
    // remember when the state gains a fifth.
    let state: ChatState = { ...CHAT_OFF, status: "booting" }
    /** The turn in flight, so a second `send` can be refused rather than
     *  queued and a cancel has something to aim at. */
    let turn: Fiber.Fiber<unknown, unknown> | null = null
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
          // A NEW conversation keeps the history and says where the break is:
          // within one server's life the panel is a log, and throwing away what
          // you were just reading because you asked for a fresh context is a
          // cost with nothing bought by it. A LOAD is different — the replay
          // that follows replaces the transcript, because a transcript of a
          // conversation you are not in IS a lie — and a dead agent leaves
          // everything where it is, with the `gone` notice to explain it.
          if (event.why === "new") publish(transcript.mark("new conversation"))
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

    const send = (text: string): Effect.Effect<void, OpFailure> =>
      Effect.gen(function*() {
        const prompt = text.trim()
        if (prompt === "") {
          return yield* new UsageFailure({ reason: "there is nothing to send" })
        }
        if (turn !== null) {
          return yield* new BusyFailure({
            reason: "the agent is still working on the last message",
          })
        }

        // The user's own message goes in FIRST and from the server, so both
        // tabs see it and a send that fails does not leave one behind.
        publish(transcript.add("user", prompt))
        move({ status: "thinking", trouble: null })

        // Accepted, not awaited: the turn runs on its own fiber and reports
        // through the transcript.
        const running = yield* Effect.forkDetach(
          Effect.gen(function*() {
            const outcome = yield* Effect.result(agent.prompt(prompt))
            publish(transcript.settle())
            if (outcome._tag === "Failure") {
              publish(transcript.add("notice", outcome.failure.message))
              move({ status: "gone", trouble: outcome.failure.message })
              return
            }
            if (outcome.success === "cancelled") {
              publish(transcript.add("notice", "cancelled"))
            }
            // A turn that came back is the proof that whatever went wrong
            // before has stopped being true. Leaving the banner up after it
            // would make the panel report a state it can see it is not in.
            move({ status: "idle", trouble: null })
          }).pipe(Effect.ensuring(Effect.sync(() => {
            turn = null
          }))),
        )
        turn = running
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
              options.log(`chat: ${outcome.failure.message}`)
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
      }),
    }
  })
