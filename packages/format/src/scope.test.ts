/**
 * `file:` AND `under:` NARROW THE WALK, and select exactly what the walk they
 * replaced selected.
 *
 * The claim is an equivalence, so the shape of this file is a differential and
 * not a table of expectations: `./scope.testlib.ts` holds the corpus walk as it
 * was and the comparator that reports every way the two answers differ, and
 * every case here is that comparison over a corpus chosen to break it. What is
 * asserted is always the same thing — an EMPTY divergence list — plus, per
 * case, enough counting to say the run was not vacuous.
 *
 * FOUR CORPORA, and each is here because the ones before it cannot reach what
 * it holds:
 *
 *   - the CORNERS, written by hand ({@link TANGLED}) — a record beneath a
 *     placement, a placement as the scope root, a parent loop, a child in
 *     another file, an id nothing claims. A generator produces these at random
 *     or not at all, and each is a set the validator would refuse, which is
 *     precisely the ground both walks promise to stand on;
 *   - a GENERATED one with depth in it, for size and for the shapes at rates —
 *     hundreds of placements and hundreds of records beneath one;
 *   - THE REAL VAULT, the orchestrator's own, read at the revision this
 *     repository pins (`OSS_OLAI_VAULT`): trees people grew, an archive with a
 *     hundred records in it, and a mirror somebody placed for a reason;
 *   - an EDITED one, where the question is asked again after a write — because
 *     the descent reads an index the PATCHER maintains ({@link
 *     Derived.children}) and the walk it is held to reads only `byId`, so a
 *     stale child list is a divergence this file sees and nothing else would.
 */

import { expect, test } from "bun:test"
import { Result } from "effect"

import type { Derived } from "./derive.ts"
import { matching, parseFilter } from "./filter.ts"
import { isMirror } from "./node.ts"
import { parseOutline } from "./parse.ts"
import {
  type Ask,
  asksOver,
  decodedVault,
  deepVaultOf,
  differential,
  pinnedVault,
  readingOfVault,
  TANGLED,
  vaultAt,
  walkedMatching,
} from "./scope.testlib.ts"
import { assemble, nodesIn } from "./set.ts"
import { reading } from "./validate.ts"
import { verdictOf } from "./verdict.ts"

/** The day the grammar's relative words count from — a constant, so a `date:`
 *  ask says the same thing in January. */
const NOW = "2026-08-13T11:00:00-04:00"

/**
 * The queries every corpus is asked, crossed with the scopes drawn off it.
 *
 * Chosen so that between them they reach every arm of the matcher a scope has
 * to survive: a plain word, a word in a note, a phrase, an `OR`, a negation, a
 * mark, a date, a query that finds nothing, and the archive — because the
 * candidates a scope hands over are what all of them are then run against, and
 * a narrowing that dropped a record would show up under whichever arm was
 * looking for it.
 */
const QUERIES: ReadonlyArray<string> = [
  "kitchen",
  "garden",
  "walnut",
  "record",
  `"a note about"`,
  "kitchen OR garden",
  "kitchen -walnut",
  "is:todo",
  "is:done",
  "has:desc",
  "date:2026-08",
  "zzzzzzzz",
  "kitchen is:trashed",
]

/** The gate, in one place: no divergence, and the run was not vacuous. */
const holds = (report: ReturnType<typeof differential>, floors: {
  readonly hits: number
  readonly narrowing: number
}): void => {
  // AN EQUALITY TO THE EMPTY LIST rather than a count, so a failure names the
  // ask, the position and the record on each side — a differential whose
  // failure message is `expected 3 to be 0` is a differential nobody can act
  // on at four in the morning.
  expect(report.divergences).toEqual([])
  expect(report.hits).toBeGreaterThan(floors.hits)
  // ...and the scopes really were corners: a run where every scope held the
  // whole vault would satisfy the line above having compared nothing.
  expect(report.narrowing).toBeGreaterThan(floors.narrowing)
}

// ── the corners ────────────────────────────────────────────────────────

test("the corners a generator cannot reach agree, scope by scope", () => {
  const at = readingOfVault(new Map(Object.entries(TANGLED)))
  holds(
    differential(at, asksOver(at.derived, QUERIES), NOW),
    { hits: 40, narrowing: 20 },
  )
})

/**
 * ...and what the corners MEAN, said once in the only place it can be said:
 * over a fixture small enough to write the answer down.
 *
 * The differential above proves the two walks agree; it cannot prove they agree
 * about the right thing, because both would go on agreeing if the ancestor walk
 * itself changed its mind about a placement. These are the memberships the
 * format actually promises, asserted against the production door directly.
 */
