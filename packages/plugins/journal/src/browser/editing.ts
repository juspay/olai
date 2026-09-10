/**
 * WHAT TO DO WITH A NOTE THIS ROW JUST MINTED — held for the activation that
 * declared it.
 *
 * The day page mints a document and hands the file back to the row that owns
 * documents. That is `olai-plugin-markdown`'s `markdown.editing`, declared on
 * `../browser.tsx`'s `editing` component rather than read out of a signal in
 * markdown's own contract door, which is where it used to live.
 *
 * THE JOURNAL DOES NOT WAIT FOR IT. The calendar, the agenda and every day page
 * are this row's own and keep working with no markdown row mounted; what is
 * absent is the *+ day note* button, which is exactly what the empty read below
 * draws — the same reading the day page already had.
 */
import { heldService } from "@olai/ui-primitives/held.ts"
import type { DocumentActions } from "olai-plugin-markdown/contract"

const provider = heldService<DocumentActions>()

/** Told by `../browser.tsx`'s `editing` component, for that activation. */
export const holdDocumentActions = provider.hold

/** ...and the day page's read. `undefined` is a serve with no document row. */
export const useDocumentActions = provider.read
