/**
 * THE DIFFERENTIAL: one op corpus, two publishing paths, and a fake subscriber
 * that reports every way the frames it was handed differ.
 *
 * `perf-published-maps` changed HOW a revision's collections are arrived at and
 * nothing else. The three collections used to be rebuilt whole from the set on
 * every revision; they are now CARRIED from the revision before, written into
 * where a file moved and rebuilt only where membership moved
 * ({@link ./published.ts}). That is a claim about cost, so the test worth
 * having is the one that says the answers did not move: replay a corpus of
 * writes against both, and hold them to the same delta sequence and the same
 * final `readAll`.
 *
 * WHAT IS KEPT HERE IS THE WALK ({@link publishedAsWalked}), which is what makes
 * this a differential rather than a fixture — the same shape `@olai/format`'s
 * `./scope.testlib.ts` was built in for `perf-filter-scope`, one layer up. A
 * test that pinned the new projection's frames against expectations written by
 * hand would pin whatever the new projection does, including the way it can
 * quietly be wrong; the reference cannot make that mistake, because it is the
 * code that shipped.
 *
 * THE HAZARD IT IS AIMED AT is the one a carried map creates: a REUSED SHELL
 * SWALLOWING A DELTA. An object whose identity survives a revision can make a
 * subscriber's own equality check skip an update it needed, and the failure is
 * silent — the collection holds the right thing, the wire was told the wrong
 * one, and nobody finds out until a tab is showing yesterday's file. So the
 * subscriber here is not a map that takes what it is given: it FOLDS BY
 * IDENTITY, exactly as a reader that memoises would, and keeps two transcripts
 * — what it was offered and what it accepted. A delta a reused shell swallowed
 * shows up as a line missing from the second.
 *
 * That the harness can actually see it is proved rather than argued:
 * {@link swallowing} and {@link misplacing} inject the two failures a carried
 * map makes possible — a stale shell handed back in place of a correction, and
 * a born key appended rather than placed in the set's order — and
 * `./published.equivalence.test.ts` asserts each is caught, by the delta check
 * and by the `readAll` check respectively.
 *
 * TWO SHAPES IN HERE WERE PUT IN BY A FAILURE rather than by foresight, and
 * they are named so the next reader does not have to rediscover them. Both are
 * membership moving in a way the corpus did not think to move it, and both were
 * invisible to a walk that re-derived membership from the set every revision:
 *
 *   - a file that leaves in a revision the store cannot NAME
 *     ({@link Step.forgotten}, which is what a `resync` produces). Every corpus
 *     below missed it and one e2e scenario caught it. The bug THAT shape
 *     measured is what the phantom lane fixed: the remove is minted now
 *     (`./published.ts`'s `mintedOf`), so what used to be a residue both
 *     sides shared is held to ZERO ({@link heldOnes}) — and {@link unminting}
 *     holds the old wire in place as the red the zero is earned against;
 *   - a MIXED-KIND membership change at a constant file count — an outline
 *     leaving as a `.md` arrives, and the inverse ({@link stepsOver}'s swap,
 *     and the hand-written pair in the corners). Every mixed-membership
 *     revision here used to be same-kind, so a rule written against the
 *     DIRECTORY's file count read this as no membership change at all and
 *     carried a map that had just lost a key; grok's review of `bcc15008`
 *     found it by reading, which is not a way a harness is allowed to be
 *     beaten twice.
 *
 * Each is a corpus shape now, and the projection asks about a COLLECTION's own
 * keys rather than about the directory ({@link ./published.ts}'s `changeOf`,
 * with `complete` for the departures nobody names).
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import {
  assemble,
  bodiedIn,
  bodyKind,
  bodyOf,
  type BrokenFile,
  faceOf,
  FILE_KINDS,
  nodesOf,
  outlinesIn,
  type Reading,
  reading,
  textKind,
  type Verdict,
  verdictOf,
} from "@olai/format"
import { seeded } from "@olai/format/testlib"
import { decodedVault } from "@olai/format/testlib/scope"
import type { Snapshot } from "@olai/store"
import type { DocumentEntry, Head } from "@olai/surface"
import { Result } from "effect"

import type { Change, Published } from "./published.ts"

/** What both sides are: a revision, and the revision the wire is holding.
 *  `null` is the first one. */
export type Projection = (
  snapshot: Snapshot<Reading>,
  published: Published | null,
) => Published

/** The three collections, by name — every counter, transcript and mutant here
 *  is per-collection, and naming them once is what keeps the three from being
 *  spelled differently in three places. */
export const COLLECTIONS = ["outlines", "documents", "heads"] as const
export type Which = (typeof COLLECTIONS)[number]

// ── the projection this replaced ───────────────────────────────────────

/**
 * `publishedOf` AS A WALK: three walks of the served files, three fresh maps.
 *
 * Copied rather than imported, and it has to be — the point of a differential
 * is that the two sides cannot share the line under test. What it does share is
 * everything the change did not touch: `faceOf`, `nodesOf`, `bodyOf` and
 * `textKind` are the real ones on both sides, so the only difference between
 * the two answers is how the collections were assembled around them.
 *
 * WHAT IS AS-IT-WAS is the WALKING, not the delta set: this reference first
 * stood for behaviour under `perf-published-maps`, and the phantom lane then
 * CHANGED the wire on purpose — the remove the store cannot name is minted
 * now. The walk spells that rule AGAIN below (`walkedChangeOf`), off its own
 * sources, exactly as independent of `./published.ts`'s `mintedOf` as before:
 * a differential whose two sides import one helper can hold the helper's bug
 * as the truth both agree on.
 */
