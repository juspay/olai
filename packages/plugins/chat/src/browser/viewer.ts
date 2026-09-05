/**
 * A DEPENDENCY LIFETIME, PROJECTED INTO A SOLID READING.
 *
 * Putting Viewer in chat's main needs would withdraw the conversation, its
 * controls and its sidebar whenever identity left. Those faces still have
 * useful work to do anonymously. The speaker's enrichment therefore gets its
 * own fiber: the runtime can name its missing key, activate it when identity
 * arrives and unwind it before the provider releases the resource.
 *
 * A nullable module signal alone would only draw the fallback. It would not
 * declare the dependency, arrange reactivation or tell the panel why the
 * reading is absent. The fiber owns those decisions; the signal below only
 * lets already drawn transcript rows observe the service entering and leaving
 * its scope. It holds the service, not a copied person or a second who.get
 * resource. Identity owns that resource and its connection-epoch refresh.
 *
 * The runtime names this component chat/speaker while keeping chat as its
 * plugin owner. Removing the row removes both lifetimes. The structural
 * contract here names only what the speaker uses, so loading chat does not
 * import identity's implementation or make its chunk present while it is off.
 */
import { definePlugin, serviceTag } from "@olai/plugin-api"
import type { Who } from "@olai/surface"
import { Effect } from "effect"
import { createSignal, type JSX } from "solid-js"

interface Viewer {
  readonly who: () => Who | null | undefined
  readonly saying: (person: Who) => string
  readonly UserIcon: (props: { readonly class: string }) => JSX.Element
}
const Viewer = serviceTag<Viewer>("identity.viewer")
const [viewer, setViewer] = createSignal<Viewer | null>(null)

export const speaker = definePlugin({
  name: "speaker",
  needs: [Viewer],
  apply: Effect.gen(function*() {
    const reading = yield* Viewer
    yield* Effect.acquireRelease(
      Effect.sync(() => setViewer(reading)),
      () => Effect.sync(() => setViewer(null)),
    )
  }),
})

export { viewer }