test("a record written beneath a placement is under nothing above that placement", () => {
  const at = readingOfVault(new Map(Object.entries(TANGLED)))
  const found = (under: string): ReadonlyArray<string> =>
    matching(at.derived, parseFilter("kitchen", NOW), { under }).map((one) => one.at.node.id)

  // The live branch, and the child written in another file — `under:` is about
  // the tree and not about the file.
  expect(found("t-root")).toEqual(["t-cross", "t-root", "t-live", "t-inner"])
  // ...and the same scope with the file named beside it, which is the
  // conjunction: the cross-file child goes.
  expect(
    matching(at.derived, parseFilter("kitchen", NOW), {
      under: "t-root",
      file: "tangled.olai",
    }).map((one) => one.at.node.id),
  ).toEqual(["t-root", "t-live", "t-inner"])
  // THE TRAP: `t-beneath` and `t-deeper` are written under a mirror, so the
  // ancestor walk stops before it reaches `t-root` and neither is in the scope
  // above. They are their own scope's records, though — the placement is what
  // is not walked THROUGH, not a record that stops existing.
  expect(found("t-root")).not.toContain("t-beneath")
  expect(found("t-beneath")).toEqual(["t-beneath", "t-deeper"])
  // A PLACEMENT AS THE ROOT names an empty corner: the record itself is one the
  // query layer never answers with, and nothing beneath it is under it.
  expect(found("t-place")).toEqual([])
  expect(found("t-chain")).toEqual([])
  // ...and EMPTY WITH A LIVE FILE BESIDE IT, which is the half that makes the
  // two lines above a claim rather than a coincidence: `tangled.olai` holds
  // four records this query selects, so a narrowing that answered an empty
  // `under:` by falling through to the file would say so here and nowhere else
  // (the same pair `asksOver` now draws over every corpus).
  const inFile = (under: string): ReadonlyArray<string> =>
    matching(at.derived, parseFilter("kitchen", NOW), { under, file: "tangled.olai" })
      .map((one) => one.at.node.id)
  expect(inFile("t-place")).toEqual([])
  expect(inFile("t-nobody")).toEqual([])
  // The target's OWN subtree is untouched by having been placed elsewhere.
  expect(found("t-target")).toEqual(["t-target", "t-target-child"])
  // A LOOP admits its whole cycle from either end, which is what the guards at
  // the two ends of the walk have to agree about.
  expect(found("t-loop-a")).toEqual(["t-loop-a", "t-loop-b"])
  expect(found("t-loop-b")).toEqual(["t-loop-a", "t-loop-b"])
  // A ROOT NOTHING CLAIMS is an empty corner, and so is the orphan's own
  // missing parent read from below.
  expect(found("t-nobody")).toEqual([])
  expect(found("t-orphan")).toEqual(["t-orphan"])
  // THE ARCHIVE is out of a scoped reading exactly as it is out of an unscoped
  // one — the scope decides the corner, the query decides the trash.
  expect(found("t-gone")).toEqual([])
  expect(
    matching(at.derived, parseFilter("kitchen is:trashed", NOW), { under: "t-gone" })
      .map((one) => one.at.node.id),
  ).toEqual(["t-gone", "t-gone-child"])
})

test("an `under:` scope through a mirror admits each record once and no more", () => {
  const at = readingOfVault(new Map(Object.entries(TANGLED)))
  // The scope that holds the placement AND its target's subtree: a mirror is a
  // second placement of a node, so an answer holding `t-target` twice — once
  // for the record and once for the placement standing in front of it — is the
  // failure this asks about. `t-place` is in `t-root`'s subtree; `t-target` is
  // not, and neither is reached twice.
  const ids = matching(at.derived, parseFilter("kitchen OR garden", NOW), {}).map((one) =>
    one.at.node.id
  )
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).not.toContain("t-place")
  for (const under of ["t-root", "t-far", "t-target", "t-place"]) {
    const scoped = matching(at.derived, parseFilter("kitchen OR garden", NOW), { under })
      .map((one) => one.at.node.id)
    expect(new Set(scoped).size).toBe(scoped.length)
  }
})

// ── size, and the shapes at rates ──────────────────────────────────────