export const publishedAsWalked: Projection = (snapshot, published) => {
  const { set, derived } = snapshot.value
  const broken = new Map(set.broken.map((file) => [file.file, file] as const))
  return {
    outlines: walkedChangeOf(
      outlinesIn(set),
      (outline) => outline.path,
      (outline) => ({
        rev: snapshot.rev,
        nodes: nodesOf(derived, outline.path),
        broken: broken.get(outline.path) ?? null,
        face: faceOf(outline),
      }),
      snapshot,
      published?.outlines,
    ),
    heads: walkedChangeOf(
      set.documents,
      (document) => document.path,
      (document) => ({
        rev: snapshot.rev,
        face: faceOf(document),
        broken: broken.get(document.path) ?? null,
      }),
      snapshot,
      published?.heads,
    ),
    ...walkedDocumentsOf(snapshot, published, broken),
  }
}

const walkedIsUnread = (file: BrokenFile | undefined): boolean =>
  file?.errors.some((error) => error.code === "unreadable-file") === true

const walkedDocumentsOf = (
  snapshot: Snapshot<Reading>,
  held: Published | null,
  broken: ReadonlyMap<string, BrokenFile>,
): Pick<Published, "documents" | "unread"> => {
  const documents = bodiedIn(snapshot.value.set)
  const change = walkedChangeOf(
    documents,
    (document) => document.path,
    (document) => ({
      rev: snapshot.rev,
      text: bodyOf(document),
      refused: walkedIsUnread(broken.get(document.path)),
    }),
    snapshot,
    held?.documents,
  )
  const upserts: Array<readonly [string, DocumentEntry]> = []
  const unread: Array<string> = []
  for (const [path, entry] of change.upserts) {
    if (entry.text !== null) upserts.push([path, entry])
    else {
      if (textKind(path) !== null) unread.push(path)
      if (held?.documents.entries.has(path) !== true) upserts.push([path, entry])
    }
  }
  return { documents: { ...change, upserts }, unread }
}

/** The rule, as it stood, PLUS the mint: every source walked, every key
 *  written into a map minted for this revision, an unchanged file's entry
 *  carried across — and the departures the store could not NAME said beside
 *  the ones it did, in the same one shape.
 *
 *  The mint needs no `complete` gate here: a walk RE-READS membership from
 *  the sources on every revision, so a key nothing names is simply a key in
 *  `held` with no source, and the answer is read off the walked map rather
 *  than off arithmetic about file counts. The ORDERING must be the
 *  candidate's — named removes first, minted after, minted in the held map's
 *  order — or the two sides would be comparing two wires instead of two
 *  projections. */
const walkedChangeOf = <S, T>(
  sources: ReadonlyArray<S>,
  keyOf: (source: S) => string,
  build: (source: S) => T,
  moved: Pick<Snapshot<unknown>, "changed" | "removed">,
  previous: Change<T> | undefined,
): Change<T> => {
  const held = previous?.entries
  const changed = new Set(moved.changed)
  const named = new Set(moved.removed)
  const entries = new Map<string, T>()
  for (const source of sources) {
    const key = keyOf(source)
    const publishedEntry = changed.has(key) ? undefined : held?.get(key)
    entries.set(key, publishedEntry ?? build(source))
  }
  return {
    entries,
    upserts: moved.changed.flatMap((path) => {
      const entry = entries.get(path)
      return entry === undefined ? [] : [[path, entry] as const]
    }),
    removes: [
      ...moved.removed.filter((path) => held?.has(path) === true),
      ...held === undefined ? [] : [...held.keys()].filter(
        (key) => !entries.has(key) && !named.has(key),
      ),
    ],
  }
}

// ── the corpus, as revisions ───────────────────────────────────────────

/**
 * ONE REVISION'S WORTH OF DISK: what a step writes, what it deletes, and what
 * it deletes WITHOUT THE STORE BEING ABLE TO SAY SO.
 *
 * A write to a path the vault does not hold is a file CREATED, which is one of
 * the two things that make a collection's map be rebuilt, so a corpus that
 * never writes one is a corpus that never reaches half the code under test.
 *
 * {@link Step.forgotten} is the other half and it is not a hypothetical. The
 * store's `removed` is the listing's diff against the STAMP TABLE the last
 * probe left, and a VERIFIED look forgets that table wholesale (`@olai/store`'s
 * `probe.forget`, behind `refresh("verified")` — the class a `git checkout`,
 * an rsync or a test harness putting a fixture back asks for), so after one, a
 * file that left is
 * re-listed as gone and named as removed by NOBODY. The walk this replaced
 * re-derived membership from the set every revision and could not be hurt by
 * it; a projection that carries its maps can be, and was — a `_olai/Inbox.olai`
 * deleted before a resync stayed in the sidebar for the life of the process,
 * which every corpus in this file missed and one e2e scenario caught
 * (`quick_capture.feature`, "the sidebar offers no Inbox"). So it is a corpus
 * shape now, and every generated run holds some.
 */
export interface Step {
  readonly writes?: ReadonlyArray<readonly [file: string, text: string]>
  readonly deletes?: ReadonlyArray<string>
  /** Files that leave the disk in a revision that names neither them nor
   *  anything else about them — see above. `changed` still names every file the
   *  probe re-decoded, because a verified look re-decodes the whole listing. */
  readonly forgotten?: ReadonlyArray<string>
}

