/**
 * A confirm's three states, and the moves between them (`./confirming.ts`).
 *
 * WHAT IS HERE AND WHAT IS NOT, said first because the split is the honest
 * part. The transition table below is a value in and a value out, so it is a
 * unit test. The DISARM — an armed question going away when its subject moves
 * — is a Solid effect, and `bun test` resolves Solid's server build, where an
 * effect does not run at all: a test of it here would pass for the wrong
 * reason today and go on passing on the day the effect is deleted. It is
 * pinned where it can actually happen, in a browser, by
 * `dragdrop_multiselect.feature`'s "The question does not outlive the rows it
 * is about" — which is also the scenario that caught the comparison-instead-of-
 * a-watch spelling this module tried on its way here.
 *
 * The reason the module exists at all is `./saying.ts`'s: the rule was written
 * inside the selection bar, found there as a bug, and then needed a second time
 * by the Trash's `Empty trash`.
 */

import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { type Confirming, createConfirming } from "./confirming.ts"

/** An owner, because the state behind the question is a signal and Solid wants
 *  one. The subject is a constant: nothing below is about it moving. */
const withConfirming = (run: (confirm: Confirming) => void): void => {
  createRoot((dispose) => {
    run(createConfirming(() => "unchanging"))
    dispose()
  })
}

test("it rests OFFERED — a control nobody has pressed is not asking anything", () => {
  withConfirming((confirm) => {
    expect(confirm.where()).toBe("offered")
  })
})

test("asking raises the question, and dropping it writes nothing", () => {
  // `drop` is what `Cancel` sends, and the whole of what it does is put the
  // control back — the caller's verb is never reached.
  withConfirming((confirm) => {
    confirm.ask()
    expect(confirm.where()).toBe("asking")
    confirm.drop()
    expect(confirm.where()).toBe("offered")
  })
})

test("a write in flight is its OWN state, not a flag beside the question", () => {
  // Which is the whole reason this is one value: `asking && working` is a
  // combination two booleans can spell and nothing means, and a reader would
  // have to hold both to know what is on screen.
  withConfirming((confirm) => {
    confirm.ask()
    confirm.begin()
    expect(confirm.where()).toBe("working")
    confirm.done()
    expect(confirm.where()).toBe("offered")
  })
})

test("going ahead does not need the question first — the caller owns the verb", () => {
  // `begin` is reachable from `offered` on purpose: what this module holds is
  // where the control IS, never a protocol the caller has to walk in order.
  withConfirming((confirm) => {
    confirm.begin()
    expect(confirm.where()).toBe("working")
  })
})
