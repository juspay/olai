/**
 * Attaching a file to a prompt — the numbers and the gate, declared once.
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
 * before writing to disk) consume the SAME constants and the same rejection
 * wording, so the two cannot drift on the threshold or on what they say about
 * it. It lives in `surface` for the reason {@link ./media.ts} does: `@olai/web`
 * and `@olai/server` cannot import each other, and a contract kept in two
 * copies is a contract kept by memory.
 *
 * ## Why two numbers, and why 3 MiB
 *
 * Carried over from kolu's `packages/padi/src/upload.ts`, derivation and all,
 * because it was derived the hard way there and re-deriving it is how the same
 * incident happens twice.
 *
 * {@link MAX_ATTACHMENT_BYTES} is a POLICY cap on the FILE.
 * {@link CHUNK_BYTES} is what ONE frame carries. They are independent, and
 * before kolu chunked its uploads they were the same number: a 26 MB drop
 * became an oversized frame, and the ndjson decoder answers one of those by
 * CLOSING THE SOCKET (1009) rather than failing the call — taking every other
 * subscription on that tab's multiplexed wire down with it.
 *
 * The frame budget is `RPC_MAX_FRAME_BYTES`, IMPORTED rather than restated:
 * the number belongs to the framework's framing layer, and this repo has
 * already paid once for a second copy of it (#71, where the listener's own
 * `maxPayload` disagreed with the classifier above it and killed frames in
 * between). A chunk must fit inside it after two expansions:
 *
 *   1. **base64** — the wire field is a string, so R raw bytes become
 *      `ceil(R / 3) * 4` characters: 4/3, about 1.334x.
 *   2. **the JSON envelope** — procedure path, request id, `appendTo` (an
 *      absolute tmp path), the `name`, and JSON's own quoting. Bounded by the
 *      low kilobytes; 64 KiB is a generous ceiling.
 *
 * There is no THIRD expansion: base64's alphabet (`A-Za-z0-9+/=`) contains no
 * character JSON escapes. That is the one it is tempting to forget, and it is
 * genuinely absent.
 *
 * The size must also be a MULTIPLE OF 3, so base64's 3-bytes-to-4-characters
 * grouping divides it exactly and every chunk boundary lands on a 4-character
 * group — which is what lets each chunk decode independently of its
 * neighbours. A MiB is 1048576, which is NOT divisible by 3, so a round 4 MiB
 * fails that requirement. 3 MiB is the nearest size that satisfies it, and it
 * lands on a pleasant identity: 3 MiB of bytes is exactly 4 MiB of base64.
 *
 *     base64:   (3145728 / 3) * 4 = 4194304 bytes  (4.00 MiB, exact)
 *     envelope: < 65536 bytes
 *     frame:    < 4259840 bytes                    (4.06 MiB)
 *     budget:   16777216 bytes                     (16.00 MiB)
 *     headroom: ~3.9x
 *
 * That last comparison is a TEST rather than a claim — see `./attach.test.ts`,
 * which measures the chunk against the imported budget. A framework bump that
 * moved the cap would otherwise rot a paragraph nobody re-reads.
 */

import { PICTURE_EXTENSIONS } from "@olai/format"
import { RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit"

/**
 * Hard cap on one attached file — a cap on abuse rather than a size anyone
 * expects to reach. kolu's own number, kept rather than invented: it is
 * deliberately much larger than a frame, which is the whole point of the two
 * being separate.
 */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

/** Raw bytes of file content carried by ONE `chat.attach` call — see the
 *  derivation in the header. Multiple of 3, so the base64 division below is
 *  exact. */
export const CHUNK_BYTES = 3 * 1024 * 1024

/** What the rest of the frame is budgeted at: the procedure path, the request
 *  id, the `appendTo` path, the name, and JSON's quoting. Generous by an order
 *  of magnitude, and exported so the headroom is something a test can measure
 *  rather than a sentence in a comment. */
export const ENVELOPE_BYTES = 64 * 1024

/** How much of a frame one chunk is allowed to be — the budget the framework
 *  owns, minus what everything else on the frame is allowed to cost. */
export const CHUNK_FRAME_BUDGET = RPC_MAX_FRAME_BYTES - ENVELOPE_BYTES

/** Base64 characters per chunk — {@link CHUNK_BYTES} after the 4/3 expansion.
 *
 *  A multiple of 4 BY CONSTRUCTION, which is what makes chunking a base64
 *  STRING sound: every 4-character group decodes to exactly 3 bytes
 *  independently of its neighbours, so splitting on a 4-character boundary and
 *  decoding each piece separately concatenates to the same bytes as decoding
 *  the whole. Split off that boundary and the pieces decode to garbage. The
 *  unit test re-checks the multiple rather than assuming it. */
export const CHUNK_BASE64_CHARS = (CHUNK_BYTES / 3) * 4

/**
 * Split a base64 string into wire-sized pieces on 4-character boundaries.
 *
 * The type says at least one piece, and that is load-bearing rather than
 * decorative: the caller's loop is "the first chunk creates the file, every
 * later one appends", so a caller that had to consider an empty list would be
 * writing a branch for a file that was never created.
 *
 * `chunkChars` is a parameter only so a test can drive the boundary arithmetic
 * with numbers it can read; production passes nothing.
 */
export const chunkBase64 = (
  data: string,
  chunkChars: number = CHUNK_BASE64_CHARS,
): readonly [string, ...ReadonlyArray<string>] => {
  if (chunkChars % 4 !== 0) {
    throw new Error(`a base64 chunk must be a multiple of 4 characters, got ${chunkChars}`)
  }
  // The one case the loop below cannot state: an empty file is still one
  // write, so that it still lands on disk.
  if (data === "") return [""]
  const pieces: [string, ...Array<string>] = [data.slice(0, chunkChars)]
  for (let at = chunkChars; at < data.length; at += chunkChars) {
    pieces.push(data.slice(at, at + chunkChars))
  }
  return pieces
}

/** How many bytes a base64 string decodes to, without decoding it — the size
 *  gate reads this rather than materialising a buffer to measure. */
export const base64DecodedLength = (data: string): number => {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0
  return Math.floor((data.length * 3) / 4) - padding
}

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
