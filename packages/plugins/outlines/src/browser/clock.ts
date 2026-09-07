/**
 * THE APP'S CLOCK, as an outline row reads it — held for the activation that declared
 * it.
 *
 * What day it is moves: at the next local midnight, and whenever a sleeping tab
 * comes back. One clock ticks in this tab and it is the renderer's
 * (`olai-plugin-ui-renderer`'s `clocks` component), so the answer arrives on
 * `ui-renderer.clocks` — declared on `../browser.tsx`'s `content` component.
 *
 * It used to arrive as `useToday`: a module variable in `@olai/web`'s
 * `client/today.tsx`, set by the renderer's activation and read by five rows
 * across the wall with nothing declared (the audit's §12).
 *
 * WITH NO CLOCK MOUNTED the reading is the empty date, which no face draws a
 * badge from — the same nothing those faces already showed before the
 * renderer's own activation had minted a clock.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Clocks } from "@olai/plugin-api"

const provider = heldService<Clocks>()

/** Told by `../browser.tsx`'s `content` component, for that activation. */
export const holdClocks = provider.hold

/** Today, in the reader's own time zone, as the ISO text the format stores. */
export const useToday = (): (() => string) => () => provider.read()?.today() ?? ""
