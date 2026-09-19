/** Stateless stdio MCP interrogation. Each caller owns its child through Scope.
 * Tool requirements and user-facing sentences remain with the caller. */
import { spawn, type ChildProcess } from "node:child_process"
import { Effect, type Scope } from "effect"
const PROTOCOL = "2025-06-18"

/** The answer and all four failure modes travel one channel. Callers own
 * judgement and sentences, so transport failure never throws through a session
 * opening. Stderr is evidence, capped separately from the protocol stream. */
type Evidence =
  | {
    /** Names and input property keys, for the caller to judge. */
    readonly _tag: "answered"
    readonly tools: ReadonlyArray<{ readonly name: string; readonly inputs: ReadonlyArray<string> }>
  }
  /** The OS would not start it — the spawn call raised. */
  | { readonly _tag: "couldNotStart"; readonly cause: string }
  /** It never reached either answer inside the deadline. */
  | { readonly _tag: "timedOut"; readonly deadlineMs: number }
  /** Its pipes went away with no answer on them. */
  | { readonly _tag: "closed" }
  /** Writing to it, or parsing what came back, failed. */
  | { readonly _tag: "failed"; readonly cause: string }

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
    let initialized = false
    const tools: Array<{ name: string; inputs: ReadonlyArray<string> }> = []
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
      buffer += chunk
      // A broken peer must not grow memory forever without emitting a newline.
      if (buffer.length > 4 * 1024 * 1024) {
        finish({ _tag: "failed", cause: "MCP response exceeds 4 MiB" })
        return
      }
      for (;;) {
        const at = buffer.indexOf("\n")
        if (at === -1) return
        const line = buffer.slice(0, at).trim()
        buffer = buffer.slice(at + 1)
        if (line === "") continue
        let message: Record<string, unknown>
        try {
          message = JSON.parse(line) as Record<string, unknown>
        } catch (thrown) {
          finish({ _tag: "failed", cause: `a line that is not JSON-RPC: ${String(thrown)}` })
          return
        }
        if (message === null || typeof message !== "object" || Array.isArray(message) || message["jsonrpc"] !== "2.0") {
          finish({ _tag: "failed", cause: "a line that is not JSON-RPC" })
          return
        }
        // Notifications may arrive between either response. They carry no id,
        // require no reply and cannot finish the question we are asking.
        if (message["id"] === undefined) continue
        if (message["error"] !== undefined) {
          finish({ _tag: "failed", cause: JSON.stringify(message["error"]) })
          return
        }
        if (message["id"] === 1) {
          const result = message["result"] as { protocolVersion?: unknown } | null | undefined
          if (initialized || typeof result?.protocolVersion !== "string") {
            finish({ _tag: "failed", cause: "invalid initialize response" })
            return
          }
          initialized = true
          // `initialize` answered: mark the session, ask for the surface.
          send({ jsonrpc: "2.0", method: "notifications/initialized" })
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
          continue
        }
        if (message["id"] === 2) {
          const result = message["result"] as { tools?: Array<Record<string, unknown>>; nextCursor?: string } | undefined
          if (!initialized || !Array.isArray(result?.tools) || result.tools.some(tool => tool === null || typeof tool !== "object" || typeof tool["name"] !== "string"
            || tool["inputSchema"] === null || typeof tool["inputSchema"] !== "object" || Array.isArray(tool["inputSchema"]))) {
            finish({ _tag: "failed", cause: "invalid tools/list response" })
            return
          }
          for (const tool of result.tools) {
            const schema = tool["inputSchema"] as { properties?: Record<string, unknown> } | undefined
            tools.push({
              name: String(tool["name"]),
              inputs: Object.keys(schema?.properties ?? {}),
            })
          }
          // MCP may split its surface across pages. Accumulate every page
          // before judging it; a missing verb may simply be on the next page.
          const again = result?.nextCursor
          if (typeof again === "string" && again !== "") {
            send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: { cursor: again } })
            continue
          }
          finish({ _tag: "answered", tools })
          return
        }
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
