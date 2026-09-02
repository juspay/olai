/**
 * What an olai WRITE said for itself, read off the tool call that made it.
 *
 * The other half of "the transcript shows what the agent changed", and
 * deliberately the opposite shape from a diff. A `.org` diff is one enormous
 * line per node with everything on it changing at once — the rule the commit
 * panel is built on — so an olai write is drawn as the node-level story instead:
 * the format's own classification of the change (*marked done*, *note
 * rewritten*, *moved*), the node it was about, and what the rollup noticed.
 *
 * None of that is derived here. It is the ops layer's reply, verbatim: `sort`
 * is `Applied.sort`, computed there from the two readings the write is made of,
 * and `nudge` is the advice the write already carried back to the agent. This
 * file only recognises the reply in a tool result and copies the four fields
 * the panel draws. The alternative — reading the change out of the summary's
 * prose, or classifying the op by its tool name — is the second classification
 * this codebase deliberately does not have.
 *
 * WHY IT IS SAFE to read a tool result at all: the reply is olai's own. The
 * agent called a tool on the MCP server this process handed it, the handler is
 * `@olai/ops`, and `did` is the field our own projection puts on every one of
 * those answers ({@link ../../server/src/mcp/tools.ts}). A result from any other
 * server matches nothing here and draws nothing — which is the losing direction
 * this can afford, exactly as {@link ./agents/leg.ts}'s bets are.
 *
 * PURE, and tested as such.
 */

import { Sort } from "@olai/format"
import type { Wrote } from "@olai/surface"

/** The reply shape this recognises — the ops layer's `Applied` plus the `did`
 *  its MCP projection adds. Loose on purpose: every field is checked before it
 *  is read, because this is somebody's payload rather than a decoded value. */
interface Reply {
  readonly did?: unknown
  readonly id?: unknown
  readonly title?: unknown
  readonly file?: unknown
  readonly sort?: unknown
  readonly nudge?: unknown
}

/**
 * The story of an olai write out of a tool call's raw output, or `undefined`
 * when that output is not one.
 *
 * `undefined` rather than `null`, and that is the sibling convention rather
 * than a preference: `@olai/acp`'s `diffsOf` answers the same way about the same
 * report, and both feed fields where `undefined` already MEANS something — "no
 * report said anything about this", which is the protocol's own rule for every
 * other field of a tool update. Two spellings of nothing would need converting
 * at the one call site that reads both.
 *
 * The output of an MCP call arrives as the whole result — `content`,
 * `structuredContent`, `isError` — so the structured half is looked for first
 * and the value itself accepted as a fallback, because "an adapter hands the
 * structured content straight through" is a shape that costs one `??` to
 * tolerate and a silent blank to assume away.
 *
 * A REFUSED call is not one of these: it comes back as an error, the ops layer
 * reports it through its own channel, and the panel already draws it as a
 * refusal row with the validator's own detail in it. Nothing here has to tell
 * the two apart, because a refusal carries no `did`.
 */
export const wroteIn = (rawOutput: unknown): Wrote | undefined => {
  if (typeof rawOutput !== "object" || rawOutput === null) return undefined
  const outer = rawOutput as { readonly structuredContent?: unknown }
  const reply = (typeof outer.structuredContent === "object" &&
      outer.structuredContent !== null
    ? outer.structuredContent
    : rawOutput) as Reply
  // `did` is the marker and `title` is what the row says; a reply carrying
  // neither is not a write this panel can tell a story about.
  if (typeof reply.did !== "string" || typeof reply.title !== "string") return undefined
  return {
    // Absent for a write that changed no record — the ops layer says so by
    // omission, and `null` is how the wire spells the same thing. CHECKED
    // against the format's own list rather than cast: this is a value out of a
    // payload, and a word the panel has no phrase for would ride the wire and
    // draw a blank where the story goes.
    sort: sortIn(reply.sort),
    // The node itself, so the row the panel draws can POINT at it rather than
    // only describe it. `null` for a reply that named none — this is somebody's
    // payload, and every other field here is checked before it is read.
    id: typeof reply.id === "string" && reply.id !== "" ? reply.id : null,
    title: reply.title,
    file: typeof reply.file === "string" && reply.file !== "" ? reply.file : null,
    nudge: typeof reply.nudge === "string" && reply.nudge !== "" ? reply.nudge : null,
  }
}

/** One of the format's own classifications, or `null` for anything else. */
const sortIn = (value: unknown): Wrote["sort"] =>
  typeof value === "string" && (Sort.literals as ReadonlyArray<string>).includes(value)
    ? (value as Wrote["sort"])
    : null
