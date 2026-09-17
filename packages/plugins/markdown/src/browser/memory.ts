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
import { referrerMemoryChannel } from "@olai/ui-primitives/referrer-memory.ts"

/** ONE channel, minted here because the activation (`../browser.tsx`) HOLDS
 *  through it while this row's faces READ through it: two different modules,
 *  so the channel is the package-private fact that connects them. The factory
 *  is `@olai/ui-primitives/referrer-memory.ts`'s — a package calls it once,
 *  and a hold clears by identity when the activation that made it stops. */
export const referrersMemory = referrerMemoryChannel()