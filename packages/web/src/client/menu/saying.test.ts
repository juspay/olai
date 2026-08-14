/**
 * What a verb's answer becomes (`./saying.ts`).
 *
 * These four rules used to be reachable only by driving a browser, because
 * they lived inside the panel's component — so the e2e suite held the two that
 * a scenario happens to look at and nothing held the others. Splitting the
 * running of a verb out of the drawing of a menu is what makes them a unit
 * test, and the throw is the one worth having here: it is the ordinary path
 * for a clipboard on any page not served over https, and its whole job is to
 * be visible.
 */

import { expect, spyOn, test } from "bun:test"
import { createRoot } from "solid-js"

import type { MenuAction } from "./action.ts"
import { createSaying, type Saying } from "./saying.ts"

/** An owner, because `createSaying` registers a cleanup — and disposing it is
 *  not a formality: it clears the six-second timer the line would otherwise
 *  leave running past the end of this file. */
const withSaying = async (run: (saying: Saying) => Promise<void>): Promise<void> => {
  let dispose = (): void => {}
  const saying = createRoot((stop) => {
    dispose = stop
    return createSaying()
  })
  try {
    await run(saying)
  } finally {
    dispose()
  }
}

const verb = (label: string, run: MenuAction["run"]): MenuAction => ({ id: label, label, run })

test("a verb with nothing to say leaves the line off entirely", async () => {
  // The absence is the assertion: an empty `Said` would be a bordered box with
  // no words in it under the `•••`, which is what this client shipped once.
  await withSaying(async (saying) => {
    await saying.pick(verb("Zoom in", () => {}))
    expect(saying.said()).toBeNull()
  })
})

test("a verb's own sentence is drawn verbatim, in the mood it chose", async () => {
  // The ops layer is the only one that carries a REASON — a mark refused over
  // finished work, a placement three rows still name — so nothing here rewords
  // it or decides its tone.
  const refusal = { tone: "alarm", text: "“install” is finished; clear it first" } as const
  await withSaying(async (saying) => {
    await saying.pick(verb("Mark todo", () => Promise.resolve(refusal)))
    expect(saying.said()).toEqual(refusal)
  })
})

test("a verb that THROWS is worded from its own label, and the cause is kept", async () => {
  // The clipboard's ordinary path: `navigator.clipboard` is refused outside a
  // secure context, which is every LAN reader on plain http. Swallowed, a copy
  // that never happened looked exactly like one that did.
  const warned = spyOn(console, "warn").mockImplementation(() => {})
  const cause = new Error("the clipboard is not available")
  try {
    await withSaying(async (saying) => {
      await saying.pick(verb("Copy link to node", () => Promise.reject(cause)))
      expect(saying.said()).toEqual({ tone: "alarm", text: "couldn't copy link to node" })
    })
    // ...and the cause is in the console rather than nowhere: a browser's
    // denial and a bug in this app's own href-building read the same on
    // screen, and must not read the same to somebody debugging it.
    expect(warned.mock.calls).toEqual([[`olai: "Copy link to node" did not happen`, cause]])
  } finally {
    warned.mockRestore()
  }
})

test("the next verb clears the last one's line before it runs", async () => {
  // Otherwise a remark from the verb before it sits under the `•••` while the
  // next one is still going, and reads as that one's answer.
  await withSaying(async (saying) => {
    await saying.pick(verb("Copy as text", () => Promise.resolve({ tone: "aside", text: "text copied" } as const)))
    expect(saying.said()).not.toBeNull()
    await saying.pick(verb("Zoom in", () => {}))
    expect(saying.said()).toBeNull()
  })
})
