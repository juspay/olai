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
 */

import { expect, test } from "bun:test"
import { type ChildProcess, spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

const MAIN = path.join(import.meta.dirname, "..", "main.ts")

/** How long a call, or a shutdown, may take before it is a hang. Generous:
 *  what is being told apart is "immediately" from "never". */
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

interface Reply {
  readonly result?: Record<string, unknown>
  readonly error?: { readonly code: number; readonly message: string }
}

/**
 * An MCP client, which is all one is: a command, its pipes, and a table of
 * ids waiting to be answered.
 */
interface Session {
  readonly call: (method: string, params?: unknown) => Promise<Reply>
  readonly notify: (method: string) => void
  /** Close the client's end of the pipe — the ordinary way an MCP client says
   *  it is done. */
  readonly done: () => void
  readonly exited: Promise<number | null>
  /** Everything each stream has said so far. */
  readonly out: () => string
  readonly err: () => string
  readonly kill: () => void
}

const launch = (root: string): Session => {
  const child: ChildProcess = spawn(
    process.execPath,
    [MAIN, "mcp", root, "--no-commit"],
    { stdio: ["pipe", "pipe", "pipe"] },
  )

  let out = ""
  let err = ""
  let pending = ""
  let next = 0
  const waiting = new Map<number, (reply: Reply) => void>()

  child.stdout?.setEncoding("utf8")
  child.stderr?.setEncoding("utf8")
  child.stdout?.on("data", (chunk: string) => {
    out += chunk
    pending += chunk
    // The transport's own contract: one message per line. A client that
    // buffered any other way would be reading a different protocol.
    const lines = pending.split("\n")
    pending = lines.pop() ?? ""
    for (const line of lines) {
      if (line.trim() === "") continue
      const message = JSON.parse(line) as Reply & { readonly id?: number }
      if (message.id === undefined) continue
      waiting.get(message.id)?.(message)
      waiting.delete(message.id)
    }
  })
  child.stderr?.on("data", (chunk: string) => {
    err += chunk
  })

  const exited = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code))
  })

  return {
    call: (method, params) => {
      const id = ++next
      const sent = new Promise<Reply>((resolve, reject) => {
        waiting.set(id, resolve)
        setTimeout(
          () =>
            reject(
              new Error(
                `\`${method}\` was never answered.\n  stdout: ${out}\n  stderr: ${err}`,
              ),
            ),
          BOUND_MS,
        )
      })
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`)
      return sent
    },
    notify: (method) => {
      child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`)
    },
    done: () => child.stdin?.end(),
    exited,
    out: () => out,
    err: () => err,
    kill: () => child.kill("SIGKILL"),
  }
}

test("a client that launched it can mark a node, and the disk says so", async () => {
  const root = served()
  const session = launch(root)
  try {
    const ready = await session.call("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "olai's own test", version: "0" },
    })
    expect(ready.result?.protocolVersion).toBe("2025-06-18")
    session.notify("notifications/initialized")

    // The closed list is what an agent may do, and it arrives without olai
    // having told this client anything else about itself.
    const listed = await session.call("tools/list")
    const tools = (listed.result?.tools ?? []) as ReadonlyArray<{ name: string }>
    expect(tools.map((tool) => tool.name)).toContain("set_done")

    const marked = await session.call("tools/call", {
      name: "set_done",
      arguments: { id: "order" },
    })
    expect(marked.result?.isError).toBeUndefined()

    // The claim of the whole item: a process that is not olai's browser, and
    // not olai's own agent, changed the outline on disk — through the ops
    // layer, so the record is whole and the file still parses.
    const written = fs.readFileSync(path.join(root, "house.jsonl"), "utf8")
    const order = written
      .split("\n")
      .find((line) => line.includes(`"id":"order"`))
    expect(order).toInclude(`"done":`)
    expect(JSON.parse(order ?? "null")).toMatchObject({
      id: "order",
      parent: "kitchen",
      title: "order the cabinets",
    })

    // And a refusal is an ANSWER, not a protocol error: `kitchen` takes its
    // status from its children, so it cannot store one, and what comes back is
    // the unfinished child to mark instead.
    const refused = await session.call("tools/call", {
      name: "set_done",
      arguments: { id: "kitchen" },
    })
    expect(refused.error).toBeUndefined()
    expect(refused.result?.isError).toBe(true)
    expect(refused.result?.structuredContent).toMatchObject({ kind: "derived" })
  } finally {
    session.kill()
  }
}, BOUND_MS * 3)

test("stdout is the protocol, and the notice a person reads is not on it", async () => {
  const root = served()
  const session = launch(root)
  try {
    await session.call("initialize", { protocolVersion: "2025-06-18", capabilities: {} })

    // Every line stdout has produced parses as a JSON-RPC frame. One stray
    // log line here is a client whose parser is looking at something that is
    // not a message, which is why the logging is routed to stderr for the
    // whole program rather than avoided file by file.
    for (const line of session.out().split("\n")) {
      if (line.trim() === "") continue
      expect(JSON.parse(line)).toMatchObject({ jsonrpc: "2.0" })
    }

    // The line that says what is being served went to the other stream, and
    // it names the directory — a person debugging a client's config has to be
    // able to see which one it opened.
    //
    // `path.resolve`, deliberately not `fs.realpathSync`: the server resolves
    // the argument it was given and does not chase symlinks, and on macOS
    // `/tmp` IS one (`/private/tmp`). Realpathing here would assert that olai
    // prints a path nobody typed.
    expect(session.err()).toInclude(`olai mcp: serving ${path.resolve(root)}`)
  } finally {
    session.kill()
  }
}, BOUND_MS * 3)

test("closing the client's end of the pipe stops it", async () => {
  const session = launch(served())
  try {
    await session.call("initialize", { protocolVersion: "2025-06-18", capabilities: {} })
    session.done()

    const stopped = await Promise.race([
      session.exited.then(() => true),
      Bun.sleep(BOUND_MS).then(() => false),
    ])
    // An MCP client shuts a server down by closing stdin. A process that
    // stayed up would be one per agent session, left holding a watcher on
    // somebody's notes directory forever.
    expect(stopped).toBe(true)
  } finally {
    session.kill()
  }
}, BOUND_MS * 3)
