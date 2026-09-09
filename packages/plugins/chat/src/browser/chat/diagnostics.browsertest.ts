import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { Schema, Stream } from "effect"
import { type CollectionDeltasMsg } from "@kolu/surface/define"
import { collection } from "@kolu/surface"
import { fenceStream } from "@kolu/surface/client"
import { useCollectionDeltas } from "@kolu/surface/solid"
import { diagnostic, observedFold } from "./diagnostics.ts"

const descriptor = collection({ name: "transcript", keySchema: Schema.String, schema: Schema.Number })
type Frame = CollectionDeltasMsg<string, number>
const frames: Frame[] = [
  { kind: "snapshot", entries: [["compact", 1]] },
  { kind: "delta", upserts: [["after", 2]], removes: [] },
  { kind: "delta", upserts: [["later", 3]], removes: [] },
]
const folding = {
  init: (entries: ReadonlyArray<readonly [string, number]>) => entries.map(([key]) => key),
  step: (keys: string[], frame: Extract<Frame, {kind: "delta"}>) => [...keys, ...frame.upserts.map(([key]) => key)],
}
const streamed = () => Stream.fromAsyncIterable((async function*() {
  for (const frame of frames) {
    await new Promise(resolve => setTimeout(resolve, 0))
    yield frame
  }
})(), cause => cause)
const until = async (ready: () => boolean) => {
  for (let i = 0; i < 1000 && !ready(); i++) await new Promise(resolve => setTimeout(resolve, 1))
}

test("a synchronous diagnostic throw cannot invalidate the real surface fold at init or step", async () => {
  const warn = console.warn
  console.warn = () => { throw new Error("even the console was withdrawn") }
  let dispose = () => {}
  try {
    const folded = createRoot(stop => {
      dispose = stop
      const view = useCollectionDeltas(descriptor, { source: Stream.concat(streamed(), Stream.never) })
      return view.fold(observedFold(folding, () => { throw new Error("chat wire is not held") }, () => {}))
    })
    await until(() => folded()?.includes("later") === true)
    expect(folded()).toEqual(["compact", "after", "later"])
  } finally { dispose(); console.warn = warn }
})

test("a real fold failure is reported before invalidation, independently of its frozen accumulator", async () => {
  const error = console.error
  console.error = () => {}
  let dispose = () => {}
  const received: string[] = []
  try {
    const folded = createRoot(stop => {
      dispose = stop
      const view = useCollectionDeltas(descriptor, { source: Stream.concat(streamed(), Stream.never) })
      return view.fold(observedFold({ ...folding, step: () => { throw new Error("projection failed") } },
        () => {}, diagnostic<void>(() => { received.push("fold_failed") })))
    })
    await until(() => received.length > 0)
    expect(folded()).toBeUndefined()
    expect(received).toEqual(["fold_failed"])
  } finally { dispose(); console.error = error }
})

test("a non-transport stream failure stops retrying but reports outside the transcript fold", async () => {
  let dispose = () => {}
  let starts = 0
  const received: string[] = []
  try {
    const view = createRoot(stop => {
      dispose = stop
      return useCollectionDeltas(descriptor, {
        source: fenceStream(Stream.suspend(() => {
          starts++
          return Stream.concat(Stream.make(frames[0]!), Stream.fail(new Error("terminal stream refusal")))
        })),
        onError: diagnostic(() => { received.push("stream_failed") }),
      })
    })
    await until(() => received.length > 0)
    expect(view.stream.error()).toBeDefined()
    expect(received).toEqual(["stream_failed"])
    expect(starts).toBe(1)
  } finally { dispose() }
})
