/**
 * THE LADDER `olai surface` WALKS to find a server.
 *
 * Four rungs, and the e2e pins only one of them (`$OLAI_SOCKET`, because that
 * is the rung a harness can hand a path on). The other three decide what
 * happens for a person who types nothing at all — which is the ordinary case,
 * and the one where getting it wrong writes into the WRONG DIRECTORY rather
 * than failing: a CLI run inside a checkout that fell through to the per-user
 * socket would capture into the user service's vault, silently and correctly
 * as far as any exit code is concerned.
 *
 * So the order is the unit under test, over a temp tree, with the environment
 * and the working directory as the inputs they really are.
 */

import { expect, test } from "bun:test"
import { Effect, Option } from "effect"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { dialOlai } from "./dial.ts"

/** Where `dialOlai` says it would go, for a given flag / env / cwd. */
const resolvedTo = async (
  values: { readonly socket?: string },
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): Promise<string> => {
  const held = { OLAI_SOCKET: process.env["OLAI_SOCKET"], XDG_RUNTIME_DIR: process.env["XDG_RUNTIME_DIR"] }
  const wasAt = process.cwd()
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    process.chdir(cwd)
    const endpoint = await Effect.runPromise(
      dialOlai({
        socket: values.socket === undefined ? Option.none() : Option.some(values.socket),
      }),
    )
    return endpoint.where
  } finally {
    process.chdir(wasAt)
    for (const [key, value] of Object.entries(held)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

/** A checkout with a dev socket in it, and a directory well below that. */
const treeWithDevSocket = (): { readonly root: string; readonly deep: string } => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-dial-")))
  fs.mkdirSync(path.join(root, ".olai-dev"), { recursive: true })
  fs.writeFileSync(path.join(root, ".olai-dev", "surface.sock"), "")
  const deep = path.join(root, "packages", "server", "src")
  fs.mkdirSync(deep, { recursive: true })
  return { root, deep }
}

test("`--socket` wins over everything, because somebody typed it", async () => {
  const { root, deep } = treeWithDevSocket()
  try {
    expect(
      await resolvedTo(
        { socket: "/tmp/typed.sock" },
        { OLAI_SOCKET: "/tmp/from-env.sock", XDG_RUNTIME_DIR: "/tmp/run" },
        deep,
      ),
    ).toBe("/tmp/typed.sock")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("…then `$OLAI_SOCKET`, which is the same choice made once for a shell", async () => {
  const { root, deep } = treeWithDevSocket()
  try {
    // The dev socket is RIGHT THERE and is still not taken: an explicit choice
    // in the environment is a choice, and a file found by walking is not.
    expect(
      await resolvedTo({}, { OLAI_SOCKET: "/tmp/from-env.sock", XDG_RUNTIME_DIR: "/tmp/run" }, deep),
    ).toBe("/tmp/from-env.sock")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("…then a worktree's own socket, found by walking UP from the cwd", async () => {
  const { root, deep } = treeWithDevSocket()
  try {
    // Asked from three directories DOWN, which is where a person actually runs
    // it — this is the rung that makes a checkout talk to its own server, and
    // the one whose absence would send the write to the user service's vault.
    expect(await resolvedTo({}, { OLAI_SOCKET: undefined, XDG_RUNTIME_DIR: "/tmp/run" }, deep))
      .toBe(path.join(root, ".olai-dev", "surface.sock"))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("…and otherwise the per-user runtime socket, which nobody had to configure", async () => {
  // No flag, no env, and a directory that is not a checkout: the convention
  // `olai web` binds with no flag on its side either. That the two agree is the
  // whole reason the CLI works out of the box, so the path is asserted rather
  // than merely "something under the runtime dir".
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-nodev-")))
  const run = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-run-")))
  try {
    expect(await resolvedTo({}, { OLAI_SOCKET: undefined, XDG_RUNTIME_DIR: run }, outside))
      .toBe(path.join(run, "olai", "surface.sock"))
  } finally {
    fs.rmSync(outside, { recursive: true, force: true })
    fs.rmSync(run, { recursive: true, force: true })
  }
})

test("a dev socket is taken on EXISTENCE, never on liveness", async () => {
  // The file left behind by a dead server still wins, deliberately: what a
  // caller gets then is "nobody serving at <that path>", which is the useful
  // sentence. Probing here would fall through to the user service instead, and
  // a write that lands in the wrong directory is far worse than one refused.
  const { root, deep } = treeWithDevSocket()
  const run = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "olai-run-")))
  try {
    // Nothing is listening on it — it is an empty regular file.
    expect(await resolvedTo({}, { OLAI_SOCKET: undefined, XDG_RUNTIME_DIR: run }, deep))
      .toBe(path.join(root, ".olai-dev", "surface.sock"))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(run, { recursive: true, force: true })
  }
})
