/**
 * What counts as "kolu is running here", against real subprocesses.
 *
 * The detection is a probe, so the fixtures are executables: a `kolu` written
 * into a directory this test puts on PATH, answering the way a real one would.
 * Nothing here talks to a padi daemon — what is being asserted is the RULE, and
 * the rule is that only an answered read counts.
 *
 * The middle case is the one that matters most, and it is the reason this file
 * exists rather than a version check: a `kolu` that speaks the protocol
 * perfectly and reaches no daemon is exactly what a stale bundled build looks
 * like (juspay/kolu#2146), and it must not become a session's MCP server.
 */

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"

import { afterEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"

import { mcpServersOf } from "./agent.ts"
import { detect, PROBE_ID, type Server } from "./kolu.ts"

/** Everything this test made, undone after each case: the directories it put
 *  on PATH, and PATH itself. */
const made: Array<string> = []
const PATH = process.env["PATH"]
const SOCKET = process.env["PADI_SOCKET"]

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
  process.env["PATH"] = PATH
  if (SOCKET === undefined) delete process.env["PADI_SOCKET"]
  else process.env["PADI_SOCKET"] = SOCKET
})

/**
 * A `kolu` on PATH, in a directory of its own, running the given script under
 * the interpreter this test is itself running under — so the fixture needs
 * nothing on PATH, which is the one thing this test is rearranging.
 *
 * PATH is REPLACED rather than prepended: a machine that really is running kolu
 * (the ordinary one to develop this on) would otherwise decide half of these
 * cases itself.
 */
const koluOnPath = (body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
  made.push(dir)
  const bin = join(dir, "kolu")
  writeFileSync(bin, `#!${process.execPath}\n${body}`)
  chmodSync(bin, 0o755)
  process.env["PATH"] = dir
  return bin
}

/**
 * A fixture that answers the read the way the flag says: with what a live padi
 * has, or with the error a kolu that reached no daemon sends.
 *
 * It answers the first thing the prober SAYS rather than reading what was
 * said. Parsing the conversation would put a fourth copy of ndjson framing in
 * this repo — the suite's fakes share one
 * (`packages/tests/support/ndjson.ts`), and this file cannot import it without
 * `@olai/chat` depending on `@olai/tests`, which is backwards. What it must
 * get right is the ID: an answer under a different one is not an answer, so it
 * comes from the prober's own constant rather than a number spelled here. That
 * a real `resources/read` is what gets sent is asserted where a real binary
 * can be asked — `features/kolu_terminals.feature`, whose fake kolu does read
 * the method.
 */
const script = (reachable: boolean): string =>
  `
const ANSWER = ${
    JSON.stringify(
      reachable
        ? { jsonrpc: "2.0", id: PROBE_ID, result: { contents: [] } }
        : {
          jsonrpc: "2.0",
          id: PROBE_ID,
          error: { code: -32603, message: "padi transport down" },
        },
    )
  }
process.stdin.once("data", () => process.stdout.write(JSON.stringify(ANSWER) + "\\n"))
`

const detected = (): Promise<Server | null> => Effect.runPromise(detect)

describe("detecting kolu", () => {
  test("a kolu whose padi answers is the session's server", async () => {
    const bin = koluOnPath(script(true))
    process.env["PADI_SOCKET"] = "/run/user/1000/padi-abc/padi.sock"

    expect(await detected()).toEqual({
      name: "kolu",
      // The path that ANSWERED, absolute — not the word we looked up.
      command: bin,
      args: ["mcp"],
      env: { PADI_SOCKET: "/run/user/1000/padi-abc/padi.sock" },
    })
  })

  test("a kolu that reached no padi is not one", async () => {
    koluOnPath(script(false))

    expect(await detected()).toBeNull()
  })

  test("a binary that is not kolu at all is not one", async () => {
    koluOnPath(`process.stdout.write("hello from something else\\n")\n`)

    expect(await detected()).toBeNull()
  })

  test("no kolu on PATH is the ordinary case, not a failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "olai-kolu-"))
    made.push(dir)
    process.env["PATH"] = dir

    expect(await detected()).toBeNull()
  })

  test("no PADI_SOCKET forwards nothing, and kolu resolves its own", async () => {
    koluOnPath(script(true))
    delete process.env["PADI_SOCKET"]

    expect(await detected()).toMatchObject({ env: {} })
  })
})

describe("what the session is handed", () => {
  const tools = { name: "olai", url: "http://127.0.0.1:7714/mcp", token: "secret" }
  const kolu: Server = {
    name: "kolu",
    command: "/nix/store/x/bin/kolu",
    args: ["mcp"],
    env: { PADI_SOCKET: "/run/padi.sock" },
  }

  test("kolu rides beside olai's own, as stdio beside http", () => {
    expect(mcpServersOf(tools, kolu)).toEqual([
      {
        type: "http",
        name: "olai",
        url: "http://127.0.0.1:7714/mcp",
        headers: [{ name: "Authorization", value: "Bearer secret" }],
      },
      {
        name: "kolu",
        command: "/nix/store/x/bin/kolu",
        args: ["mcp"],
        env: [{ name: "PADI_SOCKET", value: "/run/padi.sock" }],
      },
    ])
  })

  test("no kolu leaves the list exactly as it was", () => {
    expect(mcpServersOf(tools, null)).toHaveLength(1)
  })
})
