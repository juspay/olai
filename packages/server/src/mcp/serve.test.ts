/**
 * `olai mcp <dir>` against a real directory, as a real child process.
 *
 * The unit tests either side of this one prove the halves: `stdio.test.ts` the
 * framing, `@olai/ops`'s `ops.test.ts` the tools and the write gate. What is
 * only true end to end is what this file is for — that a client which knows
 * nothing about olai except how to launch a command can mark a node, and that
 * the bytes it changed are on the disk of a process it does not share.
 *
 * It is a child process rather than `serveTools` called in this one because
 * the claims are about a PROCESS: that stdout carries the protocol and nothing
 * else, that the notice a person reads went somewhere a parser will not see,
 * and that closing the client's end of the pipe is what stops it. None of
 * those can be observed from inside.
 *
 * Every test is one CONVERSATION — write the messages, close stdin, read
 * everything back — which is the shape stdin's close being the shutdown makes
 * available, and it is worth taking. There is no id table and no per-call
 * timeout here because there is nothing to interleave: the pump answers in
 * order, and a process that failed to stop would fail every test in the file
 * rather than only the one about stopping. The interactive client, which has
 * to leave the pipe open while a browser is looked at, is the e2e suite's
 * (`packages/tests/support/mcp.ts`).
 */

import { expect, test } from "bun:test"
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { stoppedWithin } from "../child.testlib.ts"

const MAIN = path.join(import.meta.dirname, "..", "main.ts")

/** How long a whole conversation may take before it is a hang. Generous: what
 *  is being told apart is "immediately" from "never". */
const BOUND_MS = 15_000

const HOUSE = [
  `{"id":"kitchen","ord":"a0","title":"Kitchen remodel"}`,
  `{"id":"order","parent":"kitchen","ord":"a0","title":"order the cabinets"}`,
  `{"id":"install","parent":"kitchen","ord":"a1","title":"install them"}`,
  "",
].join("\n")

/** A directory of outlines, thrown away with the test. */
const served = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "olai-mcp-"))
  fs.writeFileSync(path.join(root, "house.jsonl"), HOUSE)
  return root
}

interface Frame {
  readonly id?: number
  readonly result?: Record<string, unknown>
  readonly error?: { readonly code: number; readonly message: string }
}

/** One request. `id` is left off for a notification, which is the whole of the
 *  difference between the two in JSON-RPC. */
const ask = (
  id: number | null,
  method: string,
  params?: unknown,
): Readonly<Record<string, unknown>> => ({
  jsonrpc: "2.0",
  ...(id === null ? {} : { id }),
  method,
  params,
})

interface Said {
  readonly frames: ReadonlyArray<Frame>
  readonly err: string
  /** Whether it stopped when the pipe closed. Asserted by the test about that,
   *  and load-bearing for every other one: a process still running would have
   *  been killed with its answers half-read. */
  readonly stopped: boolean
}

/**
 * Launch it, say all of that, close the pipe, and collect everything it said.
 *
 * `stoppedWithin` is what makes the collection complete: it waits for the
 * child's stdio to drain, not merely for the process to be gone, so a test
 * that read nine of ten frames cannot happen.
 */
const converse = async (
  root: string,
  messages: ReadonlyArray<Readonly<Record<string, unknown>>>,
): Promise<Said> => {
  const child = spawn(process.execPath, [MAIN, "mcp", root, "--no-commit"], {
    stdio: ["pipe", "pipe", "pipe"],
  })

  let out = ""
  let err = ""
  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => {
    out += chunk
  })
  child.stderr?.on("data", (chunk: string) => {
    err += chunk
  })

  child.stdin?.end(messages.map((message) => `${JSON.stringify(message)}\n`).join(""))

  const stopped = await stoppedWithin(child, BOUND_MS)
  if (!stopped) child.kill("SIGKILL")

  return { frames: framesOf(out), err, stopped }
}

/** stdout, as the only thing it is allowed to be. A line that will not parse
 *  is a client's parser looking at prose, so it fails here with the line —
 *  which is what makes "stdout is the protocol" a property of every test in
 *  this file rather than of the one that says so. */
