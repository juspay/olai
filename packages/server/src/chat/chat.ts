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

import type { ChatEntry, ChatState, OpFailure, SessionInfo } from "@olai/surface"
import { BusyFailure, NotFoundFailure, UsageFailure } from "@olai/format"
import { Effect, Fiber, Semaphore } from "effect"

import * as AcpAgent from "./agent.ts"
import type { AgentEvent } from "./events.ts"
import { type Change, Transcript } from "./transcript.ts"

export interface Options {
  /** The agent, as a FACTORY over the event handler — because the two are
   *  mutually referential: the agent needs somewhere to send its events, and
   *  the thing that consumes them needs the agent to drive. Handing over a
   *  built agent would mean building it with a handler that does not exist
   *  yet. It is also the test seam: a scripted agent goes in the same slot. */
  readonly agent: (
    onEvent: (event: AgentEvent) => void,
  ) => Effect.Effect<AcpAgent.Agent>
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
    const transcript = new Transcript()
    let state: ChatState = {
      status: "booting",
      session: null,
      model: null,
      commands: [],
      trouble: null,
    }
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
          // The transcript goes with the session: a transcript of a
          // conversation you are not in is a lie.
          publish(transcript.clear())
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

    const agent = yield* options.agent(receive)

    /** An agent failure, as something a caller can render. `busy` rather than a
     *  new vocabulary: the five kinds already say everything a chat verb can
     *  mean. */
    const asFailure = (why: string): OpFailure =>
      new BusyFailure({ reason: why })

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
            move({ status: "idle" })
          }).pipe(Effect.ensuring(Effect.sync(() => {
            turn = null
          }))),
        )
        turn = running
      })

    const cancel = Effect.gen(function*() {
      yield* agent.cancel
      // The `done` frame follows on its own — the agent decides how the turn
      // ended, and a cancel that raced the end of one must not claim otherwise.
    })

    const changeSession = <A>(
      what: Effect.Effect<A, AcpAgent.AgentGone>,
    ): Effect.Effect<A, OpFailure> =>
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
            return yield* asFailure(outcome.failure.message)
          }
          move({ status: "idle" })
          return outcome.success
        }),
      )

    return {
      entries: () => transcript.entries(),
      state: () => state,
      send,
      cancel,
      newSession: Effect.asVoid(changeSession(agent.newSession)),
      loadSession: (id: string) =>
        Effect.asVoid(
          changeSession(
            Effect.catchTag(agent.loadSession(id), "AgentGone", (gone) =>
              Effect.fail(
                new AcpAgent.AgentGone({
                  why: `\`${id}\` could not be opened: ${gone.why}`,
                }),
              )),
          ),
        ),
      sessions: Effect.gen(function*() {
        const outcome = yield* Effect.result(agent.sessions)
        if (outcome._tag === "Failure") {
          return yield* new NotFoundFailure({ reason: outcome.failure.message })
        }
        return outcome.success.map(
          (stored): SessionInfo => ({
            id: stored.id,
            title: stored.title,
            updatedAt: stored.updatedAt,
          }),
        )
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
