/**
 * What the composer is armed with, as state.
 *
 * No DOM: it is a list of ids and four functions over it, which is the whole
 * reason arming lives outside the two components that share it — the row that
 * fires it and the strip that draws it are at opposite ends of the app.
 *
 * The claims worth holding are the two a person can actually produce: arming
 * the same row twice (which is what happens when the strip is not on screen),
 * and a send that came back refused (which has to put back exactly what it
 * took, and only into a strip nobody has touched since).
 */

import { describe, expect, test } from "bun:test"

import { armedNodes, armNode, disarmNode, releaseArmed, restoreArmed } from "./armed.ts"

/** The module is one signal, so every test leaves it as it found it. */
const empty = (): void => {
  releaseArmed()
}

describe("arming", () => {
  test("nothing is armed until a row says so, in the order it says it", () => {
    empty()
    expect(armedNodes()).toEqual([])
    armNode("order")
    armNode("kitchen")
    expect(armedNodes()).toEqual(["order", "kitchen"])
    empty()
  })

  test("arming the same row twice is one chip", () => {
    // Which is a thing a person does whenever they cannot see the strip: the
    // panel is minimized, or the chip is off the end of it. Two chips would be
    // two lines of one prompt naming one node.
    empty()
    armNode("order")
    armNode("order")
    expect(armedNodes()).toEqual(["order"])
    empty()
  })

  test("a chip can be taken off before the message goes", () => {
    empty()
    armNode("order")
    armNode("kitchen")
    disarmNode("order")
    expect(armedNodes()).toEqual(["kitchen"])
    empty()
  })
})

describe("sending", () => {
  test("a send takes what is armed and leaves the strip empty", () => {
    empty()
    armNode("order")
    expect(releaseArmed()).toEqual(["order"])
    expect(armedNodes()).toEqual([])
  })

  test("a REFUSED send puts back what it threw away", () => {
    empty()
    armNode("order")
    const held = releaseArmed()
    restoreArmed(held)
    expect(armedNodes()).toEqual(["order"])
    empty()
  })

  test("...but never over a row armed while the answer was in flight", () => {
    // The attachment strip's rule, and for its reason: what somebody is doing
    // now beats what they were doing a round trip ago.
    empty()
    armNode("order")
    const held = releaseArmed()
    // ...a row is armed while the send is in flight, and only then does the
    // refusal come back.
    armNode("install")
    restoreArmed(held)
    expect(armedNodes()).toEqual(["install"])
    empty()
  })
})
