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
import { heldService } from "@olai/ui-primitives/held.ts"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

const provider = heldService<ReferrerMemory>()

/** Told by `../browser.tsx`'s `backlinks` component, for that activation. */
export const holdBacklinksMemory = provider.hold

/** ...and read by this package's backlinks. `undefined` is a serve with no
 *  markdown row mounted: the section draws collapsed, which is the same
 *  nothing the memory had to say. */
export const useBacklinksMemory = provider.read