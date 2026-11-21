/**
 * WHAT ONE PARSE COSTS — the parser called on its own (`./parse.ts`), on the
 * three shapes of text a directory holds most of: nothing, a short title with
 * no markup, and a title with a link in it.
 *
 * The cost of a short text is the call, not the text, which is why the plain
 * shortcut exists: a title with no markup is its own parse and is never
 * handed to the parser at all.
 *
 * A LEG, NOT A CLAIM (`just bench`): a timing that fails a lane on a busy
 * machine teaches nobody anything. Each arm is the best of several rounds of
 * many calls, printed in microseconds per call.
 */
import { parse } from "./parse.ts"

const ARMS: ReadonlyArray<readonly [label: string, text: string]> = [
  ["empty string", ""],
  ["24-character plain title", "paint the shed doors red"],
  ["68-character title with a link", "check the [finishes](notes/finishes.md) before ordering the cabinets"],
]

const CALLS = Number(process.env["OLAI_BENCH_CALLS"] ?? 2_000)
const ROUNDS = Number(process.env["OLAI_BENCH_ROUNDS"] ?? 7)

/** The best of `ROUNDS` rounds of `CALLS` parses, in µs per parse. */
const perCall = (text: string): number => {
  let best = Number.POSITIVE_INFINITY
  for (let round = 0; round < ROUNDS; round++) {
    const start = Bun.nanoseconds()
    for (let call = 0; call < CALLS; call++) parse(text)
    best = Math.min(best, (Bun.nanoseconds() - start) / CALLS / 1_000)
  }
  return best
}

// Warm the parser before anything is timed: the first call compiles it.
for (const [, text] of ARMS) for (let call = 0; call < 200; call++) parse(text)

console.log(`parse.bench — bun ${Bun.version}, best of ${ROUNDS} rounds of ${CALLS} calls`)
for (const [label, text] of ARMS) {
  if (label.includes("-character") && !label.startsWith(`${text.length}-`)) {
    throw new Error(`the arm "${label}" holds ${text.length} characters`)
  }
  console.log(`  one parse, ${label.padEnd(32)} ${perCall(text).toFixed(1)} µs`)
}
