/**
 * THE DIFFERENTIAL: one scoped question, two implementations, and every way
 * they differ named.
 *
 * `file:` and `under:` used to be a PREDICATE run over the whole corpus, and
 * since `perf-filter-scope` they are a reading of the derivation's own indexes
 * — one file's records, or one subtree descended ({@link ./filter.ts}'s
 * `inScopeOf`). That is a change to how an answer is ARRIVED AT and to nothing
 * else, so the only test worth having is the one that says so: ask the same
 * question both ways and compare the answers, over corpora chosen to break the
 * equivalence rather than to demonstrate it.
 *
 * WHAT IS KEPT HERE IS THE OLD WALK ({@link walkedMatching}), which is what
 * makes this a differential rather than a fixture. A test that pinned the new
 * walk's answers against expectations written by hand would pin whatever the
 * new walk does, including the two ways it could quietly be wrong — a record
 * admitted through a placement, a record ordered by the tree it was descended
 * rather than by the corpus. The reference implementation cannot make either
 * mistake, because it is the code that shipped for a year.
 *
 * IT IS REUSABLE ON PURPOSE, and it has two callers because the seam it is
 * about has two sides. `./scope.test.ts` runs it over generated corpora, over
 * the corners no generator reaches ({@link TANGLED}) and over this
 * repository's own vault; `@olai/index`'s `scope.index.test.ts` runs the same
 * asks with the search index in front of them, which is the composition that
 * had to be proved rather than asserted — a scope narrows a corpus walk one
 * way and a candidate list another, and the two must select the same records.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import { Result } from "effect"

import { ancestorsOf, byCorpus, type Derived } from "./derive.ts"
import { bodiedDocument, type Document } from "./document.ts"
import { type Verdict, verdictOf } from "./verdict.ts"
import {
  type Filter,
  type Matched,
  matching,
  parseFilter,
  type Scope,
  selecting,
} from "./filter.ts"
import { seeded } from "./fixtures.testlib.ts"
import { bodyKind, fileKind, unkept } from "./kinds.ts"
import { isMirror, type LocatedRegular } from "./node.ts"
import { parseOutline } from "./parse.ts"
import { assemble } from "./set.ts"
import { reading, type Reading } from "./validate.ts"

// ── the walk this replaced ─────────────────────────────────────────────

/**
 * `matching` AS IT WAS: every record in the directory, tested one at a time.
 *
 * Copied rather than imported, and it has to be — the point of a differential
 * is that the two sides cannot share the line under test. What it does share is
 * everything the change did not touch: `selecting` is the real one, so the
 * grammar, the archive rule and the score are the matcher's own on both sides
 * and the only difference between the two answers is which records were offered
 * to it.
 *
 * The `named` arm is here for the same reason even though the production path
 * still spells it this way: a differential that compared the corpus walks and
 * took the candidate walk on trust would go green on the day the two stopped
 * agreeing about membership, which is precisely the seam an index puts under
 * this.
 */
export const walkedMatching = (
  derived: Derived,
  filter: Filter,
  scope: Scope = {},
  named?: Iterable<string>,
): ReadonlyArray<Matched> => [
  ...selecting(
    derived,
    filter,
    named === undefined
      ? walkedInScope(derived, scope)
      : walkedNamedInScope(derived, scope, named),
    scope.trashed === true || (filter.kind === "asking" && filter.speaksOfTrash),
  ),
]

/** The predicate, as it was: a file comparison, and an ancestor walk per node
 *  for `under:`. */
const walkedScoping = (
  derived: Derived,
  scope: Scope,
): ((at: LocatedRegular) => boolean) => {
  const { file, under } = scope
  if (file === undefined && under === undefined) return () => true
  return (at) => {
    if (file !== undefined && at.file !== file) return false
    if (under === undefined) return true
    return at.node.id === under ||
      ancestorsOf(derived, at.node.id).some((crumb) => crumb.node.id === under)
  }
}

