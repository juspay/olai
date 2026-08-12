/**
 * A drop, sorted by the one gate.
 *
 * The case this projection exists for is the MIXED drop: pictures and
 * something else, let go of together. Sorted up front, the refusals survive
 * the uploads that follow them; asked file by file inside the upload loop,
 * each answer is wiped by the next picture's first chunk and the file nobody
 * mentioned is a file that vanished.
 */

import { expect, test } from "bun:test"

import { sorting } from "./holding.ts"

const file = (name: string, type: string, bytes = 3) =>
  new File([new Uint8Array(bytes)], name, { type })

test("a drop of pictures is taken whole, in the order it arrived", () => {
  const dropped = [file("one.png", "image/png"), file("two.jpg", "image/jpeg")]
  const { taking, refusals } = sorting(dropped)

  expect(taking.map((each) => each.name)).toEqual(["one.png", "two.jpg"])
  expect(refusals).toEqual([])
})

test("a mixed drop takes the pictures and owes a refusal for the rest", () => {
  const { taking, refusals } = sorting([
    file("shot.png", "image/png"),
    file("notes.txt", "text/plain"),
    file("plan.pdf", "application/pdf"),
  ])

  // The pictures are not held hostage by the file beside them, and their order
  // is unchanged by the removal.
  expect(taking.map((each) => each.name)).toEqual(["shot.png"])
  // BOTH of them are named — this is the whole point. One refusal per file,
  // said together, so a drop cannot lose a file quietly.
  expect(refusals.length).toBe(2)
  expect(refusals[0]).toContain("notes.txt")
  expect(refusals[1]).toContain("plan.pdf")
})

test("an SVG is refused with everything else the gate refuses", () => {
  // A picture as far as the drag is concerned; a document that can script as
  // far as this app is. The list is `@olai/format`'s, not a second one here.
  const { taking, refusals } = sorting([file("logo.svg", "image/svg+xml")])

  expect(taking).toEqual([])
  expect(refusals[0]).toContain("not a picture")
})

test("what is judged is the name that will be SENT, not the one dragged", () => {
  // A clipboard picture often arrives with no usable name at all. The upload
  // names it after its type, so the gate has to be asked about that name —
  // judging the raw one would refuse exactly what paste goes on to accept.
  const { taking, refusals } = sorting([file("image", "image/webp")])

  expect(taking.length).toBe(1)
  expect(refusals).toEqual([])
})

test("a file over the cap is refused by size, with the numbers in it", () => {
  const { taking, refusals } = sorting([
    file("huge.png", "image/png", 51 * 1024 * 1024),
  ])

  expect(taking).toEqual([])
  expect(refusals[0]).toContain("50 MB")
})

test("nothing dropped is nothing taken and nothing said", () => {
  expect(sorting([])).toEqual({ taking: [], refusals: [] })
})
