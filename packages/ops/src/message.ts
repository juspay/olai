/**
 * How a commit is MADE, in words — the half of the message that is about olai
 * writing one rather than about what changed.
 *
 * Composing the words is `@olai/format`'s (`composed`), and it moved there
 * under `commit-whole-repo`: the panel's checkboxes make the message a function
 * of a SELECTION, so unticking a file recomposes it on screen, and a browser
 * cannot reach into this package. What stays here is the pair of conventions
 * that only the writer needs — the trailer that signs a commit, and the filter
 * that finds olai's own commits again afterwards.
 */

import { MESSAGE_PREFIX, type Writer } from "@olai/format"

export { composed, MESSAGE_PREFIX } from "@olai/format"

/** The trailer that puts the writer in the commit permanently. */
const WRITER_TRAILER = "X-Olai-Writer"

/**
 * How olai recognises its own commits in somebody's repository, as the one
 * value `@olai/git` is handed.
 *
 * Both halves are written HERE, beside the signer that puts them on: the
 * plumbing that reads a log back knows how to filter and how to read a trailer,
 * and knows nothing about which prefix or which key — which is the whole reason
 * it could be extracted at all.
 */
export const AUDIT = { prefix: MESSAGE_PREFIX, trailer: WRITER_TRAILER } as const

/**
 * A message as it is actually committed: prefixed, and signed by whoever asked.
 *
 * The trailer is the permanent half of "who wrote this". Commits otherwise take
 * the repository's own name and email, so without it an agent's edits are
 * indistinguishable from the ones a person typed — which would defeat the point
 * of the audit trail.
 */
export const signed = (message: string, writer: Writer): string => {
  const said = message.trim() === "" ? `${MESSAGE_PREFIX}: commit` : message.trim()
  const prefixed = said.startsWith(MESSAGE_PREFIX) ? said : `${MESSAGE_PREFIX}: ${said}`
  return `${prefixed}\n\n${WRITER_TRAILER}: ${writer}\n`
}
