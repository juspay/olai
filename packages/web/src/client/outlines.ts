/**
 * The outlines of the served directory, as this tab sees it.
 *
 * TWO subscriptions: a COLLECTION of outlines keyed by root-relative path, and
 * a `manifest` CELL for whether there is a set at all. The collection is served
 * with batched `deltas`, so a probe tick that touched one file sends that
 * file's entry and not the corpus — and the key is the protocol's (`keySchema`)
 * rather than a client library's default, which is the whole point of the
 * re-modelling (`docs/brainstorming/outlines-as-collection.md`).
 *
 * The DOCUMENTS are not here, and their being elsewhere is a decision rather
 * than a filing accident: they are served the opposite way — a key set for
 * everyone and a body for whoever opens one — and the module that owns that
 * member is the module that can hold the rule
 * (`./document/documents.tsx`). What that replaced was the manifest carrying
 * every document's full text in the first frame: ~124 KB of a ~212 KB snapshot
 * for this project's own `docs/`, and O(corpus) for a directory of thousands.
 *
 * THREE states a reader must tell apart, and the manifest is what says which:
 * `undefined` is "no frame yet" (the page is still reading), `null` is "there
 * has never been a valid set" (the error report IS the page), and a value is a
 * directory. An empty collection cannot carry that distinction — a directory
 * with no outlines in it is a real answer, and it looks exactly like a first
 * probe that has not finished.
 *
 * Two frames of one revision may arrive a beat apart, and nothing here pretends
 * otherwise: entries are upserted per changed file, so an unchanged neighbour
 * keeps the `rev` it was last published at. What that costs a reader is spelled
 * out in the design doc's cross-file consistency paragraph; what it costs THIS
 * module is nothing, because everything below is derived from whatever the
 * entries currently say rather than from a claim about which revision they are
 * all at. The numbers are not read here at all any more: what moved is what the
 * FRAME says moved.
 *
 * Nothing here writes to what the wire hands it — see App.tsx's note on
 * `reconcile` — and nothing here interprets it either: the entries go into
 * `@olai/format`'s own derivation, the same call the validator makes — and
 * since slice 4 of `model-indices` they go into the same PATCH of it, so a
 * keystroke costs the file it touched rather than the directory.
 *
 * WHAT MOVED IS NO LONGER WORKED OUT HERE, and that is this module's whole
 * share of the two vaults that landed upstream. `@kolu/surface`'s collection
 * `fold` hands a consumer the wire's own `{upserts, removes}` frame, and the
 * patcher takes that frame as it stands — its `SetDelta` IS that frame's shape
 * and its docstring says so. What stood between the two until now was a
 * reconstruction (a view keyed by each entry's `rev`, a file whose number moved
 * read back as an upsert): the client library folded the frames into a keyed
 * store and handed a reader `{keys, byKey}`, so the frame itself reached
 * nobody. It reaches this module now, and the reconstruction is deleted (kolu
 * #2187).
 */

import { type BrokenFile, derive, type Derived, type Face, patch } from "@olai/format"
import type { Manifest } from "@olai/surface"
import { type Accessor, createMemo } from "solid-js"

import { facesOf, sortByPath } from "./paths.ts"
import { olai } from "./wire.ts"

export interface Outlines {
  /** The set-wide facts: `undefined` before the first frame, `null` for a
   *  directory that has never loaded, a value otherwise. */
  readonly manifest: Accessor<Manifest | undefined>
  /** Every outline file, in path order. */
  readonly files: Accessor<ReadonlyArray<string>>
  /** Every outline as its FACE, in path order — what the file is called, the
   *  addresses its records point at, the tags they write
   *  (`@olai/format`'s `Face`). It rides on each entry rather than being
   *  derived here, because deriving it is a walk of every title and every note
   *  of the corpus and the server did it once when the bytes changed. */
  readonly faces: Accessor<ReadonlyArray<Face>>
  /** The files that did not parse, by path — the sidebar marks them and the
   *  main pane draws one of them instead of a tree. */
  readonly broken: Accessor<ReadonlyMap<string, BrokenFile>>
  /** One derivation of the whole set, patched frame by frame with the format's
   *  own patcher — the same value the validator judges a write against, and
   *  reached the same way. `undefined` until there is a set to derive. */
  readonly derived: Accessor<Derived | undefined>
}

