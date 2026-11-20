import { UsageFailure } from "@olai/format"
import { expect, test } from "bun:test"
import { createRoot } from "solid-js"

import { createHolding, createHoldingMemory, sorting } from "./holding.ts"
import type { UploadProgress } from "./attach.ts"
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

  expect(taking.map((each) => each.name)).toEqual(["shot.png", "notes.txt"])
  expect(refusals.length).toBe(2)
  expect(refusals[0]).toContain("archive.zip")
  expect(refusals[1]).toContain("logo.svg")
})

test("an SVG is refused, whatever the drag calls it", () => {
  const { taking, refusals } = sorting([file("logo.svg", "image/svg+xml")])

  expect(taking).toEqual([])
  expect(refusals.length).toBe(1)
})

test("what is judged is the name that will be SENT, not the one dragged", () => {
  const { taking, refusals } = sorting([file("image", "image/webp")])

  expect(taking.length).toBe(1)
  expect(refusals).toEqual([])
})

test("nothing dropped is nothing taken and nothing said", () => {
  expect(sorting([])).toEqual({ taking: [], refusals: [] })
})

const oversized = (name: string): File => {
  const claiming = file(name, "image/png")
  Object.defineProperty(claiming, "size", { value: 51 * 1024 * 1024 })
  return claiming
}

const conversation = (answering: (file: File, progress?: UploadProgress) => Uploaded | Promise<Uploaded>) => {
  const said: Array<ReadonlyArray<string>> = []
  const chat = {
    state: () => ({ session: { id: "one" }, uploadScope: "one" }),
    ui: { holding: createHoldingMemory() },
    attach: (file: File, progress?: UploadProgress) => Promise.resolve(answering(file, progress)),
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
  expect(said.at(-1)).toEqual(["the server will not take two.png"])
  expect(said[0]).toEqual([])
  dispose()
})

test("two files refused for two different reasons are both named, in one answer", async () => {
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

  expect(holding.pending().map((attachment) => attachment.name)).toEqual(["shot.png"])
  const answer = said.at(-1) ?? []
  expect(answer.length).toBe(2)
  expect(answer[0]).toContain("archive.zip")
  expect(answer[1]).toContain("huge.png")
  expect(answer[0]).not.toEqual(answer[1] ?? "")
  dispose()
})


test("overlapping uploads keep separate progress, survive remounting, and clear on refusal", async () => {
  const uploads: Array<{ progress: UploadProgress; finish: (answer: Uploaded) => void }> = []
  const { chat } = conversation((_file, progress) => new Promise(resolve => {
    uploads.push({ progress: progress!, finish: resolve })
  }))
  let dispose = () => {}
  const [holding, reopened] = createRoot(stop => {
    dispose = stop
    return [createHolding(chat), createHolding(chat)] as const
  })
  try {
    const first = holding.take([new File([new Uint8Array(3)], "clip.mp4")])
    const second = holding.take([new File([new Uint8Array(9)], "clip.mp4")])
    expect(holding.sending()).toBe(2)
    expect(holding.progress()).toBe(0)
    uploads[0]!.progress(3)
    expect(reopened.progress()).toBe(25)
    uploads[1]!.progress(3)
    expect(reopened.progress()).toBe(50)
    uploads[0]!.finish(stored("clip.mp4"))
    await first
    expect(reopened.sending()).toBe(1)
    expect(reopened.progress()).toBe(33)
    uploads[1]!.finish(refused("connection lost"))
    await second
    expect(reopened.sending()).toBe(0)
    expect(reopened.progress()).toBe(0)
  } finally {
    dispose()
  }
})
