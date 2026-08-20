/**
 * The BODIES of the served documents — one at a time, for whoever is showing
 * one.
 *
 * ONE module owns `olai.collections.documents`, and that is the point of it
 * being one. The member is served `keys` + `get` with no `deltas`
 * (`@olai/surface`), so a plain `.use()` — which opens the key stream AND a
 * value stream per key — would pull every `.md` body in the directory onto the
 * first paint, which is the defect `snapshot-scale` removed. That rule is
 * enforceable only where the member is reached, so the member is reached here
 * and nowhere else.
 *
 * WHAT IT NO LONGER OWNS is the file list. The paths, the faces and the
 * revisions used to be this module's too, off the `heads` collection beside
 * this one — and `heads` has since become the DIRECTORY, every served file
 * rather than every bodied one (`docs/brainstorming/vault-in-browser.md`'s PR
 * 10). A module named for documents holding the list of outlines as well would
 * be a module named for half of what it does, so the list moved to
 * `../directory.ts` and what is left here is the subject this file always had:
 * a body, fetched per key, by whoever is showing it.
 *
 * THE TWO WERE ALWAYS ASKED SEPARATELY, and a `.html` is why. A preview frame
 * fetches the file over HTTP from `/media/` (`./Hypertext.tsx`), so nothing on
 * that page is drawn out of the body — what it needs is the revision, so that a
 * file rewritten on disk re-points the frame. Reading the body to learn that
 * sent a saved page's megabytes to a tab that drew none of them, and made the
 * server read the file to send them; asking the head instead costs a number.
 * That was PR #206's standing deferral, and the head is where it landed.
 *
 * ONE subscription per PATH, however many components ask: `askers` is what
 * decides membership, so two rows attached to the same document share the
 * stream and neither one's unmount cancels the other's. A narrowed `.use()` is
 * honestly its own subscription with no dedup of its own, so a per-consumer
 * `.use()` here would be one socket stream per doc-carrying ROW.
 *
 * The bound is worth naming: what this costs is the documents ON SCREEN, and a
 * `doc` reference draws a one-line preview out of a whole body. An outline that
 * attaches hundreds of documents at once therefore pays for hundreds of them.
 * That is the shape the design agreed (`docs/brainstorming/surface-mcp-viewing.md`):
 * if a preview for many nodes at once is needed, the answer is a small member
 * on the wire carrying what a row draws rather than what a page does — the head
 * beside this one is that idea's first instance, and a one-line preview would
 * be its second. Measured first, not guessed at here.
 *
 * A node's `doc` is drawn on every page there is — a tree row, a zoomed
 * heading, a day — so the reader is a CONTEXT rather than a prop: threading it
 * through every row of a thousand-row tree would make every component's
 * signature a function of what one of its descendants happens to need, which is
 * the same reason the router is a context.
 */

import type { DocumentEntry } from "@olai/surface"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  useContext,
} from "solid-js"

import { sameList } from "../same.ts"
import { olai } from "../wire.ts"

/**
 * One bodied file's entry once its BODY is here — which is the only state a
 * page has anything to draw from.
 *
 * The wire's entry admits `text: null` — the server saying it holds this file's
 * PATH and not its body (`@olai/surface`'s `DocumentEntry`: a `.html`, whose
 * bytes no longer sit in the served set). ONE frame really carries it, and this
 * fold is what makes that harmless: a body ASKED FOR arrives as a body (the
 * server answers a per-key `get` with nothing at all until it has read the
 * file), but the upsert that ANNOUNCES a key — a `.html` that has just appeared
 * in the directory — says `null`, and it reaches anyone already subscribed to
 * that key.
 *
 * Folding it here is what keeps that a fact about the SERVER rather than
 * something every page has to know: a null and a missing entry are "the body is
 * not here" said two ways, and a page that told them apart would be drawing a
 * spinner for the width of a disk read. So it collapses into the `undefined`
 * every consumer already handles, once, here — and everything above this line
 * takes a `text` that is a string.
 */
export type Served = DocumentEntry & { readonly text: string }

