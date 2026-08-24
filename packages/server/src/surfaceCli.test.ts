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

import { run } from "@olai/child"
import { expect, test } from "bun:test"
import * as path from "node:path"

const MAIN = path.join(import.meta.dirname, "main.ts")

/** One CLI run, with both channels and the code — a refusal is not an error to
 *  this function, it is the answer. A hang throws `Hung` with what the CLI
 *  printed, rather than burning bun's 30s timeout with no `said`. */
const olai = async (
  argv: ReadonlyArray<string>,
  env: Readonly<Record<string, string>> = {},
): Promise<{ readonly out: string; readonly err: string; readonly code: number }> => {
  const result = await run(process.execPath, [MAIN, ...argv], {
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 10_000,
  })
  return { out: result.out, err: result.err, code: result.code ?? (result.ok ? 0 : 1) }
}

test("a capture's title is a POSITION, and a note is all else it takes", async () => {
  const { out } = await olai(["surface", "capture", "--help"])
  // The one CLI-only ergonomic this verb is annotated with: `olai surface
  // capture "…"` rather than `--title "…"`, because a title is the whole point
  // of the call and a flag would be ceremony around it.
  expect(out).toContain("[<title>]")
  expect(out).not.toContain("--title")
  expect(out).toContain("--text")
  // A capture is a title and a note (ruled, human 2026-08-23). The link field
  // and the free props map are gone — and `--props` in particular cannot come
  // back by accident, because it was the only way a caller could have named
  // `captured-by` at all.
  expect(out).not.toContain("--props")
}, 30_000)

test("every verb takes `--url`, and there is no socket anywhere", async () => {
  // Asked of `list`, which takes NO input of its own — so every flag on it is
  // the endpoint's or this face's, and nothing of the verb's can be mistaken
  // for one.
  const { out } = await olai(["surface", "list", "--help"])
  expect(out).toContain("--url")
  expect(out).not.toContain("--socket")
}, 30_000)

test("naming no server is a usage error, and never a guess", async () => {
  // THE WHOLE POINT OF THE FLAG BEING REQUIRED. The reverted design fell back
  // to a per-user path when nobody said where, which is how a capture meant for
  // one vault landed in another and answered exactly like a success. Exit 2:
  // the command was wrong and never left this process.
  const { code } = await olai(["surface", "keys", "outlines"])
  expect(code).toBe(2)
}, 30_000)

test("nothing serving is exit 3, and it names the address it tried", async () => {
  // The arm a script branches on, and the useful half is the ADDRESS as the
  // caller spelled it — not the `/mcp` this client derived from it, which is a
  // path they never typed and cannot act on.
  const nowhere = "http://127.0.0.1:1"
  // `keys outlines` and not `list`: `list` is this face's own table, read off
  // the spec without dialling anything, so it answers 0 with no server at all —
  // which is right, and is why it cannot be the verb that tests the dial.
  const { out, err, code } = await olai(["surface", "keys", "outlines", "--url", nowhere])
  expect(code).toBe(3)
  expect(err).toContain(nowhere)
  expect(err).toContain("no surface at")
  // stdout is DATA, and a failure produced none.
  expect(out.trim()).toBe("")
}, 30_000)

test("`olai surface --help` is a page, not a dump of every verb", async () => {
  // The human, on master after the first cut: "where the fuck are docs for the
  // surface command?" — and right. There is no docs page for it (ruled): the
  // help IS the doc, so it has to read like one.
  const { out, code } = await olai(["surface", "--help"])
  expect(code).toBe(0)
  for (const said of [
    // A purpose line…
    "Call any verb of a running olai from a terminal",
    // …the groups, in the order somebody reads them…
    "Capture",
    "Read",
    "Search",
    // …an example a person can paste…
    'olai surface capture "look into the new cabinets"',
    // …the two flags every verb takes, and where the answer goes — including
    // the one-line summary a write prints, which is the half a person acts on
    // and the half the ops layer's own answer has no room for.
    "--url <server>",
    "--json",
    "A write prints one line",
    "--json prints the whole",
  ]) expect(out).toContain(said)
  // And NOT the flat alphabetical listing the renderer would otherwise print
  // under the page — two listings of one set, of which the flat one reads like
  // the truth because the renderer wrote it.
  expect(out).not.toContain("SUBCOMMANDS")
}, 30_000)

test("no `watch`, and no `--follow`, because the door pushes nothing", async () => {
  // `/mcp` answers one POST with one frame and 405s the SSE half, so a
  // subscription is not something this transport can carry. It is subtracted
  // from the projection rather than offered and then always failing — a caller
  // finds out what a face can do from `--help`.
  const { code } = await olai(["surface", "watch", "outlines", "--url", "http://127.0.0.1:1"])
  expect(code).toBe(2)
  const { out } = await olai(["surface", "get", "--help"])
  expect(out).not.toContain("--follow")
}, 30_000)
