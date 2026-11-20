import { TEST_CLAIMS } from "olai-plugin-outline-olai/testlib"
import { createHash } from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

import { NO_KINDS } from "@olai/format"
import { serializeOutline } from "olai-plugin-outline-olai/format"
import { expect, test } from "bun:test"
import { Result } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import { plan, scoping, VERBS } from "./plan.ts"
import { BROKEN, DOCUMENTS, OUTLINES, SCRIPT } from "./plans.testlib.ts"

const FIXTURE = path.join(import.meta.dir, "plans.golden.json")

interface Row {
  readonly what: string
  readonly sha: string
}

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

const answered = (outcome: ReturnType<typeof plan>): unknown =>
  Result.isSuccess(outcome)
    ? { planned: outcome.success }
    : {
      refused: outcome.failure._tag,
      message: outcome.failure.message,
      detail: outcome.failure.toJSON(),
    }

const run = (): ReadonlyArray<{ readonly what: string; readonly said: unknown }> => {
  const texts: Record<string, string> = { ...OUTLINES }
  const bodies = new Map<string, string>()
  const bare = new Set<string>()
  for (const document of DOCUMENTS) {
    if (typeof document === "string") bare.add(document)
    else bodies.set(document[0], document[1])
  }
  const reading = () =>
    readingOf(setOf(texts, [...bare, ...[...bodies.entries()].map(([file, text]) => [file, text] as const)], BROKEN))

  const context = steady()
  let at = scoping(reading(), context, NO_KINDS, "outline-olai")
  const said: Array<{ readonly what: string; readonly said: unknown }> = []
  for (const step of SCRIPT) {
    const made = plan(at, step.op)
    said.push({ what: step.what, said: canonical(answered(made)) })
    if (Result.isFailure(made)) continue
    for (const file of made.success.files) texts[file.file] = serializeOutline(file.nodes)
    for (const document of made.success.documents ?? []) bodies.set(document.file, document.text)
    for (const path of made.success.removed ?? []) {
      delete texts[path]
      bodies.delete(path)
      bare.delete(path)
      expect([path in texts, bodies.has(path), bare.has(path)]).toEqual([
        false,
        false,
        false,
      ])
    }
    at = scoping(reading(), context, NO_KINDS, "outline-olai")
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
  expect(rows.map((row) => row.what)).toEqual(recorded.map((row) => row.what))
  for (const [at, row] of rows.entries()) {
    const held = recorded[at] as Row
    if (row.sha === held.sha) continue
    throw new Error(
      `step ${at} (${row.what}) no longer answers what was recorded.\n` +
        `now: ${JSON.stringify(said[at]?.said, null, 2)}`,
    )
  }
})

test("the script asks every op kind, and asks each of them on both sides of its gate", () => {
  const asked = new Set(SCRIPT.map((step) => step.op.op))
  expect([...asked].sort()).toEqual([...VERBS].sort())
  const said = run()
  const answering = new Set<string>()
  const refusing = new Set<string>()
  said.forEach((step, at) => {
    const verb = (SCRIPT[at] as { readonly op: { readonly op: string } }).op.op
    const held = typeof step.said === "object" && step.said !== null && "refused" in step.said
    ;(held ? refusing : answering).add(verb)
  })
  expect([...asked].filter((verb) => !answering.has(verb))).toEqual([])
  expect([...asked].filter((verb) => !refusing.has(verb))).toEqual([])
})
