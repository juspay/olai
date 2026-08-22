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
 * A reader must tell apart "no frame yet", the page is still reading, from
 * "there has never been a valid set", where the error report IS the page, from
 * a directory. An empty collection cannot carry that distinction: a directory
 * with no files in it is a real answer and looks exactly like a first probe
 * that has not finished. The manifest cell is what says which, and it is handed
 * in beside the entries so that the one place the two are read together is the
 * one place that answers.
 *
 * THAT SENTENCE IS THE WHOLE CONTRACT, and {@link Standing} is what makes it
 * unavoidable: what leaves this module is the ANSWER — `reading`, `never`,
 * `loaded` — and not the wire's `Manifest`, so no reader downstream can ask the
 * question a second time and get a different answer out of a cell whose word
 * may be the older of the two things this tab is holding. The one place the two
 * sources meet is {@link createDirectory}'s memo. Before `manifest-fold-skew`
 * the member handed out the cell's own three-valued shape and the shell asked
 * again — and in one of the two arrival orders, what it got back was wrong.
 *
 * BECAUSE THE TWO ARRIVE IN EITHER ORDER. They are two members on two channels,
 * and the server says exactly that rather than promising an order it cannot
 * keep (`@olai/server`'s `runtime.ts`, where a revision is published: the
 * manifest is written last and reaches a socket first, and "a reader tolerates
 * the skew either way"). So this module tolerates BOTH, and the rule is one
 * sentence in each direction:
 *
 *   - A TAB HOLDING FILES IS HOLDING A DIRECTORY. Heads are only ever published
 *     out of a revision, and a store with no snapshot publishes none — so a
 *     non-empty fold is proof that a set loaded, and it OUTRANKS a `null` the
 *     cell has not caught up on. That is the skew this used to draw wrong: a
 *     tab that connected before the first revision has been told `null`, and
 *     that revision's heads can reach it before the cell's next frame does. The
 *     error report drew over live paths, and every one of them was already
 *     here.
 *   - A DIRECTORY THAT NEVER LOADED SAYS SO, and does not wait for a frame that
 *     is not coming — while, and only while, this tab is holding no file. A
 *     tab holding a directory served by a process that has since restarted and
 *     failed to load keeps drawing it for exactly as long as it holds it: the
 *     re-seed that empties this fold is the frame the error report arrives on,
 *     which is one frame later than the cell and is the right one, because
 *     until then the paths on screen are answers this tab actually has.
 *
 * AND THE FOLD PUT A FOURTH THING IN ITS CARE. A fold's accumulator has one
 * absent state and it means "there is no valid accumulator" — before the first
 * snapshot, and after an `init`/`step` that threw, which the framework contains
 * and reports loudly and which stands until the next snapshot re-seeds. Read
 * naively that is an EMPTY DIRECTORY, which is a lie a reader cannot catch: a
 * vault with no files in it looks the same. So this answer absorbs it — while
 * the fold holds nothing, the directory reads `reading`, which is what a tab
 * draws before its first frame anyway and what it should draw again the moment
 * it is holding nothing. `never` OUTRANKS that silence, because a directory
 * that never loaded is a settled answer and no head is coming for it. The two
 * members below then agree with it rather than contradicting it: no set, no
 * paths, nothing broken — nothing is claimed that this tab is not holding, and
 * the one member that says WHICH of the states it is in is the one the shell is
 * already gated on (`./App.tsx`'s `loaded`).
 *
 * `./chat/order.ts` READS THE SAME ABSENT STATE AS AN EMPTY CONVERSATION, and
 * the two are not in conflict. A transcript with no rows is what a panel drew
 * before its first frame and is nothing else's business; a directory with no
 * files is the gate the whole shell hangs on, and a reader cannot tell it apart
 * from a vault somebody emptied. The framework hands over one `undefined` and
 * says it means "no accumulator"; what that is worth saying about is the
 * consumer's, which is why it is said here and not there.
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
import { sameMap } from "./same.ts"

/**
 * WHERE A TAB'S DIRECTORY STANDS — the three states of the header, as the three
 * words the shell switches on (`./App.tsx`).
 *
 *   - `reading` — no answer yet. Either member may still be in flight, and the
 *     fold holding nothing reads as this too (the header's fourth state).
 *   - `never` — there has never been a valid set, so the error report IS the
 *     page. A settled answer: no head is coming.
 *   - `loaded` — a directory. Possibly an empty one, which is a real answer.
 *
 * A UNION AND NOT THE WIRE'S `Manifest`, and that is the point rather than
 * tidiness. `Manifest | undefined` is these same three states spelled
 * `{} | null | undefined`, and every reader of it has to say the three-way test
 * itself — which is a second answer to a question this module was handed both
 * halves of specifically so that it could be the one that answers. The shell
 * had two spellings of it and they differed (`./App.tsx`'s `loaded` and its
 * `Switch`); what they could not tell each other was that the cell's word is
 * sometimes the older of the two, which is `manifest-fold-skew`. Three words
 * with no cell behind them make asking twice impossible.
 */
export type Standing = "reading" | "never" | "loaded"

export interface Directory {
  /** Which of the three states this tab's directory is in — see
   *  {@link Standing}, and the header for the two arrival orders it is
   *  resolved from. */
  readonly standing: Accessor<Standing>
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
   *  (docs/brainstorming/reactivity-after-the-flip.md §4.2).
   *
   *  IT KEEPS ITS `sameMap`, and the fold narrowed that guard rather than
   *  retiring it. Per FRAME there is nothing left for it to catch — the map
   *  that leaves is the accumulator's own, handed back by identity. What it
   *  still catches is the RE-SEED: `init` starts from nothing, so a snapshot
   *  over a directory holding one unreadable file mints a fresh map saying
   *  exactly what the old one said, and the sidebar's tree is a memo over this
   *  value — a link flap would rebuild the tree of a directory nothing happened
   *  to. That is the same hole `paths` has, and the difference is only WHERE
   *  each is absorbed: the thing `paths` wakes is a fold kept downstream of a
   *  context (`./served.tsx`, `./file/matching.ts`), so its compare lives
   *  beside that memo; the thing this wakes is handed straight from here
   *  (`./App.tsx` passes `broken()` to the sidebar), so its compare is here. */
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
 *
 * NOT EXPORTED, and neither is the fold below: the seam this file offers is
 * {@link Directory}, and a directory is what its suite drives. `./chat/order.ts`
 * exports its accumulator because the transcript's ORDER is the whole of what
 * that module answers; here it is only what a reading holds when there IS one —
 * the absent state, and what the manifest makes of it, are the directory's — so
 * a suite over the fold alone would be a suite over the half that cannot see
 * them.
 */
interface Held {
  readonly paths: ReadonlyArray<string>
  readonly broken: ReadonlyMap<string, BrokenFile>
  readonly members: Set<string>
}

/** WHAT A FRAME NAMES, as the two readings below are handed it. Spelled as
 *  plain readonly arrays rather than the framework's `CollectionDelta` because
 *  a SNAPSHOT goes through the same pair (see {@link SERVED_FILES}) and a
 *  snapshot's entries are readonly pairs, which that type is not. Neither
 *  reading writes to either array. */
type Upserts = ReadonlyArray<readonly [string, Head]>
type Removes = ReadonlyArray<string>

/**
 * THE FILE LIST AFTER THIS FRAME — and the very one handed in when no file
 * arrived or left, which is nearly every frame there is.
 *
 * The membership is taken in AS IT GOES, written into the accumulator's own set
 * (see {@link Held}); what this answers is the list, because the list is what
 * leaves and the set is only how it is decided. So the two are read by their
 * identity at the one place that has to know whether anything moved.
 *
 * REBUILT WHOLE AND SORTED when it does move — `files·log files`, and that is
 * NOT what this change bought: the shape it replaced sorted at exactly the same
 * frequency, behind a memo over the collection's key set, which kolu keeps quiet
 * on a frame that moves no key. What it bought is the frame that moves no key,
 * which used to cost a walk of the whole directory and a fresh array anyway
 * (`{@link Directory}`'s `paths`). A cheaper insertion here would still have to
 * copy the array — the one it holds is on screen — so what it would save is the
 * `log` on the rare frame and nothing at all on the common one.
 *
 * TOTAL OVER A REMOVE IT HAS NEVER SEEN, which the socket requires: the
 * server's tick coalescer resolves an upsert-then-remove inside one producer
 * tick to a bare remove, so a file born and dead within one tick arrives as a
 * remove that was never preceded by an upsert. `Set.delete` answers `false` for
 * it and nothing is rebuilt.
 */
const pathsAfter = (held: Held, upserts: Upserts, removes: Removes): ReadonlyArray<string> => {
  let moved = false
  for (const [file] of upserts) {
    if (held.members.has(file)) continue
    held.members.add(file)
    moved = true
  }
  for (const file of removes) if (held.members.delete(file)) moved = true
  return moved ? sortByPath(held.members) : held.paths
}

/**
 * THE UNREADABLE FILES AFTER THIS FRAME — and, the same way, the very map
 * handed in when the frame broke and mended nothing.
 *
 * COPIED ON THE FIRST WRITE, which is the whole of the shape: the map handed in
 * is the one the sidebar is drawn from, so it must never be written into — but
 * a frame that breaks nothing (nearly every frame) must not pay for a copy
 * either. So the copy is taken by the first break that actually moves, and the
 * frames that make none hand the held map straight back.
 *
 * COMPARED BY IDENTITY, which is what makes "still broken, for a new reason" a
 * new answer: a head's `broken` is replaced exactly when the frame carrying it
 * is, so a pane drawing the errors cannot be left showing the previous parse
 * failure of a file that still does not parse.
 */
const unreadableAfter = (
  was: ReadonlyMap<string, BrokenFile>,
  upserts: Upserts,
  removes: Removes,
): ReadonlyMap<string, BrokenFile> => {
  let now: Map<string, BrokenFile> | null = null
  const editing = () => (now ??= new Map(was))
  const stood = (file: string) => (now ?? was).get(file)
  for (const [file, head] of upserts) {
    const before = stood(file)
    if (head.broken === null) {
      if (before !== undefined) editing().delete(file)
    } else if (before !== head.broken) editing().set(file, head.broken)
  }
  for (const file of removes) if (stood(file) !== undefined) editing().delete(file)
  return now ?? was
}

/**
 * ONE FRAME APPLIED — the accumulator after it, and the very one handed in when
 * the frame moved neither reading.
 *
 * THREE LINES AND NO LOOP, because the two readings are two independent
 * questions asked of one frame: what files there are, and which of them did not
 * parse. Each is answered above, each answers with the value it was handed when
 * its own question did not move, and this compares those two identities to
 * decide whether there is a new accumulator at all. That comparison is the
 * fold's whole output contract, so it is worth being the only thing here.
 *
 * SO THE FRAME IS WALKED TWICE, and that is the price of the split — `2k` where
 * one fused loop would be `k`, over the keys the FRAME named. It is worth
 * saying rather than hiding, and it is worth paying: `k` is one on the ordinary
 * frame and the size of a bulk import at worst, where the walk this replaced was
 * the size of the vault whatever the frame said. `perf-faces-broken-walk`'s
 * "one walk, not one per reading" was an argument about the SET, and it is the
 * set that stopped being walked.
 *
 * THE ARMS ARE TAKEN IN THE STORE'S ORDER — upserts, then removes. The tick
 * coalescer makes them disjoint, so the order is free; taking it from the
 * framework's own `applyDelta` means that if a frame ever did name one key
 * twice, this fold and `byKey` would resolve it the same way rather than
 * disagreeing about which files there are.
 */
const after = (held: Held, upserts: Upserts, removes: Removes): Held => {
  const paths = pathsAfter(held, upserts, removes)
  const broken = unreadableAfter(held.broken, upserts, removes)
  return paths === held.paths && broken === held.broken ? held : { ...held, paths, broken }
}

/** An accumulator holding nothing — what a full-set frame is applied to. Minted
 *  per seeding rather than shared, because `members` is written in place and one
 *  fold's working memory must never be another's. */
const holdingNothing = (): Held => ({
  paths: NO_PATHS,
  broken: NO_BROKEN,
  members: new Set(),
})

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
 * A SNAPSHOT IS A FRAME whose upserts are the whole set, applied to an
 * accumulator holding nothing — which is exactly how the framework builds one
 * (`syntheticSnapshot`, rebuilt from the store for a first connect, a reconnect
 * and a late registration alike). So both arms are {@link after}, and what a
 * head being unreadable MEANS is stated once rather than once per arm — on the
 * seeding path, which is the one a reader only ever sees after a link flap.
 *
 * WHAT IT COSTS BACK, so nobody has to measure it again. THE ORDER COULD HAVE
 * STAYED OUT — a memo over the collection's `keys()` is quiet on a frame that
 * moves no key AND on a reconnect naming the same set (kolu keeps that array by
 * reference through a link flap), where a fold is re-seeded and `init` has no
 * previous accumulator to hand back, so a re-seed here sorts the directory and
 * mints a fresh list. That shape was held up against this one and lost on the
 * ground that matters: two mechanisms answering one set is what
 * `perf-faces-broken-walk` was about, and `paths` and `broken` would then be
 * able to disagree about which files there are. What it buys instead is charged
 * ONCE PER LINK FLAP — a sort, one array, and the `sameList` in `./served.tsx`
 * that absorbs it — against a walk of the vault on every frame. Two smaller
 * charges come with the same choice: `members` is a third copy of the key set
 * for the life of the tab (the framework's `order`, this, and the sorted list),
 * because the `fold` socket hands over the frame and not the `added`/`removed`
 * it computed; and registering ANY fold on `heads` makes the framework rebuild
 * its full-set frame per snapshot, which it skips for a collection nobody folds.
 * Both are per-reconnect or per-tab, and neither is per-frame.
 *
 * NOT `./chat/order.ts`'S FOLD WITH A COMPARATOR SWAPPED IN, and the two were
 * held side by side before this was written. The transcript's order is a fact
 * about a VALUE on each entry (`seq`), so a frame can re-place a row without
 * moving membership at all and that fold keeps a map of the numbers to notice;
 * a file's place is a fact about its KEY, so it cannot move while the key set
 * stands still, and this keeps a bare set. And this accumulator carries a
 * SECOND reading — the unreadable files — for which the transcript has no
 * analogue. A shared fold would be three knobs serving two callers whose
 * accumulators differ in kind; what they genuinely share is the socket, and
 * they already share it.
 */
const SERVED_FILES: CollectionFoldOptions<string, Head, Held> = {
  init: (entries) => after(holdingNothing(), entries, []),
  step: (held, { upserts, removes }) => after(held, upserts, removes),
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
    // THE ONE PLACE THE TWO SOURCES ARE READ TOGETHER, which is the whole
    // reason the cell is handed in here rather than read by the shell: they are
    // two members on two channels, either can arrive first, and only a reader
    // holding both can say which of them to believe. Both orders, in the order
    // they are decided.
    //
    // A FUNCTION OF THE TWO CURRENT VALUES and of no history, which is what
    // makes it safe to be a rule about arrival ORDER at all: there is no
    // "which came first" kept anywhere, so re-seeding, a link flap and a frame
    // arriving twice all land on the same answer as reading the two now.
    //
    // The cell is read CONDITIONALLY — a tab holding files never asks it — so
    // this memo does not subscribe to the manifest in that arm. That is not a
    // staleness hole and it is worth saying why: the answer in that arm does
    // not depend on the cell, and the only way out of it is a frame from the
    // fold, which IS tracked. A word settles under the default `equals`, so a
    // frame that moved neither member wakes nothing downstream.
    standing: createMemo((): Standing => {
      const holding = held()
      // A TAB HOLDING FILES IS HOLDING A DIRECTORY. Heads come out of a
      // revision and a store with no snapshot publishes none, so this is proof
      // of a set — and it outranks a `null` from the cell, which in this order
      // is simply the older of the two answers (`manifest-fold-skew`: the error
      // report drawn over paths that had already arrived).
      if (holding !== undefined && holding.paths.length > 0) return "loaded"
      const said = manifest()
      // …and with nothing held, `null` is the settled answer it has always
      // been: no head is coming for a directory that never loaded, so this
      // waits for no frame.
      if (said === null) return "never"
      // …and BOTH HAVING SPOKEN with no path between them is the empty vault,
      // which is a real answer and the only `loaded` with no file in it. What
      // is left is the two silences, and they are one word: the cell before its
      // first frame, and the fold holding no accumulator (the header's fourth
      // state).
      return said !== undefined && holding !== undefined ? "loaded" : "reading"
    }),
    paths: createMemo(() => held()?.paths ?? NO_PATHS),
    // SEEDED with the empty map, which the `equals` requires: a comparator is
    // asked about the FIRST value too, and `sameMap` reads a size off both
    // sides. The ERRORS are compared as well as the keys, and by IDENTITY —
    // `sameMap`'s default, and right here because a head's `broken` is replaced
    // exactly when the frame carrying it is. Comparing the key sets alone would
    // leave a pane showing the previous parse failure of a file that is still
    // broken for a new reason.
    broken: createMemo(() => held()?.broken ?? NO_BROKEN, NO_BROKEN, {
      equals: sameMap,
    }),
    // NOT IN THE FOLD, and that is the line: the fold accumulates the SET, and
    // this asks one key what revision it is at. A reader watching one file must
    // not be woken by a write three folders away, which is exactly what joining
    // it to a reading of the whole directory would do.
    head: (file) => () => entries.byKey(file())?.()?.rev,
  }
}
