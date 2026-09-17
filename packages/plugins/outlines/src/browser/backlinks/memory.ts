/**
 * THE SHARED REFERRERS SECTION'S OPEN-STATE MEMORY, as this plugin's backlinks
 * read it — held for the activation that declared the service.
 *
 * ONE memory exists per tab, minted and owned by `olai-plugin-markdown`'s
 * activation (its `createRoot` scope) and offered behind
 * `markdown.referrer-memory`. The outline does not mint one of its own: the
 * whole reason the section's open state survives a plugin rebuild is that
 * both pages — a document's and a node's — answer under the same store, so a
 * pane rebuilt from one to the other finds the answer it left.
 *
 * What makes it safe to IMPORT a value minted by another row is that the
 * dependency is DECLARED: `../browser.tsx`'s `backlinks` component names the
 * service and installs its view of it here, for that activation, cleared by
 * identity when it leaves (`@olai/ui-primitives/held.ts`'s three rules).
 * With markdown off the component sits `waiting` and this read answers
 * nothing — the delivery of that absence is `../browser.tsx`, the same way
 * `document-properties` already withdraws its integration.
 */
import { referrerMemoryChannel } from "@olai/ui-primitives/referrer-memory.ts"

/** ONE channel, minted here because the activation (`../browser.tsx`) HOLDS
 *  through it while this package's backlinks READ through it: two different
 *  modules, so the channel is the package-private fact that connects them. The
 *  factory is `@olai/ui-primitives/referrer-memory.ts`'s — a package calls it
 *  once, and a hold clears by identity when the activation that made it stops.
 *  `undefined` is a serve with no markdown row mounted: the section draws
 *  collapsed, which is the same nothing the memory had to say. */
export const backlinksMemory = referrerMemoryChannel()