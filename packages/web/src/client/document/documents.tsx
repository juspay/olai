/**
 * The documents of the set: the paths, the revision each of them is at, and one
 * body at a time.
 *
 * ONE module owns `olai.collections.documents` AND the `heads` beside it, and
 * that is the point of it being one. `documents` is served `keys` + `get` with
 * no `deltas` (`@olai/surface`), so a plain `.use()` — which opens the key
 * stream AND a value stream per key — would pull every `.md` body in the
 * directory onto the first paint, which is the defect `snapshot-scale`
 * removed. That rule is enforceable only where the member is reached, so the
 * members are reached here and nowhere else:
 *
 *   - {@link Documents.paths} and {@link Documents.head} are ONE subscription
 *     on `heads`, the member that is every bodied file's key with the body left
 *     off. It is cheap enough per entry to carry `deltas`, so a plain `.use()`
 *     opens the single coalesced snapshot-then-delta stream and every file's
 *     path and revision arrive on it — and being a `.use()` rather than a raw
 *     reach means it is in `client.health()` for free, so this stream stopping
 *     is a pill that says `partly live` and names it.
 *
 *     It replaced a `rawStream` on `documents.keys`, which carried the same
 *     paths and no revisions. Both at once would have been the same list twice
 *     on every first paint; a revision per path is the same list plus an
 *     integer each, and it is what lets a page watch ONE file for changes
 *     without opening a stream — or asking for a body — of its own.
 *
 *     WHAT THE BATCHED VERB COST, and no longer does — kept as a paragraph
 *     rather than deleted, because the trade was named here when it was real
 *     and a reader deserves to be told which way it went. It WAS this: a
 *     `deltas` frame was folded into a keyed store by copying the whole dict
 *     and reconciling the copy, so a revision that touched any bodied file cost
 *     every open tab one pass over the directory's paths — where the key stream
 *     this replaced only ever fired on a file appearing or going. The framework
 *     now writes the keys the frame NAMES, one leaf replacement per upsert
 *     (kolu #2187), so the pass over the paths is gone and a head arrives for
 *     the cost of the head. NOT ONE LINE HERE CHANGED for that: the same
 *     `.use()`, the same `{keys, byKey}`, the same enrolment — which is the
 *     whole argument for the tax having been the client library's to fix rather
 *     than this module's to work around. What is left is the honest floor: the
 *     alternative shape — a per-key stream for each file being watched — buys
 *     nothing over it now and still costs a second subscription per open
 *     document and a file list from somewhere else.
 *   - {@link Documents.read} is the BODY of one document, from a narrowed
 *     subscription whose keys are the documents somebody is showing. A body
 *     reaches this tab when a component asks for it and stops arriving when
 *     the last one that asked goes away.
 *
 * THE TWO ARE ASKED SEPARATELY ON PURPOSE, and a `.html` is why. A preview
 * frame fetches the file over HTTP from `/media/` (`./Hypertext.tsx`), so
 * nothing on that page is drawn out of the body — what it needs from this
 * module is the revision, so that a file rewritten on disk re-points the frame.
 * Reading the body to learn that sent a saved page's megabytes to a tab that
 * drew none of them, and made the server read the file to send them; asking the
 * head instead costs a number. That was PR #206's standing deferral and this is
 * the shape it named.
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

import type { Face } from "@olai/format"
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

import { facesOf } from "../paths.ts"
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
  /** Every BODIED file the directory holds — every `.md` and every `.html`,
   *  which is what both collections are keyed by (`@olai/surface`) — by path.
   *  ARRIVAL order, deliberately:
   *  the sidebar's tree sorts each of its own levels (`../fileTree.ts`) and the
   *  page model only asks whether a path is in here, so an order imposed on a
   *  corpus-sized list every time one file arrives would be work nobody reads. */
  readonly paths: Accessor<ReadonlyArray<string>>
  /** The same files as their FACES — what each is called, the addresses it
   *  points at, the tags its prose writes (`@olai/format`'s `Face`).
   *
   *  ON THE HEADS, which is the member that carries a file's key without its
   *  body, and it is the only way a tab can have this at all: a body is
   *  fetched by whoever is showing one, so a browser holding only the key set
   *  knew a document's PATH and nothing else about it. In arrival order, like
   *  {@link Documents.paths} and for the same reason. */
  readonly faces: Accessor<ReadonlyArray<Face>>
  /** Which revision of the directory one file is at, or `undefined` for a path
   *  this directory does not hold (and for every path before the first frame).
   *  It MOVES when the file does and stays put when it does not, which is the
   *  whole of what a reader watching one file needs — no body, no subscription
   *  of its own, no read of the disk at the other end. */
  readonly head: (file: Accessor<string>) => Accessor<number | undefined>
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
  // THE HEADS, whole: one batched stream carrying every bodied file's path and
  // the revision it is at. A reconnect opens with a fresh snapshot — the
  // framework's own contract for this verb — so there is nothing to resume and
  // nothing to clear in the gap.
  const heads = olai.collections.heads.use()
  // The framework's own memo over the key set, handed on rather than wrapped: a
  // memo around it could dedup nothing its own could not, and this is a module
  // about not paying for a thing twice.
  const paths = heads.keys

  /** Who wants what: a path is wanted while at least one owner is showing it.
   *  ONE value, so membership cannot disagree with the count that decides it —
   *  a path stuck in the key set is a stream that never closes, and one missing
   *  from it is a body that never arrives for a row still on screen. */
  const [askers, setAskers] = createSignal<ReadonlyMap<string, number>>(new Map())
  const wanted = createMemo(() => [...askers().keys()])
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
    paths,
    faces: createMemo(() => facesOf(paths(), (path) => heads.byKey(path)?.()?.face)),
    head: (file) => () => heads.byKey(file())?.()?.rev,
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

/** THE READER ITSELF, not one of its two questions. A context per question
 *  would be two providers to keep in step for one value that already answers
 *  both, and a page asks both of them about the same file. */
const DocumentsContext = createContext<Documents>()

export function DocumentsProvider(props: {
  /** The app's one reader of the documents collection. Handed in rather than
   *  created here for the reason `DerivedProvider`'s value is: the sidebar and
   *  the page model need the PATHS above this provider, and one module owning
   *  the member is the whole arrangement (see the note at the top). */
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

/** Which revision one served file is at — see {@link Documents.head}. The
 *  question a reader asks when what it needs to know is that the file MOVED. */
export const useHead = (
  file: () => string,
): Accessor<number | undefined> => reader().head(file)
