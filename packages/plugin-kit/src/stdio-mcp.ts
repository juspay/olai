/** Stateless stdio MCP interrogation. Each caller owns its child through Scope.
 * Tool requirements and user-facing sentences remain with the caller. */
import { spawn, type ChildProcess } from "node:child_process"
import { Effect, type Scope } from "effect"
import { frame, parse, step, type Evidence, type Exchange } from "./stdio-mcp-protocol.ts"

const PROTOCOL = "2025-06-18"

export type Verdict = Evidence & { readonly stderr: string }

/** Interrogate a child using newline-delimited JSON-RPC, including pagination. */
const askOver = async (child: ChildProcess, deadlineMs: number, signal?: AbortSignal): Promise<Verdict> => {
  const { stdout } = child
  if (child.stdin === null || stdout === null) {
    return { _tag: "couldNotStart", cause: "the child has no pipes to speak on", stderr: "" }
  }
  return await new Promise<Verdict>((resolve) => {
    let buffer = ""
    let stderr = ""
    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-8 * 1024) })
    let done = false
    let state: Exchange = { initialized: false, tools: [] }
    const finish = (verdict: Evidence): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
      resolve({ ...verdict, stderr })
    }
    const abort = (): void => finish({ _tag: "closed" })
    signal?.addEventListener("abort", abort, { once: true })
    const timer = setTimeout(() => finish({ _tag: "timedOut", deadlineMs }), deadlineMs)
    const send = (message: Record<string, unknown>): void => {
      try {
        child.stdin?.write(JSON.stringify(message) + "\n")
      } catch (thrown) {
        finish({ _tag: "failed", cause: String(thrown) })
      }
    }
    child.on("error", (thrown) => finish({ _tag: "couldNotStart", cause: String(thrown) }))
    child.stdin?.on("error", (thrown) => finish({ _tag: "failed", cause: String(thrown) }))
    stdout.on("error", (thrown) => finish({ _tag: "failed", cause: String(thrown) }))
    child.on("close", () => finish({ _tag: "closed" }))
    stdout.setEncoding("utf8")
    stdout.on("data", (chunk: string) => {
      if (done) return
      const framed = frame(buffer, chunk)
      if ("error" in framed) { finish({ _tag: "failed", cause: framed.error }); return }
      buffer = framed.rest
      for (const line of framed.lines) {
        const parsed = parse(line)
        if ("error" in parsed) { finish({ _tag: "failed", cause: parsed.error }); return }
        const next = step(state, parsed.message)
        state = next.state
        for (const message of next.send) send(message)
        if (next.answer !== undefined) { finish(next.answer); return }
      }
    })
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: "olai", version: "0.1.0" },
      },
    })
  })
}


/** Spawn and register termination atomically. Cancellation aborts the transport
 * wait; closing the caller's scope kills and joins the disposable child. */
export const askStdioMcp = (options: {
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly env?: Record<string, string | undefined>
  readonly timeout: number
}): Effect.Effect<Verdict, never, Scope.Scope> => Effect.gen(function*() {
  const child = yield* Effect.acquireRelease(
    // Only an exception from spawn is evidence that the OS could not start
    // the child. A defect in our interrogation is not an executable diagnosis.
    Effect.try({
      try: () => spawn(options.command, [...options.args], {
        stdio: ["pipe", "pipe", "pipe"], ...(options.env === undefined ? {} : { env: options.env }),
      }),
      catch: cause => ({ _tag: "couldNotStart" as const, cause: String(cause), stderr: "" }),
    }),
    child => Effect.promise(() => new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) { resolve(); return }
      child.once("close", () => resolve())
      // This child only answers a disposable capability question. It has no
      // user work to flush; SIGTERM grace would let a wedged peer delay every
      // withdrawal. SIGKILL plus close joins it before the owner releases.
      child.kill("SIGKILL")
    })),
  )
  return yield* Effect.promise(signal => askOver(child, options.timeout, signal))
}).pipe(Effect.catch(verdict => Effect.succeed(verdict)))

