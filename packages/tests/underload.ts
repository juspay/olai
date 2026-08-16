/**
 * What a loaded run dropped, counted — the reading half of `underload.sh`.
 *
 * These failures are ONE scenario in a run of six hundred, never the same one
 * twice, so the fact worth having is a census rather than a log: which
 * scenarios went, how often, in how many runs, and what each said. A person
 * reading five `.err` files by hand gets the first of those and none of the
 * rest.
 *
 * It reads the cucumber MESSAGE stream rather than the pretty output, because
 * the pretty output is for a human at the end of one run and this is arithmetic
 * over thirty. Every non-passing step is a row: the scenario, the step, how
 * long it took (which is what says whether a budget was reached or a key was
 * lost), and the harness's own sentence.
 *
 *   bun underload.ts reports/under-load
 */
import * as fs from "node:fs"
import * as path from "node:path"

interface Dropped {
  readonly run: string
  readonly scenario: string
  readonly uri: string
  readonly step: string
  readonly ms: number
  readonly message: string
}

/** Every non-passing step in one run's message stream.
 *
 *  Three lookups because the stream names things by id and not by name: a
 *  finished step knows its test case, which knows its pickle, which is the
 *  scenario a person wrote. */
const droppedIn = (file: string): ReadonlyArray<Dropped> => {
  const pickles = new Map<string, { name: string; uri: string }>()
  const steps = new Map<string, string>()
  const cases = new Map<
    string,
    { pickleId: string; testSteps: ReadonlyArray<{ id: string; pickleStepId?: string }> }
  >()
  const started = new Map<string, string>()
  const out: Array<Dropped> = []

  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue
    let message: Record<string, any>
    try {
      message = JSON.parse(line)
    } catch {
      continue
    }
    if (message["pickle"] !== undefined) {
      const pickle = message["pickle"]
      pickles.set(pickle.id, { name: pickle.name, uri: pickle.uri })
      for (const step of pickle.steps) steps.set(step.id, step.text)
    }
    if (message["testCase"] !== undefined) {
      cases.set(message["testCase"].id, message["testCase"])
    }
    if (message["testCaseStarted"] !== undefined) {
      started.set(message["testCaseStarted"].id, message["testCaseStarted"].testCaseId)
    }
    if (message["testStepFinished"] !== undefined) {
      const finished = message["testStepFinished"]
      const result = finished.testStepResult
      if (result.status === "PASSED" || result.status === "SKIPPED") continue
      const test = cases.get(started.get(finished.testCaseStartedId) ?? "")
      const pickle = test === undefined ? undefined : pickles.get(test.pickleId)
      const step = test?.testSteps.find((one) => one.id === finished.testStepId)
      out.push({
        run: path.basename(file, ".ndjson"),
        scenario: pickle?.name ?? "(unknown scenario)",
        uri: pickle?.uri ?? "(unknown feature)",
        // A `Before`/`After` hook has no pickle step, and saying so beats an
        // empty column: the server-per-scenario boots in one.
        step: step?.pickleStepId === undefined ? "(hook)" : steps.get(step.pickleStepId) ?? "(step)",
        ms: Math.round((result.duration.seconds * 1e9 + result.duration.nanos) / 1e6),
        message: (result.message ?? "").split("\n")[0] ?? "",
      })
    }
  }
  return out
}

const dir = process.argv[2] ?? "reports/under-load"
const runs = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith(".ndjson"))
  .sort()
if (runs.length === 0) {
  console.error(`no cucumber message streams under ${dir} — has underload.sh run?`)
  process.exit(1)
}

const dropped = runs.flatMap((name) => droppedIn(path.join(dir, name)))
const byRun = new Set(dropped.map((one) => one.run))

console.log(`${runs.length} runs, ${byRun.size} with a drop, ${dropped.length} scenarios dropped\n`)
if (dropped.length === 0) process.exit(0)

/** Grouped by SCENARIO, because "never the same twice" is the claim being
 *  measured and a count per scenario is what answers it. */
const groups = new Map<string, Array<Dropped>>()
for (const one of dropped) {
  const key = `${one.uri} :: ${one.scenario}`
  groups.set(key, [...(groups.get(key) ?? []), one])
}
for (const [key, all] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(all.length).padStart(3)} × ${key}`)
  for (const one of all) {
    console.log(`      ${one.run}  ${String(one.ms).padStart(6)}ms  ${one.step}`)
    console.log(`      ${" ".repeat(one.run.length)}  ${" ".repeat(6)}    ${one.message}`)
  }
}
