/**
 * The hand-off from a creation affordance to the editor it lands in.
 *
 * A document a person just minted — from the sidebar's path box, or by
 * pressing a bare calendar day — is a document they are about to write, so the
 * page it navigates to should open EDITING rather than rendering an empty
 * body with the affordance one more click away. The route cannot carry that
 * (an address says which page, never what mood it is in — a link someone
 * sends must not open someone else's editor), so it travels as a one-shot
 * note from the affordance to the page: set before the navigation, consumed
 * by the first `DocumentPage` that mounts for that file, and nothing else
 * ever reads it.
 *
 * A plain variable, deliberately not a signal: nothing reacts to it — it is
 * read exactly once, at mount, by the page it names — and a reactive value
 * here would imply a subscriber that must not exist.
 */

let minted: string | null = null

/** A document was just created; the next mount of its page starts editing. */
export const mintedDocument = (file: string): void => {
  minted = file
}

/** Whether `file` was just minted — answered once, then forgotten, so a later
 *  visit to the same page opens reading like any other. */
export const consumeMinted = (file: string): boolean => {
  const was = minted === file
  minted = null
  return was
}