/**
 * A file whose text is THIS is one the probe found and could not open — the
 * `unreadable-file` failure, which is the only breakage that reaches
 * {@link DocumentEntry.refused} and which no amount of bad JSONL produces.
 *
 * A sentinel rather than a second corpus shape, because it has to be reachable
 * from a {@link Step} like every other edit: the case worth replaying is a file
 * that reads, then refuses, then reads again.
 */
export const REFUSED = "\u0000refused"

/**
 * THE CORPUS AS THE STORE WOULD PUBLISH IT: one snapshot per step, with the
 * `changed`/`removed` pair a probe would have computed.
 *
 * Built ONCE and handed to both sides, which is the whole point — a harness
 * that generated a revision per side would be comparing two corpora. The first
 * revision names every file as changed, because that is what did move for a
 * consumer holding nothing (`@olai/store`'s `Snapshot.changed`), and every
 * later one names exactly what its step touched, with the two lists DISJOINT
 * the way the store keeps them (`absorb`).
 */
export const revisionsOf = (
  vault: ReadonlyMap<string, string>,
  steps: ReadonlyArray<Step>,
): ReadonlyArray<Snapshot<Reading>> => {
  const held = new Map(vault)
  const revisions: Array<Snapshot<Reading>> = [{
    rev: 1,
    value: readingOf(held),
    changed: [...held.keys()],
    removed: [],
  }]
  for (const step of steps) {
    const changed: Array<string> = []
    const removed: Array<string> = []
    for (const [file, text] of step.writes ?? []) {
      held.set(file, text)
      changed.push(file)
    }
    for (const file of step.deletes ?? []) {
      // A delete of a path nothing holds is not a removal — the probe reports
      // what the LISTING lost, and it never held this.
      if (held.delete(file)) removed.push(file)
    }
    // A RESYNC-SHAPED REVISION: the file goes, the whole listing is re-decoded
    // (so `changed` names every path that is left), and `removed` names nobody
    // at all — because the table the diff would have been taken against was
    // thrown away first. See {@link Step.forgotten}.
    const forgot = (step.forgotten ?? []).filter((file) => held.delete(file))
    if (forgot.length > 0) {
      for (const file of held.keys()) if (!changed.includes(file)) changed.push(file)
    }
    revisions.push({
      rev: revisions.length + 1,
      value: readingOf(held),
      changed,
      removed,
    })
  }
  return revisions
}

/** The vault decoded and assembled, the way a probe's codec would — through
 *  `@olai/format/testlib/scope`'s own decode, with the one thing that decode
 *  cannot express ({@link REFUSED}) put in beside it. */
const readingOf = (vault: ReadonlyMap<string, string>): Reading => {
  const decoded = decodedVault(vault)
  for (const [file, text] of vault) {
    if (text !== REFUSED) continue
    decoded.set(
      file,
      Result.fail<Verdict>(verdictOf([{
        file,
        line: 0,
        code: "unreadable-file",
        message: "EACCES — this file is in the directory and will not open.",
      }])),
    )
  }
  return reading(assemble(decoded))
}

// ── the subscriber ─────────────────────────────────────────────────────

/**
 * A READER ON THE WIRE, as `./runtime.ts` writes to one: the upserts of a
 * revision, then its removes, per collection, on one synchronous stack.
 *
 * IT FOLDS BY IDENTITY, and that is not a simplification but the whole subject.
 * A subscriber that re-renders on every frame would never notice a reused shell;
 * one that skips a value identical to the one it holds — which is what a memo,
 * a `createMemo` dep or a `Map` keyed fold all amount to — is the reader a
 * carried map can quietly starve. So it keeps two transcripts: everything it was
 * OFFERED, and the subset it ACCEPTED. A swallowed delta is a line that is in
 * the first and not the second.
 */
class Subscriber {
  readonly held = new Map<string, unknown>()
  readonly offered: Array<string> = []
  readonly kept: Array<string> = []

  fold(rev: number, which: Which, change: Change<unknown>): void {
    for (const [key, value] of change.upserts) {
      this.offered.push(`rev ${rev} ${which} +${key} ${spelled(value)}`)
      if (this.held.get(key) === value) continue
      this.held.set(key, value)
      this.kept.push(`rev ${rev} ${which} +${key} ${spelled(value)}`)
    }
    for (const key of change.removes) {
      this.offered.push(`rev ${rev} ${which} -${key}`)
      if (!this.held.delete(key)) continue
      this.kept.push(`rev ${rev} ${which} -${key}`)
    }
  }
}

/** ONE ENTRY, as a string a reader can compare and act on. Memoised on the
 *  entry itself: an unchanged file's entry is one object for the life of the
 *  run on both sides, so the final `readAll` comparison spends nothing on the
 *  files a corpus never touched. */
const spellings = new WeakMap<object, string>()
const spelled = (value: unknown): string => {
  if (typeof value !== "object" || value === null) return JSON.stringify(value) ?? "undefined"
  const held = spellings.get(value)
  if (held !== undefined) return held
  const said = JSON.stringify(value) ?? "undefined"
  spellings.set(value, said)
  return said
}

// ── one side of the comparison ─────────────────────────────────────────

/**
 * ONE PROJECTION, MID-REPLAY: what it has published so far and what its readers
 * have heard.
 *
 * The two sides are stepped TOGETHER rather than run one after the other, and
 * that is not a tidying — it is what makes the snapshot half of the comparison
 * possible at all. `readAll` has to be compared at EVERY revision, because a
 * key a carried map wrongly kept is a key a later rebuild silently cleans up:
 * comparing only the end state means a corpus can hold the bug and go green
 * because something after it happened to mint a fresh map. (That is exactly how
 * the mixed-kind corner slipped past a first attempt at these very steps.)
 * Materialising every revision's snapshot on both sides and comparing
 * afterwards is not the alternative — that is O(revisions × files) strings held
 * at once, hundreds of megabytes on the generated vault — so the loop compares
 * each revision as it makes it and keeps only what diverged.
 */
