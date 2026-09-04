/**
 * WHAT OTHER PLUGINS HUNG, as this half reads it.
 *
 * The panel is the reader of two slots six other plugins register into: the
 * MARK a delivered sentence wears in a transcript (`delivery.mark`), and
 * each engine's INSTALL SENTENCE on the face drawn when this machine has no ACP
 * agent at all (`engine.install`). Both used to be walks in `@olai/web` —
 * `plugins/marks.ts` and `plugins/agents.ts` — because the panel was core's.
 *
 * A HOLDER for `../browser/wire.ts`'s reason exactly: the door arrives as a
 * service this half NAMED, so the moment it is in hand is inside the `apply`,
 * and threading it down through the transcript, the speaker row and the
 * no-agent face would make every component's signature a function of what one
 * descendant needs.
 *
 * THE READS STAY TRACKED. `Faces` is the same table the app reads, and reading
 * it inside a memo re-runs when a plugin arrives or leaves — which is why the
 * two modules beside this one take a FUNCTION rather than a map. A map read
 * once would pin whichever answer the page happened to be built on, and for a
 * tab that follows the roster that is a real state rather than a theoretical
 * one.
 */

import type { Faces } from "@olai/plugin-api"

let held: Faces | null = null

/** TOLD BY `../browser.tsx`, and by nothing else. */
export const holdFaces = (faces: Faces): void => {
  held = faces
}

/** ...and read by the two walks beside this file. A THROW rather than an empty
 *  table, for the reason the wire's own accessor throws: a face of this plugin
 *  is drawn only after this plugin's fiber applied, so a read before that has
 *  not raced — it has been mounted somewhere the roster does not reach. */
export const faces = (): Faces => {
  if (held === null) {
    throw new Error(
      "olai-plugin-chat: a face read the slot table before the plugin was mounted",
    )
  }
  return held
}
