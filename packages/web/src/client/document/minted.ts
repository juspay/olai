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
 *
 * {@link mintAndOpen} is the other half, and it is here for the same reason
 * the note is: setting it and navigating are one gesture whose ORDER is the
 * contract, so the sequence is spelled where the contract is rather than at
 * each affordance that performs it.
 */

import type { Edit } from "@olai/surface"
import { Result } from "effect"

import type { Undo } from "../edit/undoing.ts"
import type { Router } from "../router.tsx"
import { applied } from "../writes.ts"
import { atFile } from "../routes.ts"

let minted: string | null = null

/** A document was just created; the next mount of its page starts editing. */
const mintedDocument = (file: string): void => {
  minted = file
}

/** Whether `file` was just minted — answered once, then forgotten, so a later
 *  visit to the same page opens reading like any other. */
export const consumeMinted = (file: string): boolean => {
  const was = minted === file
  minted = null
  return was
}

/**
 * Mint a document and open its editor — the whole of what a creation
 * affordance does, in one place because the ORDER is load-bearing.
 *
 * The note above has to be set before the navigation, or the page mounts,
 * finds nothing minted, and opens reading — an editor hand-off that fails
 * silently, which is the worst kind. Two doors send this today (the sidebar's
 * path box and a bare calendar day) and the roadmap plainly anticipates more,
 * so the sequence lives beside the one-shot rather than as a comment repeated
 * at each call site.
 *
 * WHICH document was minted is the SERVER's answer, always — a bare day
 * carries a date and the path comes back on the reply — so the navigation
 * reads `id` off what landed rather than off what was asked for, and a caller
 * that only knows a date needs to know nothing else.
 *
 * Answers with the refusal to draw, verbatim, or `null` when it landed. The
 * caller keeps only its own place to put a sentence.
 */
export const mintAndOpen = async (
  edit: Extract<Edit, { verb: "docNew" | "docDay" }>,
  record: Undo["record"],
  go: Router["go"],
): Promise<string | null> => {
  const outcome = await applied(edit, record)
  if (Result.isFailure(outcome)) return outcome.failure.message
  const file = outcome.success.id
  mintedDocument(file)
  go(atFile(file))
  return null
}
