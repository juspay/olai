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
    const slots = yield* locations({
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
