/** THE DIRECTORY, as the wire speaks it — one head per served file and whether
 * there is a set at all. The projection that BUILDS the heads is
 * `./projection.ts`, one door over, because a `./wire` door is inert and this
 * one crosses to the browser.
 *
 * A ROW DECLARES ITS OWN VOCABULARY, which is what moved. `Head` and
 * `Manifest` were `@olai/surface`'s, beside two content rows' entries and the
 * spec of a shell that no longer exists, and this row imported its own
 * members' schemas back out of the general package every browser bundles.
 * Nothing re-exports them from there now, for the reason
 * `olai-plugin-chat`'s transcript shapes are not re-exported either: a general
 * spec carrying a row's vocabulary is the registry arrow pointing backwards.
 *
 * THE VAULT IS THE ROW EVERY OTHER FILE-SHAPED ROW STANDS ON, so these two
 * shapes cross more package boundaries than any other row's — `heads` is what
 * a sidebar draws its tree from and what a page model tests membership
 * against, and no other collection holds every file. That is a reason for the
 * door to be explicit, not a reason for the shapes to live somewhere general:
 * a consumer imports `olai-plugin-vault/wire`, which is where they are
 * declared, and the fence one package over holds that door to being a
 * contract rather than a way into this row's runtime.
 */
import { BrokenFile, Face } from "@olai/format"
import { Schema } from "effect"

/**
 * One SERVED FILE's HEAD: which revision of the directory it is at, what it is
 * called, and whether it could be read at all. Everything about a file except
 * its content.
 *
 * It exists because "the file on disk MOVED" and "here is what it says" are
 * two different questions, and until this member there was one way to ask
 * both. A `.html`'s page draws from a frame that fetches the file over HTTP
 * (`/surface`'s `seal.ts`), so the only thing it wants from the wire is the first
 * question — and asking it through `olai-plugin-markdown`'s `DocumentEntry`
 * sent a saved page's megabytes to a tab that drew none of them, on every open and on every edit,
 * ahead of the fetch that actually drew it. That was PR #206's standing
 * deferral, and this is the member it named.
 *
 * EVERY served file since PR 10 of `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`,
 * where it was every BODIED one. That is the design's §3 Sidebar row arriving:
 * the file tree is paths and faces, which is key-set-sized, and it was the only
 * thing a browser still read the whole `outlines` collection for. An outline's
 * head is exactly what a document's always was — a revision and a face, no
 * content — so this is one member widened rather than a second one built beside
 * it, and the browser now learns the DIRECTORY here and each PAGE from its own
 * reading (`./page.ts`).
 *
 * `rev` is `olai-plugin-outlines`'s `OutlineEntry.rev` and
 * `olai-plugin-markdown`'s `DocumentEntry.rev`, unchanged and on purpose: it MOVES when the file does and stays put when it does not, so a
 * reader watching it is watching this one file rather than the directory's
 * clock. A page rewritten with the bytes it already had does not move it —
 * nothing re-decoded it — and a megabyte string never has to be compared to
 * find that out.
 *
 * There is no `file` field, for `DocumentEntry`'s reason: the KEY is the path. And there is no second fact in here waiting to be useful — a head that
 * grew a size, a modified time or a hash would be a second answer to a question
 * `rev` already answers, kept in step by hand.
 */
export const Head = Schema.Struct({
  rev: Schema.Int,
  /** What the file IS, apart from what it says: its path, its title, the
   *  addresses it points at, the tags it writes (`@olai/format`'s `Face`).
   *
   *  IT CARRIES ITS OWN PATH, and the paragraph above forbids exactly that of
   *  the entry — so the difference is worth naming. A `file` FIELD beside the
   *  key would be one fact spelled twice by two hands; a face is one VALUE the
   *  format made, whose identity is its path, cut from the same document in the
   *  same function as the key it arrives under ({@link headProjection}, at the
   *  foot of this file). What the browser then holds is a list of faces
   *  (`./browser/directory.ts`), where a key is not in hand — taking the path
   *  off here would mean re-attaching it on arrival, which is the second hand.
   *
   *  THE ONE FACT THAT MAY JOIN `rev` HERE, and it is worth saying why, since
   *  the paragraph above forbids a second answer to a question `rev` already
   *  has. A size, a modified time or a hash would each be one of those. A face
   *  is not: it is what the file SAYS, which is the question this member could
   *  not be asked before — and a browser cannot derive it the way it can an
   *  outline's, because the body it would read is the one thing this collection
   *  exists to keep off the wire. Without it a document is a PATH to every tab
   *  in the app, which is the position the whole first-class-documents arc is
   *  about. It moves when `rev` moves and by the same act, since both are cut
   *  from one document in one function ({@link headProjection}). */
  face: Face,
  /**
   * Why this file could not be READ — `null` for every file that parsed, and
   * for every file that has no parsing to do.
   *
   * The one field here that is not about a file's identity, and it is here for
   * the reason the face is: it is what a browser cannot derive without the
   * content. A `.olai` that stopped parsing keeps its key and carries its
   * errors — the per-entity half of the error scope expressed as DATA rather
   * than by absence, which is the same sentence `olai-plugin-outlines`'s
   * `OutlineEntry.broken` makes and the same value, cut from the same set. The sidebar marks such a
   * file and its own page draws the errors instead of a tree; a reader holding
   * only the `errors` cell would have to guess which outline a `file:line`
   * belonged to and hope the two lists agreed.
   *
   * It rides on the HEAD rather than on the page's reading because the sidebar
   * marks every broken file in the directory, not the one somebody is looking
   * at — and it is a boolean's worth of weight per file, which is what the rest
   * of this entry already costs.
   */
  broken: Schema.NullOr(BrokenFile),
})
export type Head = typeof Head.Type

/**
 * Whether there is a set at all, and nothing else.
 *
 * `null` is a state, not an absence, and it is the one thing the collections
 * cannot say. Three things a reader must tell apart — "the server has not
 * answered yet" (no frame at all), "the server has never had a valid set to
 * show" (`null`), "here is your directory" (a value) — and an empty collection
 * snapshot is the SECOND and THIRD at once unless something else carries the
 * bit. This is that something, and being that is its whole job.
 *
 * So the value carries NOTHING. It used to carry the documents, which is what
 * `olai-plugin-markdown`'s `DocumentEntry` was cut out of it to stop; what is
 * left is a fact with no fields, because every fact about this directory now belongs to a file and
 * travels on that file's entry. A set revision here would be the obvious thing
 * to reach for and is deliberately absent twice over: nothing reads it, and it
 * moves on every revision, so it would wake every open tab's derivation — the
 * cell that is quiet is the point of `./file-surface.ts`'s `sameSet`.
 */
export const Manifest = Schema.NullOr(Schema.Struct({}))
export type Manifest = typeof Manifest.Type

/** A directory that has loaded, as the one value there is of it. */
export const LOADED: Manifest = {}

/** When two answers are the same answer, so the cell can stay quiet. There is
 *  exactly one thing this value can say, so there is exactly one thing that can
 *  change about it: whether there is a set. */


