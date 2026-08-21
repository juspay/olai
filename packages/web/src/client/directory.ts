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
 * ## A FRAME COSTS THE FRAME
 *
 * `heads` is served with batched `deltas`: what reaches this tab is
 * `{upserts, removes}` — the files that moved, and nothing about the ones that
 * did not — and a write in this vault moves ONE of them. What used to read that
 * frame was a memo that walked the whole key set and asked every file's head
 * what it held, so a thousand-file directory paid a thousand reads to be told
 * about one file, and minted a fresh path list to say that the same thousand
 * files were still there.
 *
 * It is a fold now ({@link SERVED_FILES}, over `@kolu/surface`'s collection
 * `fold` — the same socket `./chat/order.ts` retired the transcript's per-frame
 * sort on, and its header argues this identical case). The shape of the saving
 * is the shape of the frame: a frame naming one file costs that one file, and
 * the two answers it hands back are the very array and the very map it handed
 * back last time unless what they say moved.
 *
 * THE IDENTITY IS THE OTHER HALF, and it is worth as much as the reads.
 * `./served.tsx` holds the path list under a membership compare because a fold
 * of the vault is kept against that very array (`./file/matching.ts`, a
 * `WeakMap`), and every `<File>` row of the sidebar asks the broken map
 * `broken.has` (`./Sidebar.tsx`). A fresh value per frame woke all of them for
 * a frame that said nothing about either question; the same value wakes none of
 * them, and the memos below are where that sameness is CASHED — the framework
 * declares a fold's accessor `equals: false`, since it cannot know whether a
 * consumer's accumulator is a value, so a `===` has to be spent somewhere or
 * the fold buys nothing.
 *
 * WHAT SURVIVES A RECONNECT is the answer's CONTENT and not its identity: a
 * snapshot re-seeds every registered fold, and `init` has no previous
 * accumulator to hand back, so a link flap mints a fresh path list naming the
 * same files. That is exactly the case `./served.tsx`'s `equals` is there for,
 * and it is why that comparison stays where it is rather than following the
 * walk it used to guard.
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
 * AND THE FOLD PUT A FOURTH THING IN ITS CARE. A fold's accumulator has one
 * absent state and it means "there is no valid accumulator" — before the first
 * snapshot, and after an `init`/`step` that threw, which the framework contains
 * and reports loudly and which stands until the next snapshot re-seeds. Read
 * naively that is an EMPTY DIRECTORY, which is a lie a reader cannot catch: a
 * vault with no files in it looks the same. So the manifest absorbs it — while
 * this fold holds nothing, the directory reports `undefined`, "still reading",
 * which is what a tab draws before its first frame anyway and what it should
 * draw again the moment it is holding nothing. `null` OUTRANKS that silence,
 * because a directory that never loaded is a settled answer and no head is
 * coming for it. The two members below then agree with the manifest rather than
 * contradicting it: no set, no paths, nothing broken — nothing is claimed that
 * this tab is not holding.
 *
 * ## Handed its members rather than reaching for them
 *
 * The app has exactly one place where a wire member is reached — `./App.tsx`,
 * the composition root — and a module that opened its own socket at import time
 * could only ever be read by a browser. That is `./outlines.ts`'s own rule,
 * kept.
 */

import type { BrokenFile } from "@olai/format"
import type { Head, Manifest } from "@olai/surface"
import type { CollectionFold, CollectionFoldOptions } from "@kolu/surface/solid"
import { type Accessor, createMemo } from "solid-js"

import { sortByPath } from "./paths.ts"

