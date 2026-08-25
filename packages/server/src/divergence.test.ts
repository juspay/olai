/**
 * THE DIVERGENCE LOG — that the entry lands at the path the flip is gated on,
 * and that a disk which will not take it does not take somebody's write with
 * it.
 *
 * WHAT diverges is `@olai/format`'s business and its own suite's
 * (`../../format/src/shadow.test.ts` holds the comparator; that package's
 * `incremental.test.ts` holds the two validators to one answer). This file is
 * about the two things this layer adds — where the line goes, and what happens
 * when it cannot go there.
 */

import type { Seen } from "@olai/format"
import { Effect } from "effect"
import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { divergenceLog, witnessOf } from "./divergence.ts"

/** One divergence, as the format hands one over — written out rather than
 *  produced by a validator that is wrong on purpose, because what is under test
 *  is the writing. */
const DIVERGED: Seen = {
  kind: "diverged",
  divergence: {
    why: "findings",
    at: "2026-08-25T04:00:00.000Z",
    touched: ["a.olai"],
    files: 3,
    accepted: { full: false, incremental: false },
    missing: ["a.olai:2 `parent` is `top`, which no node declares"],
    invented: [],
    full: ["a.olai:2 `parent` is `top`, which no node declares"],
    incremental: [],
  },
}

/** The lines this emitter was handed — the logger half of "impossible to
 *  miss", which has to happen whether or not the file does. */
const said: Array<unknown> = []
const SAY = (line: Effect.Effect<void>): void => {
  said.push(Effect.runSync(Effect.asVoid(line)))
}

/** Point the state home somewhere of its own for one case, and hand back what
 *  the log holds — `null` for a log that was never written. */
const under = (home: string, run: (at: string) => void): string | null => {
  const held = process.env["XDG_STATE_HOME"]
  process.env["XDG_STATE_HOME"] = home
  try {
    const at = divergenceLog()
    run(at)
    return fs.existsSync(at) ? fs.readFileSync(at, "utf8") : null
  } finally {
    if (held === undefined) delete process.env["XDG_STATE_HOME"]
    else process.env["XDG_STATE_HOME"] = held
  }
}

const homed = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "olai-divergence-"))

test("the log is one file under the state home, named for what it holds", () => {
  const home = homed()
  under(home, (at) => {
    expect(at).toEqual(path.join(home, "olai", "validate-shadow.ndjson"))
  })
})

test("a divergence lands in it as one line of JSON, with the vault it was about", () => {
  const home = homed()
  const written = under(home, () => {
    witnessOf("/some/vault", SAY)(DIVERGED)
  })
  expect(written).not.toBeNull()
  const entry = JSON.parse((written ?? "").trim()) as Record<string, unknown>
  expect(entry["why"]).toEqual("findings")
  expect(entry["missing"]).toEqual(DIVERGED.divergence?.missing as never)
  // The vault is IN the entry, which is what makes one file per user readable:
  // an orchestrator asking "did anything diverge last night" gets the answer
  // and the directory it was about in one line.
  expect(entry["cwd"]).toEqual("/some/vault")
})

test("two divergences are two lines, because the file is the ledger and not the latest", () => {
  const home = homed()
  const written = under(home, () => {
    witnessOf("/some/vault", SAY)(DIVERGED)
    witnessOf("/some/vault", SAY)(DIVERGED)
  })
  expect((written ?? "").trim().split("\n")).toHaveLength(2)
})

test("an agreement writes nothing at all — an empty log is what the flip is gated on", () => {
  const home = homed()
  const written = under(home, () => {
    witnessOf("/some/vault", SAY)({ kind: "narrowed", walked: false })
    witnessOf("/some/vault", SAY)({ kind: "cold" })
  })
  expect(written).toBeNull()
})

test("a state home that will not take the line does not take the write with it", () => {
  // A FILE where the directory has to go, so `mkdirSync` fails. The witness is
  // called from inside the write gate, so a refused log entry must not be a
  // refused edit — and the divergence still reached the logger, which is the
  // half that matters.
  const home = homed()
  fs.writeFileSync(path.join(home, "olai"), "not a directory")
  const before = said.length
  expect(() =>
    under(home, () => {
      witnessOf("/some/vault", SAY)(DIVERGED)
    })
  ).not.toThrow()
  // Two lines: the divergence, and the complaint about the log.
  expect(said.length - before).toEqual(2)
})
