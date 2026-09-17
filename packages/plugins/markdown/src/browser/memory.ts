/**
 * THE REFERRERS SECTION'S OPEN-STATE MEMORY, as this plugin's faces read it —
 * held for the activation that declared the service.
 *
 * The memory is a resource this row OWNS: minted inside its `createRoot`
 * (../browser.tsx), offered behind `markdown.referrer-memory`, and withdrawn
 * with the activation's scope (`@olai/ui-primitives/referrer-memory.ts`'s
 * header says the whole of why). What reaches the components is this package's
 * own copy of the value, installed by the activation that declared the
 * dependency and gone with it.
 *
 * `undefined` is the honest reading of "the section's memory is not mounted",
 * which is the state this row's own document page and the outline's backlinks
 * both draw as a fresh (collapsed) section rather than waiting through.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

const provider = heldService<ReferrerMemory>()

/** Told by `../browser.tsx`'s `content` component, for that activation. */
export const holdReferrersMemory = provider.hold

/** ...and read by this row's faces — the shared section's memory. */
export const useReferrersMemory = provider.read