export interface Directory {
  /** The set-wide facts: `undefined` before the first frame — or while the fold
   *  is holding nothing, which is the same sentence (see the header) — `null`
   *  for a directory that has never loaded, a value otherwise. */
  readonly manifest: Accessor<Manifest | undefined>
  /** Every served file's PATH, in path order — the list every membership
   *  question in the app is asked of, and the one the sidebar's tree is a
   *  function of.
   *
   *  IT USED TO BE THE FACES, and the difference is a walk. A `Face` carries
   *  what a file is called and what it points at as well as where it is
   *  (`@olai/format`), and it rides on each head rather than being derived
   *  here, because deriving one means reading the file and the content is what
   *  this member exists to keep off the wire — all of which is still true and
   *  is now nobody's business but the wire's, because no reader in this client
   *  wanted more than the path. Both of them — `./App.tsx`'s `opensAt` and
   *  `./served.tsx` — took `face.path` off every element and threw the rest
   *  away, one by a `map` per frame and the other by a scan per click.
   *
   *  IT HOLDS STILL NOW, which it never did: the list is the accumulator's own
   *  ({@link SERVED_FILES}), rebuilt on the frames that move a MEMBER and
   *  handed back unchanged on all the rest. `./served.tsx` keeps its membership
   *  compare all the same — a reconnect re-seeds the fold, and a fresh list of
   *  the same files is exactly what that compare is for. */
  readonly paths: Accessor<ReadonlyArray<string>>
  /** The files that did not parse, by path — the sidebar marks them and a pane
   *  opened on one draws its errors instead of a tree.
   *
   *  BY VALUE, and by the same mechanism: the map is minted afresh exactly when
   *  a file's breakage moved, so its identity says "the unreadable files
   *  changed" rather than "a frame arrived", and a rename three folders away
   *  leaves every `<File>` row of the sidebar where it was
   *  (docs/brainstorming/reactivity-after-the-flip.md §4.2). It used to be a
   *  fresh map per frame held still by a `sameMap` afterwards; the fold makes
   *  the comparison unnecessary by never minting the second map. */
  readonly broken: Accessor<ReadonlyMap<string, BrokenFile>>
  /** Which revision one file is at, or `undefined` for a path this directory
   *  does not hold (and for every path before the first frame). It MOVES when
   *  the file does and stays put when it does not, which is the whole of what a
   *  reader watching one file needs — no content, no subscription of its own,
   *  no read of the disk at the other end. */
  readonly head: (file: Accessor<string>) => Accessor<number | undefined>
}

/**
 * THE TWO THINGS this file asks of the heads collection — the FRAMES, and what
 * one key holds. `App.tsx` hands over the bound member itself
 * (`olai.collections.heads.use()`), which satisfies this structurally.
 *
 * Narrowed at the parameter for the reason every other seam in this client
 * narrows one (`./edit/editing.tsx` takes four verbs of a `Selection` and one
 * of a `Moving`): what a module is handed should be what it reads. What it buys
 * here is a suite — `./directory.browsertest.ts` stands one of these up out of
 * a hand-driven frame source, where the framework's whole collection type would
 * have meant standing up its lifecycle signals and its wire socket as well to
 * ask what one frame costs.
 *
 * `keys` IS NOT HERE ANY MORE, and the swap is the change: the ordered key set
 * was what a per-frame walk started from, and a fold is REGISTERED rather than
 * read — it is handed the wire's own `{upserts, removes}` and keeps the order
 * itself. This is the wider seam `perf-faces-broken-walk` said its halving did
 * not stand in the way of.
 *
 * `fold` IS THE FRAMEWORK'S OWN TYPE rather than a narrowing of it, and that is
 * not a slip. The other verb here is spelled out because the widening is the
 * point — the framework's `byKey` answers with a `Subscription`, and every one
 * of those IS an accessor, so the real member satisfies this and a fake need
 * not carry an `error` and a `pending` this file never reads. A `fold` has no
 * such fat to trim: it is one generic function, and the registration contract
 * (seeded from the store, invalidated on a throw) is the very thing a fake has
 * to honour to be worth testing against.
 */
export interface HeadEntries {
  readonly byKey: (key: string) => Accessor<Head | undefined> | undefined
  readonly fold: CollectionFold<string, Head>
}

/**
 * The accumulator: both readings of the head set, and the membership they are
 * both taken from.
 *
 * `paths` and `broken` are what LEAVE — the values the two members above hand
 * out — so they are REBUILT rather than written into, and a frame that moves
 * neither hands back the pair it was already holding. `members` is this fold's
 * own working memory and is MUTATED in place: it is reachable from nowhere else
 * (the framework hands the accumulator back to `step` and to nobody), and
 * copying a set of the whole directory per frame would be the corpus-wide walk
 * this fold exists to retire, reintroduced one line down from where it was
 * removed.
 *
 * THE THREE ARE ONE VALUE and not three, because they move by one rule: what a
 * frame named. Split into three folds they would be three registrations walking
 * the same frame, which is `perf-faces-broken-walk`'s two-memo shape with a
 * wider seam under it.
 */
export interface Held {
  readonly paths: ReadonlyArray<string>
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly members: Set<string>
}

