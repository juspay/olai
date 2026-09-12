/** The pinned wire primitive shares equal inputs, never distinct inputs. */
import { expect, test } from "bun:test"
import { collection } from "@kolu/surface"
import { collectionDeltasSchema, defineSurface, type CollectionDeltasMsg } from "@kolu/surface/define"
import { buildSurfaceClient } from "@kolu/surface/solid"
import { Cause, Effect, Queue, Schema, Stream } from "effect"
import { createRoot } from "solid-js"

const row = collection({ name: "rows", keySchema: Schema.String, schema: Schema.String })
const surface = defineSurface({ streams: {
  rows: { inputSchema: Schema.String, outputSchema: collectionDeltasSchema(Schema.String, Schema.String) },
} })
const settle = async () => { for (let i = 0; i < 8; i++) await Bun.sleep(0) }

test("two keys own two subscriptions; one release leaves the other and equal-key readers alive", async () => {
  const acquired: Array<string> = []
  const released: Array<string> = []
  const queues = new Map<string, Queue.Queue<CollectionDeltasMsg<string, string>, Cause.Done>>()
  const app = createRoot(dispose => ({ dispose, client: buildSurfaceClient(surface, {
    unary: () => Effect.void,
    stream: (_tag, input) => Stream.callback<CollectionDeltasMsg<string, string>>(queue =>
      Effect.acquireRelease(Effect.sync(() => {
        const key = input as string
        acquired.push(key)
        queues.set(key, queue)
        Queue.offerUnsafe(queue, { kind: "snapshot", entries: [["same-row", key]] })
        return key
      }), key => Effect.sync(() => { released.push(key); queues.delete(key) }))),
  }, () => true) }))
  const open = (key: string) => createRoot(dispose => ({ dispose,
    rows: app.client.streams.rows.useCollection(key, row),
  }))
  const first = open("one")
  const same = open("one")
  const second = open("two")
  try {
    await settle()
    expect(acquired.toSorted()).toEqual(["one", "two"])
    expect(first.rows.byKey("same-row")?.()).toBe("one")
    expect(second.rows.byKey("same-row")?.()).toBe("two")
    first.dispose()
    await settle()
    expect(released).toEqual([])
    same.dispose()
    await settle()
    expect(released).toEqual(["one"])
    Queue.offerUnsafe(queues.get("two")!, { kind: "delta", upserts: [["same-row", "still here"]], removes: [] })
    await settle()
    expect(second.rows.byKey("same-row")?.()).toBe("still here")
    second.dispose()
    await settle()
    expect(released.toSorted()).toEqual(["one", "two"])
  } finally {
    first.dispose(); same.dispose(); second.dispose(); app.dispose()
  }
})
