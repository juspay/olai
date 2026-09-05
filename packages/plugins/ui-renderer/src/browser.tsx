import { definePlugin, locations, Offers } from "@olai/plugin-api"
import { BrowserMount } from "@olai/plugin-api/mount"
import { Effect } from "effect"
import { createSignal, ErrorBoundary, For } from "solid-js"
import { render } from "solid-js/web"
import { name, root } from "./index.ts"

export default definePlugin({
  name,
  needs: [BrowserMount, Offers],
  apply: Effect.gen(function*() {
    const { element } = yield* BrowserMount
    const [revision, setRevision] = createSignal(0)
    const slots = locations({
      changed: () => { setRevision((value) => value + 1) },
      reading: () => { revision() },
    })
    yield* (yield* Offers).own("slots", (owner) => ({
      ...slots.forOwner(owner), read: slots.read, inspect: slots.inspect,
    }))
    yield* Effect.acquireRelease(
      Effect.sync(() => render(() => <For each={slots.read(root)}>{(entry) =>
        <ErrorBoundary fallback={(error) => <pre role="alert">{String(error)}</pre>}>
          {entry.value()}
        </ErrorBoundary>
      }</For>, element)),
      (dispose) => Effect.sync(dispose),
    )
  }),
})
