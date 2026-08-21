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
import { type Accessor, createMemo } from "solid-js"

import { facesOf, sortByPath } from "./paths.ts"
import { sameMap } from "./same.ts"

export interface Directory {
  /** The set-wide facts: `undefined` before the first frame, `null` for a
   *  directory that has never loaded, a value otherwise. */
  readonly manifest: Accessor<Manifest | undefined>
  /** Every served file as its FACE, in path order — what each is called, the
   *  addresses it points at, the tags its content writes (`@olai/format`'s
   *  `Face`). It rides on each head rather than being derived here, because
   *  deriving one means reading the file, and the file's content is the thing
   *  this member exists to keep off the wire.
   *
   *  THE PATHS are not a second member beside it: every reader that wants them
   *  takes them off the faces (`./served.tsx` mints that list once, with an
   *  `equals` over the membership), and a list of paths here would be the same
   *  walk done twice per frame. */
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

/**
 * THE TWO THINGS this file asks of the heads collection — which keys there are,
 * and what one of them holds. `App.tsx` hands over the bound member itself
 * (`olai.collections.heads.use()`), which satisfies this structurally.
 *
 * Narrowed at the parameter for the reason every other seam in this client
 * narrows one (`./edit/editing.tsx` takes four verbs of a `Selection` and one
 * of a `Moving`): what a module is handed should be what it reads. What it buys
 * here is a suite — `./directory.browsertest.ts` stands one of these up out of
 * two signals, where the framework's whole collection type would have meant
 * standing up its lifecycle signals and its frame socket as well to ask whether
 * one memo held its value.
 *
 * SPELLED OUT rather than `Pick`ed off that type, because the widening is the
 * point: the framework's `byKey` answers with a `Subscription`, and every one
 * of those IS an accessor — so the real member satisfies this, and a fake need
 * not carry an `error` and a `pending` this file never reads.
 */
export interface HeadEntries {
  readonly keys: () => ReadonlyArray<string>
  readonly byKey: (key: string) => Accessor<Head | undefined> | undefined
}

export const createDirectory = (
  entries: HeadEntries,
  manifest: Accessor<Manifest | undefined>,
): Directory => {
  // NO `equals` ON THE FILE LIST, and that is somebody else's node rather than
  // an oversight: what `faces` and `broken` cost by walking every key per frame
  // is `perf-faces-broken-walk` on the roadmap, measured and filed with its own
  // number. This diff is about what happens BELOW them — a walk that answers the
  // same thing waking every reader of it.
  const files = createMemo(() => sortByPath(entries.keys()))
  return {
    manifest,
    faces: createMemo(() => facesOf(files(), (file) => entries.byKey(file)?.()?.face)),
    /**
     * THE UNREADABLE FILES, HELD BY VALUE — the paths AND what each one is
     * wrong about.
     *
     * A `Map` minted per run is a new value on every head the directory
     * publishes, and what reads it is every `<File>` row of the sidebar asking
     * `broken.has` (`./Sidebar.tsx`) and the pane that draws a bad file's
     * errors. So a rename three folders away re-ran all of them for an answer
     * that is almost always the empty map it already was
     * (docs/brainstorming/reactivity-after-the-flip.md §4.2).
     *
     * The ERRORS are compared as well as the keys, and by IDENTITY — which is
     * `sameMap`'s default, and right here because an entry is replaced exactly
     * when the head carrying it is. Comparing the key sets alone would leave a
     * pane showing the previous parse failure of a file that is still broken
     * for a new reason.
     */
    broken: createMemo(() => {
      const found = new Map<string, BrokenFile>()
      for (const file of files()) {
        const broken = entries.byKey(file)?.()?.broken
        if (broken !== undefined && broken !== null) found.set(file, broken)
      }
      return found
    }, new Map<string, BrokenFile>(), { equals: sameMap }),
    head: (file) => () => entries.byKey(file())?.()?.rev,
  }
}
