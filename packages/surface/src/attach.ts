/**
 * Attaching a file to a prompt — the gate, declared once.
 *
 * An attached file is BYTES, and bytes are the one thing this app's wire was
 * not built to carry: every other member is a fact about a file on disk. So the
 * transport is chunked over the `chat.attach` procedure — the file arrives as a
 * sequence of bounded calls rather than one frame that scales with it — and the
 * agent is then handed a PATH, as text. Claude Code reads the file itself,
 * which keeps base64 out of the prompt and out of the session the agent
 * persists.
 *
 * This module is what both ends of that agree on: the client's pre-flight gate
 * (refuse before encoding anything) and the server's authoritative one (refuse
 * before writing to disk) are the SAME function, so the two cannot drift on the
 * threshold or on what they say about it. It lives in `surface` for the reason
 * {@link ./media.ts} does: `@olai/web`
 * and `@olai/server` cannot import each other, and a contract kept in two
 * copies is a contract kept by memory.
 *
 * ## The gate is here; the arithmetic is not
 *
 * How a file is CUT UP is wire physics, and it belongs to the framing layer
 * that owns the cap: `@kolu/surface/frame-chunking` — `chunkBase64`,
 * `base64DecodedLength` and the budget helpers, sitting beside the
 * `RPC_MAX_FRAME_BYTES` they are derived from. This module carried a copy of
 * that derivation, taken from kolu's `packages/padi/src/upload.ts` because it
 * was derived the hard way there; a copy of a margin is the #71 shape (a
 * second `maxPayload` disagreed with the classifier above it and killed the
 * frames in between), and it was paid upstream in kolu#2158. Both callers
 * import it from there directly rather than through a re-export of ours, which
 * would be the copy coming back as a spelling.
 *
 * What stays is what kolu has no opinion about: what olai will ACCEPT.
 * {@link MAX_ATTACHMENT_BYTES} is a POLICY cap on the FILE — deliberately much
 * larger than one frame, which is why the two numbers were never one — the two
 * extension allowlists, and the sentence both ends refuse with.
 */

import { PICTURE_EXTENSIONS } from "@olai/format"

/**
 * Hard cap on one attached file — a cap on abuse rather than a size anyone
 * expects to reach. kolu's own number, kept rather than invented.
 */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

/**
 * What may be attached that is NOT a picture — the kinds an agent can read as
 * itself rather than look at.
 *
 * A closed allowlist, and deliberately a SECOND list rather than a wider
 * `isPicture`: what may be drawn out of the served directory by a relative
 * `![](…)` is a question about what a BROWSER can paint, and it must not grow
 * a `.pdf` because chat learned to carry one. The two lists meet here, in the
 * one place that asks "may this be handed to the agent", and nowhere else.
 *
 * Every entry is something the agent on the other end can open from a path:
 * a PDF (Claude Code reads those), and text a person is likely to be holding
 * when they reach for a chat window — notes, a document, a table, a config.
 * The list is closed for the reason `@olai/format`'s is: "not an outline" is
 * not a policy, and a denylist is a promise to have thought of everything.
 *
 * `.svg` is absent from BOTH lists, and that is the one absence worth stating
 * out loud: an SVG is a document that can script, so it is neither a picture
 * this app will paint nor a text file it will pass on.
 */
export const DOCUMENT_EXTENSIONS: ReadonlyArray<string> = [
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".json",
]

/** Everything `chat.attach` takes: what can be looked at, and what can be
 *  read. The picker's `accept` is spelled from this too — a gate that takes a
 *  PDF the file picker will not offer is a gate that is half true. */
export const ATTACHMENT_EXTENSIONS: ReadonlyArray<string> = [
  ...PICTURE_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]

/** Is this a file the agent gets handed as a path? The extension decides,
 *  because the extension is the only thing every face of this — the drop, the
 *  paste, the picker, the server — can agree on before a byte is read. */
export const isAttachable = (name: string): boolean => {
  const lower = name.toLowerCase()
  return ATTACHMENT_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

/**
 * Why an attachment is refused, in the words BOTH ends say — or `null` when it
 * passes.
 *
 * The sentence names the whole list rather than the kind that was expected,
 * because the list is the answer to the question the refused person is
 * actually asking. It said "is not a picture" while pictures were all this
 * took, and that was a true sentence that became a wrong one the moment a PDF
 * was allowed through: a refusal that names a narrower rule than the gate
 * enforces teaches the wrong lesson to everybody who reads it.
 */
export const attachmentRejection = (name: string, bytes: number): string | null => {
  if (!isAttachable(name)) {
    return `"${name}" cannot be attached — attachments are ${ATTACHMENT_EXTENSIONS.join(", ")}`
  }
  if (bytes > MAX_ATTACHMENT_BYTES) {
    const mb = (n: number) => (n / (1024 * 1024)).toFixed(0)
    return `"${name}" is ${mb(bytes)} MB, over the ${mb(MAX_ATTACHMENT_BYTES)} MB limit`
  }
  return null
}
