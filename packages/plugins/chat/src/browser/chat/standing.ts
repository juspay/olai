/**
 * How each standing is MARKED and SAID — one table, read by both the roster's
 * chips and the sentences under them.
 *
 * Its own module because it was the same wording twice: the chip carried a
 * per-standing phrase for its tooltip and its screen-reader text, and the
 * sentence row carried a second one, near-identical, as a ternary at the point
 * of rendering. Two spellings of "what `missing` means to a person" is one for
 * the next reader to find and another for them to miss — and they had already
 * drifted, one saying *missing from this conversation* and the other *is
 * missing from this conversation*.
 *
 * EVERY SENTENCE COMPLETES THE SERVER'S NAME, which is what lets one table
 * serve both sites: *kolu is missing from this conversation* is what the row
 * draws with the name in bold and what the chip puts on its `title`, and it is
 * what a screen reader is given for the chip on its own.
 *
 * A GLYPH AND A WORD, never a colour alone. The colour is the fastest read for
 * somebody who can use it and the only read for nobody: a tick beside a name is
 * legible in a screenshot, in a high-contrast theme and to a reader who cannot
 * tell `done` from `alarm`. The sentence is what the screen reader gets, and it
 * is a whole sentence rather than the tag — `handed` means nothing to anyone
 * who has not read `../../../../plugins/chat/src/servers.ts`.
 *
 * `handed` HAS NO MARK, which is the state's own honesty: there is nothing to
 * report yet. Every row on an agent that says nothing per server is this one,
 * so a glyph here would be a decoration on the majority case and would leave
 * the tick — the thing that is actually news — competing with it.
 *
 * A RECORD OVER THE CLOSED UNION rather than a lookup with a fallback: a fifth
 * standing on the wire fails to compile here, which is the same discipline
 * `../../../../plugins/chat/src/chat.ts`'s `EVIDENCE` keeps over the event vocabulary.
 *
 * WHAT IS DELIBERATELY NOT A ROW HERE is whether a standing means this
 * conversation does not HAVE the server. That is what decides which rows get a
 * sentence of their own ({@link ./Missing.tsx}), and it is already answered by
 * a total switch beside the union itself (`@olai/surface`'s `whyNot`) — a
 * second answer in this table would be a second thing free to disagree with it,
 * and the disagreement renders as a failure row with no reason under it.
 */

import type { ServerStanding } from "olai-plugin-chat/wire"
export const SAID: {
  readonly [K in ServerStanding["kind"]]: {
    /**
     * The mark beside the name on a chip, or `null` for the standing with
     * nothing to report.
     *
     * ONE NULLABLE PAIR rather than two fields that have to be blank together:
     * a glyph and its tint are one decision, and spelled as two empty strings
     * both `{ glyph: "", tint: "text-alarm" }` and `{ glyph: "×", tint: "" }`
     * are constructible and both render wrong — an invisible mark, or an
     * untinted one. This way "no mark" is one fact and the two halves go
     * together by construction.
     */
    readonly mark: { readonly glyph: string; readonly tint: string } | null
    /** What it means, completing the server's NAME — so one sentence serves
     *  the chip's tooltip, its screen-reader text and the row under it. */
    readonly sentence: string
  }
} = {
  connected: {
    mark: { glyph: "✓", tint: "text-done" },
    sentence: "is attached, the agent says",
  },
  handed: {
    mark: null,
    sentence:
      "was handed to this conversation; the agent has not said whether it attached",
  },
  unattached: {
    mark: { glyph: "×", tint: "text-alarm" },
    sentence: "did not attach to this conversation",
  },
  missing: {
    mark: { glyph: "×", tint: "text-alarm" },
    sentence: "is missing from this conversation",
  },
}
