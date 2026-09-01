/**
 * ODU'S MANIFEST — the value `@olai/plugin-api`'s registry carries.
 *
 * Its own module rather than a `const` in `./index.ts`, for the reason the
 * wire slice is its own module: this is the thing a reader looking for "what
 * does olai know about odu" wants, whole, on one screen, and a barrel that
 * also re-exported the parts would bury it under them.
 *
 * `as const` and no annotation — {@link ./index.ts} argues the direction, and
 * the registry's `satisfies` is what proves the fit.
 *
 * ## The browser half arrives through here, which is why this file has a graph
 *
 * `./wire.ts` is a schema and a name and could be read by a daemon. THIS module
 * reaches `./browser/`, and therefore SolidJS: the dressing is a component and
 * the mount is a component, so a reader has to know that the manifest door and
 * the wire door are two graphs. That split is the whole reason
 * `olai-plugin-odu` exports three entries rather than one, and
 * `packages/plugin-api/src/fence.test.ts` walks each closure rather than trusting
 * this paragraph.
 */

import { CiChip } from "./browser/CiChip.tsx"
import { OduMount } from "./browser/mount.tsx"
import { RunMatrix } from "./browser/RunMatrix.tsx"
import { WORKTREE_KIND } from "./kinds.ts"
import { faces, name, surface } from "./wire.ts"

export const plugin = {
  name,
  surface,
  faces,
  /**
   * THE CHIP AND WHAT ITS PRESS OPENS — this plugin's one dressing.
   *
   * A `worktree` is a path on a row and is worth exactly nothing until
   * something is happening in it, so its face is an ADDITION to the line that
   * appears only while there is a run — where the terminal door one appliance
   * over owns a row always. The matrix is a grid and a chip is an inline box in
   * a wrapping line, so what the press opens hangs under the run as the seam's
   * `Pane` rather than inside the chip.
   *
   * IT IS THIS PLUGIN'S KIND ({@link ./kinds.ts}'s `WORKTREE_KIND`), which is
   * the same word the walk that licences the probe follows and the same word
   * the value gate holds a declaration to — one spelling, one authority, and
   * the chip and the dial cannot come apart.
   *
   * IT WAS THE PROPERTY KEY for one PR window, and that was a defect rather
   * than a simplification: a tab could not key on a declared kind, because
   * declarations do not travel to one, so a vault declaring `worktree` on a key
   * called `checkout` was probed and drew no chip. The close is the page
   * carrying the LICENCE as an answer per drawn value (`@olai/format`'s
   * `Licence`), so the lookup is by the word after all — never by the key, and
   * never by `WORKTREE_KEY`, which is what `@olai/odu-client` calls the column
   * and is no business of this line's.
   *
   * IT USED TO REGISTER ITSELF, from a `client/live/odu-ci/index.ts` inside
   * `@olai/web` that called the seam's `registerLive` at module load, and the
   * argument written down for that was that the folder was "the app's own tree,
   * registering the app's own table". It is not the app's tree any more, and
   * the same sentence now points the other way: a plugin reaching into the
   * app's table would be the import direction the manifests exist to make
   * impossible. So the dressing is DECLARED here and REGISTERED by the app,
   * from the manifest — which keeps the seam's own rule intact (it imports no
   * dressing) and makes the list of what is live in olai one walk over one
   * registry.
   */
  dressings: [{ kind: WORKTREE_KIND, Chip: CiChip, Pane: RunMatrix }],
  /** THE TAB'S CI HALF — one subscription however many chips draw
   *  (`./browser/mount.tsx`). It used to be two lines in the app's own
   *  composition root, and the second of them spelled `cells.ci`. */
  mount: OduMount,
} as const
