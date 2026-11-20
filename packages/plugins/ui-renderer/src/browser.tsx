import { TipScope } from "@olai/web/client/Tip.tsx"
import { definePlugin, locations, Offers, slotFacade } from "@olai/plugin-api"
import { BrowserMount } from "@olai/plugin-api/mount"
import { Effect } from "effect"
import { createRoot, createSignal, ErrorBoundary, For, untrack } from "solid-js"
import { render } from "solid-js/web"
import { name, root } from "./index.ts"

export default definePlugin({
  name,
  needs: [BrowserMount, Offers],
  apply: Effect.gen(function*() {
    const { element, changed, reading, rank } = yield* BrowserMount
    const [revision, setRevision] = createSignal(0)
    const slots = yield* locations({
      changed: () => { changed?.(); setRevision((value) => value + 1) },
      reading: () => { revision() },
    })
    const compatibility = slotFacade({ ...slots, read: (slot) => {
      return untrack(() => slots.read(slot))
    } }, reading, rank)
    yield* (yield* Offers).own("legacy-slots", compatibility.forOwner)
    yield* (yield* Offers).own("faces", () => compatibility.faces)
    yield* (yield* Offers).own("integrations", () => compatibility.management)
    yield* (yield* Offers).own("slots", (owner) => ({
      ...slots.forOwner(owner), read: slots.read, inspect: slots.inspect,
    }))
    yield* Effect.acquireRelease(
      Effect.sync(() => render(() => <TipScope><For each={slots.read(root)}>{(entry) =>
        <ErrorBoundary fallback={(error) => <pre role="alert">{String(error)}</pre>}>
          {entry.value()}
        </ErrorBoundary>
      }</For></TipScope>, element)),
      (dispose) => Effect.sync(dispose),
    )
  }),
})

import { clocksOver } from "./clocks.ts"
import { createToday } from "@olai/web/client/clock.ts"
export const components = {
  clocks: definePlugin({ name: "clocks", needs: [Offers], apply: Effect.gen(function*() {
    const state = yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>
      ({ today: createToday(), dispose }))), state=>Effect.sync(state.dispose))
    yield* (yield* Offers).own("clocks", () => clocksOver(state.today))
  }) }),
}
