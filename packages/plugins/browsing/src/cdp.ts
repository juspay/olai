/**
 * A SMALL CHROME DEVTOOLS PROTOCOL CLIENT — olai's own connection to the
 * browser it launched, flattened sessions over it, and nothing else.
 *
 * olai's server never takes a Playwright dependency: the agents already have
 * Playwright, in their own MCP processes, and what the person's pane needs is
 * a dozen CDP verbs and a few events. So the protocol is spoken here and the
 * framing is pure functions a unit test can hold without a browser.
 *
 * ## Over Chromium's DevTools PIPE, not its websocket
 *
 * Chromium is launched with `--remote-debugging-pipe` beside its port: it
 * reads calls on its fd 3 and writes answers and events on its fd 4, each
 * message ended by a NUL. The websocket port is for the agents' MCPs; olai
 * holds the pipe because the pipe is what ties the browser's life to olai's.
 * When olai goes — stopped, crashed or SIGKILLed — the pipe's far end closes
 * and Chromium shuts itself and every helper down. A browser olai cannot see
 * any more, still holding the person's profile, is the one failure a scope
 * finalizer alone cannot prevent.
 *
 * ONE CONNECTION PER LAUNCH, OWNED BY THE SCOPE THAT OPENED IT. Every tab the
 * pane drives is reached through `Target.attachToTarget({ flatten: true })`
 * on this same pipe, so a call names its session. A call still in the air when
 * the connection goes answers with the closure as its failure, never a hang.
 */
import { Data, Effect, type Scope } from "effect"
import type { Readable, Writable } from "node:stream"

/** The browser refused a call, or the connection is gone — in a sentence. */
export class CdpFailure extends Data.TaggedError("CdpFailure")<{ readonly why: string }> {
  override get message(): string {
    return this.why
  }
}

/** One call as the wire carries it. */
export interface CdpCall {
  readonly id: number
  readonly method: string
  readonly params: Record<string, unknown>
  readonly sessionId?: string
}

/** What one incoming message is: the answer to a call, or an event. Anything
 *  else on the pipe is not this protocol and is refused by name. */
export type CdpMessage =
  | { readonly _tag: "answer"; readonly id: number; readonly result: Record<string, unknown> }
  | { readonly _tag: "refusal"; readonly id: number; readonly why: string }
  | { readonly _tag: "event"; readonly method: string; readonly params: Record<string, unknown>; readonly sessionId: string | null }

/** The pipe's frame terminator. */
export const NUL = "\0"

export const encodeCall = (call: CdpCall): string => JSON.stringify(
  call.sessionId === undefined ? { id: call.id, method: call.method, params: call.params } : call,
) + NUL

/** Split what has arrived into whole messages and the unfinished rest. A
 *  frame may arrive in pieces and several may arrive together. */
export const framesOf = (buffer: string): { readonly frames: ReadonlyArray<string>; readonly rest: string } => {
  const parts = buffer.split(NUL)
  const rest = parts.pop() ?? ""
  return { frames: parts.filter((part) => part !== ""), rest }
}

export const decodeMessage = (text: string): CdpMessage => {
  const frame = JSON.parse(text) as Record<string, unknown> | null
  if (frame === null || typeof frame !== "object" || Array.isArray(frame)) throw new Error("a CDP frame is an object")
  if (typeof frame["id"] === "number") {
    const error = frame["error"] as { readonly message?: unknown } | undefined
    if (error !== undefined) {
      return { _tag: "refusal", id: frame["id"], why: typeof error.message === "string" ? error.message : JSON.stringify(error) }
    }
    return { _tag: "answer", id: frame["id"], result: (frame["result"] ?? {}) as Record<string, unknown> }
  }
  if (typeof frame["method"] === "string") {
    return {
      _tag: "event",
      method: frame["method"],
      params: (frame["params"] ?? {}) as Record<string, unknown>,
      sessionId: typeof frame["sessionId"] === "string" ? frame["sessionId"] : null,
    }
  }
  throw new Error("a CDP frame is an answer or an event")
}

