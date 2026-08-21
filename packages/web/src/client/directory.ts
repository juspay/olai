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

import { sortByPath } from "./paths.ts"
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

/** BOTH READINGS OF THE HEAD SET, as one pass produces them — see
 *  {@link walkOf}. Not a member of anything: it is what the walk returns, and
 *  the two accessors below are how a reader asks for one half of it. */
interface Walk {
  readonly faces: ReadonlyArray<Face>
  readonly broken: ReadonlyMap<string, BrokenFile>
}

/**
 * ONE WALK OVER THE KEY SET, answering both questions this file is asked of it
 * — `perf-faces-broken-walk`, closed.
 *
 * `faces` and `broken` are two readings of the SAME LEAF: each wants one field
 * of each head, over the same keys, in the same order. Written as two memos
 * they walked the directory twice per frame — and never usefully, because the
 * only thing either depends on is the head set, so they go stale together and
 * the second walk could never learn anything the first had not already read. A
 * thousand files was two thousand reads for a thousand files' worth of answer.
 *
 * A key with no entry yet is skipped by BOTH, which is what the old pair did
 * (a face was dropped when `byKey` had nothing to give, and a head that is not
 * there is a head with nothing wrong with it). That absence is real and
 * ordinary: it is the frame between a key set arriving and the entries filling
 * it.
 *
 * `head` IS NOT IN HERE, and that is the line: this walks the SET, and `head`
 * asks one key what revision it is at. A reader watching one file must not be
 * woken by a write three folders away, which is exactly what joining it to a
 * reading of the whole directory would do.
 *
 * NO `equals` HERE, and it does not want one. This is the walk, not an answer:
 * `faces` is a fresh array per frame and always was, and its readers compare
 * for themselves where they care (`./served.tsx` holds the paths with a
 * membership compare). `broken` is the one that has to hold still, and it does
 * so in its own memo below, over the map this minted.
 */
const walkOf = (entries: HeadEntries): Walk => {
  const faces: Face[] = []
  const broken = new Map<string, BrokenFile>()
  for (const file of sortByPath(entries.keys())) {
    const head = entries.byKey(file)?.()
    if (head === undefined) continue
    faces.push(head.face)
    if (head.broken !== null) broken.set(file, head.broken)
  }
  return { faces, broken }
}

export const createDirectory = (
  entries: HeadEntries,
  manifest: Accessor<Manifest | undefined>,
): Directory => {
  const walk = createMemo(() => walkOf(entries))
  return {
    manifest,
    // A PLAIN READING of the walk rather than a memo of its own: the walk is
    // already the held value, and a second node over it would hold the same
    // array under a second identity that moves at exactly the same times.
    faces: () => walk().faces,
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
     * THIS MEMO IS THE COMPARISON and nothing else now — the map itself is the
     * walk's, so what re-runs per frame here is one field read and one
     * `sameMap`, which is the size of the answer rather than the size of the
     * directory.
     *
     * The ERRORS are compared as well as the keys, and by IDENTITY — which is
     * `sameMap`'s default, and right here because an entry is replaced exactly
     * when the head carrying it is. Comparing the key sets alone would leave a
     * pane showing the previous parse failure of a file that is still broken
     * for a new reason.
     */
    broken: createMemo(() => walk().broken, new Map<string, BrokenFile>(), {
      equals: sameMap,
    }),
    head: (file) => () => entries.byKey(file())?.()?.rev,
  }
}
