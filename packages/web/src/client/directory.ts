/**
 * THE SERVED DIRECTORY, as this tab holds it — and it is now the whole of what
 * a tab holds of the vault.
 *
 * ONE subscription: the `heads` COLLECTION, keyed by root-relative path, one
 * entry per SERVED FILE carrying its revision, its face and whether it could be
 * read (`@olai/surface`'s `Head`). No records, no bodies, no derivation — the
 * key set plus a title and a suffix each, which is what the sidebar's tree
 * draws and what every membership question in the app is asked of.
 *
 * ## What this replaced, and why
 *
 * `./outlines.ts`, which subscribed to every outline FILE's records and folded
 * them — with the same `derive`/`patch` the server runs — into a second copy of
 * the whole vault. Every page was then a pure function over that copy. The
 * human's ruling of 2026-08-19 reversed it: **the browser may hold at most the
 * current page's data in memory — never the whole vault**
 * (`docs/brainstorming/vault-in-browser.md`). So the fold is gone, the
 * derivation is not in the browser bundle at all, and what is left of "the
 * directory" is this: a list of files. Each PAGE is a reading of its own
 * (`./reading.tsx`).
 *
 * THE FILE LIST DID NOT SHRINK, and that is deliberate rather than an
 * inconsistency with the ruling. §3's Sidebar row says so: paths and faces are
 * KEY-SET-SIZED — a path and a title per file — where the records they used to
 * arrive with are the corpus. A directory of a thousand files costs a thousand
 * short strings here and did cost every node of every one of them.
 *
 * ## The three states, which is why the manifest is here too
 *
 * A reader must tell apart `undefined` — "no frame yet", the page is still
 * reading — from `null`, "there has never been a valid set", where the error
 * report IS the page, from a value, which is a directory. An empty collection
 * cannot carry that distinction: a directory with no files in it is a real
 * answer and looks exactly like a first probe that has not finished. The
 * manifest cell is what says which, and it is handed in beside the entries so
 * that the one place the two are read together is the one place that answers.
 *
 * ## Handed its members rather than reaching for them
 *
 * The app has exactly one place where a wire member is reached — `./App.tsx`,
 * the composition root — and a module that opened its own socket at import time
 * could only ever be read by a browser. That is `./outlines.ts`'s own rule,
 * kept.
 */

import type { BrokenFile, Face } from "@olai/format"
import type { Head, Manifest } from "@olai/surface"
import type { ReadOnlyBoundDeltasCollectionResult } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

import { facesOf, sortByPath } from "./paths.ts"

export interface Directory {
  /** The set-wide facts: `undefined` before the first frame, `null` for a
   *  directory that has never loaded, a value otherwise. */
  readonly manifest: Accessor<Manifest | undefined>
  /** Every served file, in path order. */
  readonly files: Accessor<ReadonlyArray<string>>
  /** The same files as their FACES — what each is called, the addresses it
   *  points at, the tags its content writes (`@olai/format`'s `Face`). It rides
   *  on each head rather than being derived here, because deriving one means
   *  reading the file, and the file's content is the thing this member exists
   *  to keep off the wire. */
  readonly faces: Accessor<ReadonlyArray<Face>>
  /** The files that did not parse, by path — the sidebar marks them and a pane
   *  opened on one draws its errors instead of a tree. */
  readonly broken: Accessor<ReadonlyMap<string, BrokenFile>>
  /** Which revision one file is at, or `undefined` for a path this directory
   *  does not hold (and for every path before the first frame). It MOVES when
   *  the file does and stays put when it does not, which is the whole of what a
   *  reader watching one file needs — no content, no subscription of its own,
   *  no read of the disk at the other end. */
  readonly head: (file: Accessor<string>) => Accessor<number | undefined>
}

/** The heads collection as this composition asks for it: the keys, one entry
 *  per key, and the frame socket — the framework's own name for that shape, so
 *  a caller may hand this either the bound member or a raw hook and there is no
 *  second spelling of somebody else's contract to keep in step. */
export type Heads = ReadOnlyBoundDeltasCollectionResult<string, Head>

export const createDirectory = (
  entries: Heads,
  manifest: Accessor<Manifest | undefined>,
): Directory => {
  const files = createMemo(() => sortByPath(entries.keys()))
  return {
    manifest,
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
    head: (file) => () => entries.byKey(file())?.()?.rev,
  }
}
