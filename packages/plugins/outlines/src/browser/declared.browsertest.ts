import { afterAll, expect, mock, test } from "bun:test"
import { Effect } from "effect"
import { createRoot } from "solid-js"
import { holdClient, type Client } from "../client.ts"

interface Outstanding {
  readonly ids: ReadonlyArray<string>
  readonly ok: (named: { named: ReadonlyArray<{ asked: string; id: string; title: string }> }) => void
  readonly no: (cause: unknown) => void
}

const calls: Array<Outstanding> = []

const fake = {
    procedures: {
      nodes: {
        named: (request: { readonly ids: ReadonlyArray<string> }) =>
          Effect.tryPromise({
            try: () =>
              new Promise<{ named: ReadonlyArray<{ asked: string; id: string; title: string }> }>(
                (ok, no) => {
                  calls.push({ ids: request.ids, ok, no })
                },
              ),
            catch: (cause) => cause,
          }),
      },
    },
} as unknown as Client
const releaseClient = holdClient(() => fake)
afterAll(releaseClient)
mock.module("@olai/web/client/wire.ts", () => ({
  connectionReadout: () => ({ status: "live" }),
  connectionEpoch: () => 1,
}))

const { createDeclared, declaringFailure, createDeclarations, holdDeclarations } = await import("./declared.ts")
const declarations = createRoot(dispose => ({ dispose, release: holdDeclarations(createDeclarations()) }))
afterAll(() => { declarations.dispose(); declarations.release() })

const tick = () => new Promise((go) => setTimeout(go, 10))

const messages: Array<() => void> = []
afterAll(() => { for (const dispose of messages) dispose() })
const asking = async (id: string): Promise<Outstanding> => {
  const before = calls.length
  createRoot(dispose => {
    messages.push(dispose)
    createDeclared().want([id])
  })
  await tick()
  const call = calls[before]
  if (call === undefined) throw new Error(`nothing asked about ${id}`)
  return call
}

test("an older batch's refusal does not take back a newer batch's clear", async () => {
  const first = await asking("herbs")
  const second = await asking("mint")
  expect(first).not.toBe(second)

  second.ok({ named: [{ asked: "mint", id: "mint", title: "Mint" }] })
  await tick()
  expect(declaringFailure()).toBeNull()

  first.no(new Error("the wire went"))
  await tick()
  expect(declaringFailure()).toBeNull()
})

test("...and an older batch's success does not clear a newer batch's refusal", async () => {
  const first = await asking("compost")
  const second = await asking("slugs")

  second.no(new Error("the wire went"))
  await tick()
  expect(declaringFailure()).toContain("the wire went")

  first.ok({ named: [{ asked: "compost", id: "compost", title: "Compost" }] })
  await tick()
  expect(declaringFailure()).toContain("the wire went")
})

test("the newest batch is still what the slot says", async () => {
  const first = await asking("frames")
  first.no(new Error("the wire went"))
  await tick()
  expect(declaringFailure()).toContain("the wire went")

  const second = await asking("glazing")
  second.ok({ named: [] })
  await tick()
  expect(declaringFailure()).toBeNull()
})


test("a declaration retains titles without replacing resolved identities or missing states", async () => {
  let dispose!: () => void
  const reader = createRoot(stop => { dispose = stop; return createDeclared() })
  try {
    const before = calls.length
    reader.want(["placement", "missing"])
    expect(reader.told("placement")).toBeUndefined()
    expect(reader.title("placement")).toBeNull()
    await tick()
    calls[before]!.ok({ named: [{ asked: "placement", id: "target", title: "The node title" }] })
    await tick()
    expect(reader.named("placement")).toBe("target")
    expect(reader.told("placement")).toBe("target")
    expect(reader.title("placement")).toBe("The node title")
    expect(reader.told("missing")).toBeNull()
    expect(reader.title("missing")).toBeNull()
    reader.want(["placement"])
    await tick()
    expect(calls.length).toBe(before + 1)
  } finally { dispose() }
})


test("withdrawing the declaration owner cancels its gathered wire work", async () => {
  const before = calls.length
  const owner = createRoot(dispose => {
    const declarations = createDeclarations()
    const reader = declarations.create()
    reader.want(["withdrawn-before-send"])
    return { dispose, declarations }
  })
  owner.dispose()
  await tick()
  expect(calls.length).toBe(before)
  expect(owner.declarations.failure()).toBe(null)
})