/** One `tools/call` result, verbatim, or the reason there is none. */
export type Called =
  | { readonly _tag: "called"; readonly results: ReadonlyArray<Record<string, unknown>>; readonly stderr: string }
  | { readonly _tag: "failed"; readonly cause: string; readonly stderr: string }

/**
 * ...AND ONE SCRIPTED SESSION: initialize, then call each tool in order and
 * hand back every result. The interrogation's sibling, for a caller that has
 * to see a server DO something rather than list what it could — a check or a
 * scenario driving the real Playwright MCP. The child is scoped exactly as
 * {@link askStdioMcp}'s is; a result the peer marks `isError` fails the run
 * with its own text, because a call that did not happen is not a result.
 */
export const callStdioMcp = (options: {
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly env?: Record<string, string | undefined>
  readonly timeout: number
  readonly calls: ReadonlyArray<{ readonly name: string; readonly arguments: Record<string, unknown> }>
}): Effect.Effect<Called, never, Scope.Scope> => Effect.gen(function*() {
  const child = yield* Effect.acquireRelease(
    Effect.sync(() => spawn(options.command, [...options.args], {
      stdio: ["pipe", "pipe", "pipe"], ...(options.env === undefined ? {} : { env: options.env }),
    })),
    child => Effect.promise(() => new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) { resolve(); return }
      child.once("close", () => resolve())
      child.stdin?.end()
      child.kill("SIGTERM")
    })),
  )
  return yield* Effect.promise(signal => new Promise<Called>((resolve) => {
    let stderr = ""
    let buffer = ""
    let done = false
    const results: Array<Record<string, unknown>> = []
    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-8 * 1024) })
    const finish = (outcome: { readonly _tag: "called" } | { readonly _tag: "failed"; readonly cause: string }) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(outcome._tag === "called" ? { _tag: "called", results, stderr } : { ...outcome, stderr })
    }
    const timer = setTimeout(() => finish({ _tag: "failed", cause: `no answer within ${options.timeout / 1000} seconds` }), options.timeout)
    signal.addEventListener("abort", () => finish({ _tag: "failed", cause: "interrupted" }), { once: true })
    const send = (message: Record<string, unknown>) => child.stdin?.write(JSON.stringify(message) + "\n")
    const callNext = () => {
      const index = results.length
      const call = options.calls[index]
      if (call === undefined) { finish({ _tag: "called" }); return }
      send({ jsonrpc: "2.0", id: 2 + index, method: "tools/call", params: { name: call.name, arguments: call.arguments } })
    }
    child.on("error", (thrown) => finish({ _tag: "failed", cause: String(thrown) }))
    child.on("close", () => finish({ _tag: "failed", cause: "the server closed before answering every call" }))
    child.stdout?.setEncoding("utf8")
    child.stdout?.on("data", (chunk: string) => {
      const framed = frame(buffer, chunk)
      if ("error" in framed) { finish({ _tag: "failed", cause: framed.error }); return }
      buffer = framed.rest
      for (const line of framed.lines) {
        const parsed = parse(line)
        if ("error" in parsed) { finish({ _tag: "failed", cause: parsed.error }); return }
        const message = parsed.message
        if (message["id"] === undefined) continue
        if (message["error"] !== undefined) { finish({ _tag: "failed", cause: JSON.stringify(message["error"]) }); return }
        const result = (message["result"] ?? {}) as Record<string, unknown>
        if (message["id"] === 1) {
          send({ jsonrpc: "2.0", method: "notifications/initialized" })
          callNext()
          continue
        }
        if (result["isError"] === true) { finish({ _tag: "failed", cause: JSON.stringify(result["content"]) }); return }
        results.push(result)
        callNext()
      }
    })
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "olai", version: "0.1.0" } },
    })
  }))
})
