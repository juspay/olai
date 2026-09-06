/**
 * What a menu verb's answer becomes (`./picking.ts`).
 *
 * These rules used to be reachable only by driving a browser, because they
 * lived inside the panel's component — so the e2e suite held the one a
 * scenario happens to look at and nothing held the rest. The THROW is the one
 * most worth having here: it is the ordinary path for a clipboard on any page
 * not served over https, and its whole job is to be visible.
 *
 * How long the sentence then lasts is not tested here — that is the line's own
 * question and `../saying.test.ts` holds it.
 */

import { expect, spyOn, test } from "bun:test"
import { createRoot } from "solid-js"

import type { MenuAction } from "./action.ts"
import { createPicking, type Picking } from "./picking.ts"

/** An owner, because the line under this registers a cleanup — and disposing
 *  it clears the six-second timer that would otherwise outlive the file. */
const withPicking = async (run: (picking: Picking) => Promise<void>): Promise<void> => {
  let dispose = (): void => {}
  const picking = createRoot((stop) => {
    dispose = stop
    return createPicking()
  })
  try {
    await run(picking)
  } finally {
    dispose()
  }
}

const verb = (label: string, run: MenuAction["run"]): MenuAction => ({ id: label, label, run })

test("a verb with nothing to say leaves the line off entirely", async () => {
  // The absence is the assertion: an empty `Said` would be a bordered box with
  // no words in it under the `•••`, which is what this client shipped once.
  await withPicking(async ({ said, pick }) => {
    await pick(verb("Zoom in", () => {}))
    expect(said()).toBeNull()
  })
})

test("a verb's own sentence is drawn verbatim, in the mood it chose", async () => {
  // The ops layer is the only one that carries a REASON — a mark refused over
  // finished work, a placement three rows still name — so nothing here rewords
  // it or decides its tone.
  const refusal = { tone: "alarm", text: "“install” is finished; clear it first" } as const
  await withPicking(async ({ said, pick }) => {
    await pick(verb("Mark todo", () => Promise.resolve(refusal)))
    expect(said()).toEqual(refusal)
  })
})

test("a verb that THROWS is worded from its own label, and the cause is kept", async () => {
  // The clipboard's ordinary path: `navigator.clipboard` is refused outside a
  // secure context, which is every LAN reader on plain http. Swallowed, a copy
  // that never happened looked exactly like one that did.
  const warned = spyOn(console, "warn").mockImplementation(() => {})
  const cause = new Error("the clipboard is not available")
  try {
    await withPicking(async ({ said, pick }) => {
      await pick(verb("Copy link to node", () => Promise.reject(cause)))
      expect(said()).toEqual({ tone: "alarm", text: "couldn't copy link to node" })
    })
    // ...and the cause is in the console rather than nowhere: a browser's
    // denial and a bug in this app's own href-building read the same on
    // screen, and must not read the same to somebody debugging it.
    expect(warned.mock.calls).toEqual([[`olai: "Copy link to node" did not happen`, cause]])
  } finally {
    warned.mockRestore()
  }
})

test("the next verb clears the last one's line BEFORE it runs", async () => {
  // Not after: a verb that takes a moment would otherwise run under the
  // previous one's remark, which reads as this one's answer.
  await withPicking(async ({ said, pick }) => {
    await pick(verb("Copy as text", () => Promise.resolve({ tone: "aside", text: "text copied" } as const)))
    expect(said()).not.toBeNull()
    let duringTheAttempt: unknown = "never ran"
    await pick(verb("Zoom in", () => {
      duringTheAttempt = said()
    }))
    expect(duringTheAttempt).toBeNull()
    expect(said()).toBeNull()
  })
})
