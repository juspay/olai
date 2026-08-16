/**
 * The documents of the set: the paths, and one body at a time.
 *
 * ONE module owns `olai.collections.documents`, and that is the point of it
 * being one. The collection is served `keys` + `get` with no `deltas`
 * (`@olai/surface`), so a plain `.use()` — which opens the key stream AND a
 * value stream per key — would pull every `.md` body in the directory onto the
 * first paint, which is the defect `snapshot-scale` removed. That rule is
 * enforceable only where the member is reached, so the member is reached here
 * and nowhere else:
 *
 *   - {@link Documents.paths} is the KEY SET, driven on its own through
 *     `rawStream`. That is the framework's composition for this shape — its
 *     `unenrolledKeys` docs describe feeding the raw list back into a narrowed
 *     `.use({ keys })`, which is exactly what happens below — and `rawStream`
 *     rather than a bare `unenrolledStreamCall` so the stream is still in
 *     `client.health()`: a key stream that died would otherwise read as a
 *     directory with no documents in it. Being in the fact is half of it and
 *     was for a while the whole of it — nothing in the client READ the fact,
 *     so the enrolment bought a dead stream that was findable and still not
 *     reported. The connection readout folds it now, upstream and unskippably
 *     (`connectSurface`, juspay/kolu#2160), which is what turns this line into
 *     the guarantee it always claimed: this stream stopping is a pill that
 *     says `partly live` and names `documents.keys`.
 *   - {@link Documents.read} is the BODY of one document, from a narrowed
 *     subscription whose keys are the documents somebody is showing. A body
 *     reaches this tab when a component asks for it and stops arriving when
 *     the last one that asked goes away.
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
 * if a preview for many nodes at once is needed, the answer is a small head
 * member on the wire — measured first, not guessed at here.
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
   *  which is what the collection is keyed by (`@olai/surface`) — by path.
   *  ARRIVAL order, deliberately:
   *  the sidebar's tree sorts each of its own levels (`../fileTree.ts`) and the
   *  page model only asks whether a path is in here, so an order imposed on a
   *  corpus-sized list every time one file arrives would be work nobody reads. */
  readonly paths: Accessor<ReadonlyArray<string>>
  /** One document's body, for as long as the calling owner lives. `undefined`
   *  while it is still on the way — the normal first state, and the one a body
   *  being read from disk shares with it ({@link Served}) — and also what a
   *  set being edited answers for a `doc` naming a file that is no longer
   *  there (a valid set cannot produce that: `doc` is validated against the
   *  documents found). */
  readonly read: (file: Accessor<string>) => Accessor<Served | undefined>
}

/** Whether an entry is one a page can draw — see {@link Served}. */
const arrived = (entry: DocumentEntry | undefined): entry is Served =>
  entry !== undefined && entry.text !== null

export const createDocuments = (): Documents => {
  const [paths, setPaths] = createSignal<ReadonlyArray<string>>([])
  // No `onRetry`: every frame is the whole key set, so a reconnect replaces
  // this list wholesale, and clearing it in the gap would empty the sidebar's
  // documents for as long as the socket takes to come back.
  olai.rawStream(
    "documents.keys",
    olai.collections.documents.unenrolledKeys,
    undefined,
    { onItem: setPaths },
  )

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
    read: (file) => {
      // An EFFECT, so the interest follows a component whose `file` moves (a
      // doc reference re-keyed onto another node) and is dropped when the
      // component that wanted it goes away — the cleanup runs on both.
      createEffect(() => {
        const path = file()
        held(path, 1)
        onCleanup(() => held(path, -1))
      })
      return () => {
        const entry = entries.byKey(file())?.()
        return arrived(entry) ? entry : undefined
      }
    },
  }
}

const DocumentsContext = createContext<Documents["read"]>()

export function DocumentsProvider(props: {
  /** The app's one reader of the documents collection. Handed in rather than
   *  created here for the reason `DerivedProvider`'s value is: the sidebar and
   *  the page model need the PATHS above this provider, and one module owning
   *  the member is the whole arrangement (see the note at the top). */
  readonly documents: Documents
  readonly children: JSX.Element
}) {
  return (
    <DocumentsContext.Provider value={props.documents.read}>
      {props.children}
    </DocumentsContext.Provider>
  )
}

/** One served document, by its path — see {@link Documents.read}. */
export const useDocument = (
  file: () => string,
): Accessor<Served | undefined> => {
  const read = useContext(DocumentsContext)
  if (read === undefined) {
    throw new Error("a document reference outside <DocumentsProvider>")
  }
  return read(file)
}