const framesOf = (out: string): ReadonlyArray<Frame> =>
  out
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      try {
        return JSON.parse(line) as Frame
      } catch {
        throw new Error(
          `this line on stdout is not a JSON-RPC frame:\n  ${line}\n` +
            `stdout is the protocol, so anything else there is a message the client cannot read`,
        )
      }
    })

const answerTo = (said: Said, id: number): Frame => {
  const found = said.frames.find((frame) => frame.id === id)
  if (found === undefined) {
    throw new Error(
      `nothing answered id ${id}. Frames: ${JSON.stringify(said.frames)}\n  stderr: ${
        said.err.trim() || "(empty)"
      }`,
    )
  }
  return found
}

const HANDSHAKE = { protocolVersion: "2025-06-18", capabilities: {} }

test("a client that launched it can mark a node, and the disk says so", async () => {
  const root = served()
  const said = await converse(root, [
    ask(1, "initialize", { ...HANDSHAKE, clientInfo: { name: "olai's own test", version: "0" } }),
    ask(null, "notifications/initialized"),
    ask(2, "tools/list"),
    ask(3, "tools/call", { name: "set_done", arguments: { id: "order" } }),
    ask(4, "tools/call", { name: "set_done", arguments: { id: "kitchen" } }),
  ])

  expect(answerTo(said, 1).result?.protocolVersion).toBe("2025-06-18")

  // The closed list is what an agent may do, and it arrives without olai
  // having told this client anything else about itself.
  const tools = (answerTo(said, 2).result?.tools ?? []) as ReadonlyArray<{ name: string }>
  expect(tools.map((tool) => tool.name)).toContain("set_done")

  expect(answerTo(said, 3).result?.isError).toBeUndefined()

  // The claim of the whole item: a process that is not olai's browser, and not
  // olai's own agent, changed the outline on disk — through the ops layer, so
  // the record is whole and the file still parses.
  const order = fs
    .readFileSync(path.join(root, "house.jsonl"), "utf8")
    .split("\n")
    .find((line) => line.includes(`"id":"order"`))
  expect(order).toInclude(`"done":`)
  expect(JSON.parse(order ?? "null")).toMatchObject({
    id: "order",
    parent: "kitchen",
    title: "order the cabinets",
  })

  // A refusal is an ANSWER, not a protocol error: `kitchen` takes its status
  // from its children, so it cannot store one, and what comes back is the
  // unfinished children to mark instead.
  const refused = answerTo(said, 4)
  expect(refused.error).toBeUndefined()
  expect(refused.result?.isError).toBe(true)
  expect(refused.result?.structuredContent).toMatchObject({ kind: "derived" })

  // Four requests, four frames: the notification in the middle was answered
  // with silence, which a client would otherwise have to match against nothing.
  expect(said.frames).toHaveLength(4)
}, BOUND_MS * 3)

test("the notice a person reads is not on the protocol's stream", async () => {
  // `framesOf` has already refused anything on stdout that is not a frame, so
  // what is left to say is where the other half went. The line names the
  // directory, because a person debugging a client's config has to be able to
  // see which one it opened.
  //
  // `path.resolve`, deliberately not `fs.realpathSync`: the server resolves the
  // argument it was given and does not chase symlinks, and on macOS `/tmp` IS
  // one (`/private/tmp`). Realpathing here would assert that olai prints a path
  // nobody typed.
  const root = served()
  const said = await converse(root, [ask(1, "initialize", HANDSHAKE)])

  expect(said.err).toInclude(`olai mcp: serving ${path.resolve(root)}`)
})

test("closing the client's end of the pipe stops it", async () => {
  // An MCP client shuts a server down by closing stdin. A process that stayed
  // up would be one per agent session, left holding a watcher on somebody's
  // notes directory forever.
  const said = await converse(served(), [ask(1, "initialize", HANDSHAKE)])

  expect(said.stopped).toBe(true)
}, BOUND_MS * 3)
