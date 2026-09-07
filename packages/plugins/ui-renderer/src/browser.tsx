/**
 * The mount capability belongs to the host; the Solid root and location host
 * belong to this activation. `Offers` binds each caller's identity before it
 * can register an entry. Disposing the renderer removes the Solid tree and
 * closes the location host, draining all dependent integration scopes.
 *
 * Reads track one revision but return stable contribution identities. A change
 * elsewhere must not recreate an editor which still owns the same location.
 * Child declarations and effectful integrations are owned by entries through
 * the registry contract, rather than inferred from what a JSX tree displays.
 */
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
      // Legacy consumers track the host's batched signal. The registry's own
      // signal is for renderer roots and native location readers.
      return untrack(() => slots.read(slot))
    } }, reading, rank)
    yield* (yield* Offers).own("legacy-slots", compatibility.forOwner)
    yield* (yield* Offers).own("faces", () => compatibility.faces)
    yield* (yield* Offers).own("integrations", () => compatibility.management)
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

// Clock consumers can wait for their locations independently of the renderer
// root. Withdrawal of this row releases the service and its consumers.
import { clocksOver } from "./clocks.ts"
import { createToday } from "@olai/web/client/clock.ts"
export const components = {
  clocks: definePlugin({ name: "clocks", needs: [Offers], apply: Effect.gen(function*() {
    // THE CLOCK ITSELF IS THIS ACTIVATION'S — one timer, minted in a root this
    // component disposes — and WHAT DAY IT IS rides out on the same service
    // rather than in a module variable five rows read across the wall
    // (`@olai/plugin-api`'s `AppClocks.today`).
    const state = yield* Effect.acquireRelease(Effect.sync(()=>createRoot(dispose=>
      ({ today: createToday(), dispose }))), state=>Effect.sync(state.dispose))
    yield* (yield* Offers).own("clocks", () => clocksOver(state.today))
  }) }),
}
