/**
 * WHAT THIS DEPLOYMENT IS CALLED, as a notification title reads it — held for
 * the activation that declared it.
 *
 * A raised notification says which olai it is about (`olai [box]`), and the
 * word is the shell's answer to one `app.get` — asked and re-asked by
 * `olai-plugin-layout`'s `deployment` component, which is where the retry rule
 * lives. It arrives on `layout.deployment`, declared on `../browser.tsx`'s
 * `deployment` component; it used to arrive as `calledApp`, a module variable
 * in `@olai/web`'s `client/named.ts` set by one row and read by another with
 * nothing declared (the audit's §12).
 *
 * `undefined` UNTIL THE ANSWER LANDS is unchanged and is what the notice draws
 * its bare `olai` for — the same reading it already had before the shell's own
 * ask had come back.
 */
import type { Accessor } from "solid-js"

import { heldService } from "@olai/ui-primitives/held.ts"

/** The half of `layout.deployment` this row reads. */
type Named = { readonly called: Accessor<string | undefined> }

const provider = heldService<Named>()

/** Told by `../browser.tsx`'s `deployment` component, for that activation. */
export const holdDeployment = provider.hold

/** What this deployment calls itself, or nothing yet. */
export const calledApp: Accessor<string | undefined> = () => provider.read()?.called()
