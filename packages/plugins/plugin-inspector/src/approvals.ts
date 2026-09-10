/**
 * SAYING YES TO CODE, as this panel reaches it — held for the activation that
 * declared it.
 *
 * The verb is `olai-plugin-vault-plugins`', and it arrives as
 * `vault-plugins.approval` on a component of this row's own
 * (`./browser.tsx`'s `approval`) rather than as an import of that row's
 * client. What this panel may reach is one verb, and the runtime knows it is
 * reaching for it.
 *
 * THE PANEL DOES NOT WAIT FOR IT. The inspector's whole job is to show what a
 * serve is running, including a serve running no vault-plugins row at all, so
 * the dependency is a component and the absent read below is what
 * `./approval.ts` turns into the refusal a person reads.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { Approvals } from "olai-plugin-vault-plugins/contract"

const provider = heldService<Approvals>()

/** Told by `./browser.tsx`'s `approval` component, for that activation. */
export const holdApprovals = provider.hold

/** ...and the panel's read of it. `undefined` is a serve with no approval
 *  provider, which is a state and not a fault. */
export const approvals = provider.read
