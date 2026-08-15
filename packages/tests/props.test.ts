/**
 * The fence around the props migration: no record in this repository spells a
 * node's facts as fields any more.
 *
 * `todo`, `doing`, `done`, `date`, `see`, `after` and `blocks` were fields of a
 * record and are entries in one `props` map now (`@olai/format`'s `props.ts`).
 * The migration that moved them is a one-way door, and the way a one-way door
 * rots is a stale spelling left somewhere nobody rebuilds — a fixture that
 * still writes the old shape, a feature file whose docstring seeds a directory
 * with it, a README example somebody copies.
 *
 * ## Why this sweep PARSES instead of grepping
 *
 * The house pattern for a fence is a regex over the tracked files
 * (`web/src/client/claims.test.ts`, and the `.olai` rename's own). It does not
 * work here, and the reason is worth writing down: the seven words did not go
 * away. `done`, `doing` and `todo` are still the three MARKS — they are what
 * `status` HOLDS — and `date`, `see` and `after` are still the names of the
 * keys, just one level in. `"date":` appears in every migrated fixture in the
 * repository, correctly, inside a `props` map. A regex for the word would
 * report hundreds of lines that are exactly right, and a fence that cries wolf
 * is a fence somebody turns off.
 *
 * What actually changed is STRUCTURAL: where the key sits. So the sweep finds
 * every record literal in the repository, parses it, and asks what its TOP
 * LEVEL keys are. That is precise rather than approximate — no false positive
 * is possible, because the question the fence asks is exactly the question the
 * format answers.
 *
 * ## What the compiler already fences, and why this is the rest
 *
 * `node.done` does not compile: `RegularNode` has no such field, so every
 * TypeScript reader of the old shape is caught by `just typecheck` and needs no
 * sweep. What the compiler cannot see is a STRING — the JSONL in a fixture, in
 * a feature file's docstring, in a test's inline outline, in a document's
 * example. That is precisely the corpus below, and it is where a stale spelling
 * would otherwise survive: it type-checks perfectly, and it only fails when
 * somebody serves the directory it seeds.
 *
 * ## The sabotage proof
 *
 * {@link recordsIn} and {@link legacyKeysIn} are exported to the test at the
 * bottom, which plants violations and watches the sweep find them. That is the
 * half the `.olai` fence had to establish by hand — its author appended a
 * violating line and watched it stay green, twice — and an automated version of
 * it is cheap here because the sweep is a function rather than a regex.
 */

import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.dirname(path.dirname(import.meta.dirname))
const SELF = path.relative(ROOT, import.meta.filename)

/**
 * Every file this repository OWNS, from git rather than from a directory walk.
 *
 * Three reasons, all of them the `.olai` fence's: `git ls-files` means "a file
 * this repo owns", which is the justfile's own idiom; a hand walk sweeps
 * `packages/tests/reports/` and reads e2e failure PNGs as UTF-8; and
 * tracked-only draws the right line on WHEN — an untracked file has not landed,
 * and this is a fence about what lands.
 *
 * A non-zero exit THROWS rather than yielding an empty list, because a sweep
 * that quietly swept nothing is worse than no sweep at all.
 */
