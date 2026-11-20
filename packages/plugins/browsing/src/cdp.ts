/**
 * Chromium's DevTools pipe (`--remote-debugging-pipe`): it reads calls on its
 * fd 3 and writes answers and events on its fd 4, each message ended by a NUL.
 * The pipe's far end closing is also Chromium's cue to shut itself and every
 * helper down.
 */
import { Data, Effect, type Scope } from "effect"
import type { Readable, Writable } from "node:stream"

export class CdpFailure extends Data.TaggedError("CdpFailure")<{ readonly why: string }> {
  override get message(): string {
    return this.why
  }
}

export interface CdpCall {
  readonly id: number
  readonly method: string
  readonly params: Record<string, unknown>
  readonly sessionId?: string
}

export type CdpMessage =
  | { readonly _tag: "answer"; readonly id: number; readonly result: Record<string, unknown> }
  | { readonly _tag: "refusal"; readonly id: number; readonly why: string }
  | { readonly _tag: "event"; readonly method: string; readonly params: Record<string, unknown>; readonly sessionId: string | null }

export const NUL = "\0"

export const encodeCall = (call: CdpCall): string => JSON.stringify(
  call.sessionId === undefined ? { id: call.id, method: call.method, params: call.params } : call,
) + NUL

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

export interface CdpEvent {
  readonly method: string
  readonly params: Record<string, unknown>
  readonly sessionId: string | null
}

export interface Cdp {
  readonly send: (
    method: string,
    params?: Record<string, unknown>,
    sessionId?: string,
  ) => Effect.Effect<Record<string, unknown>, CdpFailure>
  readonly listen: (listener: (event: CdpEvent) => void) => Effect.Effect<void, never, Scope.Scope>
  readonly closed: Effect.Effect<void>
}

export interface DevToolsPipe {
  readonly calls: Writable
  readonly answers: Readable
}

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
            try { listener(message) } catch { }
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