test("a generated vault with depth in it agrees at every scope", () => {
  const vault = deepVaultOf({ files: 60, records: 24 })
  const at = readingOfVault(vault)
  // The fixture is the one this test means: no two records claim one id (the
  // single corpus where a candidate list and a corpus walk could legitimately
  // differ), and it really holds the two planted shapes.
  expect(at.derived.byId.size).toBe(at.derived.nodes.length)
  const placements = at.derived.nodes.filter((one) => isMirror(one.node))
  expect(placements.length).toBeGreaterThan(50)
  expect(beneathPlacements(at.derived)).toBeGreaterThan(50)
  // ...and it is a TREE and not a bush, which is what makes an `under:` scope
  // something other than "a root, or one record".
  expect(deepest(at.derived)).toBeGreaterThan(3)
  holds(
    differential(at, asksOver(at.derived, QUERIES), NOW),
    { hits: 500, narrowing: 100 },
  )
})

/** How many records are written under a placement — the shape the descent must
 *  not walk into, counted rather than assumed present. */
const beneathPlacements = (derived: Derived): number => {
  let count = 0
  for (const at of derived.nodes) {
    const parent = at.node.parent === undefined ? undefined : derived.byId.get(at.node.parent)
    if (parent !== undefined && isMirror(parent.node)) count += 1
  }
  return count
}

/** The deepest canonical chain in the corpus — one walk down from every root,
 *  which is what the ancestor walk would answer one record at a time. */
const deepest = (derived: Derived): number => {
  const depths = new Map<string, number>()
  const depthOf = (id: string, seen: ReadonlySet<string>): number => {
    const held = depths.get(id)
    if (held !== undefined) return held
    const at = derived.byId.get(id)
    const parent = at?.node.parent
    const above = parent === undefined || seen.has(parent)
      ? 0
      : depthOf(parent, new Set([...seen, parent]))
    const depth = above + 1
    depths.set(id, depth)
    return depth
  }
  let most = 0
  for (const at of derived.nodes) most = Math.max(most, depthOf(at.node.id, new Set([at.node.id])))
  return most
}

// ── the real vault ─────────────────────────────────────────────────────

/**
 * The orchestrator's vault, at the revision this repository pins.
 *
 * It used to be a relative walk to `docs/` beside this package. The vault moved
 * out (https://github.com/juspay/oss.olai) and the corpus went with it rather
 * than becoming a fixture: `npins` pins the repository, `shell.nix` exports the
 * store path, and {@link pinnedVault} throws by name if the suite is run
 * outside that shell — no fallback and no skip, so this leg cannot go green
 * having read nothing.
 */
const VAULT = pinnedVault()

test("the real vault agrees at every scope", () => {
  const vault = vaultAt(VAULT)
  const at = readingOfVault(vault)
  // The vault is a live directory and this test holds no opinion about what is
  // in it — but a run over an EMPTY one would assert nothing at all, so the
  // floors here are about it being a vault rather than about it being this one.
  expect(at.derived.nodes.length).toBeGreaterThan(100)
  expect(at.derived.byFile.size).toBeGreaterThan(4)
  expect(at.derived.byId.size).toBe(at.derived.nodes.length)
  holds(
    differential(at, asksOver(at.derived, REAL), NOW),
    { hits: 20, narrowing: 5 },
  )
})

/** What to ask a vault of roadmap notes. The words are its own — a query
 *  matching nothing in it would compare two empty answers all night — and the
 *  operators are the ones its records actually carry. */
const REAL: ReadonlyArray<string> = [
  "the",
  "index",
  "olai",
  "search",
  `"the human"`,
  "index OR search",
  "index -search",
  "is:todo",
  "is:done",
  "has:desc",
  "zzzzzzzz",
  "the is:trashed",
]

// ── the write, and the question asked again ────────────────────────────

