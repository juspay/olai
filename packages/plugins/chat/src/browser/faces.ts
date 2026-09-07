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
 *
 * ## THE HOLD IS THE ACTIVATION'S, and it was not
 *
 * `holdFaces` used to be a bare assignment with no undo at all: the table of a
 * stopped activation stayed reachable for the life of the tab, and a second
 * activation's value was overwritten by nothing but arrival order. It is
 * `heldFaces`' scoped acquisition now — one algorithm, minted per package,
 * cleared BY IDENTITY so a stopped activation cannot clear its replacement's
 * value. The three other rows that read a slot mint their own
 * (`olai-plugin-layout`'s `faces.ts` argues why the holder is never shared).
 *
 * An unheld read answers the empty table rather than throwing. It was a throw,
 * under the argument that a face of this plugin is drawn only after this
 * plugin's fiber applied — which is true of every face here and is not a reason
 * to take a page down: "nobody has hung a mark" is a real answer and the
 * transcript draws its plain row for it.
 */

import { heldFaces } from "@olai/plugin-api"

const own = heldFaces()

/** TOLD BY `../browser.tsx`, and by nothing else — for that activation. */
export const holdFaces = own.hold

/** ...and read by the two walks beside this file. */
export const faces = (): typeof own => own
