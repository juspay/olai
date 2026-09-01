/**
 * SPACES' MANIFEST — the value `@olai/plugin-api`'s registry carries.
 *
 * `as const` and no annotation — `./index.ts` argues the direction, and the
 * registry's `satisfies` is what proves the fit.
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
