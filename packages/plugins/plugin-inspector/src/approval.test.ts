import { expect, test } from "bun:test"
import { Effect } from "effect"
import { holdClient, type Client } from "olai-plugin-vault-plugins/client"
import { approveDefinition } from "./approval.ts"

test("approval refuses an absent browser provider, clears pending, and uses its fresh return", async () => {
  let pending: string | null = null
  const pendingStates: (string | null)[] = []
  let refused: string | null = null
  const message = (): string | null => refused
  const request = { name: "local-tool", version: "read-version", forever: false }
  const approve = () => approveDefinition(request, value => { pending = value; pendingStates.push(value) }, value => { refused = value })
  await approve()
  expect(pending).toBeNull()
  expect(message()).toContain("approval capability is not active")

  const calls: typeof request[] = []
  const client = {
    procedures: { plugins: { approve: (input: typeof request) => Effect.sync(() => { calls.push(input); return {} }) } },
  } as unknown as Client
  const stop = holdClient(() => client)
  try {
    await approve()
    expect(pending).toBeNull()
    expect(refused).toBeNull()
    expect(calls).toEqual([request])
  } finally { stop() }
  await approve()
  expect(pending).toBeNull()
  expect(message()).toContain("approval capability is not active")
  expect(calls).toEqual([request])
  expect(pendingStates).toEqual([request.name, null, request.name, null, request.name, null])
})