interface Side {
  readonly projection: Projection
  held: Published | null
  readonly readers: ReadonlyMap<Which, Subscriber>
  readonly offered: Array<string>
  readonly kept: Array<string>
  readonly unread: Array<string>
  /** How many (revision × collection) pairs handed back the very map the last
   *  revision did, and how many minted a new one. Measured rather than assumed:
   *  a corpus that never reused a map would prove the equivalence of nothing. */
  reused: number
  rebuilt: number
  upserts: number
  removes: number
  /** How many of those removes the store never NAMED — minted by the
   *  projection itself ({@link Report.minted}). */
  minted: number
}

const sideOf = (projection: Projection): Side => ({
  projection,
  held: null,
  readers: new Map(COLLECTIONS.map((which) => [which, new Subscriber()] as const)),
  offered: [],
  kept: [],
  unread: [],
  reused: 0,
  rebuilt: 0,
  upserts: 0,
  removes: 0,
  minted: 0,
})

/** One revision, published and folded — the side's own step of the replay. */
const step = (side: Side, snapshot: Snapshot<Reading>): Published => {
  const before = new Map<Which, unknown>(
    COLLECTIONS.map((which) => [which, side.held?.[which].entries] as const),
  )
  const revision = side.projection(snapshot, side.held)
  for (const which of COLLECTIONS) {
    const change = revision[which] as Change<unknown>
    if (before.get(which) !== undefined && before.get(which) === change.entries) {
      side.reused += 1
    } else side.rebuilt += 1
    side.upserts += change.upserts.length
    side.removes += change.removes.length
    for (const key of change.removes) {
      if (!snapshot.removed.includes(key)) side.minted += 1
    }
    const reader = side.readers.get(which)!
    const wasOffered = reader.offered.length
    const wasKept = reader.kept.length
    reader.fold(snapshot.rev, which, change)
    side.offered.push(...reader.offered.slice(wasOffered))
    side.kept.push(...reader.kept.slice(wasKept))
  }
  for (const path of revision.unread) side.unread.push(`rev ${snapshot.rev} unread ${path}`)
  side.held = revision
  return revision
}

/** `readAll` of one collection, as the lines a reader compares — the KEYS IN
 *  ORDER and the value at each, since the order of `entries` is the order a
 *  fresh subscriber's snapshot arrives in. */
const snapshotOf = (revision: Published, which: Which): ReadonlyArray<string> =>
  [...(revision[which] as Change<unknown>).entries].map(
    ([key, value]) => `${key} ${spelled(value)}`,
  )

// ── the comparison ─────────────────────────────────────────────────────


/**
 * WHAT A RUN OF THE HARNESS SAYS.
 *
 * `divergences` is the claim and everything else is the non-vacuity: a run over
 * a corpus that moved nothing, or one that never reused a map, would have an
 * empty divergence list and prove nothing at all, so each of those is a counter
 * here rather than something a caller has to remember to check for itself.
 */
export interface Report {
  /** Every way the two projections differed, in the words a reader needs to fix
   *  it — which revision, which collection, which file, and what each side
   *  said. EMPTY is the gate. */
  readonly divergences: ReadonlyArray<string>
  readonly revisions: number
  /** How many delta frames a reader was handed, and how many it accepted. */
  readonly upserts: number
  readonly removes: number
  /** How many keys an OPEN reader still holds that a fresh one no longer
   *  sees, counted on the CANDIDATE — the residue a revision the store
   *  cannot name used to leave on BOTH projections ({@link Step.forgotten}).
   *  Now that the wire mints the remove itself, THE PROMISE IS ZERO: any
   *  non-zero count is also a divergence (the `held ones` lines), and the
   *  count is kept because the red twin of that gate — the {@link unminting}
   *  mutant held at the old wire — must have a number to point at. */
  readonly phantom: number
  /** How many removes the CANDIDATE minted that the store never named —
   *  the shape {@link Report.phantom} is the absence of. A floor, the way
   *  `phantom`'s old floors were: it holds a corpus to REACHING the
   *  unnamed-departure shape rather than to tolerating it. */
  readonly minted: number
  /** How many (revision × collection) pairs the CANDIDATE handed back the very
   *  map the revision before did — the count that says the carrying under test
   *  actually happened. */
  readonly reused: number
  /** ...and how many it rebuilt, which is a birth or the first revision. Both
   *  arms have to be exercised or the corpus is only about one of them. */
  readonly rebuilt: number
}

/**
 * REPLAY THE CORPUS BOTH WAYS.
 *
 * The revisions are built once and handed to both, so what is compared is the
 * projection and never the corpus. Four claims, and they fail for different
 * reasons, so each is reported in its own words:
 *
 *   - the frames a reader was OFFERED, in order — the delta sequence itself;
 *   - the frames it ACCEPTED, which is the same list unless a reused shell
 *     swallowed one (see the header);
 *   - `readAll` AT EVERY REVISION, keys in order, because the order of
 *     `entries` is the order a fresh subscriber's snapshot arrives in — and at
 *     every revision rather than at the end, because a key a carried map
 *     wrongly kept is a key a later rebuild silently cleans up ({@link Side});
 *   - and, per side, the two halves of the wire's one membership promise:
 *     every key a revision's snapshot holds was ANNOUNCED to an open reader
 *     ({@link unheard}), and no key it drops is STILL HELD by one
 *     ({@link heldOnes}). The second half is the phantom lane's fix said as a
 *     gate: it was once a residue both projections shared — counted and held
 *     equal — and the mint makes it nobody's, so it is held to EMPTY.
 *     `unheard`'s half is exempt for `documents` on purpose: a body the set
 *     does not keep is withheld from that collection and published by the
 *     body reader instead (`./bodies.ts`), so a `.html` that changed is a key
 *     whose entry moved with no delta behind it, by design. `heldOnes` has
 *     no exemption: a remove is withheld from nobody.
 */
