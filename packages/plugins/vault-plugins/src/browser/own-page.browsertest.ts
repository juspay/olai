/**
 * THE PLUGIN'S OWN PAGE DRAWS THE FACE THAT IS HUNG NOW.
 *
 * `./OwnPage.tsx` draws whatever the plugin hung in `plugin.page`. When that
 * face is replaced by another — a new version mounted — the page must draw the
 * new one. A `<Show>` that is not keyed runs its child once per truthy stretch,
 * so a face replaced with no empty reading in between would leave the old one
 * on screen; the host batches roster changes, so nothing promises that empty
 * reading. The drawing is `./own-page.ts`'s, which has no JSX, so it is asked
 * here with faces that answer words instead of elements.
 *
 * Under the browser condition because `<Show>` is a memo.
 */
import { expect, test } from "bun:test"
import { createRoot, createSignal, type JSX } from "solid-js"

import type { PluginPageFace } from "../slots.ts"
import { drawOwnPage } from "./own-page.ts"

/** A face that draws a word naming itself and the path it was handed. */
const saying = (who: string): PluginPageFace => (props) => `${who}:${props.rest}` as unknown as JSX.Element

test("a face replaced by another is the new one drawn, with no empty reading between", () => {
  createRoot((dispose) => {
    const [face, setFace] = createSignal<PluginPageFace | undefined>(saying("first"))
    const drawn = drawOwnPage(face, () => "review", () => "absent" as unknown as JSX.Element) as unknown as () => unknown
    expect(drawn()).toBe("first:review")
    setFace(() => saying("second"))
    expect(drawn()).toBe("second:review")
    setFace(undefined)
    expect(drawn()).toBe("absent")
    dispose()
  })
})
