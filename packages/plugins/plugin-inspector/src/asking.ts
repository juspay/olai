/**
 * ASKING FOR A PLUGIN, as this panel reaches it — held for the activation that
 * declared it.
 *
 * The verb is `olai-plugin-vault-plugins`', and it arrives as
 * `vault-plugins.new-plugin` on a component of this row's own
 * (`./browser.tsx`'s `new-plugin`). One press: open the palette at *New
 * plugin*. The inspector holds no palette, no roster of folders and none of
 * that row's live state — it holds one function, and the runtime knows who is
 * reaching for it. The sibling holder beside this one (`./approvals.ts`) makes
 * the same argument about saying yes to code.
 *
 * THE PANEL DOES NOT WAIT FOR IT, and this is the half that makes the door
 * honest. `undefined` is a serve with no `vault-plugins` row, a serve with no
 * palette to open, or a tab whose navigation is switched off — and in every
 * one of those the panel draws no door rather than a button with nowhere to
 * go. Nothing else about the panel changes.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { NewPlugin } from "olai-plugin-vault-plugins/contract"

const provider = heldService<NewPlugin>()

/** Told by `./browser.tsx`'s `new-plugin` component, for that activation. */
export const holdAsking = provider.hold

/** ...and the panel's read of it. `undefined` is a serve where a plugin cannot
 *  be asked for from here, which is a state and not a fault. */
export const asking = provider.read
