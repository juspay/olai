/**
 * THE FOURTH CLIENT — the agent socket `olai surface` dials.
 *
 * `/mcp`'s bearer is minted per process and handed to nobody but the chat, so
 * from a terminal there was no door at all; that is the whole reason
 * `POST /capture` existed, and this is the general one that replaced it. What
 * is worth asserting is not that a socket file appeared — it is WHICH FACE
 * answers on it, and that a write through it is attributed to the door it came
 * through.
 *
 * Every test binds its socket under its OWN temporary directory rather than at
 * the per-user runtime path. That path is the convention two ends agree on with
 * no configuration, which is exactly what makes it wrong here: concurrent test
 * processes would fight for one socket and the losers would quietly serve
 * nothing.
 */

import { firstFrameOrThrow } from "@kolu/surface/first-frame"
import { unixSocketLink } from "@kolu/surface/links/unix-socket"
import { buildSurfaceFace } from "@kolu/surface/client"
import { surface } from "@olai/surface"
import { expect, test } from "bun:test"
import { Effect } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import { execFileSync } from "node:child_process"
import * as path from "node:path"

import { withServe } from "./serve.testlib.ts"

const A_ROW = `{"id":"one","ord":"a0","title":"a row"}\n`

/**
 * The members these tests call, named once.
 *
 * `buildSurfaceFace` answers a structurally-typed client, and asking it for
 * three members meant writing the same cast at every call. One shape, spelled
 * where it can be read — and it is the ops/edit pair deliberately: what these
 * tests are ABOUT is that one of them is on this face and the other is not.
 */
interface Face {
  readonly surface: {
    readonly ops: { readonly run: (request: unknown) => Effect.Effect<unknown, unknown> }
    readonly edit: { readonly apply: (request: unknown) => Effect.Effect<unknown, unknown> }
    readonly pending: { readonly get: (request: unknown) => unknown }
  }
}

/** A served directory with a socket of its own, and a client already dialled at
 *  it — torn down together, because a link left open holds the serve's scope. */
const overTheSocket = async <A>(
  use: (face: Face, root: string) => Promise<A>,
  commits: "off" | "manual" = "off",
): Promise<A> => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-socket-")))
  fs.writeFileSync(path.join(root, "a.olai"), A_ROW)
  const socketPath = path.join(root, "surface.sock")
  try {
    if (commits !== "off") {
      // A writer is only RECORDED where a commit could carry it, so the test
      // about attribution needs somewhere for one to go.
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root })
      execFileSync("git", ["add", "-A"], { cwd: root })
      execFileSync("git", [
        "-c", "user.name=t", "-c", "user.email=t@example.com",
        "commit", "-qm", "seed",
      ], { cwd: root })
    }
    return await withServe({ root, socketPath, commits }, async () => {
      const link = await unixSocketLink({ group: surface.group, socketPath })
      try {
        return await use(buildSurfaceFace(surface, link.dispatch) as Face, root)
      } finally {
        await link.dispose()
      }
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

test("the agent socket serves the AGENT face, and only it", async () => {
  await overTheSocket(async (face, root) => {
    // An agent's verb, over the socket, landing in the file.
    await Effect.runPromise(
      face.surface.ops.run({ op: "add", file: "a.olai", title: "written over the socket" }),
    )
    expect(fs.readFileSync(path.join(root, "a.olai"), "utf8"))
      .toContain("written over the socket")

    // …and the KEYBOARD's verb, which this face does not grant. A socket that
    // served the whole surface would pass the line above and fail this one,
    // which is the mistake `restrictHandlers` is here to make impossible.
    //
    // It arrives as a DEFECT rather than on the failure channel, and that is
    // right: a member this face never published is not a refusal the caller
    // could have anticipated from the member's own error type — it is a
    // programming error about which face was dialled. So the assertion is that
    // the call DIED saying so, not that it failed.
    await expect(
      Effect.runPromise(face.surface.edit.apply({ verb: "capture", title: "nope" })),
    ).rejects.toThrow("not exposed")
  })
}, 30_000)

test("a write through the socket is recorded as `cli`", async () => {
  // The trailer is the permanent half of "who did this", and the socket is a
  // door of its own — so it says so rather than borrowing `mcp`'s name.
  await overTheSocket(async (face) => {
    await Effect.runPromise(
      face.surface.ops.run({ op: "add", file: "a.olai", title: "a write to attribute" }),
    )
    const pending = await Effect.runPromise(
      firstFrameOrThrow(
        face.surface.pending.get(undefined) as never,
        "pending never opened",
      ) as Effect.Effect<
        { readonly wrote: ReadonlyArray<{ readonly writer: string }> },
        unknown
      >,
    )
    expect(pending.wrote.map((one) => one.writer)).toEqual(["cli"])
  }, "manual")
}, 30_000)
