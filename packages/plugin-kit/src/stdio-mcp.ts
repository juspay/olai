/** Stateless stdio MCP interrogation. Each caller owns its child through Scope.
 * Tool requirements and user-facing sentences remain with the caller. */
import { spawn, type ChildProcess } from "node:child_process"
import { Effect, type Scope } from "effect"
const PROTOCOL = "2025-06-18"

export type Verdict =
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

/** Interrogate a child using newline-delimited JSON-RPC, including pagination. */
export const askOver = async (child: ChildProcess, deadlineMs: number, signal?: AbortSignal): Promise<Verdict> => {
  const { stdout } = child
  if (child.stdin === null || stdout === null) {
    return { _tag: "couldNotStart", cause: "the child has no pipes to speak on" }
  }
  return await new Promise<Verdict>((resolve) => {
    let buffer = ""
    let done = false
    const tools: Array<{ name: string; inputs: ReadonlyArray<string> }> = []
    const finish = (verdict: Verdict): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", abort)
      resolve(verdict)
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
    stdout.on("data", (chunk: Buffer) => {
      if (done) return
      buffer += chunk.toString("utf8")
      if (buffer.length > 4 * 1024 * 1024) { finish({ _tag: "failed", cause: "MCP response exceeds 4 MiB" }); return }
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
          finish({ _tag: "failed", cause: "a line that is not JSON-RPC" }); return
        }
        // A NOTIFICATION carries no id; say nothing back and carry on.
        if (message["id"] === undefined) continue
        if (message["error"] !== undefined) {
          finish({ _tag: "failed", cause: JSON.stringify(message["error"]) })
          return
        }
        if (message["id"] === 1) {
          // `initialize` answered: mark the session, ask for the surface.
          send({ jsonrpc: "2.0", method: "notifications/initialized" })
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" })
          continue
        }
        if (message["id"] === 2) {
          const result = message["result"] as { tools?: Array<Record<string, unknown>>; nextCursor?: string } | undefined
          if (!Array.isArray(result?.tools) || result.tools.some(tool => tool === null || typeof tool !== "object" || typeof tool["name"] !== "string")) {
            finish({ _tag: "failed", cause: "invalid tools/list response" }); return
          }
          for (const tool of result.tools) {
            const schema = tool["inputSchema"] as { properties?: Record<string, unknown> } | undefined
            tools.push({
              name: String(tool["name"]),
              inputs: Object.keys(schema?.properties ?? {}),
            })
          }
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
    Effect.sync(() => spawn(options.command, [...options.args], {
      stdio: ["pipe", "pipe", "ignore"], ...(options.env === undefined ? {} : { env: options.env }),
    })),
    child => Effect.promise(() => new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) { resolve(); return }
      child.once("close", () => resolve())
      child.kill("SIGKILL")
    })),
  )
  return yield* Effect.promise(signal => askOver(child, options.timeout, signal))
})
