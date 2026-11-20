import { createRenderEffect, onCleanup } from "solid-js"
import { useShown } from "olai-plugin-navigation/routing"
import { heldService } from "@olai/ui-primitives/held.ts"
import { LAYER } from "@olai/web/client/layer.ts"

const socket = heldService<HTMLDivElement>()

// Kobalte's popper is `strategy: "absolute"` and cannot be configured away.
// Mounted on `document.body` that box is positioned against the document, so a
// scrolled page puts the menu a scroll-height below its trigger; mounted on
// this fixed socket the same numbers are viewport coordinates.
export const openOverlaySocket = (): (() => void) => {
  const root = document.createElement("div")
  root.dataset.olaiOverlay = ""
  root.className = `fixed left-0 top-0 ${LAYER.row}`
  document.body.append(root)
  const drop = socket.hold(root)
  return () => { drop(); root.remove() }
}

export const overlayRoot = (parent?: HTMLElement): HTMLDivElement => {
  const root = socket.read()
  if (root === undefined) {
    throw new Error(
      "olai-plugin-outlines: an overlay asked for the socket outside the row's activation",
    )
  }
  const shown = useShown()
  const page = document.createElement("div")
  ;(parent ?? root).append(page)
  createRenderEffect(() => { page.style.display = shown() ? "contents" : "none" })
  onCleanup(() => page.remove())
  return page
}
