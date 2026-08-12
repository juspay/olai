/**
 * A drop, sorted by the one gate — and then said in one answer.
 *
 * Two halves, and they are the same rule seen from two sides. {@link sorting}
 * is the MIXED drop: pictures and something else, let go of together, judged
 * before any of it is sent. {@link createHolding}'s `take` is what happens to
 * those answers afterwards, and it is the half that was a BUG: a refusal drawn
 * as it arrived was rubbed out by the next picture's upload, so a file dropped
 * into the panel could disappear with nothing on screen about it. The gate's
 * reasons and the server's are collected together and said once, which is what
 * the second half of this file holds still.
 */

import { UsageFailure } from "@olai/surface"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createHolding, sorting } from "./holding.ts"
import type { Chat, Uploaded } from "./state.ts"

const file = (name: string, type: string) => new File([new Uint8Array(3)], name, { type })

test("a drop of pictures is taken whole, in the order it arrived", () => {
  const dropped = [file("one.png", "image/png"), file("two.jpg", "image/jpeg")]
  const { taking, refusals } = sorting(dropped)

  expect(taking.map((each) => each.name)).toEqual(["one.png", "two.jpg"])
  expect(refusals).toEqual([])
})

test("a mixed drop takes what it can and owes a refusal for the rest", () => {
  const { taking, refusals } = sorting([
    file("shot.png", "image/png"),
    file("notes.txt", "text/plain"),
    file("archive.zip", "application/zip"),
    file("logo.svg", "image/svg+xml"),
  ])

  // The pictures and the DOCUMENTS are not held hostage by the files beside
  // them, and their order is unchanged by the removal.
  expect(taking.map((each) => each.name)).toEqual(["shot.png", "notes.txt"])
  // BOTH of them are named — this is the whole point. One refusal per file,
  // said together, so a drop cannot lose a file quietly.
  expect(refusals.length).toBe(2)
  expect(refusals[0]).toContain("archive.zip")
  expect(refusals[1]).toContain("logo.svg")
})

test("an SVG is refused, whatever the drag calls it", () => {
  // A picture as far as the drag is concerned; a document that can script as
  // far as this app is. WHY it is refused is `@olai/surface`'s to say and its
  // own test's to pin — what this one claims is that the answer reaches the
  // refused pile rather than the upload.
  const { taking, refusals } = sorting([file("logo.svg", "image/svg+xml")])

  expect(taking).toEqual([])
  expect(refusals.length).toBe(1)
})

test("what is judged is the name that will be SENT, not the one dragged", () => {
  // A clipboard picture often arrives with no usable name at all. The upload
  // names it after its type, so the gate has to be asked about that name —
  // judging the raw one would refuse exactly what paste goes on to accept.
  const { taking, refusals } = sorting([file("image", "image/webp")])

  expect(taking.length).toBe(1)
  expect(refusals).toEqual([])
})

test("nothing dropped is nothing taken and nothing said", () => {
  expect(sorting([])).toEqual({ taking: [], refusals: [] })
})

// ── what the whole gesture says ────────────────────────────────────────
//
// `take` needs a conversation to attach to, and the three members it uses are
// the three below: where the session is (so chips can be dropped when it
// changes), what an upload answered, and the panel's one refusal line. The
// rest of `Chat` is the transcript and the verbs a composer clicks, and no
// part of this is their business — hence the cast rather than a stub with a
// dozen members nothing calls.
//
// It also needs an OWNER, because `createHolding` keeps an effect: `createRoot`
// is what a component would have given it.

/** A file that CLAIMS a size rather than allocating one. The gate reads
 *  `File.size` and nothing else, so a test that really made 51 MB would be
 *  spending memory to say a number. */
const oversized = (name: string): File => {
  const claiming = file(name, "image/png")
  Object.defineProperty(claiming, "size", { value: 51 * 1024 * 1024 })
  return claiming
}

const conversation = (answering: (file: File) => Uploaded) => {
  const said: Array<ReadonlyArray<string>> = []
  const chat = {
    state: () => ({ session: { id: "one" } }),
    attach: (file: File) => Promise.resolve(answering(file)),
    refuse: (reasons: ReadonlyArray<string>) => said.push(reasons),
  } as unknown as Chat
  return { chat, said }
}

const stored = (name: string): Uploaded => ({
  _tag: "stored",
  stored: { path: `/tmp/olai-chat-x/${name}`, name },
})

const refused = (reason: string): Uploaded => ({
  _tag: "refused",
  failure: new UsageFailure({ reason }),
})

test("a refusal from the SERVER survives the picture that uploads after it", async () => {
  // The bug this is here for: the panel used to draw each answer as it came,
  // so the third file's upload rubbed out the second file's reason and a drop
  // of three ended with two chips and nothing said about the third.
  const { chat, said } = conversation((file) =>
    file.name === "two.png" ? refused(`the server will not take ${file.name}`) : stored(file.name)
  )
  let dispose = () => {}
  const holding = createRoot((stop) => {
    dispose = stop
    return createHolding(chat)
  })

  await holding.take([
    file("one.png", "image/png"),
    file("two.png", "image/png"),
    file("three.png", "image/png"),
  ])

  expect(holding.pending().map((attachment) => attachment.name)).toEqual([
    "one.png",
    "three.png",
  ])
  // The LAST thing said is what is on screen when the gesture ends, and it
  // still names the file that did not make it.
  expect(said.at(-1)).toEqual(["the server will not take two.png"])
  // ... and the first thing it said was nothing at all: one gesture's answer
  // does not begin with the last one's still up.
  expect(said[0]).toEqual([])
  dispose()
})

test("two files refused for two different reasons are both named, in one answer", async () => {
  // Same sentence twice is easy to get right by accident. These two come from
  // different arms of the gate — a kind and a size — so a `take` that kept
  // only one of them, or only one KIND of them, says so here.
  const { chat, said } = conversation((file) => stored(file.name))
  let dispose = () => {}
  const holding = createRoot((stop) => {
    dispose = stop
    return createHolding(chat)
  })

  await holding.take([
    file("archive.zip", "application/zip"),
    oversized("huge.png"),
    file("shot.png", "image/png"),
  ])

  // The picture between them is not held hostage by either.
  expect(holding.pending().map((attachment) => attachment.name)).toEqual(["shot.png"])
  const answer = said.at(-1) ?? []
  expect(answer.length).toBe(2)
  expect(answer[0]).toContain("archive.zip")
  expect(answer[1]).toContain("huge.png")
  // Two reasons, not one repeated: the second is about SIZE and the first is
  // not, which is the difference a single joined sentence would hide.
  expect(answer[0]).not.toEqual(answer[1] ?? "")
  dispose()
})
