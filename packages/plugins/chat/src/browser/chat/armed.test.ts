import { describe, expect, test } from "bun:test"

import { createArmed } from "./armed.ts"
const { armedNodes, armNode, disarmNode, releaseArmed, restoreArmed } = createArmed()

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
    empty()
    armNode("order")
    const held = releaseArmed()
    armNode("install")
    restoreArmed(held)
    expect(armedNodes()).toEqual(["install"])
    empty()
  })
})
