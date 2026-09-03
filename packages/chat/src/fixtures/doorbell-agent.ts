#!/usr/bin/env bun
/**
 * A tiny ACP agent for the doorbell and scoped-scheduler tests: initialize,
 * session/new, session/load, session/prompt, session/cancel.
 *
 * Two things it does that `lifecycle-agent.ts` does not, and both are what the
 * delivery arms are asserted through:
 *
 *   - **a FRESH session id per `session/new`** (`sess-1`, `sess-2`, …), so a
 *     test can hold a body for a conversation that does not exist yet and then
 *     open it. One id for every open makes "the conversation nobody is in" and
 *     "the conversation on screen" the same string.
 *   - **`session/cancel` answers every prompt in flight** with `cancelled`, so a
 *     turn boundary a person PRODUCED is reachable — which is the arm that says
 *     a cancel does not swallow what a doorbell was holding.
 *
 * Prompt text:
 *   wait:<ms> — end_turn after that many milliseconds, so a turn can be held
 *               open for as long as a test needs to deliver into it
 *   anything else — end_turn immediately
 */

const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

let minted = 0
/** The prompts this agent has been asked and not yet answered, with the timer
 *  that would answer them — a cancel takes both. */
const running = new Map<unknown, ReturnType<typeof setTimeout> | null>()

process.stderr.write("doorbell-agent: started\n")

let pending = ""
process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  pending += chunk
  const lines = pending.split("\n")
  pending = lines.pop() ?? ""
  for (const line of lines) {
    if (line.trim() === "") continue
    const message = JSON.parse(line) as {
      readonly id?: unknown
      readonly method?: string
      readonly params?: {
        readonly sessionId?: string
        readonly prompt?: ReadonlyArray<{ readonly text?: string }>
      }
    }
    switch (message.method) {
      case "initialize":
        respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
        continue
      case "session/new":
        respond(message.id, { sessionId: `sess-${++minted}` })
        continue
      case "session/load":
        respond(message.id, { sessionId: message.params?.sessionId })
        continue
      case "session/cancel": {
        for (const [id, timer] of running) {
          if (timer !== null) clearTimeout(timer)
          respond(id, { stopReason: "cancelled" })
        }
        running.clear()
        continue
      }
      case "session/prompt": {
        const text = message.params?.prompt?.[0]?.text ?? ""
        const held = /^wait:(\d+)$/.exec(text)
        if (held !== null) {
          const id = message.id
          running.set(
            id,
            setTimeout(() => {
              running.delete(id)
              respond(id, { stopReason: "end_turn" })
            }, Number(held[1])),
          )
          continue
        }
        respond(message.id, { stopReason: "end_turn" })
        continue
      }
    }
  }
})

/** A MODULE and not a script, which is the only thing keeping these three
 *  fixtures from redeclaring each other's helpers in one program. */
export {}
