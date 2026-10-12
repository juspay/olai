#!/usr/bin/env bun
/**
 * A tiny ACP agent for the sleep pass's own tests: initialize, session/new,
 * session/load, session/prompt, session/cancel — and a turn it can hold, ask a
 * question in, or die in.
 *
 * WHY MARKER FILES AND NOT PROMPT VERBS. The pass always sends the SAME words
 * (`../sleep.ts`), so there is no argument a test could put in the prompt to
 * steer this agent — and inventing a verb the product never sends would be a
 * fixture testing a conversation that cannot happen. What a scenario wants to
 * change is the agent's BEHAVIOUR in that conversation, so that is what the
 * markers are: files in the session's own directory, which the test writes and
 * this process reads.
 *
 *   `.sleep-ask`     — ask a structured question and wait for the answer, the
 *                      shape the panel draws as an open `ask` row. Nobody
 *                      answers it in a sleep, which is the whole case.
 *   `.sleep-hold`    — take the prompt and answer nothing at all, so a turn is
 *                      still running when something else happens.
 *   `.sleep-vanish`  — die on the prompt: the conversation is gone mid-turn.
 *
 * ...and three it writes, so a test can watch from outside:
 *
 *   `.sleep-asked`, `.sleep-cancelled`, `.sleep-answered`.
 *
 * With no marker at all it ends the turn at once, which is the ordinary sleep.
 */

import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

const respond = (id: unknown, result: unknown): void => {
  write({ jsonrpc: "2.0", id, result })
}

/** Where the session was opened, which is where the markers are — the vault the
 *  conversation is about rather than this process's cwd. */
let cwd = process.cwd()
const here = (name: string): string => join(cwd, name)
const has = (name: string): boolean => existsSync(here(name))
const touch = (name: string): void => {
  try {
    writeFileSync(here(name), "")
  } catch {
    // A directory that has gone is a test that has finished; nothing to say.
  }
}

let minted = 0
let asked = 0
/** The prompts this agent has been asked and not yet answered — a cancel
 *  answers every one of them, which is what a turn boundary is. */
const running = new Set<unknown>()

process.stderr.write("sleep-agent: started\n")

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
      readonly result?: unknown
      readonly params?: {
        readonly cwd?: string
        readonly sessionId?: string
        readonly prompt?: ReadonlyArray<{ readonly text?: string }>
      }
    }
    // AN ANSWER TO OUR OWN QUESTION. The panel settles the ask row and this is
    // the turn carrying on, which is the ending a sleep never reaches.
    if (message.method === undefined && message.id !== undefined && message.result !== undefined) {
      if (running.has(message.id)) {
        running.delete(message.id)
        touch(".sleep-answered")
        respond(message.id, { stopReason: "end_turn" })
      }
      continue
    }
    switch (message.method) {
      case "initialize":
        respond(message.id, { protocolVersion: 1, agentCapabilities: { loadSession: true } })
        continue
      case "session/new":
      case "session/load":
        if (typeof message.params?.cwd === "string") cwd = message.params.cwd
        respond(message.id, { sessionId: message.params?.sessionId ?? `sess-${++minted}` })
        continue
      case "session/cancel": {
        for (const id of running) {
          running.delete(id)
          respond(id, { stopReason: "cancelled" })
        }
        touch(".sleep-cancelled")
        continue
      }
      case "session/prompt": {
        touch(".sleep-asked")
        if (typeof message.params?.cwd === "string") cwd = message.params.cwd
        const id = message.id
        running.add(id)
        if (has(".sleep-vanish")) {
          // THE CONVERSATION IS GONE, mid-turn: the panel is left holding a
          // prompt nothing will ever answer.
          process.exit(0)
        }
        if (has(".sleep-ask")) {
          // A STRUCTURED QUESTION, and no reply to the prompt: the turn stays
          // open on the ask row until somebody answers it or cancels.
          write({
            jsonrpc: "2.0",
            id: `ask-${++asked}`,
            method: "elicitation/create",
            params: {
              mode: "form",
              sessionId: message.params?.sessionId,
              toolCallId: `call-${asked}`,
              message: "Which rows should I archive?",
              requestedSchema: {
                type: "object",
                properties: {
                  question_0: {
                    type: "string",
                    title: "Archive",
                    oneOf: [
                      { const: "all", title: "all" },
                      { const: "none", title: "none" },
                    ],
                  },
                },
              },
            },
          })
          continue
        }
        if (has(".sleep-hold")) continue
        // A TURN THAT SHOWS NOTHING is a turn the panel reports as having
        // produced nothing (`chat.ts`'s silent-turn notice), and a real tidying
        // agent always shows the frames it edited rows with. So this one does
        // too: the pass is being tested over an ordinary turn, not over an
        // agent that answered with nothing.
        const call = `call-${++asked}`
        write({
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: message.params?.sessionId,
            update: {
              sessionUpdate: "tool_call",
              toolCallId: call,
              title: "Archive the September rows",
              kind: "edit",
              status: "in_progress",
              locations: [{ path: join(cwd, "Work.olai"), line: 2 }],
              rawInput: {},
            },
          },
        })
        write({
          jsonrpc: "2.0",
          method: "session/update",
          params: {
            sessionId: message.params?.sessionId,
            update: {
              sessionUpdate: "tool_call_update",
              toolCallId: call,
              status: "completed",
              rawOutput: { moved: 3 },
            },
          },
        })
        running.delete(id)
        respond(id, { stopReason: "end_turn" })
        continue
      }
    }
  }
})

/** A MODULE and not a script, so this fixture and its neighbours can share one
 *  program. */
export {}