export interface Documents {
  /** One document's body, for as long as the calling owner lives — and for as
   *  long as `file()` names one: `undefined` is a caller that has nothing it
   *  would do with a body (a page whose face cannot be written — see
   *  `./DocumentPage.tsx`), and it asks the server for nothing at all.
   *
   *  `undefined` comes back while a body is still on the way — the normal first
   *  state, and the one a body being read from disk shares with it ({@link
   *  Served}) — and also for a `doc` naming a file that is no longer there (a
   *  valid set cannot produce that: `doc` is validated against the documents
   *  found). */
  readonly read: (
    file: Accessor<string | undefined>,
  ) => Accessor<Served | undefined>
}

/** Whether an entry is one a page can draw — see {@link Served}. */
const arrived = (entry: DocumentEntry | undefined): entry is Served =>
  entry !== undefined && entry.text !== null

export const createDocuments = (): Documents => {
  /** Who wants what: a path is wanted while at least one owner is showing it.
   *  ONE value, so membership cannot disagree with the count that decides it —
   *  a path stuck in the key set is a stream that never closes, and one missing
   *  from it is a body that never arrives for a row still on screen. */
  const [askers, setAskers] = createSignal<ReadonlyMap<string, number>>(new Map())
  /**
   * The paths, BY VALUE — because what the collection is asked for is the
   * SET of them and the count beside each is nobody's business but the map's.
   *
   * Two rows showing one document is a count of 1→2 on a path that was already
   * held: the same question, and a fresh array to ask it with. Handed straight
   * over, that array notified the framework's `keys` memo, which re-diffed its
   * `mapArray` and re-ran every per-key `read()` accessor in the app — no
   * refetch, because the string memos downstream stop there, but a walk of
   * every open document for a reference that changed nothing
   * (docs/brainstorming/reactivity-after-the-flip.md §3.7).
   */
  const wanted = createMemo(() => [...askers().keys()], [], { equals: sameList })
  const held = (file: string, by: number): void => {
    setAskers((before) => {
      const after = new Map(before)
      const now = (after.get(file) ?? 0) + by
      if (now > 0) after.set(file, now)
      else after.delete(file)
      return after
    })
  }

  // A NARROWED subscription: `keys` is the set above rather than the server's
  // whole key set, so the per-key streams the framework opens are exactly the
  // documents being shown. A key leaving `wanted` disposes its own reactive
  // owner, which closes that stream server-side — no teardown to write here.
  const entries = olai.collections.documents.use({ keys: wanted })

  return {
    read: (file) => {
      // An EFFECT, so the interest follows a component whose `file` moves (a
      // doc reference re-keyed onto another node) and is dropped when the
      // component that wanted it goes away — the cleanup runs on both. A caller
      // that names no file wants no body, so nothing is held for it: that is
      // the whole of how a preview costs the wire nothing.
      createEffect(() => {
        const path = file()
        if (path === undefined) return
        held(path, 1)
        onCleanup(() => held(path, -1))
      })
      return () => {
        const path = file()
        if (path === undefined) return undefined
        const entry = entries.byKey(path)?.()
        return arrived(entry) ? entry : undefined
      }
    },
  }
}

/** THE READER ITSELF. One context for one question, and the module next door
 *  answers the other one (`../directory.ts`: which files there are, and which
 *  revision each is at). */
const DocumentsContext = createContext<Documents>()

export function DocumentsProvider(props: {
  /** The app's one reader of the documents collection. Handed in rather than
   *  created here for the reason the directory's own reader is: the composition
   *  root owns the members (`../App.tsx`). */
  readonly documents: Documents
  readonly children: JSX.Element
}) {
  return (
    <DocumentsContext.Provider value={props.documents}>
      {props.children}
    </DocumentsContext.Provider>
  )
}

const reader = (): Documents => {
  const documents = useContext(DocumentsContext)
  if (documents === undefined) {
    throw new Error("a document reference outside <DocumentsProvider>")
  }
  return documents
}

/** One served document, by its path — see {@link Documents.read}. A `file()`
 *  of `undefined` asks for nothing, which is what a page whose face draws
 *  without a body passes. */
export const useDocument = (
  file: () => string | undefined,
): Accessor<Served | undefined> => reader().read(file)
