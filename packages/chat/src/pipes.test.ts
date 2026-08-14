/**
 * The half of a subprocess's lifecycle that is not a pipe: whether it ever ran.
 *
 * The ACP agent this package starts goes through {@link unstartable}, and it
 * is the kind of thing that is only ever exercised by a machine somebody else
 * has misconfigured — so it is asserted here, against real children, rather
 * than left to be discovered in the field a second time.
 *
 * Two claims, and the first is the one that used to be false: a child that
 * cannot be exec'd emits an `error` event, and an unhandled one of those is an
 * uncaught exception. This test failing on the mere ATTEMPT — before any
 * `expect` runs — is that regression.
 */

import { spawn } from "node:child_process"

import { describe, expect, test } from "bun:test"

import { unstartable } from "./pipes.ts"

describe("a child that never ran", () => {
  test("answers with the system's own reason, and takes nothing down with it", async () => {
    const child = spawn("/nonexistent/olai-test/not-a-program", [], {
      stdio: ["pipe", "pipe", "ignore"],
    })

    expect(await unstartable(child)).toContain("ENOENT")
  })

  // ... and the other side of it, which is what makes RACING this safe: a
  // child that started is a promise that never settles, so a caller may put it
  // against its own conversation without the loser ever deciding anything.
  test("says nothing at all about a child that started", async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10_000)"], {
      stdio: ["pipe", "pipe", "ignore"],
    })
    try {
      const settled = await Promise.race([
        unstartable(child).then(() => "settled"),
        new Promise((resolve) => setTimeout(() => resolve("still waiting"), 250)),
      ])
      expect(settled).toBe("still waiting")
    } finally {
      child.kill("SIGKILL")
    }
  })
})