const TRACKED: ReadonlyArray<string> = (() => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`)
  }
  return listed.stdout.split("\0").filter((one) => one !== "" && one !== SELF)
})()

/**
 * The files allowed to still spell it, in the three kinds they come in.
 *
 * A trailing `/` is a directory and matches by prefix; anything else is one
 * exact path. The distinction is deliberate: a nearby fence's first draft
 * prefix-matched everything, which silently granted `docs/format.mdx` and
 * `docs/format.md.bak` along with the file it meant.
 *
 * **The record of a past.** Brainstorming documents, RCAs — prose about what
 * was decided, written when the old shape was the shape. History is allowed to
 * quote itself, and rewriting it would be the one thing worse than a stale
 * spelling: a false one.
 *
 * **The vault.** `docs/roadmap.olai` and its archive are OLAI'S OWN OUTLINES,
 * served by olai like anybody else's directory — and the whole design of this
 * change is that a directory is carried across by the boot migration rather
 * than by hand (`@olai/format`'s `migrate.ts`). They are granted because they
 * are DATA waiting for that sweep, not source that was missed. The day somebody
 * runs olai on this repository they will flip, in one commit, exactly as a
 * reader's own vault does.
 *
 * **The two migration tests.** The only live grants, and they are the point of
 * the design rather than exceptions to it: one module reads the old shape, and
 * what proves it — a corpus of records in `@olai/format`, a directory of files
 * in `@olai/server` — has to be written in the shape it reads.
 */
const MAY_SPELL_IT: ReadonlyArray<string> = [
  "docs/RCA/",
  "docs/brainstorming/",
  "docs/Archive.olai",
  "docs/roadmap.olai",
  "packages/format/src/migrate.test.ts",
  "packages/server/src/migrate.test.ts",
]

/** The two above that are olai's own outlines rather than anybody's source —
 *  named again so the liveness test below can say what each grant is FOR. */
const THE_VAULT: ReadonlyArray<string> = ["docs/Archive.olai", "docs/roadmap.olai"]

const granted = (file: string): boolean =>
  MAY_SPELL_IT.some((allowed) =>
    allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed
  )

/** The seven, as they were spelled ON A RECORD. Written out rather than
 *  imported from the migrator's own list, and that is the one duplication this
 *  file wants: a fence that asked the code under test what to look for would go
 *  green the day somebody shortened the list. */
const LEGACY_KEYS: ReadonlyArray<string> = [
  "done",
  "doing",
  "todo",
  "date",
  "see",
  "after",
  "blocks",
]

/**
 * Every JSON object in `text` that looks like a node RECORD — one line, and
 * carrying an `id`.
 *
 * Scanned rather than matched, because a `desc` holds arbitrary text: a note
 * containing `}` or a quoted brace would end a regex's idea of the object in
 * the wrong place, and the record would be parsed as something else or skipped.
 * The scanner tracks string state and escapes, which is the only way to know
 * where a JSON object actually ends.
 *
 * Exported for the sabotage test below: what proves a sweep can go red is
 * running the sweep itself over a planted violation, and that needs the
 * function rather than the file listing.
 */
export const recordsIn = (text: string): ReadonlyArray<Record<string, unknown>> => {
  const found: Array<Record<string, unknown>> = []
  for (let at = 0; at < text.length; at++) {
    if (text[at] !== "{") continue
    // A record literal starts with a quoted key. Anything else is a TypeScript
    // object, a template hole, or prose with a brace in it.
    if (!/^\{"[a-zA-Z]+":/.test(text.slice(at, at + 24))) continue

    let depth = 0
    let inString = false
    let escaped = false
    for (let cursor = at; cursor < text.length; cursor++) {
      const ch = text[cursor]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === "\\") escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === "{") depth++
      else if (ch === "}") {
        depth--
        if (depth === 0) {
          try {
            const json: unknown = JSON.parse(text.slice(at, cursor + 1))
            // A RECORD is an object carrying an id. That excludes the many
            // other JSON objects in this repository — a wire frame, a settings
            // blob, a JSON Schema — which have no business being judged by a
            // rule about the outline format.
            if (
              json !== null && typeof json === "object" && !Array.isArray(json) &&
              typeof (json as Record<string, unknown>)["id"] === "string"
            ) {
              found.push(json as Record<string, unknown>)
            }
          } catch {
            // Not JSON: a TypeScript literal with a `${hole}` in it, most
            // likely. Nothing to judge.
          }
          at = cursor
          break
        }
      } else if (ch === "\n") break
    }
  }
  return found
}

/** The old field names this record still carries at its TOP LEVEL — empty for
 *  one in the new shape, however many of the same words appear inside its
 *  `props`. */
export const legacyKeysIn = (
  record: Record<string, unknown>,
): ReadonlyArray<string> => LEGACY_KEYS.filter((key) => key in record)

/** Every offence in the repository: the file, and what it still spells. */
const offences = (): ReadonlyArray<{ file: string; keys: ReadonlyArray<string> }> =>
  TRACKED
    .filter((file) => !granted(file))
    .flatMap((file) => {
      const keys = new Set<string>()
      for (const record of recordsIn(read(file))) {
        for (const key of legacyKeysIn(record)) keys.add(key)
      }
      return keys.size === 0 ? [] : [{ file, keys: [...keys].sort() }]
    })
    .sort((a, b) => (a.file < b.file ? -1 : 1))

const read = (file: string): string => {
  try {
    return fs.readFileSync(path.join(ROOT, file), "utf8")
  } catch {
    // A binary file, or one whose bytes are not UTF-8. It holds no record.
    return ""
  }
}

// ── the sweep is real before it is green ───────────────────────────────

/** A floor, not a count. A sweep that quietly swept nothing is a green run that
 *  checked one file, and it is the failure mode every fence in this repo is
 *  written against. */
test("the sweep is reading the repository", () => {
  expect(TRACKED.length).toBeGreaterThan(200)
})

/**
 * The SECOND anti-vacuity floor, and the one this fence specifically needs:
 * the corpus of records.
 *
 * The scanner is the load-bearing part here, not the listing — a regex typo
 * that made {@link recordsIn} return nothing would leave the test above green
 * and this whole file inert. So the number of records it actually finds is
 * asserted too. They are all in the NEW shape, which is what the sweep below
 * says; this says there are hundreds of them to have said it about.
 */
test("the scanner finds the repository's records", () => {
  const records = TRACKED.flatMap((file) => recordsIn(read(file)))
  expect(records.length).toBeGreaterThan(200)
})

// ── the fence ──────────────────────────────────────────────────────────

/**
 * The sweep. Equality to a named list rather than `toBeEmpty()`, which is
 * `claims.test.ts`' honesty trick: a rotted matcher reports an empty list and
 * FAILS, rather than passing quietly for the wrong reason.
 */
test("no record in this repository spells a node's facts as fields", () => {
  expect(offences()).toEqual([])
})

/**
 * The grants are LIVE, not just listed.
 *
 * A grant nobody needs is a hole waiting for somebody to walk through: the
 * migrator's allowance exists because it reads the old shape, and the day it
 * stops doing that the allowance must go with it rather than sitting open. So
 * each entry that names an exact FILE is required to still contain what it was
 * granted for.
 *
 * The directory grants are the record of the past — brainstorming, RCAs, the
 * roadmap and its archive — and are not asked the same question: they are
 * allowed to stop mentioning it, because history is allowed to be about
 * something else.
 */
test("every file-level grant is still spelling what it was granted for", () => {
  const files = MAY_SPELL_IT.filter((one) => !one.endsWith("/"))
  const spelling = files.filter((file) =>
    recordsIn(read(file)).some((record) => legacyKeysIn(record).length > 0)
  )
  expect(spelling.slice().sort()).toEqual([
    ...THE_VAULT,
    "packages/format/src/migrate.test.ts",
    "packages/server/src/migrate.test.ts",
  ].sort())
})

/**
 * And the vault's grant is the one with an EXPIRY, said out loud.
 *
 * `docs/roadmap.olai` is granted because it is data this PR deliberately does
 * not touch — the boot migration is what carries a directory across, and olai's
 * own is not a special case. When somebody serves this repository the file
 * flips, this test goes red, and the right fix is to delete the grant rather
 * than to re-widen it. A fence that could not tell "not yet" from "never" would
 * leave that hole open for good.
 */
test("the vault is granted because it has not been served yet, not for ever", () => {
  const waiting = THE_VAULT.filter((file) =>
    recordsIn(read(file)).some((record) => legacyKeysIn(record).length > 0)
  )
  expect(waiting.length).toBeGreaterThan(0)
})

// ── the sabotage ───────────────────────────────────────────────────────

/**
 * The fence, watched going red.
 *
 * This is the half a regex fence in this repo had to establish by hand — its
 * author appended a violating line and watched the sweep stay green, twice,
 * before the grant was tightened. Here the sweep is a function, so the
 * sabotage can be automated and run on every CI leg: a planted record in every
 * one of the seven spellings, and the two shapes that must NOT be reported.
 */
test("a planted violation is caught, in every one of the seven spellings", () => {
  for (const key of LEGACY_KEYS) {
    const planted = `{"id":"x","ord":"a0","title":"t","${key}":${
      key === "see" || key === "after" || key === "blocks" ? `["y"]` : `true`
    }}`
    const records = recordsIn(planted)
    expect(records).toHaveLength(1)
    expect(legacyKeysIn(records[0] as Record<string, unknown>)).toEqual([key])
  }
})

test("the new shape is not reported, however many of the words are inside it", () => {
  const legal =
    `{"id":"x","ord":"a0","title":"t","props":{"status":"done","since":"2026-08-11",` +
    `"date":"2026-08-10","after":["a"],"blocks":["b"],"see":["c"],"todo":"a user key"}}`
  const records = recordsIn(legal)
  expect(records).toHaveLength(1)
  expect(legacyKeysIn(records[0] as Record<string, unknown>)).toEqual([])
})

/**
 * The scanner survives the thing that breaks a regex: a note with braces and
 * quotes in it, which is exactly what `desc` holds and exactly what would make
 * a pattern-matched object end in the wrong place.
 */
test("a record whose note is full of braces and quotes is still read whole", () => {
  const gnarly =
    `{"id":"x","ord":"a0","title":"t","desc":"a \\"quoted\\" {brace} and a \\\\ backslash",` +
    `"done":true}`
  const records = recordsIn(gnarly)
  expect(records).toHaveLength(1)
  expect(legacyKeysIn(records[0] as Record<string, unknown>)).toEqual(["done"])
})
