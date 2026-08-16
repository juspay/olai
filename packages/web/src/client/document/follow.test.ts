/**
 * THE ONE RULE THIS APP SPELLS TWICE, held to its own copy.
 *
 * "Which press is the reader's plain intent" has a home: `../press.ts`'s
 * `ours`, which the router's own header calls one rule about what a click
 * means, and which moved out of the router the day a third surface needed it.
 * The seal's link handler is the fourth caller and the one that CANNOT have it:
 * it is text in a template literal (`@olai/surface`'s `seal.ts`, `FOLLOW`),
 * shipped into a frame with no module system, and `@olai/surface` could not
 * import `@olai/web` even if the frame could. So the rule is spelled twice, and
 * `seal.ts` says so out loud.
 *
 * What that argument covers is drift in ONE direction: a handler that stops
 * claiming a press `ours` would still claim just degrades to the behaviour
 * before any of this, which the sandbox refuses anyway. It says nothing about
 * the other direction — a press this app has decided is NOT its own (a new
 * modifier, a new exclusion added to `ours`) still being claimed inside the
 * frame, which would be one surface answering a click every other surface
 * leaves to the browser. Nothing caught that: `seal.test.ts` extracts and
 * checks the handler's two DATA duplications (the message prefix, the suffix
 * list interpolated from the registry) and cannot reach `press.ts` to check the
 * one that is hand-copied LOGIC.
 *
 * So it is checked here, in the only package that can see both — `@olai/web`
 * imports the seal for its `SEAL` and owns `press.ts` — and it is checked by
 * RUNNING the shipped source rather than by comparing text: the guard is lifted
 * out of `SEAL` and evaluated against every combination of the facts a press
 * has, beside `ours` on the same input. A rewording of either that keeps the
 * meaning passes; a change to what either MEANS fails, naming the press.
 *
 * The extraction throws rather than skipping when it finds nothing, which is
 * `seal.test.ts`'s own idiom for reading its constants back out of the script:
 * a regex that quietly matched nothing is a test that quietly stopped testing.
 */

import { SEAL } from "@olai/surface"
import { expect, test } from "bun:test"

import { ours } from "../press.ts"

/** The facts a press has, as this rule reads them — the two `ours` judges
 *  besides the modifiers, and the four modifiers themselves. */
interface Press {
  readonly defaultPrevented: boolean
  readonly button: number
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
}

/**
 * The seal's own gate, lifted out of the script it ships in and made callable.
 *
 * Everything between the click listener's opening brace and the line that goes
 * looking for a link is the guard — the part that decides whether this press is
 * one to consider at all — so it is taken whole and given a `return true` to
 * fall through to. Anything the guard refuses returns early, exactly as it does
 * in the frame: a BARE `return`, so what comes back for a refused press is
 * `undefined` rather than `false`, and `=== true` is the faithful reading of it
 * (in the frame that early return is the listener simply stopping).
 */
const claims = ((): ((press: Press) => boolean) => {
  const found = /addEventListener\("click", function \(event\) \{\n([\s\S]*?)\n\s*var node/
    .exec(SEAL)
  if (found === null) {
    throw new Error(
      `the seal's click handler has no guard to read — this test cannot see what ` +
        `it is comparing against:\n${SEAL}`,
    )
  }
  const guard = new Function("event", `${found[1]!}\n  return true`) as (press: Press) => unknown
  return (press) => guard(press) === true
})()

/** Every combination of the six facts: 64 presses, which is small enough to
 *  take all of rather than sample. */
const PRESSES: ReadonlyArray<Press> = [false, true].flatMap((defaultPrevented) =>
  [0, 1].flatMap((button) =>
    [false, true].flatMap((metaKey) =>
      [false, true].flatMap((ctrlKey) =>
        [false, true].flatMap((shiftKey) =>
          [false, true].map((altKey) => ({
            defaultPrevented,
            button,
            metaKey,
            ctrlKey,
            shiftKey,
            altKey,
          }))
        )
      )
    )
  )
)

test("the seal's injected click gate answers exactly what this app calls its own press", () => {
  const disagreed = PRESSES.filter((press) =>
    claims(press) !== ours(press as unknown as MouseEvent)
  )
  expect(disagreed).toEqual([])
})

// …and the table is not trivially one-sided: a rule that claimed everything, or
// nothing, would agree with a broken `ours` and pass the assertion above.
test("that agreement is over presses of both kinds", () => {
  expect(PRESSES.filter((press) => claims(press)).length).toBe(1)
  expect(PRESSES.filter((press) => !claims(press)).length).toBe(PRESSES.length - 1)
})
