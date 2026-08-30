/**
 * KOLU'S MANIFEST — the value `@olai/plugins`' registry carries.
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
 * reaches `./browser/` and `@olai/kolu-ui`, and therefore SolidJS and, behind
 * one of these faces, a terminal emulator. That is the whole reason
 * `@olai/plugin-kolu` exports three code entries rather than one, and
 * `packages/plugins/src/fence.test.ts` walks each closure rather than trusting
 * this paragraph.
 */

import { TERMINAL_KEY } from "@olai/kolu-client/wire"
import { TerminalBlock } from "@olai/kolu-ui"

import { KoluMount } from "./browser/mount.tsx"
import { Padi } from "./browser/Padi.tsx"
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
   * The COMPONENT is `@olai/kolu-ui`'s, behind a package wall, because it
   * renders kolu's row and mounts kolu's emulator and that is an appliance's
   * implementation. What is decided HERE is the one thing that is olai's: that
   * this key wears that face.
   *
   * Against `TERMINAL_KEY` — `@olai/kolu-client`'s own exported constant —
   * never the string `"terminal"`: a literal would be a second spelling free to
   * drift from the one the browser's own components read.
   *
   * IT IS THE PROPERTY KEY AND NOT THIS PLUGIN'S KIND ({@link ./kinds.ts}),
   * and the two are no longer the same question. The server's walk follows the
   * declared KIND; a tab cannot, because a vault's declarations do not travel
   * to one. So a vault that declares `terminal` on a key called something else
   * is walked and probed and draws no row — named here rather than papered
   * over, and closed by a wire member that carries the licence per drawn
   * value.
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
  dressings: [{ kind: TERMINAL_KEY, Block: TerminalBlock }],
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
} as const
