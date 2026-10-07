/**
 * A SMALL CHROME DEVTOOLS PROTOCOL CLIENT — one websocket to the browser,
 * flattened sessions over it, and nothing else.
 *
 * olai's server never takes a Playwright dependency: the agents already have
 * Playwright, in their own MCP processes, and what the person's pane needs is
 * a dozen CDP verbs and four events. So the wire is spoken here, over `ws`,
 * and the framing is pure functions a unit test can hold without a browser.
 *
 * ONE CONNECTION PER BROWSER, OWNED BY THE SCOPE THAT OPENED IT. Every target
 * the pane drives is reached through `Target.attachToTarget({ flatten: true })`
 * on this same socket, so a call names its session rather than opening a
 * socket per tab, and closing the scope closes them all at once. A call still
 * in the air when the socket goes answers with the closure as its failure,
 * never a hang.
 */
import { Data, Effect, type Scope } from "effect"
import WebSocket from "ws"

/** The browser refused a call, or the connection is gone — in a sentence. */
export class CdpFailure extends Data.TaggedError("CdpFailure")<{ readonly why: string }> {
  override get message(): string {
    return this.why
  }
}

/** One frame as the wire carries it, in whichever direction. */
export interface CdpCall {
  readonly id: number
  readonly method: string
  readonly params: Record<string, unknown>
  readonly sessionId?: string
}

/** What one incoming frame is: the answer to a call, or an event. Anything
 *  else on the socket is not this protocol and is refused by name. */
export type CdpMessage =
  | { readonly _tag: "answer"; readonly id: number; readonly result: Record<string, unknown> }
  | { readonly _tag: "refusal"; readonly id: number; readonly why: string }
  | { readonly _tag: "event"; readonly method: string; readonly params: Record<string, unknown>; readonly sessionId: string | null }

export const encodeCall = (call: CdpCall): string => JSON.stringify(
  call.sessionId === undefined ? { id: call.id, method: call.method, params: call.params } : call,
)

export const decodeMessage = (text: string): CdpMessage => {
  const frame = JSON.parse(text) as Record<string, unknown> | null
  if (frame === null || typeof frame !== "object") throw new Error("a CDP frame is an object")
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

/**
 * Dial the browser's websocket for as long as the calling scope stands.
 *
 * `maxPayload` is lifted to the frame cap the surface carries, not `ws`'s
 * default: a screencast frame is the large message here and must never be the
 * one that kills the connection.
 */
export const openCdp = (url: string, maxPayload = 32 * 1024 * 1024): Effect.Effect<Cdp, CdpFailure, Scope.Scope> =>
  Effect.gen(function*() {
    const socket = yield* Effect.acquireRelease(
      Effect.callback<WebSocket, CdpFailure>((resume) => {
        const socket = new WebSocket(url, { maxPayload, perMessageDeflate: false })
        const failed = (cause: unknown) => resume(Effect.fail(new CdpFailure({ why: `the browser's DevTools socket would not open: ${String(cause)}` })))
        socket.once("error", failed)
        socket.once("open", () => {
          socket.off("error", failed)
          resume(Effect.succeed(socket))
        })
        return Effect.sync(() => socket.terminate())
      }),
      (socket) => Effect.sync(() => socket.close()),
    )
    let next = 0
    let gone: string | null = null
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
    socket.on("message", (data) => {
      let message: CdpMessage
      try {
        message = decodeMessage(String(data))
      } catch (cause) {
        end(`the browser spoke something other than CDP: ${String(cause)}`)
        socket.terminate()
        return
      }
      if (message._tag === "event") {
        for (const listener of listeners) {
          try { listener(message) } catch { /* contained: see `listen` */ }
        }
        return
      }
      const settle = pending.get(message.id)
      pending.delete(message.id)
      settle?.(message._tag === "answer" ? Effect.succeed(message.result) : Effect.fail(new CdpFailure({ why: message.why })))
    })
    socket.on("close", () => end("the browser's DevTools connection closed"))
    socket.on("error", (cause) => end(`the browser's DevTools connection failed: ${String(cause)}`))

    const send: Cdp["send"] = (method, params = {}, sessionId) => Effect.callback((resume) => {
      if (gone !== null) {
        resume(Effect.fail(new CdpFailure({ why: gone })))
        return
      }
      const id = ++next
      pending.set(id, resume)
      socket.send(encodeCall({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }))
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