export const differential = (
  vault: ReadonlyMap<string, string>,
  steps: ReadonlyArray<Step>,
  candidate: Projection,
  reference: Projection = publishedAsWalked,
): Report => {
  const revisions = revisionsOf(vault, steps)
  const was = sideOf(reference)
  const now = sideOf(candidate)
  const divergences: Array<string> = []
  // BOTH SIDES, ONE REVISION AT A TIME, with the snapshot compared where it is
  // made — see {@link Side}. The delta transcripts are compared afterwards
  // because they are the size of what MOVED and can be held whole; a snapshot
  // is the size of the directory and cannot.
  for (const snapshot of revisions) {
    const before = step(was, snapshot)
    const after = step(now, snapshot)
    if (divergences.length >= LINES) continue
    for (const which of COLLECTIONS) {
      divergences.push(
        ...differing(
          `\`readAll\` of ${which} at revision ${snapshot.rev}`,
          snapshotOf(before, which),
          snapshotOf(after, which),
        ),
      )
    }
  }
  divergences.push(
    ...differing("the delta a reader was offered", was.offered, now.offered),
    ...differing("the delta a reader accepted", was.kept, now.kept),
    ...differing("the body owed to a reader", was.unread, now.unread),
  )
  for (const which of COLLECTIONS) {
    for (const [side, run] of [["the walk", was], ["the carried map", now]] as const) {
      // `unheard` is exempt for `documents` BY DESIGN (a body the set does
      // not keep is WITHHELD from the delta it would ride). The phantom line
      // never is: a REMOVE is withheld from nobody, so an open reader of any
      // collection holding a key a fresh one cannot read is the wire's one
      // membership promise broken — whichever side left it.
      if (which !== "documents") {
        divergences.push(
          ...unheard(
            `${side}: what a fresh reader of ${which} reads, against what an open one was told`,
            run,
            which,
          ),
        )
      }
      divergences.push(
        ...heldOnes(
          `${side}: what an open reader of ${which} still holds that a fresh one no longer reads`,
          run,
          which,
        ),
      )
    }
  }
  return {
    divergences,
    revisions: revisions.length,
    upserts: now.upserts,
    removes: now.removes,
    phantom: COLLECTIONS.reduce(
      (count, which) => count + phantomsOf(now, which).length,
      0,
    ),
    minted: now.minted,
    reused: now.reused,
    rebuilt: now.rebuilt,
  }
}


/**
 * WHAT A FRESH READER SEES AND AN OPEN ONE WAS NOT TOLD — one half of the
 * wire's own promise, checked per side rather than between them.
 *
 * ONE DIRECTION, and the reverse is {@link heldOnes}'s: every key a
 * revision's snapshot holds was announced to an open reader with that very
 * value, so `readAll ⊆ fold` is a claim about publishing and a divergence
 * here is a delta somebody owed and did not send. The reverse — `fold ⊆
 * readAll`, nothing held that a fresh reader cannot see — USED to break on
 * exactly one shape: a file that leaves in a revision the store cannot name
 * (a `resync` — {@link Step.forgotten}), dropped from the snapshot and named
 * in no `removes`, so an open reader went on holding it until reconnect.
 * Both projections left the same residue, which is why it used to be counted
 * and held EQUAL between the sides rather than asserted away; the remove is
 * MINTED now (`./published.ts`'s `mintedOf`), so the residue is nobody's and
 * the reverse is held to empty beside this one.
 *
 * `documents` is exempt from this whole check, and on purpose: a body the set
 * does not keep is withheld from that collection and published by the body
 * reader instead (`./bodies.ts`), so a `.html` that changed is a key whose entry
 * moved with no delta behind it, by design.
 */
const unheard = (
  what: string,
  side: Side,
  which: Which,
): ReadonlyArray<string> => {
  const folded = side.readers.get(which)!.held
  const out: Array<string> = []
  for (const line of side.held === null ? [] : snapshotOf(side.held, which)) {
    const key = line.slice(0, line.indexOf(" "))
    const held = folded.has(key) ? spelled(folded.get(key)) : undefined
    if (held === line.slice(key.length + 1)) continue
    out.push(
      `${what}: ${key} — the snapshot says ${line.slice(key.length + 1)}` +
        ` and the open reader holds ${held ?? "nothing"}`,
    )
    if (out.length >= LINES) {
      out.push(`${what}: ...and more after ${key}`)
      break
    }
  }
  return out
}

/**
 * THE OTHER HALF of the wire's promise: the keys an open reader still holds
 * that a fresh one no longer sees, listed so EACH side can be held to
 * leaving none — which, after the mint, is the promise where "both leave the
 * same ones" used to be. Sorted, because a fold's order is arrival order.
 *
 * No `documents` exemption here, unlike {@link unheard}: that one is exempt
 * because a changed body's UPSERT is withheld by design, and a remove is
 * withheld from nobody.
 */
