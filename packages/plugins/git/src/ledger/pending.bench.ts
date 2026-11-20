import { median, runtimeSaid, timesSaid } from "@olai/format/testlib"
import { Effect } from "effect"

import { node, outline, withArms } from "./pending.testlib.ts"

const DIRTY = (process.env["OLAI_BENCH_DIRTY"] ?? "1,10,50")
  .split(",")
  .map((one) => Number(one.trim()))
  .filter((one) => Number.isFinite(one) && one > 0)

const FILES = Math.max(...DIRTY, 50)

const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 40)

const ROUNDS = Number(process.env["OLAI_BENCH_EDITS"] ?? 9)

const body = (which: number, edit: number): string =>
  outline(
    ...Array.from(
      { length: RECORDS },
      (_, at) => node(`n${which}-${at}`, `file ${which} record ${at} · ${edit}`),
    ),
  )

const corpus = (): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: FILES }, (_, which) => [`file${which}.olai`, body(which, 0)] as const),
  )

interface Arm {
  readonly times: ReadonlyArray<number>
  readonly spawns: number
}

const row = (dirty: number): Promise<{ readonly before: Arm; readonly after: Arm }> =>
  withArms(corpus(), {}, (arms) =>
    Effect.gen(function*() {
      const { cached, cachedSide, plain, plainSide, session } = arms

      for (let which = 0; which < dirty; which++) {
        session.write(`file${which}.olai`, body(which, 1))
      }
      yield* arms.settle
      yield* cached.status
      yield* plain.status

      const before: Array<number> = []
      const after: Array<number> = []
      let beforeSpawns = 0
      let afterSpawns = 0

      for (let round = 0; round < ROUNDS; round++) {
        session.write("file0.olai", body(0, round + 2))
        yield* arms.settle
        arms.reset()

        const first = round % 2 === 0
        const at = Bun.nanoseconds()
        const one = first ? yield* cached.status : yield* plain.status
        const between = Bun.nanoseconds()
        const two = first ? yield* plain.status : yield* cached.status
        const end = Bun.nanoseconds()

        after.push((first ? between - at : end - between) / 1e6)
        before.push((first ? end - between : between - at) / 1e6)
        afterSpawns += cachedSide.spawns()
        beforeSpawns += plainSide.spawns()

        if (JSON.stringify(one) !== JSON.stringify(two)) {
          throw new Error(
            `the two arms answered differently at ${dirty} dirty, round ${round}, ` +
              `so neither number means anything:\n${JSON.stringify(one)}\n${JSON.stringify(two)}`,
          )
        }
      }

      return {
        before: { times: before, spawns: beforeSpawns / ROUNDS },
        after: { times: after, spawns: afterSpawns / ROUNDS },
      }
    }))

console.log(
  `repository: ${FILES} outlines × ${RECORDS} records, ${ROUNDS} keystrokes per row\n` +
    `${runtimeSaid()}\n`,
)

for (const dirty of DIRTY) {
  const { after, before } = await row(dirty)
  console.log(`${dirty} dirty outline${dirty === 1 ? "" : "s"} waiting`)
  console.log(`  ${timesSaid("before", before.times, 7)}`)
  console.log(`  ${timesSaid("after", after.times, 7)}`)
  console.log(
    `  git subprocesses for the committed side, per keystroke: ` +
      `${before.spawns.toFixed(1)} → ${after.spawns.toFixed(1)}`,
  )
  console.log(
    `  one keystroke, against the per-file read it replaced: ` +
      `${(median(before.times) / median(after.times)).toFixed(1)}×\n`,
  )
}
