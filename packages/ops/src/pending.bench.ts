/**
 * WHAT ONE KEYSTROKE COSTS THE COMMIT PANEL, at one, ten and fifty dirty
 * outlines — before and after `perf-git-per-write`, both arms in one run.
 *
 * Every published revision surveys git, and the node-level diff needs the copy
 * HEAD holds of every dirty outline. That used to be a `git show HEAD:<file>`
 * subprocess plus a full parse of what came back, PER DIRTY FILE, PER REVISION:
 * under `--commit=manual` the dirty list only grows through a session, so a
 * keystroke in one outline paid for every outline anybody had touched since the
 * last commit. It now reads a commit's copy ONCE — `<sha>:<path>` names an
 * immutable object, so the answer is remembered under the sha it was asked
 * about (`./committed.ts`) — and a keystroke pays one `rev-parse` and nothing
 * else. This is the number for that claim.
 *
 * BOTH ARMS ARE IN THE TREE, which is what this repository requires of a pair
 * of figures: the "before" is the per-file read kept as the differential's
 * reference implementation (`./committed.testlib.ts`'s `forgetful`), so a
 * reader re-running this gets both halves and can compare them on their own
 * hardware rather than taking one laptop's milliseconds on trust.
 *
 * IT IS A LEG, NOT A CLAIM (`just bench`), and deliberately not a dependency of
 * `check`: a timing that fails a lane on a busy machine teaches nobody
 * anything, and perf numbers are reported artifacts and never gates. What the
 * equivalence rests on is `./pending.equivalence.test.ts` — the same two arms,
 * over a scripted git session, in the suite.
 *
 * ONE THING HERE DOES FAIL THE RUN, and it is not a timing: every round
 * compares what the two arms answered, and a single divergence throws. Two arms
 * answering different panels are two arms nobody may compare, and the one shape
 * a flattering ratio takes is an arm that reported magnificently by answering
 * less than it was supposed to.
 *
 * TWO MEASUREMENTS, because the interesting one is not a timing:
 *
 *   - THE SUBPROCESSES, which is the subject. The repository each arm is handed
 *     is counted rather than either implementation being instrumented
 *     (`./committed.testlib.ts`'s `counting`), so what is reported is git
 *     processes spawned PER KEYSTROKE for the committed side — the figure the
 *     roadmap node is about, and the one that does not move with the weather.
 *     The cache's own `rev-parse` is counted like any other, so the "after"
 *     column is what it really costs rather than what it saved.
 *   - THE TIME, alternating and warmed, because a subprocess that cost no wall
 *     clock would be an optimisation nobody needed. It is the WHOLE survey —
 *     `status`, the state probe, the audit read and the committed side — since
 *     that is what a revision actually pays; the constant three sit in both
 *     columns and are exactly what stops the ratio being a fiction.
 *
 * THREE ROWS, because the whole complaint is that the bill GREW: one dirty
 * outline is the keystroke you pay right after a commit, fifty is the same
 * keystroke at the end of an afternoon of deferring one, and the shape of the
 * "before" column between them is the bug. Size them with OLAI_BENCH_DIRTY,
 * the outlines with OLAI_BENCH_RECORDS, the rounds with OLAI_BENCH_EDITS.
 */

import { median, runtimeSaid, timesSaid } from "@olai/format/testlib"
import { Effect } from "effect"

import { node, outline, withArms } from "./pending.testlib.ts"

/** How many dirty outlines each row waits on. The middle one is an ordinary
 *  morning; the last is what manual commit looks like by the afternoon. */
const DIRTY = (process.env["OLAI_BENCH_DIRTY"] ?? "1,10,50")
  .split(",")
  .map((one) => Number(one.trim()))
  .filter((one) => Number.isFinite(one) && one > 0)

/** Outlines in the repository, whatever a row dirties. Bigger than the biggest
 *  row, so every row runs the same directory and the `git status` under both
 *  arms surveys the same number of files — a row that also shrank the
 *  repository would be measuring two things at once. */
const FILES = Math.max(...DIRTY, 50)

/** Records per outline. What this sizes is the PARSE the committed side used to
 *  redo per revision, which is the half of the old cost that is not a
 *  subprocess. */
const RECORDS = Number(process.env["OLAI_BENCH_RECORDS"] ?? 40)

/** Keystrokes per row. */
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
    Array.from({ length: FILES }, (_, which) => [`file${which}.org`, body(which, 0)] as const),
  )

/** One arm over one row: what each keystroke took, and what it spawned. */
interface Arm {
  readonly times: ReadonlyArray<number>
  /** Git subprocesses per keystroke, for the committed side. */
  readonly spawns: number
}

/**
 * One row: `dirty` outlines waiting, then {@link ROUNDS} keystrokes, each timed
 * on both arms in alternating order.
 *
 * The EDIT and the store's re-read are outside the clock: what is timed is the
 * survey a revision pays, and re-reading the directory is the store's own cost
 * and identical for both arms. The alternation is the usual one — going second
 * in a round is worth more than some of the differences this is asked to see.
 */
const row = (dirty: number): Promise<{ readonly before: Arm; readonly after: Arm }> =>
  withArms(corpus(), {}, (arms) =>
    Effect.gen(function*() {
      const { cached, cachedSide, plain, plainSide, session } = arms

      // EVERYTHING WAITING, and both arms warmed on it: the first survey of a
      // generation owes a read for every dirty file on EITHER arm, and timing
      // that would be timing the one revision this change does not claim to
      // make cheaper.
      for (let which = 0; which < dirty; which++) {
        session.write(`file${which}.org`, body(which, 1))
      }
      yield* arms.settle
      yield* cached.status
      yield* plain.status

      const before: Array<number> = []
      const after: Array<number> = []
      let beforeSpawns = 0
      let afterSpawns = 0

      for (let round = 0; round < ROUNDS; round++) {
        // ONE KEYSTROKE: one file that is already waiting, edited again.
        session.write("file0.org", body(0, round + 2))
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

        // THE GATE. Two arms answering different panels are two arms nobody may
        // compare.
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