const phantomsOf = (side: Side, which: Which): ReadonlyArray<string> => {
  const fresh = new Set(
    side.held === null ? [] : (side.held[which] as Change<unknown>).entries.keys(),
  )
  return [...side.readers.get(which)!.held.keys()].filter((key) => !fresh.has(key)).sort()
}

/** Each phantom as its own divergence line — the wire's other promise held to
 *  EMPTY, per side ({@link phantomsOf}). Capped the way {@link differing} is:
 *  one missed mint lists the whole held map, and the first few name the rule
 *  broken as well as the transcript would. */
const heldOnes = (
  what: string,
  side: Side,
  which: Which,
): ReadonlyArray<string> => {
  const out: Array<string> = []
  for (const key of phantomsOf(side, which)) {
    out.push(`${what}: ${key}`)
    if (out.length >= LINES) {
      out.push(`${what}: ...and more after ${key}`)
      break
    }
  }
  return out
}

/**
 * Two transcripts, differenced — the FIRST place they part and a few after it,
 * never all of them.
 *
 * A frame dropped shifts every line after it, so an uncapped difference of two
 * forty-thousand-line transcripts is not a diagnostic, it is the transcript
 * again. What a reader needs is the first divergence, in full, with what each
 * side said at that position.
 */
const differing = (
  what: string,
  was: ReadonlyArray<string>,
  now: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const out: Array<string> = []
  for (let at = 0; at < Math.max(was.length, now.length); at++) {
    if (was[at] === now[at]) continue
    out.push(
      `${what}, at position ${at}: the walk says ${was[at] ?? "nothing"}` +
        ` and the carried map says ${now[at] ?? "nothing"}`,
    )
    if (out.length >= LINES) {
      out.push(`${what}: ...and the rest of it past position ${at}`)
      break
    }
  }
  if (out.length === 0 && was.length !== now.length) {
    out.push(`${what}: the walk has ${was.length} lines and the carried map ${now.length}`)
  }
  return out
}

/** How many divergent positions are worth printing before the point is made —
 *  one dropped frame diverges at every position after it. */
const LINES = 5

// ── the hazard, injected ───────────────────────────────────────────────

/**
 * A REUSED SHELL THAT SWALLOWS A DELTA — the failure a carried map makes
 * possible, wired up so the harness can be held to catching it.
 *
 * It does to `heads` what a wrong reuse test would do to any collection: the
 * first file of every revision after the first keeps the entry the wire already
 * holds, and the upsert that would have corrected it is dropped. The collection
 * is then internally consistent — what it holds is what it said — which is
 * exactly why it is the dangerous shape: only a comparison against a projection
 * that did the work can see it, and only a reader folding by identity feels it.
 *
 * `heads` because every served file is in it, so no corpus can miss the arm.
 */
export const swallowing = (projection: Projection): Projection => (snapshot, published) => {
  // COPIED BEFORE THE CALL: the projection under test carries its maps forward
  // and writes into them, so "what the wire held a moment ago" is a question
  // that has to be asked while it is still answerable.
  const before = published === null ? null : new Map(published.heads.entries)
  const revision = projection(snapshot, published)
  const first = revision.heads.upserts[0]
  if (before === null || first === undefined) return revision
  const stale = before.get(first[0])
  if (stale === undefined) return revision
  revision.heads.entries.set(first[0], stale)
  return {
    ...revision,
    heads: { ...revision.heads, upserts: revision.heads.upserts.slice(1) },
  }
}

/**
 * A BORN KEY APPENDED RATHER THAN PLACED — the other failure, and the one this
 * change actually risks.
 *
 * `Map` keeps insertion order, so a projection that wrote a new path into the
 * map it carried instead of rebuilding it would put that file at the END of a
 * list every other key of which is in the set's path order. Not one delta
 * differs: the frames are identical, the collection holds every right value,
 * and the only thing that moved is the order a FRESH subscriber's snapshot
 * arrives in. So this is the mutant that the `readAll` half of the comparison
 * exists for, and nothing else in the harness can see it.
 */
export const misplacing = (projection: Projection): Projection => (snapshot, published) => {
  const before = published === null ? null : [...published.heads.entries.keys()]
  const revision = projection(snapshot, published)
  if (before === null) return revision
  const held = new Set(before)
  const entries = new Map<string, Head>()
  for (const key of before) {
    const entry = revision.heads.entries.get(key)
    if (entry !== undefined) entries.set(key, entry)
  }
  for (const [key, entry] of revision.heads.entries) {
    if (!held.has(key)) entries.set(key, entry)
  }
  return { ...revision, heads: { ...revision.heads, entries } }
}

/**
 * THE PHANTOM, WIRED BACK IN — the pre-fix wire held in place as the harness's
 * RED: send a reader only the removes the store NAMED, as publishing did for
 * the whole of the walk's life and `perf-published-maps`'s after it.
 *
 * It is the quietest of the three mutants: not one WRONG frame, just the ones
 * the fix mints DELETED — every collection holds the right thing and no open
 * reader is told so. And it is how the fix's gate is proved to have teeth:
 * the zero every green case now asserts for `Report.phantom` must be a zero
 * this mutant fails, in the words the failure would use ({@link heldOnes}),
 * and the missing frames must show on the DELTA transcripts, where the
 * reference — minting — says them and this side does not.
 *
 * Written against the wrapper shape rather than held as a third projection,
 * like {@link swallowing}: the pre-fix wire is a SUBSET of the fixed one, not
 * a different one.
 */
