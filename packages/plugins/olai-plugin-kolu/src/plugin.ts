/**
 * KOLU'S MANIFEST — the value `@olai/plugin-api`'s registry carries.
 *
 * Its own module rather than a `const` in `./index.ts`, for the reason the
 * wire slice is its own module: this is the thing a reader looking for "what
 * does olai know about kolu" wants, whole, on one screen, and a barrel that
 * also re-exported the parts would bury it under them.
 *
 * `as const` and no annotation — {@link ./index.ts} argues the direction, and
 * the registry's `satisfies` is what proves the fit.
 *
 * ## The browser half arrives through here, which is why this file has a graph
 *
 * `./wire.ts` is a schema and a name and could be read by a daemon. THIS module
 * reaches `./browser/` and `./appliance/`, and therefore SolidJS and, behind
 * one of these faces, a terminal emulator. That is the whole reason
 * `olai-plugin-kolu` exports three code entries rather than one, and
 * `packages/bundle/src/fence.test.ts` walks each closure rather than trusting
 * this paragraph.
 */

import { TerminalBlock } from "./appliance/index.ts"

import { KoluMark } from "./browser/Mark.tsx"
import { KoluMount } from "./browser/mount.tsx"
import { Padi } from "./browser/Padi.tsx"
import { TERMINAL_KIND } from "./kinds.ts"
import { faces, name, surface } from "./wire.ts"

export const plugin = {
  name,
  surface,
  faces,
  /**
   * THE TERMINAL DOOR — kolu's own Dock row, drawn where the `terminal`
   * property is, plus the live pane that row opens.
   *
   * It wears the BLOCK face because a terminal somebody named is worth a row
   * whether or not anything is happening in it: the fleet always has something
   * to say (a live row, or the sentence saying why there is none), so there is
   * no quiet state to be quiet about — where the CI face one appliance over is
   * a chip that draws nothing most of the time.
   *
   * The COMPONENT is `./appliance/`'s, behind a module boundary, because it
   * renders kolu's row and mounts kolu's emulator and that is an appliance's
   * implementation. What is decided HERE is the one thing that is olai's: that
   * this kind wears that face.
   *
   * IT IS THIS PLUGIN'S KIND ({@link ./kinds.ts}'s `TERMINAL_KIND`), which is
   * the same word the server's walk and the value gate follow — one spelling,
   * one authority, and the face and the probe cannot come apart.
   *
   * IT WAS THE PROPERTY KEY for one PR window, and that was a defect rather
   * than a simplification: a tab could not key on a declared kind, because a
   * vault's declarations do not travel to one, so a vault that declared
   * `terminal` on a key called `pty` was walked, probed and gated and drew no
   * row. The close is the page carrying the LICENCE as an answer per drawn
   * value (`@olai/format`'s `Licence`), so the browser's lookup is by the word
   * after all — never by the key, and never by `TERMINAL_KEY`, which is what
   * `@olai/kolu-client` calls the column and is no business of this line's.
   *
   * IT USED TO REGISTER ITSELF, from a `client/live/kolu-terminal/index.ts`
   * inside `@olai/web` that called the seam's `registerLive` at module load,
   * and the argument written down for that was that the folder was "the app's
   * own tree, registering the app's own table". It is not the app's tree any
   * more, and the same sentence now points the other way: a plugin reaching
   * into the app's table would be the import direction the manifests exist to
   * make impossible. So the dressing is DECLARED here and REGISTERED by the app
   * from the manifest — which keeps the seam's own rule intact (it imports no
   * dressing) and makes the list of what is live in olai one walk over one
   * registry.
   */
  dressings: [{ kind: TERMINAL_KIND, Block: TerminalBlock }],
  /** THE PADI PILL, in the app's chrome row — the third standing promise beside
   *  the connection and the Commit pill (`./browser/Padi.tsx`). It hangs no
   *  DRAWER of its own on the manifest: the feed is what this readout's press
   *  opens, so it belongs to the readout and not to a second slot the app would
   *  have to know to place. */
  chrome: { Header: Padi },
  /** THE TAB'S KOLU HALF — one subscription however many rows draw
   *  (`./browser/mount.tsx`). It used to be a `<KoluUi client={olai}>` in the
   *  app's own composition root, and the day kolu's members became a sibling
   *  that line would have had to spell this plugin's name. */
  mount: KoluMount,
  /**
   * KOLU'S FACE IN A TRANSCRIPT (`./browser/Mark.tsx`) — the mark over a
   * sentence the doorbell delivered into somebody's conversation.
   *
   * It is here rather than in the panel for the reason every other browser
   * face is: core may know this plugin's NAME as data and nothing else, so the
   * panel looks a mark up by the name it already stamped on the row and the
   * shape itself is contributed from the tenant that owns it. The day odu
   * delivers anything, it fills the same field with its own and core is not
   * edited at all.
   *
   * It is NOT the doorbell's mark. The doorbell is one door kolu speaks
   * through; the face says which appliance is speaking, which is the question
   * a reader of a transcript actually has. The nested viewport and the
   * pressable-id spelling are `@olai/plugin-kit`'s, shared with every other
   * tenant that fills this field.
   */
  mark: KoluMark,
} as const
