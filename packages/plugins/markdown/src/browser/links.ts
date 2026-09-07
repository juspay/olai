/**
 * WHERE A PATH OF THIS VAULT OPENS, as a document reads it — held for the
 * activation that declared it.
 *
 * There is exactly one asker and it is a strange one: a `.html` preview, where
 * a reader clicks a link inside somebody else's saved page and the seal hands
 * the path out over `postMessage` (`@olai/surface`'s `seal.ts`,
 * `./document/Hypertext.tsx`). Everywhere else in this client a link is already
 * a `Route` by the time anything looks at it.
 *
 * The answer is `olai-plugin-navigation`'s and arrives on `navigation.file-links`
 * — a service `../browser.tsx`'s `content` component already names. It used to
 * arrive as `useOpens`: a module variable in navigation's own `opens.tsx`, set
 * by that row's `files` component and read across the wall with nothing
 * declared (the audit's §12).
 *
 * A PATH THIS DIRECTORY DOES NOT HOLD ANSWERS NOTHING, and so does a serve with
 * no navigation row — which is the same answer the reader already draws for an
 * unopenable link.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Opens } from "olai-plugin-navigation/opens"

const provider = heldService<Opens>()

/** Told by `../browser.tsx`'s `content` component, for that activation. */
export const holdOpens = provider.hold

/** Where a vault path opens. */
export const useOpens = (): Opens => (path, at) => provider.read()?.(path, at)
