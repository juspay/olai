/**
 * The document-level socket an overlay hangs from.
 *
 * A `z-index` only compares inside its own stacking context, and this app
 * makes those on purpose — a sticky section heading is one, at
 * {@link LAYER.row}. An overlay left in the outline is a preceding sibling
 * of the next heading and is the one that is cut in two
 * (`menu-under-headers`).
 *
 * The guarantee "this paints over the page" can only be made at a layer that
 * can see the whole page (P5). This file is that layer: one `position: fixed`
 * box at the viewport origin, {@link LAYER.row} so it still gives way to
 * chrome, and every overlay that hangs over the outline mounts here.
 *
 * Kobalte's popper is `strategy: "absolute"` and cannot be talked out of it.
 * Mounted on `document.body`, that absolute box is positioned against the
 * document, so a scrolled page puts the menu a scroll-height below its
 * trigger. Mounted HERE, the same numbers are viewport coordinates.
 *
 * Completions hang from Kobalte's popper (absolute, so this socket is the
 * origin). The line beside the `•••` measures in viewport pixels and needs
 * the same origin. Drop lines and the sweep band compute document
 * coordinates and stay on the body.
 */

import { LAYER } from "./layer.ts"

let root: HTMLDivElement | undefined

/** The socket. Minted once, the first time an overlay asks. */
export const overlayRoot = (): HTMLDivElement => {
  if (root !== undefined) return root
  root = document.createElement("div")
  root.dataset.olaiOverlay = ""
  // `fixed` at the viewport origin, no size of its own: absolute children
  // are placed in viewport pixels, and the root does not swallow a click
  // aimed at the page (its in-flow box is empty).
  root.className = `fixed left-0 top-0 ${LAYER.row}`
  document.body.append(root)
  return root
}