/**
 * AN EDIT, AND THEN THE SAME QUESTION — the case a fresh derivation cannot be
 * asked.
 *
 * The descent reads {@link Derived.children}, which on every keystroke after a
 * write is not a map that was BUILT but one the patcher carried across from the
 * revision before, re-filing only what the edit touched. The walk it is held to
 * reads `byId` and each record's own `parent`, and those are the very fields the
 * patcher rebuilds from — so a child list left holding a record that moved, or
 * missing one that arrived, is invisible to the reference walk and is exactly
 * what this compares against it.
 *
 * FOUR WRITES, and each moves a different thing about the shape a scope reads:
 * a record moved to another parent, a placement arriving over a live branch, a
 * whole file rewritten, and a file removed. The reading is PATCHED after each
 * one (`reading(set, { read, delta })`), which is what the store hands a query
 * on a settled keystroke.
 *
 * TWO WRITE SHAPES ARE DELIBERATELY NOT HERE, and the reason is an argument
 * rather than an omission — the next reader's question is "why not a
 * cross-file move, and why not an untrash", so it is answered where they will
 * look (pi's review of `5a07615`, which judged both provably unable to hide a
 * divergence and asked for the proof to be written down).
 *
 * A CROSS-FILE MOVE cannot hide one because the FILE a record is written in is
 * not an input to the descent at all. `descendedFrom` reaches a record through
 * `byId` and `children`, both keyed by ID, and the file enters in exactly two
 * places: the `at.file` comparison, which reads the field off the very record
 * the delta re-filed, and the `byFile` bucket a `file:`-only scope walks. A
 * move is those two buckets rewritten in one delta — which is the union of the
 * whole-file rewrite and the file removal below it, in one round instead of
 * two. There is no third thing it touches.
 *
 * AN UNTRASH cannot hide one because the archive is not a scope. What was put
 * away is decided in `selecting` off `isTrashed(at.file)`, DOWNSTREAM of the
 * candidates and after both walks have already chosen them — and `selecting`
 * is the real one on both arms of this differential (`./scope.testlib.ts` says
 * why it must be). So the two sides cannot disagree about the trash rule for
 * the same reason they cannot disagree about `is:done`: it is one function,
 * called once, with the same boolean. What an untrash moves that the scope CAN
 * see is which file a record is written in, which is the paragraph above.
 */
