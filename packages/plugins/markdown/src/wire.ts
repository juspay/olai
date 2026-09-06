/** THE DOCUMENTS COLLECTION, as the wire speaks it — one entry per bodied
 * file, and nothing that reads a revision. The projection that decides which of
 * them travel is `./projection.ts`, one door over, because a `./wire` door is
 * inert and this one crosses to the browser.
 *
 * A ROW DECLARES ITS OWN VOCABULARY, which is what moved. `DocumentEntry` was
 * `@olai/surface`'s, beside the entries of two other rows and the spec of a
 * shell that no longer exists, and this row imported its own member's schema
 * back out of the general package every browser bundles. Nothing re-exports it
 * from there now, for the reason `olai-plugin-chat`'s transcript shapes are not
 * re-exported either: a general spec carrying a row's vocabulary is the
 * registry arrow pointing backwards. A consumer of these shapes imports
 * `olai-plugin-markdown/wire`.
 *
 * TWO THINGS AND NOT ONE, and the pairing is the point: {@link DocumentEntry}
 * says what a body's key is worth, and {@link documentProjection} says which
 * keys may carry one. They are one file because the second is the only reason
 * the first has three states — an entry that a projection would never withhold
 * would not need to tell a missing body from a refused read.
 */
import { Effect, Schema } from "effect"

/**
 * One bodied file's slice of the set, as published at set revision `rev`.
 *
 * The entry carries the BODY, and it is the only thing on the wire that does:
 * one collection, keyed by path, read one key at a time. What it replaced was
 * a `documents` array on `olai-plugin-vault`'s `Manifest` — every served
 * document's full text
 * in the FIRST frame of every subscription, ~124 KB of a ~212 KB snapshot for
 * this project's own `docs/`, and O(corpus) for a directory of thousands.
 * What changed then was when a body travels — when someone opens it — and
 * nothing about the SET: it went on holding every body it had read.
 *
 * It does not any more, and that is the second half of the same idea: a `.html`
 * is served from a read of its own and its bytes are kept by nobody
 * (`@olai/format`'s `kinds.ts` decides which kinds, `./server/bodies.ts`
 * does the reading), so this entry's `text` can be `null` — see
 * below. What is unchanged, and load-bearing, is that the server still holds
 * every served PATH and validates every `doc` against it (`docs/format.md`).
 *
 * `rev` is the set's revision at the moment this entry was published, for the
 * reason `olai-plugin-outlines`'s `OutlineEntry` carries one: a body now
 * arrives on its own frame, so "which moment of the directory am I reading" is
 * a question a reader can actually ask, and the answer is a number rather than
 * an assumption. An unchanged document keeps the entry it was published with, so the number does
 * not move under a reader who is not looking at a changed file.
 *
 * There is no `file` field: the KEY is the path. A second copy of it here is a
 * second spelling of one fact, and the two could disagree.
 *
 * THREE STATES, and they are not two plus a boolean. `text` a string is the
 * body. `text: null` and {@link DocumentEntry.refused} false is the body not
 * here — a `.html` the set keeps only the path of, or a key announced before
 * its bytes have been read. `refused` true is a READ that was attempted and
 * the file would not open: the key is here, the bytes are not, and that is a
 * fact about THIS file rather than a reason to fail the whole probe. Exactly
 * one of a body and a refusal is the news; a reader that folded `refused`
 * into `text ?? ""` would draw a blank page for a file that had something to
 * say.
 */
export const DocumentEntry = Schema.Struct({
  rev: Schema.Int,
  /**
   * Verbatim, exactly as on disk — markdown or markup, interpreted at view
   * time by whichever face this kind of file is drawn with.
   *
   * `null` is a STATE and not an absence, the way `olai-plugin-vault`'s
   * `Manifest` is: this
   * file is served and its body is not here. It is what a server holding only
   * the PATH of a `.html` says about one to itself — the set does not keep a
   * saved page's bytes for the life of the process (`@olai/format`'s
   * `kinds.ts`) — and it is admitted by this schema because that projection is
   * typed by it.
   *
   * A reader ASKING FOR ONE is not shown it. A per-key `get` for a body the
   * server does not hold answers nothing until the file has been read, which is
   * the framework's own held-open-on-absent path: a browser waits one read
   * rather than being told the body is missing, and a one-shot reader (an
   * agent's `resources/read`, which takes the first frame and leaves) is handed
   * the file rather than a `null`. The other way every entry could travel — the
   * batched `deltas` verb — is exactly what this collection does not have.
   *
   * ONE frame can still carry it, and it is worth being exact about which: the
   * upsert that ANNOUNCES a key, for a file that has just appeared in the
   * directory. That frame is how a collection says its membership changed, and
   * it reaches anyone already subscribed to that key — which can only be a
   * reader who asked for a file before it existed. It says what it says: the
   * file is here, its body is not yet. A reader folds it the way it folds an
   * entry that has not arrived, and hears the body on a later frame or on its
   * next read.
   *
   * A READ THAT WAS REFUSED is the other `null`, and it is not this one. See
   * {@link DocumentEntry.refused}.
   */
  text: Schema.NullOr(Schema.String),
  /**
   * Whether a READ of this body was attempted and the file would not open.
   *
   * `false` for every file whose body is here, and for every file whose body
   * is not here yet — the projection of a `.html` the set keeps only the path
   * of. `true` is the third state this entry can be in: the file is served, a
   * reader asked for its bytes, and the disk said no. It is not a parse
   * failure (`olai-plugin-vault`'s `Head.broken`, `olai-plugin-outlines`'s
   * `OutlineEntry.broken` — those are decode failures, and a file that cannot
   * be opened never reaches them) and it is not an absence (the key is here).
   * The blast radius is this file: what it replaced was a probe that failed the
   * WHOLE directory over one unreadable saved page.
   *
   * Produced where the read happens (`./server/bodies.ts` for a body the set
   * does not keep; the probe, for a kept `.md` that will not open) and answered
   * the same way on the HTTP face (`olai-plugin-vault`'s `http/media.ts`) so
   * the two tell one story. The sentence both faces draw is `@olai/surface`'s
   * `BODY_REFUSED`.
   *
   * A one-shot reader (an agent's `resources/read`) is handed this frame
   * rather than being held open until a body that will never come. That is
   * the held-open-on-absent path closed for a read that failed, rather than
   * only for a read that succeeded.
   *
   * OPTIONAL on the wire, default `false`, so the two mismatched ends are
   * both legal: an old client drops a field it does not know (and degrades
   * to the blank body it always drew), and a new client reading a frame
   * that never carried one treats it as not refused. In-repo the two ends
   * ship from one commit; this is the public wire's answer for a raw
   * client that does not.
   */
  refused: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
})
export type DocumentEntry = typeof DocumentEntry.Type
