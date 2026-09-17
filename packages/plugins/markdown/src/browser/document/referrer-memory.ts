/**
 * THE REFERRERS SECTION'S OPEN-STATE MEMORY, as this plugin's activation hands
 * it to the document page that draws the section.
 *
 * The memory itself is `@olai/ui-primitives`' `createReferrerMemory` — a
 * factory the activation calls INSIDE its `createRoot` scope — and the
 * SHARED section reads it through props. What this module adds is the
 * channel from the activation to the component: a `heldService`, the same
 * one every other browser service in this package travels on
 * (`./clock.ts`, `./routing.ts`).
 *
 * WHY A HOLD AND NOT A PROP THREADED THROUGH `DocumentPage`: the plugin's
 * activation scope is not a component mount point — there is no JSX from
 * `apply` — so a value minted there reaches a component only through the
 * held channel or Solid context. `heldService` is the designed one, and it
 * is exactly its three rules: the consumer holds (this activation's
 * `browser.tsx`), the hold clears BY IDENTITY (the disposed activation
 * removes its own memory and no other), and the read is tracked (a document
 * page drawn before the activation installed its memory gets `undefined`
 * and draws the section collapsed).
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import { createReferrerMemory, type ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"

const provider = heldService<ReferrerMemory>()

/** The memory this activation created, or nothing before it installs one. */
export const documentReferrersMemory = provider.read

/** Called by the activation's `createRoot` for ITS scope. The answer removes
 *  this memory and no other — the `stop` an `acquireRelease` releases with. */
export const holdReferrersMemory = (): (() => void) =>
  provider.hold(createReferrerMemory())