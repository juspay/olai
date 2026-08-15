/**
 * The agent socket, from the other end of it.
 *
 * `./faces.test.ts` proves the browser half of the per-face property — a write
 * verb the surface declares, refused on the websocket. This file is the half
 * that makes that property worth having rather than merely true: the SAME verb,
 * on the SAME runtime, ANSWERING on the socket. One surface, two faces, two
 * different answers, and the difference is the map.
 *
 * It dials the way an attached `olai mcp` does — `unixSocketLink` at the path
 * both processes derive from the directory alone — but stays at the wire rather
 * than standing an MCP adapter on top of it, because what is being held still
 * here is the FACE. That the adapter over it serves an agent identically is
 * `mcp/serve.test.ts`'s claim, made where it belongs: across a real process
 * boundary.
 */

import { findSaid } from "@olai/log/testlib"
import { surface } from "@olai/surface"
import { unixSocketLink } from "@kolu/surface/links/unix-socket"
import { expect, test } from "bun:test"
import { Cause, Effect, Exit } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { served, withServe } from "./serve.testlib.ts"
import { attaching, socketFor } from "./socket.ts"

/**
 * A real `olai web` on a temp directory, and a real dial at the socket it
 * bound.
 *
 * Nothing here knows the path from the server — it is computed from the
 * DIRECTORY, which is the whole of the rendezvous convention: two processes
 * that share nothing but the directory name must land on the same socket, so a
 * test that read the path out of the server would be testing an agreement it
 * had arranged.
 */
const withAgentSocket = (
  body: (
    root: string,
    dispatch: {
      unary: (tag: string, payload: unknown) => Effect.Effect<unknown, unknown>
    },
  ) => Promise<void>,
): Promise<void> => {
  const root = served()
  return withServe({ root }, async (said) => {
    // The server says so before it announces a port, which is the ordering
    // `serve.ts` keeps deliberately: an agent that races the log line finds a
    // surface rather than an ENOENT.
    expect(findSaid(said, "agents can attach to this server")).toBeDefined()

    const link = await unixSocketLink({
      group: surface.group,
      socketPath: socketFor(root),
    })
    try {
      await body(root, link.dispatch)
    } finally {
      await link.dispose()
    }
  })
}

test("a write over the socket lands in the running server's directory", async () => {
  await withAgentSocket(async (root, dispatch) => {
    const applied = await Effect.runPromise(
      dispatch.unary("surface/ops/run", { op: "title", id: "a", title: "renamed over the socket" }) as Effect.Effect<{ title: string; file: string; rev: number }>,
    )
    expect(applied.title).toBe("renamed over the socket")
    expect(applied.file).toBe("a.olai")

    // The bytes, on the disk of the process that owns the store. This is the
    // whole claim: the caller has no store, no watcher and no ops layer, and
    // the write went through the same gate a keystroke does.
    expect(fs.readFileSync(path.join(root, "a.olai"), "utf8"))
      .toContain(`"title":"renamed over the socket"`)
  })
})

test("the same verb the browser is refused is ANSWERED here", async () => {
  // Stated as its own test because it is the property, not a side effect of
  // the one above: `faces.test.ts` calls `surface/ops/run` over a websocket at
  // a server exactly like this one and is told the member is not exposed.
  await withAgentSocket(async (_root, dispatch) => {
    const exit = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/ops/run", { op: "title", id: "a", title: "answered" })),
    )
    expect(Exit.isSuccess(exit)).toBe(true)
  })
})

test("the socket does not carry the human's conversation", async () => {
  await withAgentSocket(async (_root, dispatch) => {
    // The gate cuts both ways, and this is the direction that is easy to
    // forget: an agent that is not ours has no business driving somebody's
    // chat session, so `chat.*` is absent from the agent's map exactly as
    // `ops.*` is absent from the browser's.
    const exit = await Effect.runPromise(
      Effect.exit(dispatch.unary("surface/chat/send", { text: "hello" })),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(Cause.pretty(exit.cause)).toContain(
        `"surface/chat/send" is not exposed on this face`,
      )
    }
  })
})

test("a server that stopped leaves nothing to dial", async () => {
  // The claim `docs/running.md` makes to whoever reads it, and the whole reason
  // there is no state file: a stopped server takes its socket with it, so the
  // next `olai mcp` finds nobody home and opens its own store. Asserted AFTER
  // the serve's scope has closed, which is when the listener's own finalizer
  // has run — so the dial here answers `ENOENT`, the ordinary shutdown.
  //
  // The OTHER route to the same verdict is a process that was killed rather
  // than closed, whose inode survives and answers `ECONNREFUSED`. That one is
  // upstream's (`serveOverUnixSocket` clears a provably-stale socket at bind)
  // and is not exercised here; what this file owns is that BOTH codes are read
  // as "nobody is home", which is one line of `socket.ts` and above.
  const root = served()
  await withServe({ root }, async () => {
    const live = await attaching(socketFor(root))
    expect(live).not.toBeNull()
    // Disposed here rather than left for the process to reap: the point of the
    // line below is what the PATH says once the server is gone, and a socket
    // this test is still holding open would be the test answering itself.
    live?.first.dispose()
  })

  expect(await attaching(socketFor(root))).toBeNull()
})

test("the socket path is the directory's, however the directory was spelled", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-socket-")))
  const nested = fs.mkdtempSync(path.join(os.tmpdir(), "olai-socket-"))
  const link = path.join(nested, "link")
  fs.symlinkSync(root, link)

  // The two processes coordinate on nothing but the directory, so the two ways
  // a person reaches one — `olai web ~/notes` and `olai mcp .` from inside a
  // symlink to it — have to answer the same path. `resolve` alone does not.
  expect(socketFor(link)).toBe(socketFor(root))
  expect(socketFor(`${root}/.`)).toBe(socketFor(root))
  // And two vaults are two sockets: a person with notes and work open runs two
  // servers, and an agent in either must reach the one serving ITS directory.
  expect(socketFor(nested)).not.toBe(socketFor(root))
})
