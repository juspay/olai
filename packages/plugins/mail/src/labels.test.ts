import { expect, test } from "bun:test"
import { Effect } from "effect"
import { makeLabels } from "./labels.ts"

test("label cache resolves both directions, ignores case, refreshes once on a miss", async () => {
  let runs = 0
  const cache = makeLabels(() => Effect.sync(() => {
    runs++
    return { labels: [{ id: "INBOX", name: "INBOX" }, ...(runs > 1 ? [{ id: "Label_1", name: "waiting" }] : [])] }
  }))
  await Effect.runPromise(Effect.all([cache.load, cache.load], { concurrency: 2 }))
  expect(runs).toBe(1)
  expect(await Effect.runPromise(cache.resolve(["inbox"]))).toEqual(["INBOX"])
  expect(await Effect.runPromise(cache.resolve(["WAITING"]))).toEqual(["Label_1"])
  expect(cache.names(["Label_1"])).toEqual(["waiting"])
  expect(runs).toBe(2)
  const refused = await Effect.runPromise(Effect.result(cache.resolve(["missing"])))
  expect(refused._tag).toBe("Failure")
  if (refused._tag === "Failure") expect(refused.failure.reason).toBe('this mailbox has no label "missing"; it has: INBOX, waiting')
  expect(runs).toBe(3)
})
