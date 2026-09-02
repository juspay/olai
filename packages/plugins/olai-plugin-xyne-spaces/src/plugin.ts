/**
 * SPACES' MANIFEST — the value `@olai/plugin-api`'s registry carries.
 *
 * Its own module rather than a `const` in `./index.ts`, for the reason the
 * wire slice is its own module: this is the thing a reader looking for "what
 * does olai know about Spaces" wants, whole, on one screen, and a barrel that
 * also re-exported the parts would bury it under them.
 *
 * `as const` and no annotation — {@link ./index.ts} argues the direction, and
 * the registry's `satisfies` is what proves the fit.
 *
 * ## The browser half arrives through here, which is why this file has a graph
 *
 * `./wire.ts` is a schema and a name and could be read by a daemon. THIS module
 * reaches `./browser/`, and therefore SolidJS: the pill is a component and the
 * mount is a component, so a reader has to know that the manifest door and the
 * wire door are two graphs. That split is the whole reason
 * `olai-plugin-xyne-spaces` exports three entries rather than one, and
 * `packages/plugin-api/src/fence.test.ts` walks each closure rather than trusting
 * this paragraph.
 */

import { SpacesMark } from "./browser/Mark.tsx"
import { SpacesMount } from "./browser/mount.tsx"
import { Spaces } from "./browser/Spaces.tsx"
import { faces, name, surface } from "./wire.ts"

export const plugin = {
  name,
  surface,
  faces,
  /** THE SPACES PILL, in the app's chrome row — three states, like the padi
   *  pill one appliance over: connected, absent, fault. It hangs no drawer:
   *  there is no events feed, and a press that opened nothing would be a
   *  control that lied. */
  chrome: { Header: Spaces },
  /** THE TAB'S SPACES HALF — one subscription for the pill. */
  mount: SpacesMount,
  /** THE FACE over a fault sentence this plugin delivered into a conversation. */
  mark: SpacesMark,
} as const
