import type { Armed, Spawned } from "@kolu/acp/wire"

export const armedTask = (said: Partial<Armed> = {}): Armed => ({
  task: "task-1",
  description: null,
  ended: null,
  report: null,
  ...said,
})

export const sentAgent = (said: Partial<Spawned> = {}): Spawned => ({
  kind: null,
  said: null,
  ...said,
})