export const unminting = (projection: Projection): Projection => (snapshot, published) => {
  const revision = projection(snapshot, published)
  const named = new Set(snapshot.removed)
  const filtered = <T>(change: Change<T>): Change<T> => ({
    ...change,
    removes: change.removes.filter((key) => named.has(key)),
  })
  return {
    ...revision,
    outlines: filtered(revision.outlines),
    documents: filtered(revision.documents),
    heads: filtered(revision.heads),
  }
}

// ── what to do to a corpus ─────────────────────────────────────────────

/**
 * THE STEPS, drawn off the vault itself rather than written down beside it.
 *
 * A list of edits written by hand is a list that stops naming anything the day
 * a generator changes, so the files here are the vault's own — and the shapes
 * that must be reached whatever it holds are put in beside them at rates: a
 * save (the commonest revision there is), a file BORN (the one thing that makes
 * a collection's map be rebuilt), a file that LEAVES, a file that breaks and
 * mends, a file that refuses to open and then opens, a many-file revision of the
 * shape a `git pull` makes, a RESYNC in which something leaves and the store
 * can name nobody ({@link Step.forgotten} — sometimes with another file put
 * back to earlier bytes in the same revision, the `git checkout` shape), and
 * a revision that moves nothing at all.
 *
 * MEMBERSHIP MOVES BOTH WAYS AND ACROSS KINDS, which is the half that had to be
 * added rather than the half that was designed: an outline leaving as a `.md`
 * arrives moves no file count at all, so a rule written against the DIRECTORY's
 * size reads it as no membership change and carries a map that just lost a key.
 * Every mixed-membership revision in this generator was once same-kind, which is
 * exactly why the harness could not see that bug (grok's review of `bcc15008`).
 * So a swap is a step now, in both directions, sometimes with the departure
 * NAMED and sometimes not.
 *
 * BIRTHS SORT EVERYWHERE, which is what the order half of the comparison needs:
 * a new path drawn to sort before the whole vault, into the middle of it, and
 * after all of it, because a map that appended a born key would still look
 * right for the last of those three.
 *
 * THE RESYNC BAND REPORTS HOW OFTEN IT FIRED, in the returned `resyncs` — a
 * bare `forgotten`, or one under a restore of a live path, counted at the
 * push. The minted floors a run's report is held to are fired through this
 * band AND through the swap arm's unnamed half, so they can only say the
 * shape was REACHED — never that this band reached it: the band sat dead
 * once (`roll < 0.94` behind the `git pull` arm's `< 0.96`) while every
 * floor passed, because the floors were not about IT. Count its own fires
 * and floor the count (grok's review of the phantom PR): a squeezed band,
 * or a shared floor lowered by hand, then fails loudly instead of the way
 * the 0.94 threshold failed — silently.
 *
 * SEEDED, so a divergence is a corpus a reader can re-run rather than a
 * lottery.
 */