export const createOutlines = (): Outlines => {
  const entries = olai.collections.outlines.use()
  const manifest = olai.cells.manifest.use()

  const files = createMemo(() => sortByPath(entries.keys()))

  /**
   * THE ONE DERIVATION, folded rather than rebuilt — over the wire's own frames.
   *
   * TWO ARMS and nothing else, because the frame is the unit of update and the
   * patcher already takes one. A full-set frame — the wire's first, every
   * reconnect snapshot, and the synthetic one a late fold is seeded with — has
   * nothing standing to patch onto, so the patcher declines it and rebuilds;
   * going through `patch` anyway is what keeps that arm honest, since WHERE a
   * file's records land in the flat list is `assemble`'s rule and a browser
   * that spelled it again here would be a second answer about what corpus this
   * is. Every frame after it is the held view patched with what the frame
   * named, which is the whole of what a keystroke costs this tab.
   *
   * THE STEP IS THE PATCHER, passed as itself rather than called through a
   * lambda that re-spells the frame. That is not brevity: a `step` written as
   * `(held, { upserts, removes }) => patch(held, { upserts, removes })` would
   * be this module claiming to translate between two shapes, and there is no
   * translation — `SetDelta` IS the collection-delta frame, which is what
   * `patch`'s own docstring says it takes. If the two ever part, this line stops
   * compiling, which is the right place for that to be noticed.
   *
   * A REMOVE OF A KEY THIS FOLD NEVER SAW is a no-op in the patcher
   * (`byFile.delete` on an absent file), which is exactly what the socket asks
   * of a `step`: the server's tick coalescer resolves an upsert-then-remove
   * inside one producer tick to a bare remove, so a remove that was never
   * preceded by an upsert is a real frame rather than a hypothetical one. It
   * costs one wasted wake — such a file lands in `touched`, so a frame carrying
   * only it answers with a fresh `Derived` identity — and nothing else.
   */
  const view = entries.fold({
    init: (all) => patch(EMPTY, { upserts: all, removes: [] }),
    step: patch,
  })

  /**
   * WHAT IS LEFT WALKING THE DIRECTORY, named now that the two O(N) passes
   * above it are gone and this is what a frame's cost is made of.
   *
   * `faces` and `broken` each read one field off EVERY key and rebuild their
   * whole answer, so a frame that moved one file still costs a pass over the
   * file list in each. That was true before this change and is unchanged by it
   * — what changed is the company it keeps: the framework no longer copies the
   * dict and reconciles the copy, and the derivation no longer rebuilds, so
   * these two are now the only per-frame walks in this module.
   *
   * They are cheap walks — a `Face` object and a `broken` field per file,
   * never a record — and they are NOT folded here, deliberately: a second and
   * third accumulator over the same frames would be three things to keep in
   * step with one wire, where the socket's own argument is that a consumer
   * should hold ONE. If a directory large enough to feel this turns up, the
   * honest first move is to measure a frame end to end in a browser — which
   * nothing in this tree does any more, and which is this PR's own standing
   * deferral rather than a claim that it would not matter.
   */
  return {
    manifest: manifest.value,
    files,
    faces: createMemo(() => facesOf(files(), (file) => entries.byKey(file)?.()?.face)),
    broken: createMemo(() => {
      const found = new Map<string, BrokenFile>()
      for (const file of files()) {
        const broken = entries.byKey(file)?.()?.broken
        if (broken !== undefined && broken !== null) found.set(file, broken)
      }
      return found
    }),
    /**
     * The gate, and now the only thing between the fold and a reader: a set that
     * has NEVER loaded has nothing to show derived, and the page it gets is the
     * error report rather than an empty tree. So the `undefined` here is the
     * manifest's two absent states and the fold's own — no snapshot yet, or a
     * throw the framework contained, reported and will re-seed on the next one
     * — and not a state this module invented.
     *
     * IT GATES AND NO LONGER RESETS, which is the one behaviour this module
     * traded away and is worth saying rather than discovering. The memo it
     * replaces held the view itself, so a manifest falling back to `null` threw
     * the view away and the next frame was rebuilt from scratch. The
     * accumulator is the fold's now, and what re-initialises it is the WIRE's
     * own snapshot boundary — first connect, and every reconnect. That is the
     * more honest of the two: the collection and the cell are separate members,
     * a directory that goes never-loaded empties the collection through frames
     * this fold applies, and a view rebuilt because a NEIGHBOURING cell went
     * absent was always a coincidence of where the state was kept.
     */
    derived: createMemo(() => {
      const loaded = manifest.value()
      if (loaded === undefined || loaded === null) return undefined
      return view()
    }),
  }
}

/** The view of a directory with nothing in it — what a full-set frame is patched
 *  onto, so the first frame and a reconnect are one arm rather than two. Minted
 *  once: it holds no records, so every snapshot of every tab can be handed the
 *  same one. */
const EMPTY: Derived = derive([])