/**
 * The fold: seed from a full-set frame, and step one delta.
 *
 * A MODULE CONSTANT rather than a function called per directory, because it
 * holds nothing — the accumulator is the framework's to keep, one per
 * registration — which is `./chat/order.ts`'s reasoning and reaches further
 * here: a fold declared at module scope cannot close over a socket, so the
 * "handed its members rather than reaching for them" rule in the header is a
 * fact about this file's shape rather than a habit.
 *
 * THE ORDER IS REBUILT ONLY WHEN MEMBERSHIP MOVED, and that distinction is the
 * whole point: a frame rewriting three files this fold already holds changes
 * nothing about which files there are, so the answer is the list that was
 * already right. When it does move, the list is rebuilt whole and sorted —
 * O(files) on the frames that ADD or DROP one, where the shape it replaced was
 * O(files·log files) on every frame there is. A cheaper insertion would still
 * have to copy the array (the one it holds is on screen), so what it would save
 * is the `log` on the rare frame rather than the walk on the common one.
 *
 * THE BREAKAGE IS COPIED ON THE FIRST WRITE, for the same reason from the other
 * side: the map this fold is holding is the one the sidebar is drawn from, so
 * it must never be mutated in place — but a frame that breaks nothing (which is
 * nearly every frame) must not pay for a copy either. So the copy is taken by
 * the first edit of a frame and not before, and the frames that make none hand
 * the held map straight back.
 *
 * TOTAL OVER A REMOVE IT HAS NEVER SEEN, which the socket requires: the
 * server's tick coalescer resolves an upsert-then-remove inside one producer
 * tick to a bare remove, so a file born and dead within one tick arrives as a
 * remove that was never preceded by an upsert. `Set.delete` answers `false` for
 * it and nothing is rebuilt.
 *
 * THE ARMS ARE TAKEN IN THE STORE'S ORDER — upserts, then removes. That
 * coalescer makes them disjoint, so the order is free; taking it from the
 * framework's own `applyDelta` means that if a frame ever did name one key
 * twice, this fold and `byKey` would resolve it the same way rather than
 * disagreeing about which files there are.
 */
export const SERVED_FILES: CollectionFoldOptions<string, Head, Held> = {
  init: (entries) => {
    const members = new Set<string>()
    const broken = new Map<string, BrokenFile>()
    for (const [file, head] of entries) {
      members.add(file)
      if (head.broken !== null) broken.set(file, head.broken)
    }
    return { paths: sortByPath(members), broken, members }
  },
  step: (held, { upserts, removes }) => {
    let moved = false
    let edited: Map<string, BrokenFile> | null = null
    /** The map to WRITE into: the held one copied, once, by the first break of
     *  this frame that actually moves. */
    const editing = () => (edited ??= new Map(held.broken))
    /** What this frame has left standing about one file so far — the copy once
     *  there is one, the held map until then. */
    const breakage = (file: string) => (edited ?? held.broken).get(file)
    for (const [file, head] of upserts) {
      if (!held.members.has(file)) {
        held.members.add(file)
        moved = true
      }
      const was = breakage(file)
      // COMPARED BY IDENTITY, and that is what makes "still broken, for a new
      // reason" a new answer: a head's `broken` is replaced exactly when the
      // frame carrying it is, so a pane drawing the errors cannot be left
      // showing the previous parse failure of a file that still does not parse.
      if (head.broken === null) {
        if (was !== undefined) editing().delete(file)
      } else if (was !== head.broken) editing().set(file, head.broken)
    }
    for (const file of removes) {
      if (held.members.delete(file)) moved = true
      if (breakage(file) !== undefined) editing().delete(file)
    }
    if (!moved && edited === null) return held
    return {
      paths: moved ? sortByPath(held.members) : held.paths,
      broken: edited ?? held.broken,
      members: held.members,
    }
  },
}

/** The empty directory, minted once each: what every reading answers with while
 *  the fold holds no accumulator, so a memo below settles rather than reporting
 *  a new empty answer per frame. The manifest is what says WHY it is empty
 *  (the header's three states). */
const NO_PATHS: ReadonlyArray<string> = []
const NO_BROKEN: ReadonlyMap<string, BrokenFile> = new Map()

export const createDirectory = (
  entries: HeadEntries,
  manifest: Accessor<Manifest | undefined>,
): Directory => {
  // THE HEAD SET, FOLDED — the wire's own frames accumulated into the two
  // readings this app asks a directory for, instead of the whole set being
  // re-read per frame. MUST be registered under a reactive owner, which is the
  // fold's own requirement: `./App.tsx` calls this inside the app's root, and
  // the registration is dropped by that owner's `onCleanup`.
  const held = entries.fold(SERVED_FILES)
  return {
    manifest: createMemo(() => {
      const said = manifest()
      // `null` OUTRANKS the fold's silence — see the header's fourth state.
      return said === null || held() !== undefined ? said : undefined
    }),
    paths: createMemo(() => held()?.paths ?? NO_PATHS),
    broken: createMemo(() => held()?.broken ?? NO_BROKEN),
    // NOT IN THE FOLD, and that is the line: the fold accumulates the SET, and
    // this asks one key what revision it is at. A reader watching one file must
    // not be woken by a write three folders away, which is exactly what joining
    // it to a reading of the whole directory would do.
    head: (file) => () => entries.byKey(file())?.()?.rev,
  }
}