test("a write leaves the narrowing answering what the walk does", () => {
  const vault = new Map(deepVaultOf({ files: 12, records: 18, seed: 20260825 }))
  const decoded = decodedVault(vault)
  let read = reading(assemble(decoded))
  const asks = asksOver(read.derived, QUERIES, { files: 6, roots: 10 })
  holds(differential(read, asks, NOW), { hits: 60, narrowing: 20 })

  /** The asks this round is judged by: the ones drawn off the corpus this
   *  started from, AND the ones drawn off the view the last write left.
   *
   *  BOTH, because they are two different questions and each misses what the
   *  other catches. The first are STALE by round two — they name ids a write
   *  moved, emptied or took away, which is a case worth keeping and is what an
   *  agent's saved query is; the second are the only ones that can name what an
   *  edit CREATED, so a corpus asked only its original scopes never asks about
   *  post-edit reality at all (pi's review of `5a07615`). The stale half is the
   *  reason the seed and the caps are the same on both: two draws over one
   *  shape rather than a second table. */
  const asking = (): ReadonlyArray<Ask> => [
    ...asks,
    ...asksOver(read.derived, QUERIES, { files: 6, roots: 10 }),
  ]

  /** What four scopes say now — read back after every write, so the test can
   *  insist each edit really MOVED an answer rather than agreeing four times
   *  over about a corpus nothing happened to. One scope per write, each named
   *  beside the write it is the witness for. */
  const moved: Array<string> = []
  const say = (): string =>
    ["d3n1", "d4r", "d8r", "d6r"]
      .map((under) =>
        walkedMatching(read.derived, parseFilter("kitchen OR garden", NOW), { under })
          .map((one) => one.at.node.id).join(",")
      )
      .join(" | ")
  moved.push(say())

  const rewritten = (file: string, edit: (text: string) => string): void => {
    const text = vault.get(file) as string
    const edited = edit(text)
    // THROWN rather than written unchanged, for `./fixtures.testlib.ts`'s
    // reason: a write that writes nothing is a round of this test comparing
    // the previous round's corpus with itself, and it would pass.
    if (edited === text) throw new Error(`the edit to ${file} changed nothing`)
    vault.set(file, edited)
    decoded.set(file, Result.mapError(parseOutline(file, edited), verdictOf))
  }
  const requeried = (changed: ReadonlyArray<string>, removed: ReadonlyArray<string>): void => {
    read = reading(assemble(decoded), {
      read,
      delta: {
        upserts: changed.map((file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const),
        removes: [...removed],
      },
    })
    // NO TWO RECORDS CLAIM ONE ID, asked of every round rather than of the
    // corpus this started from. It is the one set where a candidate list and a
    // corpus walk may legitimately differ (`./filter.ts`'s `namedInScope`), so
    // an edit that minted one would report a divergence that is about this
    // fixture and not about the narrowing — which is exactly what the first
    // draft of this test did, by writing `deep5.olai` beside the generator's
    // own `area5/deep5.olai`.
    expect(read.derived.byId.size).toBe(read.derived.nodes.length)
    holds(differential(read, asking(), NOW), { hits: 40, narrowing: 15 })
    moved.push(say())
  }

  // A RECORD MOVES to another parent — the shape that takes a subtree out of
  // one scope and puts it into another, and the one a child list that was
  // merely appended to would answer for both.
  rewritten(
    "deep3.olai",
    (text) => text.replace(/^\{"id":"d3n17","parent":"[^"]*"/m, `{"id":"d3n17","parent":"d3n1"`),
  )
  requeried(["deep3.olai"], [])

  // A PLACEMENT ARRIVES over a live branch: whatever hangs under `d4n1` was in
  // every scope above it a moment ago and is in none of them now, which is the
  // trap asked as an EDIT rather than as a fixture.
  rewritten(
    "deep4.olai",
    (text) =>
      text.replace(/^\{"id":"d4n1".*$/m, `{"id":"d4n1","parent":"d4r","ord":"a1","mirror":"d3r"}`),
  )
  requeried(["deep4.olai"], [])

  // A FILE REWRITTEN WHOLE — every record in it a new object under a new id,
  // which is the patcher's re-file path rather than its carry-across one, and
  // takes every scope the old ids named away with it.
  rewritten("deep8.olai", (text) => text.replaceAll(`"d8`, `"e8`))
  requeried(["deep8.olai"], [])

  // ...and a FILE GONE, taking a scope's records with it: `under:` a root in it
  // must answer nothing, and `file:` it must too.
  vault.delete("deep6.olai")
  decoded.delete("deep6.olai")
  requeried([], ["deep6.olai"])
  expect(matching(read.derived, parseFilter("kitchen", NOW), { under: "d6r" })).toEqual([])
  expect(matching(read.derived, parseFilter("kitchen", NOW), { file: "deep6.olai" })).toEqual([])

  // THE EDITS REALLY MOVED THE ANSWER. Without this the four comparisons above
  // could be four readings of one unchanged corpus, which is the way a soak
  // passes for the wrong reason.
  expect(moved.length).toBe(5)
  expect(new Set(moved).size).toBe(moved.length)
})

// ── and it really narrows ──────────────────────────────────────────────

/**
 * THE COST, as the only thing about it a test may assert: WHAT IS READ.
 *
 * Milliseconds are the bench's (`./filter.bench.ts`), and a timing that fails a
 * lane on a busy machine teaches nobody anything. What is checkable is the
 * shape of the claim rather than its size — a scoped query reads the corner and
 * never the directory — and it is checkable exactly, by handing the door a
 * derivation whose flat corpus reading is a trap.
 *
 * It is the assertion the whole change is for. Every comparison above would go
 * on passing if `inScopeOf` walked `derived.nodes` and filtered it, because
 * filtering the corpus is what it USED to do and the answer was right then too.
 */
test("a scoped query never reads the corpus", () => {
  const at = readingOfVault(deepVaultOf({ files: 40, records: 20, seed: 20260826 }))
  const blind = withoutCorpus(at.derived)
  const file = [...at.derived.byFile.keys()][3] as string
  const asked = parseFilter("kitchen OR garden", NOW)
  for (const scope of [{ file }, { under: "d9n1" }, { under: "d9n1", file: "deep9.olai" }]) {
    // The same answer, arrived at without the corpus in reach — both halves
    // matter, and a scope that answered nothing at all would pass the first.
    expect(matching(blind, asked, scope)).toEqual(matching(at.derived, asked, scope))
    expect(matching(at.derived, asked, scope).length).toBeGreaterThan(0)
  }
  // ...and a candidate list is the other way in, which does not read the corpus
  // either: what it reads is `byId`, once per candidate. The list deliberately
  // holds records from OUTSIDE the scope as well as inside it, so the scope has
  // something to cut and the comparison is not two empty answers.
  const named = [
    ...(at.derived.byFile.get("deep9.olai") ?? []),
    ...(at.derived.byFile.get(file) ?? []),
  ].map((one) => one.node.id)
  const off = matching(at.derived, asked, { under: "d9r" }, named)
  expect(off.length).toBeGreaterThan(0)
  expect(off.length).toBeLessThan(named.length)
  expect(matching(blind, asked, { under: "d9r" }, named)).toEqual(off)
  // THE CONTROL. An unscoped query does read it, so the three above are a
  // narrowing rather than a trap nothing reaches.
  expect(() => matching(blind, asked, {})).toThrow(/read the whole corpus/)
})

/** A derivation with the corpus taken out of reach — every index it holds, and
 *  a flat reading that throws rather than answering. Spreading first and
 *  declaring the getter after is what makes it a trap for `nodes` alone:
 *  `byFile`, `byId` and `children` are the very maps the real derivation holds,
 *  so what is being read is measured and not modelled. */
const withoutCorpus = (derived: Derived): Derived => ({
  ...derived,
  get nodes(): never {
    throw new Error("a scoped query read the whole corpus")
  },
})
