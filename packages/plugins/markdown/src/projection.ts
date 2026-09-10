/**
 * WHY THE PROJECTION IS NOT IN `./wire.ts`, which is where it briefly was.
 *
 * A `./wire` door is INERT — schemas and nothing else, which is the sentence
 * every row's `surface.ts` opens with and the property that lets a browser load
 * a contract without acquiring anything. This file is not inert in the way that
 * matters: it reaches `@olai/surface/projection` for the slicing rule, which
 * reaches `@olai/format`'s set readers, and `./surface.ts` imports the entry
 * schema as a VALUE — so a projection sitting beside the schema puts the
 * server's revision machinery on the graph of every browser that loads the
 * spec. It is a few hundred lines of code no tab can call, on the one graph
 * where nothing unused is free.
 *
 * So the split is by GRAPH rather than by subject: the schema crosses to the
 * browser, the projection does not, and the two doors say which is which.
 * `@olai/bundle`'s `fence.test.ts` walks the browser entry's transitive imports
 * and is what keeps the answer honest.
 */
import { type BrokenFile, type Document, bodyOf, isBodied, type Markdown, type Reading, textKind, type Unkept } from "@olai/format"
import type { Snapshot } from "@olai/store"
import { type Change, changeOf, frame, type Projection } from "@olai/surface/projection"

import type { DocumentEntry } from "./wire.ts"

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
