/**
 * WHAT THE PLANNER SAID, RECORDED BEFORE ITS SHAPE CHANGED — the gate the
 * `perf-batch-assemble` decomplect is held to.
 *
 * That change is two moves inside {@link ./plan.ts} (roadmap node, ruled with
 * the human 2026-08-25): the questions a planner asks of the set became a value
 * handed in ({@link ./asked.ts}), and the twenty-six-arm switch that dispatched
 * the verbs became a keyed TABLE. Both are behaviour-preserving BY
 * CONSTRUCTION. Neither is behaviour-preserving by inspection, and the two fail
 * in ways the existing suites would not necessarily name: a context that
 * answered a shade differently from asking the set turns into a refusal
 * somebody meets months later, and a table entry keyed at the wrong verb turns
 * into a plan for the wrong op.
 *
 * So the claim is an EQUALITY and this file is the differential. The reference
 * arm is not a second implementation — it is the answers themselves, recorded
 * from the planner as it stood and committed beside this file
 * (`./plans.golden.json`), one row per step of `./plans.testlib.ts`'s script:
 * every op kind, answering and refusing, each planned against the set the steps
 * before it left.
 *
 * **A HASH PER STEP, not the plan itself.** Sixty plans in full is a hundred
 * kilobytes of fixture nobody reads, and the useful failure is not the diff
 * against a wall of JSON — it is "step 34 (`untrash` by the recorded chain)
 * changed", with the new answer printed. So the fixture is the SHA of each
 * step's answer canonicalised as data (keys sorted, so the hash is about the
 * answer and not about the order a literal was built in) and the assertion
 * prints what the step says now when one moves.
 *
 * **HOW TO RE-RECORD, and when it is legitimate.** `OLAI_RECORD_PLANS=1 bun
 * test packages/ops/src/plans.golden.test.ts` rewrites the fixture. It is
 * legitimate when a change to the planner is MEANT to change an answer — a
 * refusal reworded, a verb taught something new — and the diff on the fixture
 * is then a list of which steps moved, which is exactly what such a PR should
 * show. It is not legitimate as a way past a failure nobody understands.
 *
 * **PROVENANCE, stated because a golden is only as good as its recording.** The
 * rows were recorded on this branch before the decomplect landed, from a
 * planner otherwise identical to `master`'s: the two edits already in the tree
 * at that point were the untrash signpost's membership test
 * (`outlinePaths(...).includes` → `outlineNames(...).has`) and the did-you-mean
 * candidates (a concatenated generator → the declared map plus the minted ids),
 * and both are equalities with differentials of their own
 * (`@olai/format`'s `suggest.test.ts`, `./walks.test.ts`). Everything else in
 * this file's subject — every refusal, every record, every summary — is the
 * braid's own answer.
 */

import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

import { serializeOutline } from "@olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { plan, scoping } from "./plan.ts"
import { BROKEN, DOCUMENTS, OUTLINES, SCRIPT } from "./plans.testlib.ts"

const FIXTURE = path.join(import.meta.dir, "plans.golden.json")

/** One recorded row: which step, and the hash of what it answered. The phrase
 *  travels with the hash so a diff on the fixture reads as a list of verbs
 *  rather than of indices. */
interface Row {
  readonly what: string
  readonly sha: string
}

/**
 * An answer as DATA, with every object's keys in one order.
 *
 * The hash has to be about what the planner said and not about the order a
 * literal happened to spread its fields in — a refactor that builds the same
 * record with `{...node, title}` instead of `{title, ...node}` is not a change
 * anybody is owed a failure about.
 */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
        .map(([key, held]) => [key, canonical(held)]),
    )
  }
  return value
}

/** Both arms of what a planner can say, in one shape — because half the script
 *  is refusals and a gate that only recorded the plans would be a gate over
 *  the half that is easy. */
const answered = (outcome: ReturnType<typeof plan>): unknown =>
  Result.isSuccess(outcome)
    ? { planned: outcome.success }
    : {
      refused: outcome.failure._tag,
      message: outcome.failure.message,
      detail: outcome.failure.toJSON(),
    }

