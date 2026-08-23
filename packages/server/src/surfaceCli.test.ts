/**
 * WHAT `olai surface` OFFERS AS ARGV, pinned as words.
 *
 * The projection is `@kolu/surface-cli`'s and its rules are tested there. What
 * is this repo's, and what nothing upstream can pin, is the shape THIS binary
 * ends up with: which argument is a position rather than a flag, which endpoint
 * flags exist, and what a caller sees when nothing is serving.
 *
 * No server is started and none is needed — a `--help` never dials, and the
 * nothing-serving case is precisely the one where there is nothing to dial. So
 * these run against the source entry point directly, in a second or two.
 */

import { expect, test } from "bun:test"
import { execFile } from "node:child_process"
import * as path from "node:path"
import { promisify } from "node:util"

const run = promisify(execFile)

const MAIN = path.join(import.meta.dirname, "main.ts")

/** One CLI run, with both channels and the code — a refusal is not an error to
 *  this function, it is the answer. */
const olai = async (
  argv: ReadonlyArray<string>,
  env: Readonly<Record<string, string>> = {},
): Promise<{ readonly out: string; readonly err: string; readonly code: number }> => {
  try {
    const { stdout, stderr } = await run(process.execPath, [MAIN, ...argv], {
      env: { ...process.env, ...env },
      maxBuffer: 32 * 1024 * 1024,
    })
    return { out: stdout, err: stderr, code: 0 }
  } catch (thrown) {
    const said = thrown as { stdout?: string; stderr?: string; code?: number }
    return { out: said.stdout ?? "", err: said.stderr ?? "", code: said.code ?? -1 }
  }
}

test("a capture's title is a POSITION, and its other fields are flags", async () => {
  const { out } = await olai(["surface", "capture", "--help"])
  // The one CLI-only ergonomic this verb is annotated with: `olai surface
  // capture "…"` rather than `--title "…"`, because a title is the whole point
  // of the call and a flag would be ceremony around it.
  expect(out).toContain("[<title>]")
  expect(out).not.toContain("--title")
  for (const flag of ["--text", "--url", "--props"]) expect(out).toContain(flag)
}, 30_000)

test("the endpoint offers `--socket` and deliberately no `--url`", async () => {
  // Asked of `list`, which takes NO input of its own — so every flag on it is
  // the endpoint's, and `--url` appearing here could only be the endpoint's.
  // (`capture` has a `--url` FIELD, which is a different thing entirely and is
  // why this is not asked there.)
  const { out } = await olai(["surface", "list", "--help"])
  expect(out).toContain("--socket")
  expect(out).not.toContain("--url")
}, 30_000)

test("nothing serving is exit 3, and it names the path it tried", async () => {
  // The arm a script branches on, and the one where the useful half is the
  // PATH: "no surface" without saying where leaves a caller guessing which of
  // four rungs was taken.
  const nowhere = "/tmp/olai-surely-not-here.sock"
  // `keys outlines` and not `list`: `list` is this face's own table, read off
  // the spec without dialling anything, so it answers 0 with no server at all —
  // which is right, and is why it cannot be the verb that tests the dial.
  const { out, err, code } = await olai(["surface", "keys", "outlines"], { OLAI_SOCKET: nowhere })
  expect(code).toBe(3)
  expect(err).toContain(nowhere)
  expect(err).toContain("no surface at")
  // stdout is DATA, and a failure produced none.
  expect(out.trim()).toBe("")
}, 30_000)
