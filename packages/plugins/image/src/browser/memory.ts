/**
 * THE SHARED REFERRERS SECTION'S OPEN-STATE MEMORY, as this host's body page
 * reads it — held for the activation that declared the service.
 *
 * ONE memory exists per tab, minted and owned by `olai-plugin-markdown`'s
 * activation and offered behind `markdown.referrer-memory`. This host does not
 * mint one of its own: the whole reason the section's open state survives a
 * plugin rebuild is that every page that draws it — a document's, a node's, a
 * body page's — answers under the same store.
 *
 * What makes it safe to import a value minted by another row is that the
 * dependency is DECLARED: `../browser.tsx`'s `referrers` component names the
 * service and installs its view of it here, for that activation, cleared by
 * identity when it leaves (`@olai/ui-primitives/held.ts`'s three rules).
 * With markdown off the component sits `waiting` and this read answers
 * nothing — the delivery of that absence is `../browser.tsx`: the body page
 * itself (`page`) does NOT name the service, so a pdf/csv/picture/html page
 * still draws with markdown off, and the section then draws collapsed, which
 * is the same nothing the memory had to say.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

const provider = heldService<ReferrerMemory>()

/** Told by `../browser.tsx`'s `referrers` component, for that activation. */
export const holdReferrersMemory = provider.hold

/** ...and read by this host's body page, which passes it to `<BodyPage>`. */
export const useReferrersMemory = provider.read