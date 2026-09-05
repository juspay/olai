import { expect, test } from "bun:test"
import { bootstrapSelected } from "./bootstrap.ts"

test("a delayed bootstrap cannot replace a newer live roster", async () => {
  let authoritative = false
  let answer!: (response: Response) => void
  const applied: ReadonlyArray<string>[] = []
  const pending = bootstrapSelected({
    authoritative: () => authoritative,
    request: () => new Promise((resolve) => { answer = resolve }),
    apply: async (names) => { applied.push(names) },
  })
  authoritative = true
  answer(Response.json(["old-shell"]))
  await pending
  expect(applied).toEqual([])
})

test("only the server-selected names bootstrap, including an empty selection", async () => {
  for (const selected of [[], ["renderer", "shell"]]) {
    const applied: ReadonlyArray<string>[] = []
    await bootstrapSelected({ authoritative: () => false, request: async () => Response.json(selected), apply: async (names) => { applied.push(names) } })
    expect(applied).toEqual([selected])
  }
})

test("an unavailable bootstrap invents no default selection", async () => {
  const applied: ReadonlyArray<string>[] = []
  await expect(bootstrapSelected({ authoritative: () => false, request: async () => new Response("absent", { status: 404 }), apply: async (names) => { applied.push(names) } })).rejects.toThrow("HTTP 404")
  expect(applied).toEqual([])
})

test("a malformed bootstrap cannot mount a plugin", async () => {
  let applied = false
  await expect(bootstrapSelected({ authoritative: () => false, request: async () => Response.json([{ id: "injected", chunk: "/unapproved.js" }]), apply: async () => { applied = true } })).rejects.toThrow("Invalid browser bootstrap response")
  expect(applied).toBe(false)
})

test("an established roster does not request a bootstrap", async () => {
  let requested = false
  await bootstrapSelected({ authoritative: () => true, request: async () => { requested = true; return Response.json([]) }, apply: async () => { throw new Error("should not apply") } })
  expect(requested).toBe(false)
})
