/** THE DOCUMENTS COLLECTION, as the wire speaks it — one entry per bodied
 * file, and the projection that decides which of them travel.
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
import { bodyOf, type BrokenFile, type Document, isBodied, type Markdown, type Reading, textKind, type Unkept } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { type Change, changeOf, frame, type Projection } from "@olai/surface/projection"
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

/**
 * The documents half of a revision: what the two collections keyed by a bodied
 * file are told, and what is owed to the body reader.
 *
 * ONE function over ONE reading of the previous revision, and over ONE binding
 * of the source list, which is the whole reason it is not three: the slice, the
 * head and the split all need "what the wire had before this" and all three
 * must be about the same files, and callers passing those separately are
 * callers who can pass different things.
 *
 * An entry carrying its text is sent as it is. An entry saying `null` is a body
 * the set does not keep, and it is the body reader's: writing that value to a
 * key somebody is showing would blank the page and re-fill it a moment later,
 * where the reader replaces it in one frame.
 *
 * A key this revision INTRODUCES is sent anyway, `null` and all, and that is
 * not an exception but the other thing an upsert does: it is how the collection
 * learns its MEMBERSHIP changed, which is what puts a new file in the sidebar.
 * A reader cannot be SHOWING a file that did not exist a moment ago, so there
 * is nothing to blank.
 *
 * WHO CAN SEE THAT `null`, exactly: only a reader holding a `get` open on the
 * key ACROSS the file's birth. It used to be all they saw — a body was read for
 * whoever ASKED, the ask was `readOne`, and this frame is not an ask — so such a
 * reader sat on the announcement with no body until it opened the key again.
 * That is closed now, and by the other half of the same revision: the newborn
 * path is in `unread` too, a hold is taken by the SUBSCRIPTION rather than by a
 * successful read (the collection's own `holders` dep, `./server.ts`), so the
 * body is read for exactly the readers holding that key and lands on the same
 * key one frame later. What is left of the edge is an ORDER rather than an
 * absence: a holder across a birth sees the announcement and then the body,
 * where a reader who opens the key afterwards sees only the body. Nobody in
 * tree is even in that position — the browser's subscription is CREATED from
 * the key set (the page model refuses a path the directory does not hold,
 * `olai-plugin-navigation`'s page model), and an MCP client reads afresh on every
 * `notifications/resources/updated` — and a raw client that holds one is now
 * told the whole truth in two frames instead of half of it in one.
 *
 * WHAT IS STILL NOT DONE HERE, and deliberately: no body is READ from this
 * function, on a birth or on any other revision. A `git pull` that adds four
 * hundred saved pages announces four hundred keys and opens none of them,
 * because the read is the body reader's and its filter is who is holding what.
 * And no body is OWED for a file this process cannot read as text at all — see
 * the pass at the foot of the function.
 */
/** Whether this file's breakage is a READ that failed, not a parse. The set
 *  folds every decode Result.fail into `broken`; only `unreadable-file` is
 *  {@link DocumentEntry.refused}. A parse-broken `.md` keeps the blank body
 *  it always had, and `Head.broken` is still what the sidebar ⚠ hangs from. */
const isUnread = (file: BrokenFile | undefined): boolean =>
  file?.errors.some((error) => error.code === "unreadable-file") === true

const documentsOf = (
  snapshot: Snapshot<Reading>,
  held: { readonly documents: Change<DocumentEntry> } | null,
  /** Why the set holds a PLACE for a file and no content — the same map
   *  the heads read for `olai-plugin-vault`'s `Head.broken`. An outline's
   *  breakage rides `olai-plugin-outlines`'s `OutlineEntry.broken`; a
   *  document's READ failure is this entry's `refused`. A parse failure is
   *  not. */
  broken: ReadonlyMap<string, BrokenFile>,
  /** Both {@link changeOf}'s own — the files this revision re-decoded, and
   *  whether the store's diff accounts for every one that left. */
  decoded: ReadonlyArray<Document>,
  complete: boolean,
): { readonly documents: Change<DocumentEntry>; readonly unread: ReadonlyArray<string> } => {
  // The BODIED half of the directory: this member is what a reader opens as a
  // page, and an outline is published as its records next door.
  const change = changeOf<Markdown | Unkept, DocumentEntry>(
    snapshot.value.set,
    isBodied,
    (document) => ({
      rev: snapshot.rev,
      text: bodyOf(document),
      // A kept `.md` that will not OPEN is a refusal of THIS file. A
      // `.html` is never in `broken` from the probe — its body is not
      // kept — so its refusal arrives later, from `./server/bodies.ts`.
      refused: isUnread(broken.get(document.path)),
    }),
    decoded,
    snapshot,
    held?.documents,
    complete,
  )
  // One pass, two lists: what to send, and what somebody has to read. A file is
  // in exactly one of them unless it is BOTH new and bodyless, which is a key
  // announced and a body owed — see above.
  //
  // A BODY IS OWED ONLY WHERE THERE IS ONE TO READ, which is the registry's
  // `holds` column asked by name (`textKind`). A picture and a `.pdf` are
  // bodied files the set keeps nothing of, exactly like a saved page — and
  // there is no text in either for this process to hand anybody: their pages
  // fetch the bytes themselves, off the media route. Listing one here would
  // promise a body that, if a raw client ever held the key, would be read off
  // the disk and decoded as UTF-8, which is neither the file nor an error. The
  // KEY is still announced, because membership is what puts a file in the
  // sidebar.
  //
  // WHICH KEYS ARE NEW is the slice's own answer (`born`) rather than a
  // question asked of the previous revision's map, which is a map this one now
  // holds — see `@olai/surface`'s `Sliced`.
  const upserts: Array<readonly [string, DocumentEntry]> = []
  const unread: Array<string> = []
  for (const [path, entry] of change.upserts) {
    if (entry.text !== null) upserts.push([path, entry])
    else {
      if (textKind(path) !== null) unread.push(path)
      if (change.born.has(path)) upserts.push([path, entry])
    }
  }
  return { documents: { ...change, upserts }, unread }
}

/**
 * THIS REVISION'S `documents`, the one before it consumed, and the paths the
 * body reader now owes somebody.
 *
 * The slicing rule is not here — `@olai/surface`'s `projection.ts` holds it,
 * argued in full — and what this adds is the only thing that is this row's: a
 * bodied file's key may travel without its body, and deciding which of them do
 * is {@link documentsOf} above. `unread` rides out beside the change rather
 * than being derived from it by the caller, because "an upsert this revision
 * withheld" and "a body somebody is owed" are decided in one pass and could
 * not be re-derived apart without asking the registry twice.
 */
export const documentProjection = (snapshot: Snapshot<Reading>, previous?: Projection<DocumentEntry>): Projection<DocumentEntry> & { readonly unread: ReadonlyArray<string> } => {
  const one = frame(snapshot, previous?.files)
  const next = documentsOf(snapshot, previous ? { documents: previous.change } : null, one.broken, one.decoded, one.complete)
  return { files: one.files, change: next.documents, unread: next.unread }
}