export const stepsOver = (
  files: ReadonlyArray<string>,
  { steps, seed = 20260824 }: { readonly steps: number; readonly seed?: number },
): { readonly steps: ReadonlyArray<Step>; readonly resyncs: number } => {
  const random = seeded(seed)
  // WHICH KIND A PATH IS, asked of the REGISTRY rather than of its spelling:
  // `./kinds.ts` is the one place that says what a file of the set is, and an
  // `endsWith` here would be a second answer to it — which the sweep in
  // `@olai/tests`' `kinds.test.ts` fails a run over. A file with no BODY KIND is
  // an outline, which is `decodedVault`'s own reading one package down.
  const outlines = files.filter((file) => bodyKind(file) === null)
  const bodied = files.filter((file) => bodyKind(file) !== null)
  const pick = (of: ReadonlyArray<string>): string | undefined =>
    of.length === 0 ? undefined : of[Math.floor(random() * of.length)]
  const gone = new Set<string>()
  const live = (of: ReadonlyArray<string>): ReadonlyArray<string> =>
    of.filter((file) => !gone.has(file))
  const out: Array<Step> = []
  let resyncs = 0
  for (let at = 0; at < steps; at++) {
    const roll = random()
    const outline = pick(live(outlines))
    const document = pick(live(bodied))
    if (roll < 0.34 && outline !== undefined) {
      out.push({ writes: [[outline, minted(at)]] })
    } else if (roll < 0.55 && document !== undefined) {
      out.push({ writes: [[document, `# document ${at}\n\nrewritten at step ${at}.\n`]] })
    } else if (roll < 0.62) {
      // A FILE BORN, and where it sorts is drawn: before the whole vault, into
      // the middle of it, and after all of it.
      out.push({ writes: [[`${bornAt(random, at)}${OUTLINE}`, minted(at)]] })
    } else if (roll < 0.68) {
      out.push({ writes: [[`${bornAt(random, at)}${MARKDOWN}`, `# born ${at}\n`]] })
    } else if (roll < 0.74 && outline !== undefined) {
      gone.add(outline)
      out.push({ deletes: [outline] })
    } else if (roll < 0.78 && document !== undefined) {
      gone.add(document)
      out.push({ deletes: [document] })
    } else if (roll < 0.84 && outline !== undefined) {
      // BROKEN, and mended in the step after it — the two halves of the one
      // shape, so no run leaves the corpus with a file nothing ever fixed.
      out.push({ writes: [[outline, `{"id":"torn ${at}`]] })
      out.push({ writes: [[outline, minted(at)]] })
    } else if (roll < 0.88 && document !== undefined) {
      out.push({ writes: [[document, REFUSED]] })
      out.push({ writes: [[document, `# mended ${at}\n`]] })
    } else if (roll < 0.92) {
      // THE `git pull` SHAPE: several files re-decoded, one born and one gone,
      // in one revision — which is the revision that used to cost three whole
      // maps and now costs one rebuild.
      const writes: Array<readonly [string, string]> = [[
        `${bornAt(random, at)}${OUTLINE}`,
        minted(at),
      ]]
      for (const file of sampledFrom(random, live(outlines), 4)) writes.push([file, minted(at)])
      for (const file of sampledFrom(random, live(bodied), 2)) {
        writes.push([file, `# pulled ${at}\n`])
      }
      const leaving = pick(live(outlines))
      if (leaving !== undefined) gone.add(leaving)
      out.push({ writes, deletes: leaving === undefined ? [] : [leaving] })
    } else if (roll < 0.96) {
      // A RESYNC: a file leaves and the store cannot say which — see
      // {@link Step.forgotten}. Drawn from both kinds, because a departure the
      // diff loses is a departure from whichever collection held it. And half
      // the time it is the whole `git checkout` SHAPE: ANOTHER file is put
      // back to earlier bytes in the same revision, which is exactly what a
      // checkout of another commit does to a tree (the phantom lane's repro).
      //
      // THIS ARM WAS DEAD ON ARRIVAL: it once sat at `roll < 0.94` BEHIND the
      // `git pull` arm's `roll < 0.96`, so no sequence reached it — only the
      // swap arm's unnamed half reached the shape at all, which is why every
      // floor here read `phantom: 1` where this arm alone would have made it
      // several.
      const leaving = random() < 0.5 ? pick(live(outlines)) : pick(live(bodied))
      if (leaving === undefined) out.push({})
      else {
        gone.add(leaving)
        // THE FIRE ITSELF, counted — every push below carries a `forgotten`
        // of a live path, whichever of the three shapes it takes.
        resyncs += 1
        if (random() < 0.5) out.push({ forgotten: [leaving] })
        else {
          // Put one file BACK to earlier bytes while the other one goes: the
          // probe re-decodes the whole listing either way, so `changed` holds
          // the restored one and `removed` holds nobody.
          const restored = pick(live(random() < 0.5 ? outlines : bodied))
          out.push(
            restored === undefined
              ? { forgotten: [leaving] }
              : {
                writes: [[
                  restored,
                  bodyKind(restored) === null ? minted(at) : `# restored at ${at}\n`,
                ]],
                forgotten: [leaving],
              },
          )
        }
      }
    } else if (roll < 0.98) {
      // A MIXED-KIND SWAP AT A CONSTANT FILE COUNT — one kind leaves and the
      // OTHER arrives in the same revision, which is the shape a rule written
      // against the directory's file count is wrong about (grok's review of
      // `bcc15008`; the corners have the hand-written version). Both directions
      // are drawn, and every so often the departure is one the store cannot
      // name, which is the same hole with no remove on the wire either.
      const outward = random() < 0.5
      const leaving = pick(live(outward ? outlines : bodied))
      if (leaving === undefined) out.push({})
      else {
        gone.add(leaving)
        const arriving = `${bornAt(random, at)}${outward ? MARKDOWN : OUTLINE}`
        const writes = [[arriving, outward ? `# swapped in at ${at}\n` : minted(at)] as const]
        out.push(
          random() < 0.4 ? { writes, forgotten: [leaving] } : { writes, deletes: [leaving] },
        )
      }
    } else {
      // A REVISION THAT MOVES NOTHING — every collection reuses its map and
      // every subscriber hears nothing, which is the arm the counters below
      // would otherwise never reach.
      out.push({})
    }
  }
  return { steps: out, resyncs }
}

/** One outline's worth of JSONL, minted for a step so no two writes of one file
 *  are the same bytes — a corpus whose edits changed nothing would compare two
 *  projections that had nothing to do. */
const minted = (at: number): string =>
  [
    JSON.stringify({ id: `s${at}root`, ord: "a0", title: `written at step ${at}` }),
    JSON.stringify({
      id: `s${at}child`,
      parent: `s${at}root`,
      ord: "a1",
      title: `a child written at step ${at}`,
      ...(at % 3 === 0 ? { todo: true } : {}),
    }),
  ].join("\n")

/** A path for a file being BORN, drawn to sort before the whole vault, into the
 *  middle of it, or after all of it — see {@link stepsOver}. And every so often
 *  into a directory named after a file beside it, which is the one pair
 *  `byPath` and a plain code-point sort disagree about. */
const bornAt = (random: () => number, at: number): string => {
  const roll = random()
  if (roll < 0.3) return `0born${at}`
  if (roll < 0.5) return `zzz/born${at}`
  if (roll < 0.65) return `note0/born${at}`
  return `mid${at}`
}

/** The suffix a NEW file of each kind is minted with, read off the REGISTRY
 *  rather than written out — for the reason `stepsOver` asks `bodyKind` which
 *  kind a path is: `@olai/format`'s `kinds.ts` is the one place that says what
 *  a file of the set is called, and a corpus that spelled one would be a second
 *  answer to it (`@olai/tests`' `kinds.test.ts` sweeps for exactly that). */
const OUTLINE = FILE_KINDS.outline.exts[0]
const MARKDOWN = FILE_KINDS.document.exts[0]

/** `count` of them, spread across the list rather than taken off the front. */
const sampledFrom = (
  random: () => number,
  of: ReadonlyArray<string>,
  count: number,
): ReadonlyArray<string> => {
  if (of.length <= count) return of
  const stride = of.length / count
  return Array.from(
    { length: count },
    (_, at) => of[Math.min(of.length - 1, Math.floor(at * stride + random() * stride))] as string,
  )
}
