/**
 * EVERY FIBER THIS PLUGIN STARTS HAS AN OWNER, held as an equality over the
 * source rather than as a paragraph.
 *
 * ## Why this is a source check and not a behaviour one
 *
 * The forks this guards were `Effect.forkDetach`, which attaches to the GLOBAL
 * scope: a turn-boundary write, a doorbell flush at three moments, a cancel
 * watcher and a deferred session cancel all went on running after the panel
 * that started them had stopped. Each of them is now the panel's or the
 * agent's, interrupted by its `stopWithReason`.
 *
 * What that change does NOT do is alter what a person sees, and pretending
 * otherwise would be inventing evidence. Every one of those tasks is already
 * INERT after a stop — the cancel watcher finds the ticket set drained and
 * returns, a flush finds no conversation to speak into, the deferred cancel
 * finds a closed connection — so there is no assertion about output that can
 * tell the two arrangements apart. What they cost was a fiber outliving the
 * plugin that made it, and the honest proof of a fiber's owner is that there is
 * exactly one place a fiber can be made.
 *
 * So: three sites, each named with the handle that holds it. A fourth appearing
 * anywhere in this package fails here, which is the property the audit's
 * section 9 actually asked for — *identify the right owner for each task, then
 * make its shutdown cancel or join the task* — kept as something a reviewer can
 * check by reading one list.
 */

import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"

/** THE PLUGIN'S OWN SOURCE, off git rather than a walk: a file nobody tracks is
 *  not part of this package's claim, and an editor's stray copy must not fail a
 *  suite. */
const sources = (): ReadonlyArray<string> =>
  execFileSync("git", ["ls-files", "*.ts", "*.tsx"], {
    cwd: join(import.meta.dirname, ".."),
    encoding: "utf8",
  })
    .split("\n")
    .filter((path) => path !== "" && !path.includes(".test.") && !path.includes(".testlib."))

/**
 * WHERE A FIBER MAY BE MADE, and what holds it.
 *
 * `src/scoped.ts` makes none: the scheduler takes its fork from the bridge's
 * `detached` seam through `Options.fork`, so its idle timers, its relocation
 * and its boot are the PLUGIN's — which is why it is absent from this list
 * rather than exempted in it.
 */
const OWNED: ReadonlyArray<{ readonly file: string; readonly held: string }> = [
  { file: "src/agent.ts", held: "`aside`, whose set `stopWithReason` interrupts" },
  { file: "src/chat.ts", held: "`ticket.fiber`, drained and interrupted by `stopWithReason`" },
  { file: "src/chat.ts", held: "`aside`, whose set `stopWithReason` interrupts" },
]

test("nothing in this plugin forks a fiber without an owner", () => {
  const found = sources().flatMap((path) => {
    const at = join(import.meta.dirname, "..", path)
    return readFileSync(at, "utf8")
      .split("\n")
      // CODE ONLY — this file's own subject is discussed in prose all over the
      // package, and a comment naming the seam it replaced is not a fork.
      .flatMap((line, index) =>
        /Effect\.(forkDetach|runFork)\b/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line)
          ? [`${path}:${index + 1}`]
          : []
      )
  })
  // ONE PER ENTRY IN THE LIST ABOVE, and the list says what holds each. A new
  // fork is not forbidden — it is asked to name its owner here.
  expect(found.map((one) => one.split(":")[0]).sort()).toEqual(
    OWNED.map((one) => one.file).toSorted(),
  )
})