function* walkedInScope(derived: Derived, scope: Scope): Generator<LocatedRegular> {
  const inScope = walkedScoping(derived, scope)
  for (const located of derived.nodes) {
    if (isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    yield at
  }
}

const walkedNamedInScope = (
  derived: Derived,
  scope: Scope,
  named: Iterable<string>,
): ReadonlyArray<LocatedRegular> => {
  const inScope = walkedScoping(derived, scope)
  const found: Array<LocatedRegular> = []
  for (const id of named) {
    const located = derived.byId.get(id)
    if (located === undefined || isMirror(located.node)) continue
    const at = located as LocatedRegular
    if (!inScope(at)) continue
    found.push(at)
  }
  return found.sort(byCorpus)
}

// ── the comparison ─────────────────────────────────────────────────────

/** One question the two walks are asked: the text somebody typed, and the
 *  corner of the set it was asked about. */
export interface Ask {
  readonly text: string
  readonly scope: Scope
}

/**
 * WHAT A RUN OF THE HARNESS SAYS.
 *
 * `divergences` is the claim and everything else is the non-vacuity: a run that
 * asked nothing, matched nothing, or asked only scopes that happened to hold
 * the whole vault would have an empty divergence list and prove nothing, and
 * each of those three is a counter here rather than a thing a caller has to
 * remember to check for itself.
 */
export interface Report {
  /** Every way the two answers differed, in the words a reader needs to fix it
   *  — which ask, which position, which record on each side. EMPTY is the gate. */
  readonly divergences: ReadonlyArray<string>
  /** How many asks were made. */
  readonly asked: number
  /** How many records the reference walk selected across all of them. */
  readonly hits: number
  /** How many SCOPED asks selected something, and fewer records than the same
   *  query unscoped — the count that says the scopes really are corners of the
   *  set rather than the whole of it. */
  readonly narrowing: number
  /** How many asks were answered off a candidate list rather than off the
   *  corpus — zero unless the caller supplied one. */
  readonly candidates: number
}

/**
 * ASK EVERY QUESTION BOTH WAYS.
 *
 * `narrow` is the seam an index plugs into: hand it something that answers a
 * filter with the ids that MIGHT match (`@olai/index`'s `Index.narrow`, whose
 * `null` means "ask the corpus") and both walks are run over those candidates
 * instead of over the set. Both — which is the whole point: the scope must
 * select the same records off a candidate list as off the corpus, and a harness
 * that only compared the corpus walks would never look at the composition.
 */
export const differential = (
  at: Reading,
  asks: Iterable<Ask>,
  now: string,
  narrow?: (at: Reading, filter: Filter) => Iterable<string> | null | undefined,
): Report => {
  const divergences: Array<string> = []
  let asked = 0
  let hits = 0
  let narrowing = 0
  let candidates = 0
  for (const ask of asks) {
    const filter = parseFilter(ask.text, now)
    // MATERIALISED, because it is iterated three times below and a caller may
    // hand back a generator: the two walks and the unscoped control must each
    // be offered the SAME candidates, and a list the first of them consumed
    // would quietly make the other two answers about nothing.
    const answered = narrow?.(at, filter)
    const named = answered === null || answered === undefined ? undefined : [...answered]
    const walked = walkedMatching(at.derived, filter, ask.scope, named)
    const narrowed = matching(at.derived, filter, ask.scope, named)
    asked += 1
    hits += walked.length
    if (named !== undefined) candidates += 1
    if (isScoped(ask.scope) && walked.length > 0) {
      const whole = walkedMatching(at.derived, filter, trashOnly(ask.scope), named)
      if (walked.length < whole.length) narrowing += 1
    }
    for (const line of differing(ask, walked, narrowed)) divergences.push(line)
  }
  return { divergences, asked, hits, narrowing, candidates }
}

const isScoped = (scope: Scope): boolean =>
  scope.file !== undefined || scope.under !== undefined

/** The same scope with the corner taken off it — what "the same query
 *  unscoped" means, keeping the archive rule so the comparison is about the
 *  corner and not about the trash. */
const trashOnly = (scope: Scope): Scope =>
  scope.trashed === undefined ? {} : { trashed: scope.trashed }

/**
 * The two answers, differenced — SET first and then ORDER, because they fail
 * for different reasons and a reader wants to be told which.
 *
 * A record missing from one side is a membership bug (a placement descended
 * through, a subtree the descent could not reach); the same records in another
 * order is the corpus order not being kept, which no `toContain`-shaped
 * assertion would ever notice. The position lines are CAPPED because a walk
 * that shifted by one diverges at every position after it, and forty thousand
 * lines is not a diagnostic.
 */
const differing = (
  ask: Ask,
  walked: ReadonlyArray<Matched>,
  narrowed: ReadonlyArray<Matched>,
): ReadonlyArray<string> => {
  const said = `${askedAs(ask)}:`
  const out: Array<string> = []
  const byWalk = new Set(walked.map(whereOf))
  const byNarrowing = new Set(narrowed.map(whereOf))
  for (const one of byWalk) {
    if (!byNarrowing.has(one)) out.push(`${said} the narrowing misses ${one}`)
  }
  for (const one of byNarrowing) {
    if (!byWalk.has(one)) out.push(`${said} the narrowing admits ${one}, which the walk does not`)
  }
  if (out.length > 0) return out
  for (let at = 0; at < Math.max(walked.length, narrowed.length); at++) {
    const one = walked[at]
    const other = narrowed[at]
    if (one !== undefined && other !== undefined && spelled(one) === spelled(other)) continue
    out.push(
      `${said} at position ${at} the walk says ${one === undefined ? "nothing" : spelled(one)}` +
        ` and the narrowing says ${other === undefined ? "nothing" : spelled(other)}`,
    )
    if (out.length >= ORDER_LINES) {
      out.push(`${said} ...and the rest of the order past position ${at}`)
      break
    }
  }
  return out
}

/** How many out-of-order positions are worth printing before the point is
 *  made — one shifted record diverges at every position after it. */
const ORDER_LINES = 5

const askedAs = (ask: Ask): string => {
  const corner = [
    ask.scope.file === undefined ? [] : [`file:${ask.scope.file}`],
    ask.scope.under === undefined ? [] : [`under:${ask.scope.under}`],
    ask.scope.trashed === true ? ["trashed"] : [],
  ].flat()
  return `${JSON.stringify(ask.text)}${corner.length === 0 ? "" : ` (${corner.join(" ")})`}`
}

/** A record as a reader has to be able to find it: the id, and where it is
 *  written. */
const whereOf = (one: Matched): string =>
  `${one.at.node.id} @ ${one.at.file}:${one.at.line}`

/** ...and the whole of what a position promises, the match included: the two
 *  walks run the same matcher, so a field or a score that differed would be a
 *  record admitted as a different hit and not merely in a different place. */
const spelled = (one: Matched): string =>
  `${whereOf(one)} [${one.match.field ?? "-"} ${one.match.score}]`

// ── the corpora ────────────────────────────────────────────────────────

/**
 * THE CORNERS NO GENERATOR REACHES, written by hand because most of them are
 * sets the VALIDATOR would refuse — the ground both walks explicitly promise to
 * stand on, since `ancestorsOf`'s own header says its crumbs are drawn from sets
 * the validator's error messages describe — and a generator drawing one at
 * random would only sometimes produce it.
 *
 * Every one is a shape where the descent and the ancestor walk could disagree,
 * and the comment beside it is what it is here for:
 *
 *   - A RECORD BENEATH A PLACEMENT (`t-beneath`, and one under IT). This is the
 *     trap the whole change turns on: `ancestorsOf` stops at a parent that is a
 *     mirror, so neither is under `t-root`, and a descent that walked into a
 *     placement's children would admit both. Nothing else in this fixture can
 *     catch it, because the answer it produces is plausible.
 *   - A PLACEMENT AS THE SCOPE ITSELF (`under:t-place`), which names an empty
 *     corner rather than the subtree its target has.
 *   - A PLACEMENT OF A PLACEMENT (`t-chain`), so the mirror rule is asked of a
 *     record whose own target is one.
 *   - A CHILD IN ANOTHER FILE (`t-cross`), which `parent` being same-file
 *     placement says never happens and which the two walks must still agree
 *     about — it is what makes `file:` beside `under:` a real conjunction and
 *     not a formality.
 *   - A PARENT LOOP (`t-loop-a` / `t-loop-b`), where the cycle guards at the two
 *     ends have to admit the same records.
 *   - A PARENT NOTHING CLAIMS (`t-orphan`), which is the scope root that is not
 *     there read from below.
 *   - THE ARCHIVE, a subtree of it, so a scope and the trash rule meet.
 */
export const TANGLED: Readonly<Record<string, string>> = {
  // `far.olai` sorts BEFORE `tangled.olai`, which is what makes the order half
  // of the comparison real: a descent of `t-root` reaches `t-cross` last and
  // the corpus holds it first.
  "far.olai": [
    `{"id":"t-far","ord":"a0","title":"far kitchen root"}`,
    `{"id":"t-target","parent":"t-far","ord":"a1","title":"the kitchen target","todo":true}`,
    `{"id":"t-target-child","parent":"t-target","ord":"a2","title":"kitchen under the target"}`,
    `{"id":"t-cross","parent":"t-live","ord":"a3","title":"kitchen written in another file"}`,
  ].join("\n"),
  "tangled.olai": [
    `{"id":"t-root","ord":"a0","title":"tangled kitchen root"}`,
    `{"id":"t-live","parent":"t-root","ord":"a1","title":"a live kitchen branch","todo":true}`,
    `{"id":"t-inner","parent":"t-live","ord":"a2","title":"kitchen deeper in","desc":"walnut"}`,
    `{"id":"t-place","parent":"t-root","ord":"a3","mirror":"t-target"}`,
    `{"id":"t-beneath","parent":"t-place","ord":"a4","title":"kitchen beneath a placement"}`,
    `{"id":"t-deeper","parent":"t-beneath","ord":"a5","title":"kitchen deeper beneath one"}`,
    `{"id":"t-chain","parent":"t-root","ord":"a6","mirror":"t-place"}`,
    `{"id":"t-loop-a","parent":"t-loop-b","ord":"a7","title":"kitchen in a loop, one"}`,
    `{"id":"t-loop-b","parent":"t-loop-a","ord":"a8","title":"kitchen in a loop, two"}`,
    `{"id":"t-orphan","parent":"t-nobody","ord":"a9","title":"kitchen under nothing"}`,
  ].join("\n"),
  "_olai/Trash.olai": [
    `{"id":"t-gone","ord":"a0","title":"an old kitchen plan"}`,
    `{"id":"t-gone-child","parent":"t-gone","ord":"a1","title":"kitchen, once"}`,
  ].join("\n"),
}

/**
 * A GENERATED VAULT WITH DEPTH IN IT — `./fixtures.testlib.ts`'s `vaultOf` is
 * the shape the benches measure and every file in it is a root with a flat row
 * of children under it, which is the one shape an `under:` scope cannot be
 * wrong about.
 *
 * So this one nests: a record's parent is drawn from the records already
 * written in its file, biased toward the recent ones, which gives trees a few
 * levels deep with wide and narrow branches in the same corpus. On top of that
 * it plants the two shapes that make a descent and an ancestor walk disagree,
 * at rates high enough that a hundred files hold hundreds of each — a MIRROR
 * among the children, and every so often a record written BENEATH one.
 *
 * SEEDED, so a divergence is a fixture a reader can re-run rather than a
 * lottery, and the seed is a parameter so a caller can have a second vault of
 * the same shape.
 */
export const deepVaultOf = (
  { files, records, seed = 20260824 }: {
    readonly files: number
    readonly records: number
    readonly seed?: number
  },
): ReadonlyMap<string, string> => {
  const random = seeded(seed)
  const corpus = new Map<string, string>()
  for (let at = 0; at < files; at++) {
    corpus.set(
      at % 5 === 0 ? `area${at % 7}/deep${at}.olai` : `deep${at}.olai`,
      deepFileOf(random, at, records),
    )
  }
  return corpus
}

/** One file's JSONL — a root, a tree under it, placements among the branches,
 *  and now and then a record written under a placement. */
const deepFileOf = (random: () => number, at: number, records: number): string => {
  const root = `d${at}r`
  const lines = [
    JSON.stringify({ id: root, ord: "a0", title: `deep file ${at} kitchen` }),
  ]
  /** What a new record may hang under: every REGULAR record written so far in
   *  this file. A mirror is deliberately not in it — a placement is offered as
   *  a parent by {@link beneath} alone, so the shape is generated at a rate
   *  rather than at whatever the draw happens to do. */
  const parents: Array<string> = [root]
  /** ...and the placements, which are what a record written beneath one hangs
   *  under. */
  const placed: Array<string> = []
  for (let which = 1; which < records; which++) {
    const id = `d${at}n${which}`
    // BIASED TOWARD THE RECENT, which is what makes this a tree rather than a
    // bush: drawing uniformly from every record written so far puts nearly
    // everything one level under the root once a file is more than a few rows
    // long.
    const parent = parents[
      Math.min(parents.length - 1, Math.floor(parents.length * (1 - random() * random())))
    ] as string
    if (which % 9 === 0 && at > 0) {
      // A PLACEMENT among the children, pointing into the file before this one.
      lines.push(
        JSON.stringify({ id, parent, ord: `a${which}`, mirror: `d${at - 1}n1` }),
      )
      placed.push(id)
      continue
    }
    if (which % 11 === 0 && placed.length > 0) {
      // ...and a record written BENEATH one, which is in no `under:` scope
      // above that placement however deep the descent goes.
      lines.push(
        JSON.stringify({
          id,
          parent: placed[Math.floor(random() * placed.length)] as string,
          ord: `a${which}`,
          title: `kitchen ${which} beneath a placement in file ${at}`,
        }),
      )
      parents.push(id)
      continue
    }
    lines.push(
      JSON.stringify({
        id,
        parent,
        ord: `a${which}`,
        title: `${which % 3 === 0 ? "kitchen" : "garden"} record ${which} of deep file ${at}`,
        ...(which % 4 === 0 ? { desc: `a note about walnut and the budget ${which}` } : {}),
        ...(which % 5 === 0 ? { todo: true } : {}),
        ...(which % 7 === 0
          ? { date: `2026-08-${String((which % 28) + 1).padStart(2, "0")}` }
          : {}),
      }),
    )
    parents.push(id)
  }
  return lines.join("\n")
}

// ── what to ask of a corpus ────────────────────────────────────────────

/**
 * THE ASKS, drawn off the corpus itself rather than written down beside it.
 *
 * A scope names a file or a record, and a table of them written by hand is a
 * table that stops naming anything the day a generator or a vault changes — so
 * the files are the set's own and the `under:` roots are records taken from it,
 * spread across the corpus rather than clustered at its front, with the shapes
 * that must also be asked put in beside them: a scope with both halves, a root
 * that is a placement, a root nothing claims — each of those two also WITH a
 * live file beside it, which is the half that makes an empty corner provable
 * rather than merely empty — and the archive.
 *
 * SEEDED for the same reason the corpora are, and CAPPED because the product of
 * every query with every file is a suite that takes minutes to say what a few
 * hundred asks say in a second.
 */
export const asksOver = (
  derived: Derived,
  queries: ReadonlyArray<string>,
  { files = 12, roots = 24, seed = 20260824 }: {
    readonly files?: number
    readonly roots?: number
    readonly seed?: number
  } = {},
): ReadonlyArray<Ask> => {
  const random = seeded(seed)
  const scopes: Array<Scope> = [{}]
  const paths = [...derived.byFile.keys()]
  for (const file of sampled(random, paths, files)) scopes.push({ file })
  const regular = derived.nodes.filter((at) => !isMirror(at.node))
  for (const at of sampled(random, regular, roots)) {
    scopes.push({ under: at.node.id })
    // The conjunction, with the file the root is actually written in — the
    // half that must hold everything — and with one it is not, which must hold
    // only what a cross-file child put there.
    scopes.push({ under: at.node.id, file: at.file })
  }
  // AN EMPTY CORNER, and the same empty corner WITH A LIVE FILE BESIDE IT.
  //
  // The pair is the point rather than either half. A root that is a placement
  // and a root nothing claims both name nothing, and the walk they are held to
  // arrives at that by testing every record and finding no ancestor above it —
  // so a narrowing that answered an empty `under:` by falling through to the
  // FILE branch would be wrong in exactly one shape, and only a scope naming a
  // file that really holds records can catch it. With the `under:` alone both
  // sides are empty for two different reasons and the comparison proves
  // nothing (pi's review of `5a07615`).
  const live = paths.find((file) => (derived.byFile.get(file) ?? []).length > 0)
  const placement = derived.nodes.find((at) => isMirror(at.node))
  for (
    const under of [
      ...(placement === undefined ? [] : [placement.node.id]),
      "nothing-claims-this-id",
    ]
  ) {
    scopes.push({ under })
    if (live !== undefined) scopes.push({ under, file: live })
  }
  scopes.push({ trashed: true })
  for (const file of paths) {
    if (file.includes("Trash")) scopes.push({ file, trashed: true })
  }
  return queries.flatMap((text) => scopes.map((scope) => ({ text, scope })))
}

/** `count` of them, spread across the list rather than taken off the front: a
 *  sample of the first twelve files is a sample of one corner of the corpus. */
const sampled = <T>(
  random: () => number,
  of: ReadonlyArray<T>,
  count: number,
): ReadonlyArray<T> => {
  if (of.length <= count) return of
  const stride = of.length / count
  return Array.from(
    { length: count },
    (_, at) => of[Math.min(of.length - 1, Math.floor(at * stride + random() * stride))] as T,
  )
}

// ── corpora, as readings ───────────────────────────────────────────────

/**
 * JSONL and markdown by path, DECODED — the map `assemble` takes, kept beside
 * {@link readingOfVault} because the invalidation test holds one and
 * re-assembles it with a file replaced.
 *
 * Which arm a path is on is asked of the REGISTRY and never of its spelling:
 * `./kinds.ts` is the one place that says what a file of the set is, and an
 * `endsWith` here would be a second answer to it — which the sweep in
 * `@olai/tests`' `kinds.test.ts` fails a run over.
 */
export const decodedVault = (
  vault: ReadonlyMap<string, string>,
): Map<string, Result.Result<Document, Verdict>> => {
  const decoded = new Map<string, Result.Result<Document, Verdict>>()
  for (const [file, text] of vault) {
    decoded.set(
      file,
      // A file with no BODY KIND is an outline — the one kind that holds
      // records rather than text, which is what makes it the else of this.
      bodyKind(file) === null
        ? Result.mapError(parseOutline(file, text), verdictOf)
        : Result.succeed<Document>(bodiedDocument(file, text)),
    )
  }
  return decoded
}

export const readingOfVault = (vault: ReadonlyMap<string, string>): Reading =>
  reading(assemble(decodedVault(vault)))

/**
 * THE REAL VAULT: a directory on disk, read as the set it is.
 *
 * `docs/` is this repository's own — the roadmap the item under test is written
 * in, the orchestrator's board, the inbox and the archive — and it is here
 * because a generated corpus is a corpus somebody designed. What a real one has
 * that no generator draws is history: trees people actually grew, ids people
 * actually chose, a mirror somebody placed for a reason, and an archive with a
 * hundred records in it. It also CHANGES, which is exactly why nothing asserted
 * about it may be about its contents — the differential compares two answers
 * and holds no opinion about what either says.
 *
 * WHAT IS READ is what the set holds CONTENT for, asked of the REGISTRY
 * ({@link ./kinds.ts}) rather than of a suffix written out here — an `endsWith`
 * would be a second answer to the one place that says what a file of the set is,
 * and the sweep in `@olai/tests`' `kinds.test.ts` fails a run over one. A kind
 * the set keeps only the PATH of is not read (there is no text to hand over),
 * and a file no kind claims at all is not part of the set — neither is a record,
 * and neither is in any scope.
 */
export const vaultAt = (dir: string): ReadonlyMap<string, string> => {
  const vault = new Map<string, string>()
  const walk = (at: string): void => {
    for (const entry of fs.readdirSync(path.join(dir, at), { withFileTypes: true })) {
      const file = at === "" ? entry.name : `${at}/${entry.name}`
      if (entry.isDirectory()) walk(file)
      else if (fileKind(file) !== null && !unkept(file)) {
        vault.set(file, fs.readFileSync(path.join(dir, file), "utf8"))
      }
    }
  }
  walk("")
  return vault
}
