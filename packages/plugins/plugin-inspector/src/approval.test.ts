import { expect, test } from "bun:test"
import { Effect } from "effect"
import type { Approvals } from "olai-plugin-vault-plugins/contract"
import { holdApprovals } from "./approvals.ts"
import { approveDefinition } from "./approval.ts"

test("approval refuses an absent declared provider, clears pending, and uses its fresh return", async () => {
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
  const approval: Approvals = {
    approve: (input) => Effect.sync(() => { calls.push(input); return {} }),
  }
  const stop = holdApprovals(approval)
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
