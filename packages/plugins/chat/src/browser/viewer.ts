/** The transcript's declared dependency on identity's browser reading.
 * This component may wait independently while chat keeps its anonymous face. */
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
export const [viewer, setViewer] = createSignal<Viewer | null>(null)

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