/** One event, as a listener is handed it. */
export interface CdpEvent {
  readonly method: string
  readonly params: Record<string, unknown>
  readonly sessionId: string | null
}

export interface Cdp {
  /** Call one method, on the browser or on a flattened session. */
  readonly send: (
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ) => Effect.Effect<Record<string, unknown>, CdpFailure>
  /** Listen to every event for as long as the calling scope stands. A
   *  listener that throws is contained here, so one bad handler cannot take
   *  the connection or its neighbours down. */
  readonly listen: (listener: (event: CdpEvent) => void) => Effect.Effect<void, never, Scope.Scope>
  /** Settles when the connection is gone, by either side. */
  readonly closed: Effect.Effect<void>
}

/** The two ends of Chromium's DevTools pipe, as olai holds them: what olai
 *  writes (Chromium's fd 3) and what olai reads (Chromium's fd 4). */
export interface DevToolsPipe {
  readonly calls: Writable
  readonly answers: Readable
}

/** Speak CDP over the pipe for as long as the calling scope stands. Closing
 *  the scope ends olai's side of the pipe, which is also Chromium's cue to
 *  shut down if nothing else has stopped it first. */
export const openCdp = (pipe: DevToolsPipe): Effect.Effect<Cdp, never, Scope.Scope> =>
  Effect.gen(function*() {
    let next = 0
    let gone: string | null = null
    let buffer = ""
    const pending = new Map<number, (outcome: Effect.Effect<Record<string, unknown>, CdpFailure>) => void>()
    const listeners = new Set<(event: CdpEvent) => void>()
    const ended: Array<() => void> = []
    const end = (why: string) => {
      if (gone !== null) return
      gone = why
      for (const settle of pending.values()) settle(Effect.fail(new CdpFailure({ why })))
      pending.clear()
      for (const done of ended.splice(0)) done()
    }
    const onData = (chunk: Buffer | string) => {
      const framed = framesOf(buffer + String(chunk))
      buffer = framed.rest
      for (const text of framed.frames) {
        let message: CdpMessage
        try {
          message = decodeMessage(text)
        } catch (cause) {
          end(`the browser spoke something other than CDP: ${String(cause)}`)
          return
        }
        if (message._tag === "event") {
          for (const listener of listeners) {
            try { listener(message) } catch { /* contained: see `listen` */ }
          }
          continue
        }
        const settle = pending.get(message.id)
        pending.delete(message.id)
        settle?.(message._tag === "answer" ? Effect.succeed(message.result) : Effect.fail(new CdpFailure({ why: message.why })))
      }
    }
    const onEnd = () => end("the browser's DevTools pipe closed")
    const onError = (cause: unknown) => end(`the browser's DevTools pipe failed: ${String(cause)}`)
    yield* Effect.acquireRelease(
      Effect.sync(() => {
        pipe.answers.setEncoding("utf8")
        pipe.answers.on("data", onData)
        pipe.answers.on("end", onEnd)
        pipe.answers.on("close", onEnd)
        pipe.answers.on("error", onError)
        pipe.calls.on("error", onError)
      }),
      () => Effect.sync(() => {
        pipe.answers.off("data", onData)
        pipe.answers.off("end", onEnd)
        pipe.answers.off("close", onEnd)
        pipe.answers.off("error", onError)
        end("the browser's DevTools connection was closed by olai")
        pipe.calls.end()
      }),
    )

    const send: Cdp["send"] = (method, params = {}, sessionId) => Effect.callback((resume) => {
      if (gone !== null) {
        resume(Effect.fail(new CdpFailure({ why: gone })))
        return
      }
      const id = ++next
      pending.set(id, resume)
      pipe.calls.write(encodeCall({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }))
      return Effect.sync(() => { pending.delete(id) })
    })
    const listen: Cdp["listen"] = (listener) => Effect.acquireRelease(
      Effect.sync(() => { listeners.add(listener) }),
      () => Effect.sync(() => { listeners.delete(listener) }),
    )
    const closed: Effect.Effect<void> = Effect.callback<void>((resume) => {
      if (gone !== null) resume(Effect.void)
      else ended.push(() => resume(Effect.void))
    })
    return { send, listen, closed }
  })
