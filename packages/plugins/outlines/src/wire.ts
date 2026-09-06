/** THE OUTLINES COLLECTION, as the wire speaks it — one entry per outline
 * file, and nothing that reads a revision. The projection that BUILDS these is
 * `./projection.ts`, one door over, because a `./wire` door is inert and this
 * one crosses to the browser.
 *
 * A ROW DECLARES ITS OWN VOCABULARY, which is what moved. `OutlineEntry` was
 * `@olai/surface`'s, beside the entries of two other rows and the spec of a
 * shell that no longer exists, and this row imported its own member's schema
 * back out of the general package every browser bundles. Nothing re-exports it
 * from there now, for the reason `olai-plugin-chat`'s transcript shapes are not
 * re-exported either: a general spec carrying a row's vocabulary is the
 * registry arrow pointing backwards. A consumer of these shapes imports
 * `olai-plugin-outlines/wire`, which is where they are declared.
 *
 * THE SHAPES ON THE FLOOR ARE STILL THE FLOOR'S. `Located`, `BrokenFile` and
 * `Face` are `@olai/format`'s and are taken from there rather than re-declared
 * here, and so are the page and narrowing shapes this row's streams are
 * declared with: one vocabulary that the spec and the ops layer both stand on,
 * so there is no second spelling to drift. What is this row's is the ENTRY —
 * how a file's records, its breakage and its face are packed into one keyed
 * value, and at which revision. */
import { BrokenFile, Face, Located } from "@olai/format"
import { Schema } from "effect"

/**
 * One outline file's slice of the set, as published at set revision `rev`.
 *
 * Exactly one of `nodes` / `broken` is meaningful: a file that stopped parsing
 * keeps its key and carries its errors, which is the per-entity half of the
 * error scope expressed as DATA rather than by absence. A reader that had only
 * the `errors` cell would have to guess which outline a `file:line` belonged to
 * and hope the two lists agreed.
 *
 * `rev` is the SET's revision at the moment this entry was published, and it
 * travels per entry rather than per frame for one reason and against one
 * expectation. The reason: a phase-4 write names it as the base it edited, and
 * the base a write is derived from is the revision the entry it read was at.
 * The expectation it defeats is that all the entries on screen share it — see
 * the cross-file consistency paragraph in
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/outlines-as-collection.md`. Only the files that MOVED in
 * a tick are upserted, so an unchanged neighbour keeps the older number until
 * something changes it.
 *
 * WHICH MAKES IT THE CHANGE TOKEN, and that is a contract rather than an
 * accident of the implementation, because two readers rest on it: this number
 * moves when THIS FILE's records move and at no other time. A write names the
 * revision it edited as its base, and `Head.rev` is how a page WATCHES one file
 * it does not draw — a preview waiting for its `.html` to move — without asking
 * for the body. So an entry rebuilt at a new revision for a file that did not
 * change costs a reader wasted work, and an entry whose records changed
 * published at a revision a reader already holds is a view that is silently
 * stale. {@link outlineProjection} is what keeps it (an entry is rebuilt
 * exactly when the store re-decoded its path), and `published.test.ts` is where
 * that is pinned.
 *
 * WITHIN ONE PROCESS, which is the other half of the same promise: these
 * numbers are a counter, so a tab comparing two servers' counters would be
 * comparing nothing. It cannot: the socket echoes the process id it was given
 * and a server that does not recognise itself retires the tab
 * (`packages/tests/features/the_connection.feature` restarts a server under a
 * live tab and asserts exactly that, plus the reload that recovers it). So a
 * reader COMPARING these numbers — a write against the base it read, a page
 * against the revision it last saw — is always comparing within the run that
 * minted them.
 */
export const OutlineEntry = Schema.Struct({
  rev: Schema.Int,
  /** This file's nodes only, in file order. Empty for a file that did not
   *  parse, and empty for one that holds nothing — the difference is `broken`. */
  nodes: Schema.Array(Located),
  broken: Schema.NullOr(BrokenFile),
  /** What this file IS, apart from what it holds: its title, the addresses it
   *  points at, the tags its records write (`@olai/format`'s `Face`).
   *
   *  It rides here rather than being derived on arrival, and that is a cost
   *  decision rather than a doctrinal one: a browser CAN build an outline's
   *  face — it holds the records and the format's own constructor — but doing
   *  so is a walk of every title and every note of the corpus per revision,
   *  where the server built this once when the file's bytes changed. The
   *  face is small; the walk is not. */
  face: Face,
})
export type OutlineEntry = typeof OutlineEntry.Type
