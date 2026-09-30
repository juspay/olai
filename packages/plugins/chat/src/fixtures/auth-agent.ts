#!/usr/bin/env bun
/**
 * THE AGENT HALF OF THE SIGN-IN BENCH — an ACP agent with two `terminal` auth
 * methods and nothing else.
 *
 * It exists for one question a browser scenario cannot ask: what happens when
 * TWO PRESSES arrive in the same instant. A scenario presses one button and then
 * another, which is the attach case; the race is two callers inside one tick,
 * and that is a unit test's to arrange (`../agent.test.ts`).
 *
 * The command line it hands over is the test's, through the environment rather
 * than through a literal here: `OLAI_TEST_LOGIN_BUN` / `OLAI_TEST_LOGIN_SCRIPT` /
 * `OLAI_TEST_LOGIN_LOG` are what the bench sets, and the adapter reads them the
 * way the pinned Claude adapter reads its own argv — `process.execPath` plus a
 * script, which is exactly the shape `_meta["terminal-auth"]` carries.
 *
 * `other-login` is the second method, and it is there to be offered and NOT
 * pressed: a press of a different method while one is running must be refused
 * rather than attach (`Agent.signIn`).
 */

import { appendFileSync } from "node:fs"

/** A MODULE and not a script, which is what keeps this bench's `write` from
 *  redeclaring the `write` beside it in the program: a top-level `const` in a
 *  file with no import or export belongs to the whole of it. The import above
 *  settles it, and every fixture in this directory says so one way or another —
 *  the one that did not is what caught this. */
export {}

/**
 * ... AND IT IS ALSO A LOGIN, when it is handed the one argument its second
 * method names. That method writes no command line of its own, which is the
 * protocol's other spelling: the client then runs THE AGENT BINARY with those
 * args, and this file is that binary — so a bench that wanted the fallback
 * exercised has to have something sensible to do when it is what runs.
 */
if (process.argv.includes("--other")) {
  appendFileSync(process.env["OLAI_TEST_LOGIN_LOG"] ?? "", "other\n")
  process.exit(0)
}

let pending = ""
const write = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk: string) => {
  pending += chunk
  const lines = pending.split("\n")
  pending = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.trim()) continue
    const message = JSON.parse(line) as { readonly id?: unknown; readonly method?: string }
    const respond = (result: unknown): void => write({ jsonrpc: "2.0", id: message.id, result })
    switch (message.method) {
      case "initialize":
        respond({
          protocolVersion: 1,
          agentCapabilities: { loadSession: true },
          authMethods: [
            {
              id: "fake-login",
              name: "Fake login",
              description: "a method the client runs",
              type: "terminal",
              _meta: {
                "terminal-auth": {
                  command: process.env["OLAI_TEST_LOGIN_BUN"] ?? process.execPath,
                  args: [
                    process.env["OLAI_TEST_LOGIN_SCRIPT"] ?? "",
                    process.env["OLAI_TEST_LOGIN_LOG"] ?? "",
                  ],
                  label: "Fake Login",
                },
              },
            },
            { id: "other-login", name: "Other login", type: "terminal", args: ["--other"] },
          ],
        })
        return
      default:
        // NOTHING ELSE IS IMPLEMENTED, and said rather than ignored: a bench
        // whose agent went quiet would hang the test instead of failing it.
        write({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: `no such method: ${String(message.method)}` },
        })
    }
  }
})
