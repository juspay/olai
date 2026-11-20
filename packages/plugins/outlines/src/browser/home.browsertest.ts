import { afterAll, expect, mock, test } from "bun:test"
import { Effect } from "effect"
import { createRoot, createSignal } from "solid-js"
import { BusyFailure, UsageFailure } from "@olai/format"
import { holdClient, type Client } from "../client.ts"

const answers: Array<Effect.Effect<{ homes: ReadonlyArray<{ id: string; file: string }> }, unknown>> = []
let asked = 0
const fake = {
  procedures: { nodes: { homes: () => { asked++; return answers.shift() ?? Effect.never } } },
} as unknown as Client
const releaseClient = holdClient(() => fake)
afterAll(releaseClient)

const [epoch, setEpoch] = createSignal(1)
mock.module("@olai/web/client/wire.ts", () => ({
  connectionReadout: () => ({ status: "live" }),
  connectionEpoch: epoch,
}))
const { nodeHome } = await import("./home.ts")
const settled = () => new Promise(resolve => setTimeout(resolve, 0))

test("a busy answer waits for the next connection, then answers", async () => {
  answers.push(Effect.fail(new BusyFailure({ reason: "the connection was replaced" })))
  answers.push(Effect.succeed({ homes: [{ id: "order", file: "house.olai" }] }))
  await createRoot(async dispose => {
    const home = nodeHome("order")
    await settled()
    expect(asked).toBe(1)
    expect(home()).toBeUndefined()
    setEpoch(2)
    await settled()
    expect(asked).toBe(2)
    expect(home()).toBe("house.olai")
    dispose()
  })
})

test("a refusal that is not busy is unavailable, not missing", async () => {
  answers.push(Effect.fail(new UsageFailure({ reason: "broken" })))
  await createRoot(async dispose => {
    const home = nodeHome("order")
    await settled()
    expect(home()).toBeInstanceOf(Error)
    dispose()
  })
})
