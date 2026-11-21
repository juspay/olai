/**
 * THE DRAWING OF A PLUGIN'S OWN PAGE — the face the plugin hung, keyed on that
 * face, or the fallback where there is none.
 *
 * KEYED, because a face can be replaced by another with no empty reading in
 * between: a new version of the plugin mounted while the page is open, with
 * the host batching the roster change. A `<Show>` that is not keyed runs its
 * child once per truthy stretch, and would go on drawing the old face. Keyed,
 * the child runs again for each face, so the page is always the face hung now.
 *
 * No JSX, so `./own-page.browsertest.ts` reads it with faces that answer words.
 */
import { type Accessor, type Component, createComponent, type JSX, Show } from "solid-js"

import type { PluginPageFace } from "../slots.ts"

/** `<Show keyed>` over a face: Solid's `Show` at the one shape this file
 *  draws, so `createComponent` is handed a single signature to read. */
const ShowFace: Component<{
  readonly when: PluginPageFace | undefined
  readonly keyed: true
  readonly fallback: JSX.Element
  readonly children: (Face: PluginPageFace) => JSX.Element
}> = Show

export const drawOwnPage = (
  face: Accessor<PluginPageFace | undefined>,
  rest: Accessor<string>,
  fallback: () => JSX.Element,
): JSX.Element =>
  createComponent(ShowFace, {
    get when() { return face() },
    keyed: true,
    get fallback() { return fallback() },
    children: (Face) => createComponent(Face, { get rest() { return rest() } }),
  })
