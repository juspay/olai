/**
 * EATING THE GHOST CLICK a touch browser makes after a long press — held for
 * the activation that declared it.
 *
 * A finger held on a row opens its `•••`, and the lift leaves a synthetic click
 * behind that would land on whatever the menu put under it. One arbiter per
 * page eats it (`@olai/web`'s `client/ghost.ts`), and that arbiter is
 * `olai-plugin-navigation`'s: it arrives on `navigation.gestures`, declared on
 * `../browser.tsx`'s `content` component.
 *
 * It used to arrive as `swallowGhost`, a module variable in `@olai/web`'s own
 * door installed by navigation's activation and read here across the wall with
 * nothing declared (the audit's §12).
 *
 * WITH NO ARBITER MOUNTED the ghost is not eaten, which is what a serve with no
 * navigation row already did — and is a touch-only nuisance rather than a
 * broken page.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Gestures } from "olai-plugin-navigation/contract"

const provider = heldService<Gestures>()

/** Told by `../browser.tsx`'s `content` component, for that activation. */
export const holdGestures = provider.hold

/** Eat the next synthetic click, if there is an arbiter to eat it. */
export const swallowGhost = (): void => provider.read()?.swallowGhost()