/**
 * The script, run.
 *
 * A step that ANSWERS leaves its plan behind — through the format's own writer
 * and parser, which is what {@link ./following.ts} does and for its reasons
 * (line numbers are real, and a draft record is not the record the parser
 * produces). A step that REFUSES leaves the set exactly where it was, which is
 * what a refused write leaves behind on disk. So each step is judged against
 * the world the successful steps before it made.
 *
 * ONE `steady()` for the whole run, so the ids a capture mints count up across
 * the script the way they do across a batch — an id in a recorded plan is part
 * of what is being pinned.
 */
const run = (): ReadonlyArray<{ readonly what: string; readonly said: unknown }> => {
  const texts: Record<string, string> = { ...OUTLINES }
  const bodies = new Map<string, string>()
  const bare: Array<string> = []
  for (const document of DOCUMENTS) {
    if (typeof document === "string") bare.push(document)
    else bodies.set(document[0], document[1])
  }
  const reading = () =>
    readingOf(setOf(texts, [...bare, ...[...bodies.entries()].map(([file, text]) => [file, text] as const)], BROKEN))

  const context = steady()
  // ONE SCOPE PER STEP here, deliberately: this file is about what a planner
  // ANSWERS, and a step that refuses leaves the set where it was — so each step
  // is scoped against the reading it is really judged against rather than
  // against a carried context this file is not the test of
  // (`./following.equivalence.test.ts` is).
  let at = scoping(reading(), context)
  const said: Array<{ readonly what: string; readonly said: unknown }> = []
  for (const step of SCRIPT) {
    const made = plan(at, step.op)
    said.push({ what: step.what, said: canonical(answered(made)) })
    if (Result.isFailure(made)) continue
    for (const file of made.success.files) texts[file.file] = serializeOutline(file.nodes)
    for (const document of made.success.documents ?? []) bodies.set(document.file, document.text)
    at = scoping(reading(), context)
  }
  return said
}

const shaOf = (said: unknown): string =>
  createHash("sha256").update(JSON.stringify(said)).digest("hex").slice(0, 16)

test("every op of the script answers what it answered before the decomplect", () => {
  const said = run()
  const rows: ReadonlyArray<Row> = said.map((step) => ({
    what: step.what,
    sha: shaOf(step.said),
  }))

  if (process.env["OLAI_RECORD_PLANS"] === "1") {
    fs.writeFileSync(FIXTURE, `${JSON.stringify(rows, null, 2)}\n`)
    console.log(`recorded ${rows.length} steps into ${FIXTURE}`)
    return
  }

  const recorded = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as ReadonlyArray<Row>
  // THE LIST FIRST, so a step inserted or dropped fails as that rather than as
  // sixty hashes in the wrong places.
  expect(rows.map((row) => row.what)).toEqual(recorded.map((row) => row.what))
  for (const [at, row] of rows.entries()) {
    const held = recorded[at] as Row
    if (row.sha === held.sha) continue
    // The whole answer, printed, because the hash cannot be read: this is the
    // one failure in the suite whose fix needs the value in front of you.
    throw new Error(
      `step ${at} (${row.what}) no longer answers what was recorded.\n` +
        `now: ${JSON.stringify(said[at]?.said, null, 2)}`,
    )
  }
})

/**
 * THE SCRIPT COVERS THE VOCABULARY, asserted rather than believed: a verb the
 * planner grows and the script never asks about is a verb this gate says
 * nothing about, and the failure would be silence.
 *
 * The marks are four ops and one planner, so the check is over the OP names the
 * script sends rather than over the table — what must be true is that no verb
 * an agent can send is missing from the run.
 */
test("the script asks every op kind, and refuses at least one of each shape", () => {
  const asked = new Set(SCRIPT.map((step) => step.op.op))
  expect([...asked].sort()).toEqual([
    "add",
    "after",
    "apply",
    "cancelled",
    "create",
    "create-doc",
    "date",
    "desc",
    "doc",
    "doing",
    "done",
    "duplicate",
    "empty",
    "merge",
    "mirror",
    "move",
    "prop",
    "repeat",
    "see",
    "split",
    "title",
    "todo",
    "trash",
    "unmirror",
    "untrash",
    "update",
  ])
  // Half the script is refusals — the arms that read the SET rather than the
  // request, which are the ones the context change could have moved.
  const said = run()
  const refused = said.filter((step) =>
    typeof step.said === "object" && step.said !== null && "refused" in step.said
  )
  expect(refused.length).toBeGreaterThanOrEqual(20)
  expect(said.length - refused.length).toBeGreaterThanOrEqual(30)
})
