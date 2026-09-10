/**
 * The document-level socket an overlay hangs from — and the row that owns it.
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
 *
 * ## IT HAS AN OWNER NOW, and it had none
 *
 * This module was `@olai/web`'s. It appended the container to the page the
 * first time an overlay asked and remembered it in a module variable for the
 * life of the tab — so turning the outline off left the box behind, and turning
 * it on again reused a container nobody was responsible for. An empty `div` is
 * a small residue beside a running callback or a child process, and its
 * LIFETIME was undefined all the same (the audit's §10).
 *
 * Its three callers were all this row's — the completions popper, the row
 * menu's dropdown and the sentence beside it — so the owner is chosen from the
 * consumers rather than from whoever draws a frame: `../browser.tsx` mints it
 * inside the same acquisition that holds the rest of this row's browser state,
 * and removing the row removes the box. Stopping and restarting the row cannot
 * accumulate containers, because the release takes the element off the page and
 * the hold answers `undefined` in between.
 */

import { heldService } from "@olai/ui-primitives/held.ts"
import { LAYER } from "@olai/web/client/layer.ts"

const socket = heldService<HTMLDivElement>()

/** Hang the socket on the page for this activation. The answer takes it off
 *  again — and only the one it hung, by identity. */
export const openOverlaySocket = (): (() => void) => {
  const root = document.createElement("div")
  root.dataset.olaiOverlay = ""
  // `fixed` at the viewport origin, no size of its own: absolute children
  // are placed in viewport pixels, and the root does not swallow a click
  // aimed at the page (its in-flow box is empty).
  root.className = `fixed left-0 top-0 ${LAYER.row}`
  document.body.append(root)
  const drop = socket.hold(root)
  return () => { drop(); root.remove() }
}

/** The socket, for an overlay that is being drawn. */
export const overlayRoot = (): HTMLDivElement => {
  const root = socket.read()
  if (root === undefined) {
    // Unreachable from a face of this row: every caller draws inside a page
    // this row contributes, and the socket is hung before the contribution is
    // made. A throw rather than a body fallback, because mounting on the body
    // is the exact defect this socket exists to prevent and it would be silent.
    throw new Error(
      "olai-plugin-outlines: an overlay asked for the socket outside the row's activation",
    )
  }
  return root
}
