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
 * all at. The numbers themselves are now READ, mind — they are how the fold
 * below tells which files moved (`./deriving.ts`) — but they are read one file
 * at a time, which is what they mean, and never compared across two.
 *
 * Nothing here writes to what the wire hands it — see App.tsx's note on
 * `reconcile` — and nothing here interprets it either: the entries go into
 * `@olai/format`'s own derivation, the same call the validator makes — and
 * since slice 4 of `model-indices` they go into the same PATCH of it, so a
 * keystroke costs the file it touched rather than the directory (`./deriving.ts`
 * holds the fold and says how the delta is worked out).
 */

import type { BrokenFile, Derived, Face } from "@olai/format"
import type { Manifest } from "@olai/surface"
import { type Accessor, createMemo } from "solid-js"

import { type View, viewOf } from "./deriving.ts"
import { sortByPath } from "./paths.ts"
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
   * THE ONE DERIVATION, folded rather than rebuilt.
   *
   * What it READS is a revision per file, which is what makes it cheap and what
   * makes it correct: reading `rev` off each entry is the dependency this memo
   * wants (a file that moved says so in one number), and it is what
   * `./deriving.ts` turns into the delta the format's patcher takes. A memo
   * that read every record instead — the flatten this replaces — woke on the
   * same frames and then paid for the whole corpus to answer for one file.
   *
   * A set that has never loaded has nothing to derive FROM, and the page it
   * gets is the error report rather than an empty tree — so the `undefined`
   * here is the manifest's two absent states and not a third one. Dropping back
   * to it also drops the held view, which is right: what comes after a
   * never-loaded directory is a first frame, and a first frame is a derivation.
   */
  const view = createMemo((held: View | undefined) => {
    const loaded = manifest.value()
    if (loaded === undefined || loaded === null) return undefined
    return viewOf(held, entries.keys(), (file) => entries.byKey(file)?.())
  }, undefined)

  return {
    manifest: manifest.value,
    files,
    faces: createMemo(() =>
      files().flatMap((file) => {
        const face = entries.byKey(file)?.()?.face
        return face === undefined ? [] : [face]
      })
    ),
    broken: createMemo(() => {
      const found = new Map<string, BrokenFile>()
      for (const file of files()) {
        const broken = entries.byKey(file)?.()?.broken
        if (broken !== undefined && broken !== null) found.set(file, broken)
      }
      return found
    }),
    derived: createMemo(() => view()?.derived),
  }
}
