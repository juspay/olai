/**
 * A request plus a snapshot, into the whole files that write would produce.
 *
 * PURE, and that is the design rather than a tidiness preference. Everything
 * hard about an op — where a node goes among its siblings, what a mark is
 * worth remarking on, what an archived subtree hangs off — is decided here,
 * over a value, so it can be tested without a disk and re-decided against a newer
 * snapshot when the store has moved ({@link ./ops.ts}'s retry loop). Nothing in
 * this file touches a file system, a clock or a random source: the two it needs
 * arrive as {@link Context}.
 *
 * A plan is WHOLE FILES, never a patch. Every op re-emits each outline it
 * touches from its records, through the format's own writer — so the canonical
 * field order and the one trailing newline are not something an op can get
 * wrong, and there is no seam where two records could end up glued onto one
 * line. The op decides what the records ARE; `@olai/format` decides what they
 * look like.
 *
 * What is NOT decided here: whether the resulting set validates. The write gate
 * asks the one validator that question over the set the plan would produce
 * ({@link ../../store/src/store.ts}), which is the only place that can see the
 * whole set. So this file refuses only what it can refuse WITHOUT re-validating
 * — an id nobody declares, an undo of a mark that is not there — and lets the
 * validator speak for everything else, in its own words, with `file:line`.
 */

import {
  ancestorsOf,
  ARCHIVE,
  archiveBeside,
  BATCH_AT_MOST,
  type BatchedRequest,
  bodyKind,
  BusyFailure,
  chainOf,
  countedChildren,
  type Custom,
  isArchived,
  derive,
  type Derived,
  didYouMean,
  drawingPath,
  DOCUMENT_EXT,
  fileKind,
  isMirror,
  type Located,
  type LocatedRegular,
  MARKS,
  type MirrorNode,
  type Node,
  nodeNamed,
  type Status,
  NotFoundFailure,
  canonicalRepeat,
  nextOccurrence,
  nodesOf,
  nothing,
  type OpFailure,
  ordBetween,
  OUTLINE_EXT,
  shadowFor,
  siblingsOf,
  standingBefore,
  type Reading,
  type RegularNode,
  REPEAT_GRAMMAR,
  storedMarker,
  targetsOf,
  unfinished,
  unfinishedWithin,
  withCustom,
  UsageFailure,
  ValidationFailure,
  type Capture,
  type Minted,
  NESTING,
  type WriteRequest as Request,
} from "@olai/format"
import { Result } from "effect"

import { folding } from "./following.ts"

/** One outline, as the records it will hold after the write. */
export interface FilePlan {
  readonly file: string
  readonly nodes: ReadonlyArray<Node>
}

/** One DOCUMENT, as the text it will hold after the write. Beside
 *  {@link FilePlan} rather than an arm of it, because the two go to different
 *  serialisers: an outline is records through the format's writer, and a
 *  document is its text, verbatim — there is nothing to serialise and nothing
 *  a writer could get wrong about it. */
export interface DocumentPlan {
  readonly file: string
  readonly text: string
}

export interface Plan {
  readonly files: ReadonlyArray<FilePlan>
  /** The documents this write replaces or creates, whole. Absent for every op
   *  about nodes, which is all of them but two. */
  readonly documents?: ReadonlyArray<DocumentPlan>
  /** The node the op was about, and where it lives once the write lands. */
  readonly id: string
  readonly title: string
  readonly file: string
  /** Every node a capture created, parent before child. Absent unless the op
   *  made a subtree — {@link Applied}'s own field says why. */
  readonly captured?: ReadonlyArray<Minted>
  /** The git commit subject, in the convention `olai` has always used:
   *  `capture:` / `done:` / `doing:` / `todo:` / `move:` / `archive:` /
   *  `unarchive:` / `create:` / `see:` / `after:` / `mirror:` / `unmirror:` and
   *  a title (or a path, when an outline is born empty). A placement's subject
   *  names what it SHOWS — the target's title — since a mirror has none of its
   *  own. */
  readonly summary: string
  /** What the rollup would like the writer to notice, on a write that HAPPENED
   *  ({@link nudged}). Absent unless there is something to say. */
  readonly nudge?: string
}

/** The two impure things an op needs, handed in so the planner stays a
 *  function: a fresh id, and what time it is. */
export interface Context {
  /** A candidate id. Called again if the set already holds the one it gave. */
  readonly mint: () => string
  /** The instant a `done` is stamped with, as the format's own text: a local
   *  ISO datetime carrying its offset (`@olai/format`'s `stampOf`). The other
   *  two marks store `true` and never read this. */
  readonly now: () => string
}

type Planned = Result.Result<Plan, OpFailure>

/** A record under construction. The format's structs are readonly — they
 *  describe what was READ — and every op here builds its replacement by
 *  copying one and changing a field, which is the one place that readonly is
 *  in the way rather than in the right. */
type Draft<N> = { -readonly [K in keyof N]: N[K] }

/** The set and its derivation are taken TOGETHER, as the one value the store
 *  published ({@link Reading}), rather than as a set this planner derives from:
 *  the view it plans against is the view the validator approved, so a write is
 *  judged against the same corpus the reader who asked for it was looking at,
 *  and the whole tree is not walked again per keystroke for an answer already
 *  in hand. */
export const plan = (
  at: Reading,
  context: Context,
  request: Request,
): Planned => {
  const scope = { ...at, context }

  switch (request.op) {
    case "add":
      return planAdd(scope, request)
    case "done":
    case "doing":
    case "todo":
      return planMark(scope, request)
    case "title":
      return planEdit(
        scope,
        request.id,
        (node) => ({ ...node, title: request.title }),
        (node) => `rename: ${node.title}`,
        (node) =>
          stale(
            request.was,
            node.title,
            `\`${node.title}\` is not the title this write expected to replace ` +
              `(\`${request.was}\`) — it has been retitled since, so nothing was written`,
          ),
      )
    case "desc":
      return planEdit(
        scope,
        request.id,
        (node) => withField(node, "desc", request.desc),
        (node) => `note: ${node.title}`,
        (node) =>
          stale(
            request.was,
            node.desc ?? null,
            `the note on \`${node.title}\` is not the one this write expected to ` +
              `replace — it has changed since, so nothing was written`,
          ),
      )
    case "date":
      // `date:`, not the reference implementation's `move:`. That word was
      // right there — a date WAS what `move` named — and it is wrong here:
      // beside this format's real reparenting op it reads as a structural
      // change that never happened.
      return planEdit(
        scope,
        request.id,
        (node) => withField(node, "date", request.date),
        (node) => `date: ${node.title} -> ${node.date ?? "(cleared)"}`,
      )
    case "repeat":
      // The DATE's own arm, one field along, and planned by the same function
      // for the same reason: it is one optional field with one value and no
      // condition. Nothing here judges the rule, and nothing here judges the
      // PAIR either — a `repeat` the grammar cannot read, and one with no
      // `date` under it, are both per-line rules of the format's, refused at
      // the write gate over the bytes this plan would produce (@olai/store's
      // `commit`). One rule, one wording, whichever verb moved which half.
      //
      // WHAT IT DOES DO is store the CANONICAL spelling: reading a rule is
      // forgiving (`mon`, `every monday`, `Every Week On Monday`) and writing
      // one is not, because two files meaning the same thing must not differ
      // byte for byte — a merge conflict over which way somebody spelled Monday
      // is a conflict about nothing (docs/format.md's Writing). Text the
      // grammar cannot read passes through UNCHANGED, so the refusal quotes
      // what the caller actually sent rather than something this line invented.
      return planEdit(
        scope,
        request.id,
        (node) =>
          withField(
            node,
            "repeat",
            request.repeat === null ? null : canonicalRepeat(request.repeat) ?? request.repeat,
          ),
        (node) => `repeat: ${node.title} -> ${node.repeat ?? "(cleared)"}`,
      )
    case "prop":
      return planProp(scope, request)
    case "move":
      return planMove(scope, request)
    case "split":
      return planSplit(scope, request)
    case "merge":
      return planMerge(scope, request)
    case "archive":
      return planArchive(scope, request)
    case "duplicate":
      return planDuplicate(scope, request)
    case "unarchive":
      return planUnarchive(scope, request)
    case "empty":
      return planEmpty(scope, request)
    case "create":
      return planCreate(scope, request)
    case "see":
      return planSee(scope, request)
    case "mirror":
      return planMirror(scope, request)
    case "unmirror":
      return planUnmirror(scope, request)
    case "after":
      return planAfter(scope, request)
    case "doc":
      return planWriteDocument(scope, request)
    case "create-doc":
      return planCreateDocument(scope, request)
    // The two that plan no outline of their own: both fold this same switch over
    // a run of ops ({@link folded}), which is why they can be listed here beside
    // the verbs they are made of rather than living somewhere above them.
    case "update":
      return planUpdate(scope, request)
    case "apply":
      return planApply(scope, request)
  }
}

// ── the shared middle ──────────────────────────────────────────────────

/** The reading a plan is judged against, plus the two impure things an op
 *  needs. It EXTENDS the pair rather than restating its halves: `plan` is
 *  handed a `Reading` and spreads it in, so a second spelling of those two
 *  fields is one the patcher could leave behind. */
interface Scope extends Reading {
  readonly context: Context
}

/** A field set to a value, or removed when the value is `null`. `undefined` is
 *  how the format spells absent, and the writer omits it — so this is the one
 *  place "clear the date" turns into "there is no `date` key". */
const withField = <K extends "desc" | "date" | "repeat">(
  node: RegularNode,
  field: K,
  value: string | null,
): RegularNode => {
  const next: Draft<RegularNode> = { ...node }
  if (value === null || value === "") delete next[field]
  else next[field] = value
  return next
}

/**
 * The node an op names, in a file the op may write — the prologue every
 * in-place edit shares. The two questions are never wanted apart: an op that
 * resolved a node without asking whether its file is writable would plan an
 * edit that erases the records the file did not parse into.
 */
const editable = (
  scope: Scope,
  id: string,
): Result.Result<LocatedRegular, OpFailure> => {
  const target = regularAt(scope, id)
  if (Result.isFailure(target)) return target
  const may = writable(scope, target.success.file)
  return Result.isFailure(may) ? Result.fail(may.failure) : target
}

/**
 * An id nothing in the set declares — ONE refusal, whatever the id was doing.
 *
 * The node an op is about and a target it was asked to point at fail the same
 * way and want the same help, so they are one function rather than two
 * sentences: an agent that mistyped `instal` is in the same position whether it
 * was marking that node or hanging a mirror off it.
 *
 * It teaches the way the VALIDATOR does, with the validator's own rule
 * (`@olai/format`'s `nearestId`): an unknown reference is nearly always a
 * misspelling, so the closest id within a typo's distance is offered and
 * anything further away is not, because a guess that is merely nearest teaches
 * a reader to distrust the offer. Where there is nothing close, the answer names
 * the tool that finds a node without knowing its id.
 *
 * `see` used to LIST every id in the set here. That is the right answer for the
 * OUTLINES of a directory — there are five of them — and the wrong one for the
 * nodes in it: a vault of a few thousand put its whole id space in one refusal,
 * with the one id worth reading somewhere in the middle of it.
 *
 * Exported over the DERIVATIONS rather than over a planning scope because the
 * miss is not only the planner's: `@olai/server` resolves a keystroke into a
 * request and meets the same missing id on the way there, and a person told
 * one sentence by the agent and another by the keyboard would be reading two
 * products.
 */
export const notFound = (derived: Derived, id: string): OpFailure =>
  missingId(id, derived.byId.keys())

/**
 * The same sentence over whatever ids are KNOWN — the set's, or the set's plus
 * the ones a capture is about to mint.
 *
 * Split out for exactly one caller ({@link wiring}): a capture's edges may name
 * a sibling in the same call, so an id that is a typo of one of THOSE has to be
 * offered too. A second spelling of this refusal would be a `see` target
 * corrected one way by `set_see` and another by `add_node`.
 */
const missingId = (id: string, known: Iterable<string>): OpFailure => {
  // The CLAUSE is the format's too, not just the budget behind it: a refusal
  // and a load error say "did you mean" in one voice or in two.
  const near = didYouMean(id, known)
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${id}\` is not a node in the loaded set, and nothing in it is spelled ` +
        `close enough to be a typo of it — \`search_nodes\` finds a node by title, ` +
        `id or \`#tag\``
      : `\`${id}\` is not a node in the loaded set${near}`,
    named: id,
  })
}

/** The same refusal, from inside the planner, where the derivations are one
 *  field of the scope every plan already carries. */
const unknownId = (scope: Scope, id: string): OpFailure => notFound(scope.derived, id)

/**
 * The first path from `from` to `to` through `edges`, `from` and `to` included
 * — or `null` when there is none. Cycle-safe, and `from === to` is a path of
 * one, which is what makes a self-edge a loop like any other.
 *
 * THREE ops need a loop named rather than merely detected, over three different
 * graphs: what contains what (a move under its own descendant), what drawing a
 * node leads to drawing (a mirror inside what it shows), and what has to happen
 * before what (an `after` edge closing a cycle). The graphs are the callers';
 * the walk is one.
 */
const pathTo = (
  from: string,
  to: string,
  edges: (id: string) => Iterable<string>,
): ReadonlyArray<string> | null => {
  const seen = new Set<string>()
  // The trail is extended only for a node this walk is actually descending
  // into: a revisit answers `null` without copying anything, which matters
  // because the common answer is `null` and a node reached through three
  // mirrors is reached three times.
  const walk = (at: string, trail: ReadonlyArray<string>): ReadonlyArray<string> | null => {
    if (at === to) return [...trail, at]
    if (seen.has(at)) return null
    seen.add(at)
    const path = [...trail, at]
    for (const next of edges(at)) {
      const found = walk(next, path)
      if (found !== null) return found
    }
    return null
  }
  return walk(from, [])
}

/**
 * "That id is a placement, not a node — name the node."
 *
 * Exported for the reason {@link notFound} is: a caller ABOVE this layer meets
 * the same id and owes the same sentence. `@olai/server` resolves the nodes a
 * chat message is about the same way an op resolves the node it edits, and a
 * mirror is no more describable than it is editable — two spellings of this
 * would be two answers to one question about one id.
 */
export const notANode = (id: string, target: string): OpFailure =>
  new UsageFailure({
    reason: `\`${id}\` is a mirror — a second placement of \`${target}\`, ` +
      `not a node of its own. Name \`${target}\` instead.`,
  })

/** The record with this id, or the refusal that says so. A MIRROR is not an
 *  answer: it is a second placement of a node that lives elsewhere, and every
 *  op edits the node. */
const regularAt = (scope: Scope, id: string): Result.Result<LocatedRegular, OpFailure> => {
  const located = scope.derived.byId.get(id)
  if (located === undefined) return Result.fail(unknownId(scope, id))
  if (isMirror(located.node)) {
    return Result.fail(notANode(id, located.node.mirror))
  }
  return Result.succeed(located as LocatedRegular)
}

/**
 * A file this op may write, or the refusal that says why not.
 *
 * A file the set could not READ contributes nothing to it, so re-emitting it
 * from the set would erase whatever is really in it. That has to be a refusal,
 * and it has to carry the errors — fix the file, then edit it.
 *
 * ONE rule, every kind of file, because it is one rule: an outline whose lines
 * did not parse has lost its records, and a document that could not be read has
 * lost its text, and writing either from a set that is missing it is the same
 * mistake. Only the clause differs, and which clause it is comes off the
 * format's own registry rather than a flag a caller passes — a file whose
 * content is a BODY lost its text, a file whose content is records lost those —
 * so a caller cannot ask for the wrong sentence about the file it named.
 */
const writable = (scope: Scope, file: string): Result.Result<void, OpFailure> => {
  const broken = scope.set.broken.find((entry) => entry.file === file)
  if (broken !== undefined) {
    return Result.fail(
      new ValidationFailure({
        reason: `\`${file}\` ${
          bodyKind(file) !== null
            ? "could not be read, so what it holds is not loaded — writing it would drop that."
            : "has lines that do not parse, so its records are not loaded — writing it would drop them."
        } Fix the file first.`,
        errors: broken.errors,
      }),
    )
  }
  return Result.succeed(undefined)
}

/** Where a new record lands: the outline it is written into, and the node it
 *  hangs off — absent at top level. */
interface Landing {
  readonly file: string
  readonly parent?: string | undefined
}

/**
 * Where a record a call BRINGS INTO BEING goes, and whether that file may be
 * written — the prologue `add` and `add_mirror` share.
 *
 * The two answers are one question asked twice over, and both ops have to get
 * the same one: with a `parent`, the file is the parent's, always, because
 * `parent` is same-file by the format and a `file` that disagreed would be a set
 * the validator rejects; without one, the caller names an outline the set
 * already holds, since `create_outline` is the only op that mints a file.
 */
const landsIn = (
  scope: Scope,
  request: { readonly file?: string | undefined; readonly parent?: string | undefined },
): Result.Result<Landing, OpFailure> => {
  if (request.parent !== undefined) {
    const parent = regularAt(scope, request.parent)
    if (Result.isFailure(parent)) return Result.fail(parent.failure)
    const may = writable(scope, parent.success.file)
    if (Result.isFailure(may)) return Result.fail(may.failure)
    return Result.succeed({ file: parent.success.file, parent: request.parent })
  }

  const file = request.file
  if (file === undefined) {
    return Result.fail(
      new UsageFailure({
        reason: "give `parent` (it goes under that node) or `file` (it goes at top level)",
      }),
    )
  }
  if (!scope.set.files.includes(file)) {
    return Result.fail(
      new NotFoundFailure({
        reason: `\`${file}\` is not one of the outlines under the served directory: ` +
          `${scope.set.files.join(", ") || "there are none"}`,
        named: file,
      }),
    )
  }
  const may = writable(scope, file)
  if (Result.isFailure(may)) return Result.fail(may.failure)
  return Result.succeed({ file })
}

/** An id nothing in the set claims. `mint` may repeat itself; this is what
 *  makes that harmless. */
const freshId = (scope: Scope, taken: ReadonlySet<string>): string => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = scope.context.mint()
    if (!scope.derived.byId.has(candidate) && !taken.has(candidate)) return candidate
  }
  // A mint that cannot produce an unused id in a thousand tries is broken, and
  // a plan that silently reused one would corrupt the set.
  throw new Error("could not mint an unused node id")
}

/** One file's records, in file order. */
const recordsOf = (scope: Scope, file: string): ReadonlyArray<Node> =>
  nodesOf(scope.derived, file).map((located) => located.node)

/** The same records with one replaced, matched by id. */
const replacing = (
  records: ReadonlyArray<Node>,
  id: string,
  next: Node,
): ReadonlyArray<Node> =>
  records.map((record) => (record.id === id ? next : record))

// ── siblings and where a node lands among them ─────────────────────────

interface Anchor {
  readonly before?: string | undefined
  readonly after?: string | undefined
}

/** The next key after `previous`, appending at the end of a row.
 *
 *  `ordBetween` answers `null` when nothing sorts between its two bounds, and
 *  with `null` above there is always room — so a `null` here is the ENCODING
 *  having run out, which is not a condition any caller can act on. Spelled once
 *  because four places append a key, and four copies of an impossible case is
 *  four chances to spell it differently. */
const nextOrd = (previous: string | null): string => {
  const next = ordBetween(previous, null)
  if (next === null) throw new Error("the order encoding ran out of keys")
  return next
}

/**
 * The `ord`s a row should carry once `moving` sits where `placement` says.
 *
 * The answer is usually ONE `ord` — that is the point of a fractional index,
 * and it is why an insert is a one-line diff rather than a renumbering. The
 * exception is a row whose neighbours leave no room at all
 * ({@link ordBetween} returns `null`: nothing sorts between `x` and `x0`), and
 * there the row is renumbered from scratch. Rare, bounded to one parent's
 * children, and the alternative is refusing an insert for a reason nobody can
 * act on.
 */
const placed = (
  siblings: ReadonlyArray<Located>,
  moving: string,
  placement: Anchor,
): Result.Result<ReadonlyArray<{ id: string; ord: string }>, OpFailure> => {
  if (placement.before !== undefined && placement.after !== undefined) {
    return Result.fail(
      new UsageFailure({ reason: "give `before` or `after`, not both" }),
    )
  }

  // The row as it will read, with the moving node taken out of wherever it was
  // and put back where it was asked for.
  const row = siblings.filter((located) => located.node.id !== moving)
  const anchorId = placement.before ?? placement.after
  let at = row.length
  if (anchorId !== undefined) {
    const found = row.findIndex((located) => located.node.id === anchorId)
    if (found === -1) {
      return Result.fail(
        new NotFoundFailure({
          reason: `\`${anchorId}\` is not one of the siblings this node is being placed among`,
          named: anchorId,
        }),
      )
    }
    at = placement.before !== undefined ? found : found + 1
  }

  const before = at === 0 ? null : (row[at - 1] as Located).node.ord
  const after = at === row.length ? null : (row[at] as Located).node.ord
  const gap = ordBetween(before, after)
  if (gap !== null) return Result.succeed([{ id: moving, ord: gap }])

  // No room. Renumber the whole row, the moving node included, from the first
  // key up — every neighbour keeps its position and gains a canonical `ord`.
  const order = [...row.slice(0, at), null, ...row.slice(at)]
  const renumbered: Array<{ id: string; ord: string }> = []
  let previous: string | null = null
  for (const entry of order) {
    const next = nextOrd(previous)
    renumbered.push({ id: entry === null ? moving : entry.node.id, ord: next })
    previous = next
  }
  return Result.succeed(renumbered)
}

/** The key {@link placed} gave the record being placed. It is always in there —
 *  placing something is what that function was asked to do — so a miss is a
 *  defect in this file rather than anything a caller can act on, and it is one
 *  sentence for the two ops that bring a record into being. */
const ordFor = (
  ords: ReadonlyArray<{ id: string; ord: string }>,
  id: string,
): string => {
  const ord = ords.find((entry) => entry.id === id)?.ord
  if (ord === undefined) throw new Error("the placement did not include the new record")
  return ord
}

/** Apply what {@link placed} decided to a file's records. The moving node is
 *  handed in separately because on an `add` it is not in the file yet. */
const withOrds = (
  records: ReadonlyArray<Node>,
  ords: ReadonlyArray<{ id: string; ord: string }>,
): ReadonlyArray<Node> => {
  const byId = new Map(ords.map((entry) => [entry.id, entry.ord]))
  return records.map((record) => {
    const ord = byId.get(record.id)
    return ord === undefined ? record : { ...record, ord }
  })
}

// ── add ────────────────────────────────────────────────────────────────

/**
 * Capture a node — and, when `children` are given, the whole tree under it.
 *
 * ONE plan, which is the entire point. An agent capturing an outline used to
 * issue one call per node, each riding the full write gate and each a round
 * trip; worse, a failure partway through left a half-captured subtree on disk
 * with nothing to say which half it was. A tree that is planned at once is
 * validated at once and renamed into place at once, so the outline either has
 * the whole capture in it or has never heard of it.
 *
 * The refusals are the same shape for the same reason. A chosen id that
 * collides — with the set, or with another node in this same call — refuses
 * everything, because "nothing landed" is the only answer that keeps the
 * promise. Ids are minted for the rest exactly as a single add mints one.
 *
 * `before` / `after` place the ROOT among its new siblings and nothing else:
 * the children are being born, so there is nobody there to place them among,
 * and they land in the order they were written.
 */
const planAdd = (
  scope: Scope,
  request: Extract<Request, { op: "add" }>,
): Planned => {
  const landing = landsIn(scope, request)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  const { file, parent } = landing.success

  // Every id in the tree is decided before any record is built, and the set of
  // ids this call has claimed is what makes the second collision — one child
  // against another — a refusal rather than a duplicate the validator finds.
  const into = minting()
  const root = idFor(scope, into.taken, request.id)
  if (Result.isFailure(root)) return Result.fail(root.failure)
  const id = root.success

  const ords = placed(siblingsOf(scope.derived, file, parent), id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ordFor(ords.success, id)

  // ANCHORED: this capture's root carries a placement, so its own `after` names
  // the sibling it lands after and is the caller's business rather than
  // {@link misplacedAfter}'s. Every node below it is the other case.
  const built = captured(scope, into, request, { id, parent, ord, below: NESTING }, true)
  if (Result.isFailure(built)) return Result.fail(built.failure)
  const minted = built.success

  // DOOR ONE, spelled in a capture: a tree that arrives already saying `done`
  // over a task it is bringing with it.
  //
  // AFTER {@link emit}, and that order is a REQUIREMENT rather than a
  // preference. The floor of the unrolled capture schema declares `children` as
  // anything at all — deliberately, so the planner can refuse it by name
  // (`@olai/format`'s `writing.ts`) — so a fourth level arrives typed `Capture`
  // by a cast and checked by nothing. This walk reads `mark` off every
  // descendant, so run first it would dereference that level, where a `null` is
  // a crash rather than an answer; `emit` refuses the depth before it can.
  // ({@link misplacedAfter} runs first and is the exception that shows the
  // rule: it guards the entry instead, because what it teaches is worth
  // hearing before anything else.)
  //
  // AFTER {@link wiring} is a different kind of decision and is one: nothing
  // makes it necessary — wiring resolves edges and this reads marks, and
  // neither can change the other's answer — so what the order fixes is which
  // refusal a capture that trips BOTH gets. It gets wiring's. An unknown target
  // or a loop is a fact about a name the caller typed, and can be corrected
  // where it was typed; a `done` over open work is a judgement about the shape
  // of the tree, and is the message worth arriving at second because acting on
  // it means rewriting the capture. Nothing has landed either way: a plan is
  // returned whole or not at all, so "before anything is minted" was never what
  // made a capture atomic.
  const contradicts = capturedOverOpenWork(request)
  if (contradicts !== undefined) return Result.fail(contradicts)

  // What came WITH the node the caller named. Only the commit line asks: the
  // answer says what it made whether that is one node or fifteen, and `(+0)`
  // would be a subject counting nothing.
  const under = minted.length - 1
  // DOOR TWO: the door the 2026-08-16 incident actually walked through, and
  // the flow it matters most for — somebody writing down work that has just
  // come up, under a branch somebody else called finished last week.
  //
  // It asks the REQUEST rather than the records `wiring` just produced, and
  // that stays correct for one reason worth pinning: what door two wants is
  // whether the arriving tree holds an unfinished MARK, and wiring writes only
  // `see` and `after`. The two record sets differ by edges alone.
  return Result.succeed(arriving(scope, { file, parent }, () => capturesOpenWork(request), {
    files: [
      { file, nodes: withOrds([...recordsOf(scope, file), ...minted], ords.success) },
    ],
    id,
    title: request.title,
    file,
    summary: under === 0
      ? `capture: ${request.title}`
      : `capture: ${request.title} (+${under})`,
    captured: mintedOf(minted),
  }))
}

/**
 * The marked-but-unfinished nodes a capture is bringing with it, below the one
 * given — the {@link unfinishedWithin} question asked of a tree that is not on
 * disk yet, and the reason it cannot simply be that function: nothing here has
 * an id or a parent link, so there is no derivation to walk.
 *
 * A capture's children are its own by construction — there is no placement in
 * the shape and nothing minted here is a mirror — so the rule the other walk
 * spends a line on does not arise.
 */
const capturedOpen = (capture: Capture): ReadonlyArray<Capture> => {
  const open: Array<Capture> = []
  const descend = (at: Capture): void => {
    for (const child of at.children ?? []) {
      if (unfinished(child.mark)) open.push(child)
      descend(child)
    }
  }
  descend(capture)
  return open
}

/** Whether a capture holds work that is not finished, its own mark included —
 *  what door two asks about an arriving tree, the way {@link holdsOpenWork}
 *  asks it about one that already exists. */
const capturesOpenWork = (capture: Capture): boolean =>
  unfinished(capture.mark) || capturedOpen(capture).length > 0

/**
 * DOOR ONE, over a capture: a node born `done` with an unfinished task born
 * under it in the same call.
 *
 * REFUSED rather than repaired, which is the door-one answer and not door
 * two's, because nothing here is stale: both halves of the contradiction are
 * being written in this one call, by this one caller, who can simply write it
 * differently. There is no ancestor whose mark went quietly out of date — the
 * `done` is a claim about a branch made in the same breath as the branch.
 *
 * Named by TITLE alone: the ids are minted by this same call, so there is
 * nothing yet for a reader to look up or an agent to type.
 */
const capturedOverOpenWork = (capture: Capture): OpFailure | undefined => {
  if (capture.mark === "done") {
    const open = capturedOpen(capture)
    if (open.length > 0) {
      const one = open.length === 1
      const named = capped(open, (child) => `\`${child.title}\``)
      return new UsageFailure({
        reason: `\`${capture.title}\` is captured done over ${open.length} ` +
          `unfinished ${one ? "task" : "tasks"} in the same call: ${named}. ` +
          `Done-hidden hides a done ` +
          `node WITH its subtree, so the capture would land already invisible ` +
          `— capture ${one ? "that one" : "those"} without a mark, or ` +
          `\`${capture.title}\` without the \`done\`. Nothing was written.`,
      })
    }
  }
  for (const child of capture.children ?? []) {
    const refused = capturedOverOpenWork(child)
    if (refused !== undefined) return refused
  }
  return undefined
}

/** The records a write created, as the answer names them. */
const mintedOf = (records: ReadonlyArray<RegularNode>): ReadonlyArray<Minted> =>
  records.map((record) => ({ id: record.id, title: record.title }))

/**
 * The id one new record will carry: the one it chose, or a minted one.
 *
 * "Free" has two halves and both refuse: an id the SET already holds, and one
 * another node in this same call has claimed. The second only exists because a
 * capture mints many ids at once — and it is also what a cycle attempt looks
 * like from here, since a child naming its own ancestor's chosen id is naming
 * an id that is already spoken for.
 *
 * Takes the CHOSEN id rather than the capture it came off, because a placement
 * chooses one too: a mirror is not a capture, and it needs exactly this answer.
 */
const idFor = (
  scope: Scope,
  taken: Set<string>,
  chosen: string | undefined,
): Result.Result<string, OpFailure> => {
  if (chosen === undefined) {
    const fresh = freshId(scope, taken)
    taken.add(fresh)
    return Result.succeed(fresh)
  }
  if (scope.derived.byId.has(chosen)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${chosen}\` is already the id of a node in this set`,
      }),
    )
  }
  if (taken.has(chosen)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${chosen}\` is named twice in this capture — every node needs an id of ` +
          `its own, and nothing was written`,
      }),
    )
  }
  taken.add(chosen)
  return Result.succeed(chosen)
}

/** Where a captured node lands: the three things a record needs that the
 *  capture itself does not say. One declaration, because the walk and the
 *  record builder are describing the same placement. */
interface At {
  readonly id: string
  readonly parent?: string | undefined
  readonly ord: string
}

/**
 * One captured node, as the record it will be written as.
 *
 * BOTH ops that mint a node read it — `add`'s walk, and the seed of a brand-new
 * outline — because "what a capture puts on disk" must not have two answers.
 * `create`'s seed has always been documented as minting exactly what a capture
 * mints, and that was a sentence holding two copies of the same lines together.
 *
 * A mark the capture asks for is written exactly as the op that marks an
 * existing node writes it ({@link marker}). Canonical field order is the
 * writer's business, not this object's.
 */
const capturedNode = (
  scope: Scope,
  capture: Capture,
  at: At,
): RegularNode => {
  const node: Draft<RegularNode> = {
    id: at.id,
    ...(at.parent === undefined ? {} : { parent: at.parent }),
    ord: at.ord,
    title: capture.title,
  }
  if (capture.mark !== undefined) node[capture.mark] = marker(scope, capture.mark)
  if (capture.date !== undefined) node.date = capture.date
  if (capture.desc !== undefined) node.desc = capture.desc
  // The properties, through the SAME writer one `set_prop` per key would reach
  // (`@olai/format`'s `withCustom`), so "a key holding nothing is a key the
  // file does not carry" is one rule and not a second one spelled for captures.
  // The keys were judged by {@link propKey} in {@link emit} before anything got
  // here; what is left is writing them.
  const props = Object.entries(capture.props ?? {})
  if (props.length > 0) {
    let custom: Custom = {}
    for (const [key, value] of props) custom = withCustom(custom, key.trim(), value)
    // A map with no keys left is no `custom` field rather than `{}` — the
    // format's own rule for absence (`@olai/format`'s `nothing`, which spells
    // the empty map out), asked here rather than restated, so a capture whose
    // every property was an empty string produces the record a `set_prop` of
    // the same nothing would.
    if (!nothing(custom)) node.custom = custom
  }
  // The EDGES are not written here, and that is the one asymmetry in this
  // function: `see` and `waitsOn` may name a node this same call has not minted
  // yet ({@link wiring}), so they are collected and resolved once every id in
  // the tree is known. A record built with them would be a record built against
  // half a capture.
  //
  // The two STAMPS a record coming into being carries are {@link borne}'s, for
  // both ops that mint one — the instant, and no `changed` beside it.
  return borne(scope, node)
}

/** One node's edges, held until every id in the capture is known — what
 *  {@link emit} collects and {@link wiring} resolves. Both fields on one wire
 *  rather than a wire per field: `emit` visits each node once, so a node's two
 *  lists arrive together and a `field` discriminator would only be something
 *  for the resolver to group back. */
interface Wire {
  readonly id: string
  readonly see?: ReadonlyArray<string> | undefined
  readonly after?: ReadonlyArray<string> | undefined
}

/**
 * A capture under construction: the ids it has claimed, the records it has
 * built, and the edges it still owes.
 *
 * ONE accumulator rather than three parameters threaded through a recursive
 * walk, because the three are one thing — what this call has decided so far —
 * and a walk that took them apart could be handed two of them from one capture
 * and the third from another.
 */
interface Minting {
  readonly taken: Set<string>
  readonly records: Array<RegularNode>
  readonly wires: Array<Wire>
}

const minting = (): Minting => ({ taken: new Set(), records: [], wires: [] })

/**
 * One captured node and everything under it, appended to `records` in the order
 * they will be written: parent before child, siblings as they were given. That
 * order is the outline's own reading order, which is what a file re-emitted
 * from these records should look like to a person opening it.
 *
 * Answers with the refusal that stops the WHOLE capture, or `null`. A `Result`
 * would be a value threaded through a walk whose real product is the array it
 * is filling.
 */
const emit = (
  scope: Scope,
  into: Minting,
  capture: Capture,
  /** Where this node lands, and how many further generations may hang off it. */
  at: At & { readonly below: number },
): OpFailure | null => {
  if (capture.title.trim() === "") {
    return new UsageFailure({ reason: "a node needs a title" })
  }
  // The property KEYS, judged before the record is built and in `set_prop`'s own
  // words ({@link propKey}). Here rather than at the end of the walk because a
  // shadowed key is a fact about the key alone — it needs no id resolved and no
  // sibling minted — and a refusal that arrives at the node it is about is the
  // one worth reading.
  for (const key of Object.keys(capture.props ?? {})) {
    const named = propKey(key.trim())
    if (named !== undefined) return named
  }
  into.records.push(capturedNode(scope, capture, at))
  if ((capture.see?.length ?? 0) > 0 || (capture.waitsOn?.length ?? 0) > 0) {
    into.wires.push({ id: at.id, see: capture.see, after: capture.waitsOn })
  }

  const children = capture.children ?? []
  if (children.length === 0) return null

  // The floor of the unrolled schema (`@olai/format`'s `writing.ts`'s `NESTING`). Only
  // the LENGTH of what arrived here is read — it is whatever the host sent,
  // and it is being refused rather than walked.
  if (at.below === 0) {
    return new UsageFailure({
      reason:
        `a capture nests at most ${NESTING} levels of \`children\`, and ` +
        `\`${capture.title}\` is already that deep, so nothing was written. Capture ` +
        `down to \`${capture.title}\` first — THAT answer's \`captured\` gives it an ` +
        `id — then hang the rest off it with a second \`add_node\`.`,
    })
  }

  let previous: string | null = null
  for (const child of children) {
    const ord = nextOrd(previous)
    const id = idFor(scope, into.taken, child.id)
    if (Result.isFailure(id)) return id.failure
    const refused = emit(scope, into, child, {
      id: id.success,
      parent: at.id,
      ord,
      below: at.below - 1,
    })
    if (refused !== null) return refused
    previous = ord
  }
  return null
}

/**
 * The capture's edges, once every id in it is known — `see` and `waitsOn`
 * resolved, checked and written onto the records {@link emit} built.
 *
 * **A SECOND PASS, and the reason is forward references.** A capture is a tree
 * given in reading order, and the thing a lane actually wants to say is "step
 * two waits on step one" — but also, freely, "step one is followed by step two",
 * where the target is a sibling three lines further down that has no id until
 * this same call mints one. Resolving an edge as the walk reaches it would make
 * the first legal and the second a refusal about an id that is right there in
 * the request, which is a rule nobody could hold in their head. So the ids are
 * all claimed first ({@link Minting.taken}) and the edges are answered against
 * the whole call.
 *
 * **THE REFUSALS ARE `set_see`'s AND `set_after`'s**, reached through the same
 * two functions: an unknown target is {@link missingId}, with the closest id
 * that exists — and the ids a capture is minting are among the candidates, so a
 * typo of a sibling is corrected to that sibling — and an `after` edge that
 * closes a loop is {@link closesLoop}, naming the loop with the validator's own
 * arrow. What differs is only the GRAPH the loop is looked for in: the set's
 * ordering edges plus the ones this capture is bringing, so a cycle drawn
 * entirely between nodes that do not exist yet is caught here rather than by
 * the validator, against a file nobody has written.
 */
/**
 * A capture, as the records it becomes — the two passes, in the one order they
 * may be run.
 *
 * BOTH ops that mint a tree call this and neither spells the sequence for
 * itself: `add`'s capture, and the seed of a brand-new outline. The order is
 * load-bearing rather than incidental (ids claimed, THEN edges resolved,
 * {@link wiring}), so a caller free to write it down is a caller free to write
 * it down differently — and there were two of them before this existed.
 */
const captured = (
  scope: Scope,
  into: Minting,
  capture: Capture,
  at: At & { readonly below: number },
  /** Whether the ROOT of this capture has a placement anchor — true for
   *  `add_node`, whose `after` at the top level names the sibling it lands
   *  after, and false for a seed, whose file has no other rows to land among.
   *  It decides one thing only: whether the root's own `after` is a word this
   *  call means or {@link misplacedAfter}'s footgun. */
  anchored: boolean,
): Result.Result<ReadonlyArray<RegularNode>, OpFailure> => {
  const bent = misplacedAfter(capture, anchored, at.below)
  if (bent !== undefined) return Result.fail(bent)
  const refused = emit(scope, into, capture, at)
  return refused !== null ? Result.fail(refused) : wiring(scope, into)
}

/**
 * `after` written where it means nothing — the bend {@link Capture}'s `waitsOn`
 * pays for, caught rather than dropped.
 *
 * A capture spells its ordering edges `waitsOn`, because at `add_node`'s top
 * level `after` is the placement anchor. Below that level `after` is not a
 * field at all, and an Effect struct DROPS a key it does not declare — so an
 * agent that has read `set_after`, or that is looking at the anchor one line
 * up, writes `after` on a child, loses the whole dependency and is told the
 * capture succeeded. A silent half-write is the one outcome this layer refuses
 * outright, so the schema declares the key ({@link Capture}'s `after`) purely
 * to make it REFUSABLE, and this is where it is refused: by name, pointing at
 * the word that works.
 *
 * WALKED FIRST, before anything is minted, for what it teaches: an agent that
 * misspelled the edge field wants to hear THAT, not a refusal about an id it
 * named somewhere else. Going first is what makes the DEPTH BOUND below part of
 * this function rather than a nicety — the door-one walk can descend blindly
 * because `emit` has already refused a fourth level by the time it runs, and
 * this one cannot. Below {@link NESTING} the schema validated nothing
 * ({@link ../../format/src/writing.ts}'s `childrenOf`, whose floor accepts an
 * array of anything at all), so a node down there is raw JSON: its `children`
 * may be a number, and `for…of` over a number throws where a refusal belongs.
 * The walk therefore stops exactly where the schema stopped, and `emit` refuses
 * the depth a moment later in its own words.
 */
const misplacedAfter = (
  capture: Capture,
  anchored: boolean,
  /** How many further generations the SCHEMA vouched for. */
  below: number,
): OpFailure | undefined => {
  if (!anchored && capture.after !== undefined) {
    return new UsageFailure({
      reason: `\`${capture.title}\` carries \`after\`, which is not what a captured node ` +
        `says about its edges — write \`waitsOn\` instead, with the same ids. ` +
        `\`after\` at the top of a capture names the SIBLING the node is placed ` +
        `after, so a node further down has no use for the word and this one was ` +
        `about to be dropped. Nothing was written.`,
    })
  }
  // The floor of what the schema checked. Everything the walk has touched so
  // far is a decoded node; one level further is not, and is `emit`'s to refuse.
  if (below === 0) return undefined
  for (const child of capture.children ?? []) {
    const bent = misplacedAfter(child, false, below - 1)
    if (bent !== undefined) return bent
  }
  return undefined
}

const wiring = (
  scope: Scope,
  into: Minting,
): Result.Result<ReadonlyArray<RegularNode>, OpFailure> => {
  if (into.wires.length === 0) return Result.succeed(into.records)

  /** Is this a target this call may name at all — a node the set holds, or one
   *  this call is minting? Asked directly of the two maps rather than of a
   *  union of their keys: a corpus-sized copy per capture, to answer a handful
   *  of lookups, is the walk this codebase spends its per-write budget
   *  avoiding. What the REFUSAL needs is the ids as an iterable, and that is
   *  built only on the path that refuses ({@link candidates}). */
  const has = (target: string): boolean =>
    into.taken.has(target) || scope.derived.byId.has(target)
  /** Every id a did-you-mean may offer, the minted ones included — so a typo of
   *  a sibling this call is bringing into being is corrected to that sibling,
   *  which the set's own ids could never have offered. */
  const candidates = function*(): Iterable<string> {
    yield* scope.derived.byId.keys()
    yield* into.taken
  }
  /** A target as the ORDERING GRAPH knows it — a node being born stands for
   *  itself, since there is nothing to resolve it through. */
  const graphed = (target: string): string =>
    into.taken.has(target) ? target : standingAt(scope, target)

  // The edges as they will read once this capture lands, per node, deduped in
  // the order they were written — `@olai/format`'s own rule that a target named
  // twice is named once, which `set_see` and `set_after` keep by never
  // appending an id the list already holds. A `Set` keeps insertion order, so
  // the dedupe is the rule and not a reordering of it.
  const born = new Map<string, Wire>()
  for (const wire of into.wires) {
    for (const target of [...(wire.see ?? []), ...(wire.after ?? [])]) {
      if (!has(target)) return Result.fail(missingId(target, candidates()))
    }
    born.set(wire.id, {
      id: wire.id,
      ...(wire.see === undefined ? {} : { see: [...new Set(wire.see)] }),
      ...(wire.after === undefined ? {} : { after: [...new Set(wire.after)] }),
    })
  }

  // Only NOW is the loop question askable: an edge from a node being born to a
  // sibling being born is a link in a chain neither end of which the derivation
  // has heard of, so the walk reads both maps.
  const edges = (id: string): Iterable<string> => [
    ...(scope.derived.after.get(id) ?? []),
    ...(born.get(id)?.after ?? []).map(graphed),
  ]
  for (const wire of born.values()) {
    for (const target of wire.after ?? []) {
      const refused = closesLoop(edges, wire.id, target, graphed(target))
      if (refused !== null) return Result.fail(refused)
    }
  }

  return Result.succeed(into.records.map((record) => {
    const wired = born.get(record.id)
    if (wired === undefined) return record
    const next: Draft<RegularNode> = { ...record }
    if (wired.see !== undefined) next.see = wired.see
    if (wired.after !== undefined) next.after = wired.after
    return next
  }))
}

// ── the marks ──────────────────────────────────────────────────────────

/** The commit subject for taking a mark OFF, one per mark — racket's wording
 *  for the two it had, and the same shape for the third. A table rather than a
 *  conditional, so a fourth mark is a missing key and not a silent default. */
const UNMARKED = {
  done: "undone",
  doing: "not-doing",
  todo: "not-todo",
} as const satisfies Record<Status, string>

/**
 * What a mark is WORTH on disk.
 *
 * ONLY `done` IS STAMPED, and it is stamped with the INSTANT it was made rather
 * than the day: finishing something happens AT a moment, "some time on Tuesday"
 * is the answer to a question nobody asked, and the day view reads the day off
 * the front of the value either way (`@olai/format`'s `dayOf`), so the time
 * costs a reader nothing and orders a day's finished work.
 *
 * `doing` and `todo` store `true` (resolved 2026-08-11, human). The symmetry
 * argument — three answers to one question, written by one op — loses to what a
 * date on a mark now MEANS: it puts the node on that day (docs/format.md's
 * Days). A stamped `todo` would file everything on the day it was captured, so
 * a day page would fill up with work that was written down then rather than
 * done then, and `/today` would drift into a capture log. Finishing is the
 * event a journal is about; filing is not, and neither is starting. Nothing is
 * lost for a person who wants one: `set_date` schedules, and a hand-written
 * date on any mark still reads (the format takes all three).
 *
 * One function because two ops ask: marking a node that exists, and capturing
 * one that arrives already marked. Two spellings would be two answers to "what
 * does a mark store", and the second one would be the one nobody remembers to
 * change.
 */
const marker = (scope: Scope, mark: Status): string | true =>
  mark === "done" ? scope.context.now() : true

/**
 * A record about to be written, stamped `changed` — the one place a write says
 * when it happened.
 *
 * EVERY WRITE THAT REWRITES A NODE goes through here, and that is the whole of
 * the rule: there is no verb for `changed`, no request carries one, and no
 * caller decides. A person or an agent asks for a title, a mark, a date, an
 * edge or a property, and the stamp rides along, exactly as `done` has always
 * carried its instant.
 *
 * WHAT IT IS NOT APPLIED TO, and each is a decision rather than an omission:
 *
 *   - a MIRROR, which has neither field. A placement is a location, not a node;
 *     what changed when one moves is where a node is drawn, and the node itself
 *     did not hear about it;
 *   - ARCHIVING and unarchiving, which move a subtree between files without
 *     asking anything about its content. `archive_node` already promises that
 *     "nothing is stamped: archiving is not finishing", and re-stamping every
 *     node under a branch because somebody put the branch away would fill a
 *     whole subtree's worth of `changed` with one gesture that changed nothing
 *     anybody wrote.
 */
const touched = <N extends Node>(scope: Scope, node: N): N =>
  isMirror(node) ? node : { ...node, changed: scope.context.now() }

/**
 * A record COMING INTO BEING, stamped — {@link touched}'s twin, and the other
 * half of the one rule the two of them make: the ops layer puts `created` on a
 * node when it is captured and re-puts `changed` on it whenever it is written
 * afterwards. There is no verb for either, and `set_prop` refuses both by name.
 *
 * TWO OPS MINT A NODE and the rule has to be one sentence for both: a CAPTURE
 * builds a record out of a request ({@link capturedNode}), and a DUPLICATE
 * builds one out of a record that already exists ({@link planDuplicate}). Only
 * the second can arrive carrying a `changed`, and that is exactly why the
 * dropping is here rather than at the one call site that needs it: `changed`
 * absent beside a `created` means "nothing has been written to this since it
 * was captured", and a copy that kept the original's would be claiming somebody
 * had written to it before it existed.
 *
 * It takes a REGULAR node rather than any record, where `touched` takes either.
 * That is not an inconsistency: a mirror can be rewritten (its `ord` moves), so
 * the rewriting stamp has to answer for one; nothing mints a placement out of
 * another record, and the two callers have both narrowed by the time they are
 * here.
 */
const borne = (scope: Scope, node: RegularNode): RegularNode => {
  const next: Draft<RegularNode> = { ...node, created: scope.context.now() }
  delete next.changed
  return next
}

const planMark = (
  scope: Scope,
  request: Extract<Request, { op: Status }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const mark = request.op
  const undo = request.undo === true

  const stored = storedMarker(node)
  if (undo && stored !== mark) {
    return Result.fail(
      new UsageFailure({ reason: `\`${node.title}\` is not marked ${mark}` }),
    )
  }
  if (!undo && stored === mark) {
    return Result.fail(
      new UsageFailure({ reason: `\`${node.title}\` is already ${mark}` }),
    )
  }
  // Any mark that is not `done`, over a node that IS done, walks finished work
  // backwards. `doing` and `todo` both do it, and neither may do it quietly.
  if (!undo && mark !== "done" && stored === "done") {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${node.title}\` is done. Undo that first — nothing should decide on your ` +
          `behalf that finished work is not finished.`,
      }),
    )
  }
  // THE ONE VERB THE ORDER IS A LAW FOR — the mark above walks finished work
  // backwards and is refused for all three, this one is refused for `doing`
  // alone. Starting is an instruction about what to pick up next; finishing is
  // a report about what happened, and reports are not gated. {@link heldUp}
  // carries the argument, and sits beside the nudge that is its other half.
  if (!undo && mark === "doing") {
    const held = heldUp(scope, node)
    if (held !== undefined) return Result.fail(held)
  }

  // DOOR ONE ({@link sweepingOpenWork}): a `done` may not be written over
  // unfinished work in the branch below it.
  if (!undo && mark === "done") {
    const sweeping = sweepingOpenWork(scope, file, node)
    if (sweeping !== undefined) return Result.fail(sweeping)
  }

  // Setting one mark CLEARS the others: a node carrying two is a record the
  // format rejects, so this is not tidiness — it is what makes the write valid.
  const next: Draft<RegularNode> = { ...node }
  for (const other of MARKS) delete next[other]
  // Only the node being marked is touched — every other record in the file is
  // re-emitted exactly as it was read, so a `true` or a day-only value
  // elsewhere stays the text it was.
  if (!undo) next[mark] = marker(scope, mark)

  // WHAT COMES BACK ({@link recurring}): a `done` on a node that repeats hands
  // the rule to the occurrence it spawns, so `next` above stops carrying one.
  // `undefined` is every other write, which is nearly every write.
  const again = recurring(scope, file, node, mark, undo)
  if (again !== undefined) delete next.repeat

  const summary = undo
    ? `${UNMARKED[mark]}: ${node.title}`
    : again === undefined
    ? `${mark}: ${node.title}`
    : `${mark}: ${node.title} (next: ${again.spawned.date})`

  // The rollup's remark is suppressed by a spawn, and that is the whole of why
  // it is asked here rather than inside {@link nudged}: that function reads the
  // snapshot, which cannot see a record this write is about to bring into
  // being, so "every task under `chores` is done now" would be a sentence made
  // untrue by the very same write. What is said instead is {@link recurring}'s
  // own news, which is the thing a reader of this write actually wants.
  const said = again === undefined
    ? nudged(scope, node, mark, undo)
    : `\`${node.title}\` repeats ${node.repeat} — the next one is on ${again.spawned.date}.`

  const records = replacing(recordsOf(scope, file), node.id, touched(scope, next))

  // DOOR TWO ({@link arriving}): this write is what MAKES the node unfinished
  // work, so it is an arrival under whatever stands above it. The node's own
  // parent chain, never its own mark — a node is not above itself.
  //
  // A SPAWN IS AN ARRIVAL TOO, and it is the one way a `done` can be one: the
  // occurrence it brings into being is born `todo`, which is open work landing
  // under whatever stands over the node that was just finished. Left out, a
  // finished branch would go on hiding the next occurrence of everything under
  // it (docs/format.md's Status, door two).
  return Result.succeed(arriving(
    scope,
    { file, parent: node.parent },
    () => !undo && (mark !== "done" || again !== undefined),
    {
      files: [{
        file,
        nodes: again === undefined
          ? records
          : withOrds([...records, again.spawned], again.ords),
      }],
      id: node.id,
      title: node.title,
      file,
      summary,
      ...(again === undefined ? {} : { captured: mintedOf([again.spawned]) }),
      ...(said === undefined ? {} : { nudge: said }),
    },
  ))
}

/**
 * What a `done` on a repeating node produces: the occurrence that comes next,
 * and the `ord`s its placement decided.
 *
 * EVERY FIELD REQUIRED, and the absence is the whole value ({@link recurring}
 * answers `undefined`) — which is the difference between a shape that can be
 * half-true and one that cannot. Three optional fields was a product whose
 * arms were held apart by reading order, so every reader had to test the one
 * field that grounds the others and trust itself to test the right one. One
 * `undefined` is one question, asked once at the top of the caller.
 *
 * THE DAY IT LANDED ON IS THE RECORD'S, and `spawned` says so in its type
 * rather than in a second field beside it: `RegularNode` spells `date`
 * optional, which is true of records in general and never of this one, so the
 * narrowing is what lets three readers say `spawned.date` and get a `string`.
 * A `next` field carrying the same value was one more thing to keep in step
 * with the record two lines above it.
 */
interface Recurrence {
  readonly spawned: RegularNode & { readonly date: string }
  readonly ords: ReadonlyArray<{ id: string; ord: string }>
}

/**
 * THE SPAWN, and the one place in this system that decides it.
 *
 * It sits in the planner rather than at either door for the reason every other
 * policy here does: the browser's `Complete` and an agent's `set_done` are the
 * same request, planned by the same function, so "finishing a repeating node
 * makes the next one" is a fact about the OP and not a behaviour two surfaces
 * agreed to implement. A web-side spawn would be a rule MCP does not have, and
 * an MCP-side one a rule the keyboard does not have; there is nowhere else both
 * can be true at once.
 *
 * THE NEW NODE IS FRESH, which is the roadmap's word and the design: the
 * completed record keeps its `done` instant and its own date, so the journal
 * shows what was finished on the day it was finished, and the occurrence that
 * is owed is a different node on a different day. Rewriting the one record's
 * date forward would be a task that has been finished eleven times and can
 * prove none of them.
 *
 * WHAT IT CARRIES is the intent and nothing else — title, note, the rule, the
 * next date. What it deliberately does NOT carry, each because it names
 * something particular to the occurrence that just ended: the edges (`after`
 * naming tasks that are already done would be a new task born blocked on
 * history), the children (a subtree is where that occurrence's work was
 * recorded), the document (`doc` is a path, and two nodes naming one file would
 * both be editing the same text), and the properties (a `pr` or a `stage` is a
 * fact about the occurrence that carried it). A person who wants any of them
 * forward puts it there; nothing here guesses.
 *
 * IT IS BORN `todo`, because it is work that has not started — and because an
 * unmarked occurrence could never be overdue (`@olai/format`'s `isOverdue`
 * reads a mark), so a recurring chore that spawned a bullet would be a thing
 * that silently stopped being owed.
 *
 * THE RULE MOVES WITH IT, and that single decision is what makes the churn
 * edge unrepresentable rather than policed: un-doing the `done` leaves a node
 * with no rule, so re-doing it spawns nothing, and there is no "have I already
 * spawned this?" flag for anybody to keep. What un-doing does NOT do is take
 * the spawned occurrence away — the write that made it was a write, and a
 * recurrence with one live head is exactly what the set then has
 * (docs/format.md's Days).
 */
const recurring = (
  scope: Scope,
  file: string,
  node: RegularNode,
  mark: Status,
  undo: boolean,
): Recurrence | undefined => {
  if (undo || mark !== "done" || node.repeat === undefined) return undefined
  // THE RULE IS ALREADY KNOWN GOOD, and that is `@olai/format`'s doing rather
  // than a check skipped here: a `repeat` this grammar cannot read, or one
  // with no `date` to repeat from, is a `bad-repeat` per line — so the file
  // never parsed, its records are not in the set, and {@link writable} has
  // already refused to write it. Both readings go through the same
  // `parseRepeat`, so they cannot come to disagree.
  //
  // A throw, then, for {@link ordFor}'s reason and in its shape: this is a
  // defect in this codebase rather than anything a caller can act on, and the
  // alternative — spawning nothing, quietly — is a recurrence that stops
  // without saying so.
  const nextDate = node.date === undefined
    ? undefined
    : nextOccurrence(node.repeat, node.date)
  if (nextDate === undefined) {
    throw new Error(
      `\`${node.repeat}\` reached the planner without a next date, which the format's ` +
        `per-line rule makes unreachable: a repeat is ${REPEAT_GRAMMAR}, with a \`date\``,
    )
  }

  const id = freshId(scope, new Set())
  const ords = placed(siblingsOf(scope.derived, file, node.parent), id, { after: node.id })
  // {@link placed} refuses only an anchor that is not among the siblings, and
  // the anchor here is the node those siblings were read from — so this is the
  // same unreachable defect the throw above names, thrown for the same reason.
  if (Result.isFailure(ords)) {
    throw new Error(
      `the occurrence after \`${node.title}\` could not be placed beside it: ` +
        ords.failure.message,
    )
  }
  // A NODE COMING INTO BEING, built by the one function that says what that
  // looks like ({@link capturedNode}) — which is what the answer already calls
  // this record, since it reports it in `captured`. Everything a born node
  // carries is that function's: the `created` stamp with no `changed` beside
  // it, and a mark spelled the way {@link marker} spells one. Written out here,
  // the third mint site would know both of those rules independently.
  //
  // `repeat` is spread on after it, and it is the one field that has to be: a
  // capture cannot carry a rule (nothing captures one — a rule arrives by
  // travelling from the occurrence before it), so there is no `Capture` field
  // for it and inventing one would be a door `add_node` would then advertise.
  const spawned: RegularNode & { readonly date: string } = {
    ...capturedNode(scope, {
      title: node.title,
      mark: "todo",
      date: nextDate,
      ...(node.desc === undefined ? {} : { desc: node.desc }),
    }, { id, parent: node.parent, ord: ordFor(ords.success, id) }),
    date: nextDate,
    repeat: node.repeat,
  }
  return { spawned, ords: ords.success }
}

/**
 * What is standing in this node's way, as the refusal that will not let it
 * START — or `undefined`, which is nearly every node.
 *
 * THE ASYMMETRY BETWEEN THE TWO VERBS IS THE WHOLE DESIGN, and this function
 * and {@link nudged} below are the two halves of it, deliberately adjacent so
 * the divergence is one thing to read rather than two rules in two files:
 *
 *   - **`set_done` allows and remarks.** Finishing out of order is sometimes
 *     TRUE — the world outruns the plan, somebody did the thing, and a tool
 *     that refuses to record what happened is a tool that gets lied to. So the
 *     rollup says what it noticed and the write lands.
 *   - **`set_doing` refuses.** Starting is not a report about the world, it is
 *     an INSTRUCTION about what to pick up next, and `a after b` is the set's
 *     own statement that b comes first. A machine told to start what the DAG
 *     forbids has been told to do the impossible, and the honest answer is to
 *     say so before the write rather than to draw the row dim afterwards. The
 *     app has drawn blockedness since edges-ui and nothing REFUSED it; that
 *     gap is what this closes.
 *   - **`set_todo` is not here at all.** Filing work is not starting it, and
 *     un-starting needs no gate — a node put back on the pile is a node that
 *     stopped claiming to be in progress, which is exactly what a blocked node
 *     should be doing.
 *
 * THE BLOCKED DERIVATION IS THE ONE SOURCE OF TRUTH, read and not respelled
 * (`@olai/format`'s `standingBefore`, which is `blockage`'s own predicate over
 * `blockage`'s own normalised graph). That is what buys the three rules nobody
 * would remember to write here: a plain BULLET target blocks nothing (it is
 * not work, so there is nothing under it to finish), a DONE target blocks
 * nothing, and an ARCHIVED one blocks nothing either. A second spelling of "is
 * this in the way" would be a row the app draws ready and the op refuses, or
 * worse the other way round.
 *
 * IT IS `standingBefore` AND NOT `blockersOf`, and that is the one subtle line
 * here. `blockersOf` answers what a node IS waiting on, which is empty for a
 * plain bullet — a bullet is not work, so nothing is telling it it cannot
 * start, and that is right for every DRAWING of blockedness. But this write is
 * about to make the node work. Asking the drawn reading would let `set_doing`
 * on an unmarked node walk straight past the gate its own `after` edges
 * declare, land `doing`, and be drawn blocked a frame later — the exact state
 * this refusal exists to make unreachable. So the question asked is the one the
 * write is about: what do this node's `after` targets hold up.
 *
 * NAMING WHAT IS IN THE WAY, in both vocabularies: the TITLE, because that is
 * what the person reading the refusal recognises, and the ID, because that is
 * what the agent reading it must type into the next call. The mark travels too
 * — it rides on the `InTheWay` the derivation already hands over, and
 * "waiting on something somebody is doing" and "waiting on something nobody
 * has picked up" are different positions to be in.
 *
 * NOT A CAPTURE, which may be born `doing` with `waitsOn` naming an unfinished
 * task and is not refused. The rule this is an instance of is the one below: a
 * gate on STARTING is a gate on the instruction, never on the pair of facts. A
 * capture states both at once, by a caller that knows both, which is the
 * discovery — the same thing `set_doing` followed by `set_after` states in two
 * calls and is refused nowhere. What is refused is being told to start
 * something the set ALREADY says cannot start, and a node that does not exist
 * yet has no already. The row lands, drawn blocked, saying what it waits for.
 *
 * NOT SOFTENED BY `apply`, and by construction rather than by a rule of its
 * own: a batch plans each op against what the ops before it left, so
 * `[set_after, set_doing]` meets this gate exactly as those two calls do.
 *
 * NOT `set_after` EITHER, and that one is a choice. Wiring an edge onto a node
 * that is already `doing` leaves a started row waiting on something, and that
 * is a true thing to record: "I picked this up and have just realised it needs
 * X first" is how anybody finds out. The row goes dim and says what it is
 * waiting for, which is what the drawing has always been for. What is refused
 * is the INSTRUCTION to start — the moment a machine is told to do the
 * impossible — not the discovery that the order was other than you thought.
 */
const heldUp = (scope: Scope, node: RegularNode): OpFailure | undefined => {
  const waiting = standingBefore(scope.derived, node.id)
  if (waiting.length === 0) return undefined

  const named = waiting
    .map((one) => `\`${one.at.node.title}\` (\`${one.at.node.id}\`, ${one.status})`)
    .join(", ")
  const one = waiting.length === 1
  return new UsageFailure({
    reason: `\`${node.title}\` comes after ${waiting.length} unfinished ` +
      `${one ? "task" : "tasks"}, so it cannot start yet: ${named}. ` +
      `Finish ${one ? "that" : "those"} first — or start what is ready.`,
  })
}

/**
 * What the rollup has to say about a `done` that has just been written — and
 * it is a REMARK, never a refusal.
 *
 * ONE THING IS LEFT TO NOTICE, and it is the one worth noticing: the last
 * unfinished task under a parent going done, which is the moment somebody
 * might want to tick the parent too — and now can, whatever else hangs off it.
 *
 * IT USED TO HAVE A SECOND ARM, and knowing which one it was is the whole
 * history of this file's two gates: a branch ticked done over tasks nobody
 * finished, said out loud and allowed, on the reading that "shipped, dropping
 * the rest" is sometimes exactly what was meant. The human's 2026-08-16 ruling
 * is that it must be a constraint instead, because what it was permitting was
 * work vanishing off the page. That sentence is now {@link sweepingOpenWork}'s
 * refusal, turned around — this function does not say it, because the write
 * that would have earned it no longer lands.
 *
 * So the asymmetry one function up ({@link heldUp}) reads differently than it
 * did: the finishing verb is still ungated by the ORDER, and remarks about it;
 * what it is gated by is the branch below it, which is a different question
 * about a different set of edges.
 *
 * Deliberately not a load invariant, and neither is either gate. A set arrives
 * from a git merge with nobody to nudge and nobody to refuse, and a file that
 * will not load is a worse answer to "these two disagree" than a file that
 * loads and says so.
 */
const nudged = (
  scope: Scope,
  node: RegularNode,
  mark: Status,
  undo: boolean,
): string | undefined => {
  if (undo || mark !== "done") return undefined

  // The parent as it reads AFTER this write. The snapshot still calls the node
  // being marked unfinished, so "nothing else is open" is what is asked —
  // waiting for the write to land would be waiting for the moment to pass.
  //
  // The BRANCH under the parent, not its children, for the same reason
  // {@link sweepingOpenWork} asks the deep question: a suggestion to mark a
  // node done that the very next call would refuse is worse than no suggestion
  // at all. The node being marked has nothing open under it — door one is what
  // makes that true — so it is the only thing this has to look past.
  const above = node.parent === undefined
    ? undefined
    : scope.derived.byId.get(node.parent)?.node
  return above !== undefined && !isMirror(above) && storedMarker(above) !== "done" &&
      unfinishedWithin(scope.derived, above.id).every((task) => task.node.id === node.id)
    ? `every task under \`${above.title}\` is done now — mark it done too if ` +
      `the branch is finished.`
    : undefined
}

// ── done must not come to stand over open work ─────────────────────────

/** How many unfinished tasks a refusal NAMES before it starts counting them
 *  instead, for the reason {@link notFound} does not list every id in the set:
 *  a refusal holding two hundred titles has buried the one that would have
 *  been read. */
const NAMED_AT_MOST = 5

/** That list, written out: the first {@link NAMED_AT_MOST} named however the
 *  caller names them, then how many it did not name. Two refusals spend this
 *  cap — the same door, once over a set on disk and once over a capture — and
 *  a cap that drifted between them would be two policies about one sentence. */
const capped = <T>(all: ReadonlyArray<T>, name: (one: T) => string): string =>
  all.slice(0, NAMED_AT_MOST).map(name).join(", ") +
  (all.length > NAMED_AT_MOST ? `, and ${all.length - NAMED_AT_MOST} more` : "")

/**
 * DOOR ONE: what stands in the way of calling a branch finished — or
 * `undefined`, which is nearly every node.
 *
 * THE TWO DOORS, and why they are answered differently. This function is one
 * of them and {@link arriving} is the other, and the argument is here because
 * it is one argument: they are the two ways into one state, exactly as
 * {@link heldUp} and {@link nudged} are the two halves of one asymmetry.
 *
 * The state being made unreachable is one state: a node storing `done` with
 * unfinished tasks anywhere in the branch below it. Done-hiding drops a done
 * row WITH its subtree — deliberately, since a mark on a parent is a claim
 * about the whole branch (docs/format.md's Status) — so that state is work
 * that has vanished from the view whose whole job is showing what is left.
 *
 * It used to be reachable two ways, and the incident of 2026-08-16 walked
 * through the second:
 *
 *   - **the done comes to the work.** `set_done` over a branch holding open
 *     tasks. This was allowed-with-a-nudge, and the nudge is now the refusal's
 *     own sentence ({@link sweepingOpenWork}).
 *   - **the work comes to the done.** A task arriving under an ancestor that
 *     was marked done when the branch really was finished — a capture, a
 *     `set_todo`, a move, a merge, a return from the archive. Nobody marked
 *     anything over anything; the ancestor's mark simply went stale, five days
 *     of new children at a time ({@link arriving}).
 *
 * ONE DOOR REFUSES AND THE OTHER REPAIRS, which is the same asymmetry
 * {@link heldUp} draws between finishing and starting, read at a different
 * angle. `set_done` is a CLAIM about the branch, made now, by somebody looking
 * at it: "this is finished" while three tasks under it are not is a claim that
 * is false as it is made, the person is right there, and the refusal names
 * what to do about it. An arriving task makes no claim about anything above
 * it — a person capturing work into a branch is not commenting on the mark
 * three levels up, and very often does not know it is there. Refusing them
 * would be a capture flow that says no because of somebody else's stale
 * sentence, and the price of that is not a fixed outline; it is work that
 * never gets written down. So the ancestor's `done` comes OFF, because the
 * arriving task is the newer and truer fact about the branch, and the answer
 * says so out loud.
 *
 * NEITHER IS A LOAD INVARIANT, and that has not changed. A git merge can put a
 * mark in one branch and a task under it in another and merge both cleanly; a
 * set that arrives that way must still load, must still be readable, and must
 * still be fixable — which is exactly what these two gates do to it the moment
 * anybody writes. The format has nothing to say about a mark and the children
 * under it (docs/format.md's Validation), and gains nothing to say here.
 *
 * ARCHIVED WORK IS EXEMPT AT BOTH DOORS, as everywhere else: a subtree put
 * away in an `Archive.olai` is over, so nothing in it is open work and nothing
 * in it hides any. It is one question — is the file this happens in an archive
 * — asked once per door, because `parent` is same-file by the format and a
 * node's whole ancestry therefore lives where the node does.
 *
 * A MIRROR IS NOT CONTAINMENT, at either door, and that is one rule read from
 * both ends. `unfinishedWithin` never counts a placement and never walks into
 * one, so a mirror of open work under a branch does not stop that branch being
 * marked done; and the chain this walks upward is the canonical `parent` one,
 * so a task DRAWN under a done node through a placement is not under it. Both
 * follow from the format's own sentence — a mirror is a second view of a node,
 * not a second obligation (`@olai/format`'s `derive.ts`) — and the reason it is
 * the right sentence here is that hiding a placement hides no work: the node
 * itself keeps its own row, wherever it really lives. `add_mirror` is
 * therefore not gated at all, which is only consistent.
 *
 * ── AND THIS DOOR IN PARTICULAR ──
 *
 * The sentence is the nudge this replaces, turned around. It was policy —
 * "sometimes exactly what was meant" — and the human's 2026-08-16 ruling is
 * that it must be a constraint instead, because the thing it was permitting is
 * work disappearing from the view that exists to show what is left. What is
 * lost with it is the gesture "shipped, dropping the rest" in ONE call; what
 * replaces it is two, and the refusal names every node the second one is
 * about. A person who really means it clears those marks — which is a truer
 * record of "not happening" than a `done` two levels up that nobody can see
 * from the row.
 *
 * NAMED IN BOTH VOCABULARIES, exactly as {@link heldUp} names blockers: the
 * TITLE for the person reading it, the ID for the agent that has to type it
 * into the next call, and the mark each one carries — capped at
 * {@link NAMED_AT_MOST}.
 */
const sweepingOpenWork = (
  scope: Scope,
  file: string,
  node: RegularNode,
): OpFailure | undefined => {
  if (isArchived(file)) return undefined
  const open = unfinishedWithin(scope.derived, node.id)
  if (open.length === 0) return undefined

  const one = open.length === 1
  const named = capped(open, (task) => {
    const mark = scope.derived.status.get(task.node.id)
    return `\`${task.node.title}\` (\`${task.node.id}\`, ${mark})`
  })
  return new UsageFailure({
    reason: `\`${node.title}\` holds ${open.length} unfinished ` +
      `${one ? "task" : "tasks"}, so it cannot be marked done yet: ${named}. ` +
      `Done-hidden hides a done node ` +
      `WITH its subtree, so this would sweep ${one ? "it" : "them"} off the ` +
      `page. Finish ${one ? "that" : "those"} first — or take the mark off ` +
      `${one ? "it" : "them"} if ${one ? "it is" : "they are"} not happening, ` +
      `since an unmarked bullet is not unfinished work.`,
  })
}

/** Nothing stands above this place — the one spelling of it, shared so the
 *  common case allocates nothing. */
const NOTHING_ABOVE: ReadonlyArray<LocatedRegular> = []

/**
 * What door two DECIDES: the `done` marks standing over a place open work is
 * about to arrive at — root first, and every one of them, because any one of
 * them hides the branch on its own. {@link arriving} is what acts on it, and
 * is the only caller: deciding and acting are one obligation, split here only
 * so the walk can be read on its own.
 *
 * `parent` is where the arrival LANDS, and the chain asked about is that node
 * and everything above it: the landing parent itself is the first thing that
 * would hide what arrives. Absent when the arrival is at top level, where
 * there is nothing above it at all.
 *
 * Canonical `parent` links, through `@olai/format`'s own walk, so a placement
 * is not a way up — see the header above.
 *
 * The two guards below are the stance `ancestorsOf` itself takes and not live
 * logic about anything a caller can send: a parent that is missing, or is a
 * placement, is a set the VALIDATOR has already condemned, and every walk in
 * this system still has to answer over one of those rather than throw. Reading
 * them as reachable cases would be reading them wrong; deleting them would put
 * an unchecked cast where the format keeps a check.
 */
const staleDoneAbove = (
  scope: Scope,
  file: string,
  parent: string | undefined,
): ReadonlyArray<LocatedRegular> => {
  if (parent === undefined || isArchived(file)) return NOTHING_ABOVE
  const at = scope.derived.byId.get(parent)
  if (at === undefined || isMirror(at.node)) return NOTHING_ABOVE
  const chain = [...ancestorsOf(scope.derived, parent), at as LocatedRegular]
  const done = chain.filter((one) => storedMarker(one.node) === "done")
  return done.length === 0 ? NOTHING_ABOVE : done
}

/**
 * The `done` marks INSIDE a subtree that stand over unfinished work in it —
 * the contradiction a restored branch can be carrying in its own luggage.
 *
 * THE HOLE THIS CLOSES (grok's review of #207). Both doors exempt the archive,
 * for a reason that is right: work put away is over, so nothing in there is
 * unfinished and nothing in there is hidden by a mark. But an exemption is a
 * place where the state can legally be BORN — `set_done` on an archived branch
 * over an archived `todo` is refused nowhere — and `unarchive` then carries it
 * into the live set, where door two was only ever looking ABOVE the landing.
 * The contradiction landed through an ops write, which is precisely what these
 * gates promise cannot happen; the git-merge residual the docs carve out is a
 * set that arrived some other way, not one this planner wrote.
 *
 * REOPENED RATHER THAN REFUSED, which is door two's answer and not door one's,
 * for door two's reason plus one that is decisive on its own. The person is
 * not making a claim: they are asking for their subtree back, and the marks in
 * it went stale exactly as an ancestor's does — true while the branch was over,
 * false the moment it is live again. The exemption is about where a node LIVES,
 * so it ends here, and so does what it was protecting. And a refusal would be
 * unfixable from the web: the trash is deliberately not a place you edit (no
 * checkbox, no `•••`, one verb — `web/src/client/trash/TrashPage.tsx`), so
 * "clear those marks first" is advice a person cannot take. Work would be
 * stranded in the trash by the gate that exists to keep work visible.
 *
 * Every one of them, not just the root: `A` done over `B` done over `C` todo
 * is two claims that hide `C`, and door one's own walk refuses both when they
 * are made in the live set.
 *
 * Cycle-safe like every walk here, and it runs on `unarchive` alone — the one
 * op that crosses out of the exemption.
 */
const contradictedWithin = (
  scope: Scope,
  id: string,
): ReadonlyArray<LocatedRegular> => {
  const at = scope.derived.byId.get(id)
  if (at === undefined || isMirror(at.node)) return NOTHING_ABOVE
  const found: Array<LocatedRegular> = []
  const seen = new Set<string>()
  const consider = (one: LocatedRegular): void => {
    if (seen.has(one.node.id)) return
    seen.add(one.node.id)
    if (
      storedMarker(one.node) === "done" &&
      unfinishedWithin(scope.derived, one.node.id).length > 0
    ) {
      found.push(one)
    }
    for (const child of countedChildren(scope.derived, one.node.id)) consider(child)
  }
  consider(at as LocatedRegular)
  return found.length === 0 ? NOTHING_ABOVE : found
}

/** Whether a subtree that is about to arrive somewhere holds work that is not
 *  finished — the node's own mark, or any unfinished task below it. What
 *  {@link arriving}'s `brings` is answered with when the thing arriving is
 *  already in the set: a branch of bullets and done work lands under a
 *  finished ancestor without contradicting it. */
const holdsOpenWork = (scope: Scope, node: RegularNode): boolean =>
  unfinished(storedMarker(node)) || unfinishedWithin(scope.derived, node.id).length > 0

/**
 * DOOR TWO, done to a plan: the whole obligation in one move.
 *
 * ONE FUNCTION BECAUSE IT IS ONE OBLIGATION, and it was four. Taking a stale
 * `done` off is three things that must happen together or not at all — the
 * mark comes off the record, the commit subject names what it took off, and
 * the answer says so — and each of them was a separate call the five arrival
 * sites each had to remember to make, off a shared `above` they each had to
 * compute and each had to spell the empty case of.
 *
 * That shape is a rule held in the author's memory rather than in the code,
 * and two of its three failure modes are SILENT: a site that rewrote the
 * records and forgot the sentence takes a person's mark off without telling
 * them — which is the exact half of the ruling that says this may never land
 * quietly — and one that wrote the sentence without the rewrite says a thing
 * that is not true of the file. The third loses the git record. Fused, none of
 * the three is reachable: there is one place where the mark comes off, and it
 * is the same expression that writes the other two.
 *
 * It takes the PLAN the write has already decided and hands back the plan it
 * becomes, which is why it can own all three: the records are in `files`, the
 * subject is `summary`, the sentence is `nudge`. A write with nothing arriving
 * gets its own plan back, unchanged and unallocated.
 *
 * The `nudge` it finds is KEPT and this news goes in front of it: a merge that
 * carried a mark off to the archive, or a `done` that finished the last task
 * under a parent, still has its own thing to say, and the two are one field on
 * one answer.
 */
const arriving = (
  scope: Scope,
  /** Where the open work LANDS: the outline it is written in, and the node it
   *  hangs off — absent at top level, where nothing stands above it. Plus, for
   *  the one arrival that can carry a contradiction of its own, the subtree
   *  being restored ({@link contradictedWithin}). */
  at: {
    readonly file: string
    readonly parent: string | undefined
    readonly restoring?: string
  },
  /** Whether what is arriving holds work that is not finished. The caller's to
   *  answer, because only the caller knows what is arriving — a subtree the
   *  set already holds ({@link holdsOpenWork}) or a capture that is not on
   *  disk yet ({@link capturesOpenWork}).
   *
   *  A THUNK, and that is about cost rather than taste. Answering it can mean
   *  walking a whole arriving branch, while the question asked first below is
   *  a handful of map lookups up the parent chain — and the chain says no on
   *  nearly every write in a set, since a `done` ancestor is the rare thing
   *  this exists to catch. Passed as a value, every move, merge and unarchive
   *  in the system would pay for the subtree walk to learn nothing. */
  brings: () => boolean,
  plan: Plan,
): Plan => {
  // The two halves of one question — which `done` marks would stand over
  // unfinished work once this write lands — asked outside-in. Above the
  // landing, only when something unfinished is actually arriving; inside what
  // arrives, which needs no such gate because a contradiction in there IS
  // unfinished work in there.
  const above = staleDoneAbove(scope, at.file, at.parent)
  const inside = at.restoring === undefined
    ? NOTHING_ABOVE
    : contradictedWithin(scope, at.restoring)
  const reopened = [
    ...(above.length > 0 && brings() ? above : NOTHING_ABOVE),
    ...inside,
  ]
  if (reopened.length === 0) return plan

  const titles = reopened.map((one) => one.node.title)
  const one = reopened.length === 1
  // Stamped `changed` like any other write, because this IS a write to them.
  const undone = new Set(reopened.map((one) => one.node.id))
  const said = `${titles.map((title) => `\`${title}\``).join(", ")} ` +
    `${one ? "was" : "were"} marked done over work that is not finished — ` +
    `done-hidden would have swept it off the page, so ` +
    `${one ? "that mark is" : "those marks are"} off now. Mark ` +
    `${one ? "it" : "them"} done again when the branch really is finished.`

  return {
    ...plan,
    files: plan.files.map((planned) =>
      planned.file !== at.file ? planned : {
        file: planned.file,
        nodes: planned.nodes.map((record) => {
          if (!undone.has(record.id)) return record
          const next: Draft<RegularNode> = { ...(record as RegularNode) }
          delete next.done
          return touched(scope, next)
        }),
      }
    ),
    // The COMMIT says it too, which is the record that outlives the answer: a
    // mark taken off a node nobody named belongs in the subject line, not only
    // in a sentence the writer read once.
    summary: `${plan.summary} (reopened: ${titles.join(", ")})`,
    nudge: plan.nudge === undefined ? said : `${said} ${plan.nudge}`,
  }
}

// ── title / desc / date ────────────────────────────────────────────────

/** The three field edits, which differ only in what they change and what the
 *  commit line says. Both arrive as functions rather than as a tag this
 *  function would switch on: a switch here would be the caller's decision,
 *  made twice — and so does the third, which is the CONDITION two of them may
 *  carry ({@link stale}). */
const planEdit = (
  scope: Scope,
  id: string,
  edit: (node: RegularNode) => RegularNode,
  summarize: (node: RegularNode) => string,
  /** What this write expects to find, when it is conditional. Checked HERE,
   *  inside the plan, so it is re-checked on every attempt the write gate
   *  makes: a `StaleWrite` re-plans this same request against the newer
   *  snapshot, and a condition tested anywhere else would be a condition the
   *  retry does not test. */
  holds?: (node: RegularNode) => OpFailure | null,
): Planned => {
  const target = editable(scope, id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const broken = holds?.(node)
  if (broken != null) return Result.fail(broken)

  const next = edit(node)
  if (next.title.trim() === "") {
    return Result.fail(new UsageFailure({ reason: "a node needs a title" }))
  }
  const summary = summarize(next)

  return Result.succeed({
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, touched(scope, next)) }],
    id: node.id,
    title: next.title,
    file,
    summary,
  })
}

/**
 * What is wrong with a property's KEY — or `undefined`, which is nearly every
 * key.
 *
 * The two refusals {@link planProp} makes before it has looked at a node at
 * all, and they are out here rather than inside it because a CAPTURE writes
 * properties too now (`add_node`'s `props`, `olai-batch-verbs`): a key spelled
 * like a field has to be turned toward the same verb whether it arrives on a
 * node that exists or on one being born, and the sentence saying so may not
 * have two versions.
 */
const propKey = (key: string): OpFailure | undefined => {
  if (key === "") return new UsageFailure({ reason: "a property needs a key" })
  const shadow = shadowFor(key)
  if (shadow === undefined) return undefined
  return new UsageFailure({
    reason: `${
      shadow.field
        ? `a node already says \`${key}\` with a field of its own`
        : `\`${key}\` is what a node's own fields already answer`
    }, so a property by that name would be a second answer to one question — ${shadow.door}`,
  })
}

/**
 * One custom key, set or taken off — the only writer of `custom`, and the one
 * op in this file whose subject is a key rather than a field.
 *
 * WHAT IT CANNOT DO IS NOT POLICED HERE, and that is the shape doing the work:
 * every fact olai reads is a FIELD at the top level and this writes inside one
 * map, so there is no list of forbidden keys to keep in step with the format —
 * `set_prop` could not reach `done` if it tried.
 *
 * The one rule left is about SHADOWING rather than about writing, which is why
 * it reads a table beside the record's own fields (`@olai/format`'s
 * `shadowFor`) instead of one here: `{"done":true,"custom":{"done":"yesterday"}}`
 * is a legal record and an unreadable one — a drawer would show `done` beside a
 * checkbox that says something else, and a reader would have two answers to one
 * word. So a key spelled like a field is turned toward the verb that writes
 * that fact ({@link propKey}, which a capture asks too).
 *
 * A key is otherwise not judged. The map takes any key, so a rule here about
 * hyphens or case would be this op inventing a spelling the format does not
 * have. An EMPTY key is the one exception, and it is not a rule about keys —
 * it is the same "nothing has one spelling" the value's `null` obeys.
 */
const planProp = (
  scope: Scope,
  request: Extract<Request, { op: "prop" }>,
): Planned => {
  const key = request.key.trim()
  const named = propKey(key)
  if (named !== undefined) return Result.fail(named)

  const value = request.value
  return planEdit(
    scope,
    request.id,
    (node) => ({ ...node, custom: withCustom(node.custom, key, value ?? undefined) }),
    // The KEY is in the subject either way, because it is what changed: a
    // commit reading `prop: the header goes stale` would leave the reader to
    // diff the line to find out which fact moved.
    (node) =>
      value === null || value === ""
        ? `prop: ${node.title} -> ${key} (cleared)`
        : `prop: ${node.title} -> ${key}=${value}`,
    // A WRITE THAT WOULD CHANGE NOTHING IS REFUSED, which is what `set_done` on
    // a done node and `set_see` with a target it already names both do — and
    // what this op was missing.
    //
    // It matters more here than the symmetry suggests, because of the stamps.
    // Every write stamps `changed`, and the stamps are deliberately invisible to
    // the comparison (`@olai/format`'s `changes.ts`), so a set_prop of the value
    // already held used to land on disk, dirty git, count as an op in the chat
    // transcript and report `edited` — while the pending panel listed nothing at
    // all for a tree git called dirty. One gesture, two faces, neither of them
    // true. The guard is what makes "a stamp is not a change" a fact rather than
    // a thing the panel happens not to look at.
    (node) => {
      const held = node.custom?.[key]
      if (value === null || value === "") {
        return held === undefined
          ? new UsageFailure({
            reason: `\`${node.title}\` carries no \`${key}\`, so there is none to take off`,
          })
          : null
      }
      return held === value
        ? new UsageFailure({
          reason: `\`${node.title}\` already says \`${key}\` is \`${value}\` — nothing would change`,
        })
        : null
    },
  )
}

/**
 * A conditional write's condition: `undefined` is not conditional at all, and
 * anything else must match what the record holds now.
 *
 * `null` is a value it can be asked to check FOR — a note that is not there —
 * so the question is whether the field was given, never whether it is empty.
 * One function for the two fields that take one, so "did this still say what
 * the caller thought" is decided once and the callers differ only in the
 * sentence a reader gets.
 */
const stale = (
  was: string | null | undefined,
  now: string | null,
  reason: string,
): OpFailure | null =>
  was === undefined || was === now ? null : new UsageFailure({ reason })

// ── move ───────────────────────────────────────────────────────────────

const planMove = (
  scope: Scope,
  request: Extract<Request, { op: "move" }>,
): Planned => {
  const located = scope.derived.byId.get(request.id)
  if (located === undefined) return Result.fail(unknownId(scope, request.id))
  const { file, node } = located

  const may = writable(scope, file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  const parent = request.parent === undefined
    ? node.parent
    : request.parent === null
    ? undefined
    : request.parent

  if (parent !== undefined && parent !== node.parent) {
    const target = regularAt(scope, parent)
    if (Result.isFailure(target)) return Result.fail(target.failure)
    if (target.success.file !== file) {
      return Result.fail(
        new UsageFailure({
          reason:
            `\`${parent}\` is in \`${target.success.file}\` and \`${request.id}\` is in ` +
            `\`${file}\`. Every outline is an independent tree, so a parent is always in ` +
            `the same file; archiving is what moves a subtree between them.`,
        }),
      )
    }
    const inside = containing(scope, request.id, parent)
    if (inside !== null) {
      return Result.fail(
        new UsageFailure({
          reason: `\`${parent}\` is inside \`${request.id}\` — ${inside} — so the move ` +
            `would make a loop`,
        }),
      )
    }
    // …and the same loop closed through a PLACEMENT, which the parent walk
    // above cannot see: `parent` is not among this record's descendants, it is
    // among what one of them DRAWS. Moving a branch that holds a mirror under
    // what that mirror shows is the ordinary way in — a Now section is mirrors
    // of live work, and "put Now under one of the items it shows" is a move a
    // person can mean by accident.
    //
    // The graph is `@olai/format`'s `drawnFrom`, walked by its `drawingPath`,
    // which is the walk the validator's own containment rule makes and the one
    // `add_mirror` refuses by ({@link showsInto}). Without this the plan was
    // BUILT and the write gate then refused the set — a refusal about a file
    // that was never written, for a reason the tool that planned it did not
    // know about, which is exactly what sharing that graph exists to prevent.
    const draws = showsInto(scope, request.id, parent)
    if (draws !== null) {
      return Result.fail(
        new UsageFailure({
          reason: `\`${parent}\` is inside what \`${request.id}\` draws — ${draws} — so ` +
            `moving it there would put a placement inside the subtree it shows, and ` +
            `drawing that never ends. A mirror may not be placed inside the subtree it ` +
            `shows.`,
        }),
      )
    }
  }

  const ords = placed(siblingsOf(scope.derived, file, parent), node.id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)

  const moved = withParent(node, parent)
  // A mirror has no title of its own — it is a placement of a node that does —
  // so what the commit line calls it is the id it was named by.
  const title = isMirror(node) ? request.id : node.title

  // DOOR TWO: a subtree carrying unfinished work, landing somewhere new. Only
  // when the PARENT changes — a reorder among the same siblings arrives under
  // nothing it was not already under, and an ancestor's mark is not this
  // write's business to touch over a keystroke that moved a row up one place.
  // A MIRROR is never asked: it is a placement, and a placement is not
  // containment, so moving one under a finished branch says nothing about
  // where the work it draws actually lives.
  const brings = () =>
    parent !== node.parent && !isMirror(node) &&
    holdsOpenWork(scope, node as RegularNode)

  return Result.succeed(arriving(scope, { file, parent }, brings, {
    files: [
      {
        file,
        nodes: withOrds(
          replacing(recordsOf(scope, file), node.id, touched(scope, moved)),
          ords.success,
        ),
      },
    ],
    id: node.id,
    title,
    file,
    summary: `move: ${title}`,
  }))
}

const withParent = <N extends Node>(node: N, parent: string | undefined): N => {
  const next: Draft<N> & { parent?: string } = { ...node }
  if (parent === undefined) delete next.parent
  else next.parent = parent
  return next
}

/**
 * The chain by which `parent` sits inside the subtree rooted at `id` — or
 * `null` when it does not.
 *
 * The validator would catch the cycle this move would make, but its message is
 * about a set on disk; this one is about the move, and it NAMES the chain for
 * the same reason the other two loop refusals do — an agent told which
 * ancestry it just tried to fold into itself can fix the call.
 *
 * Upward through `parent`, which is the containment graph read the direction a
 * reparenting asks about: is the new parent one of my own descendants? {@link
 * showsInto} asks the same question of a placement and walks DOWNWARD, because
 * only that direction follows a mirror to what it shows.
 */
const containing = (scope: Scope, id: string, parent: string): string | null => {
  const path = pathTo(parent, id, (at) => {
    const up = scope.derived.byId.get(at)?.node.parent
    return up === undefined ? [] : [up]
  })
  return path === null ? null : chainOf(path)
}

// ── split and merge ────────────────────────────────────────────────────

/**
 * One node into two: the head it keeps, and the tail as the sibling after it.
 *
 * ONE PLAN, and that is the reason this is an op rather than a `set_title`
 * followed by an `add`. Those are two writes at two revisions, and both ways of
 * half-landing are wrong — a tail written while the head still says the whole
 * sentence duplicates it, and a head written with the tail refused loses what
 * was typed. Planned together they are one validation and one all-or-none
 * rename, which is exactly the argument {@link planAdd}'s `children` makes one
 * level up.
 *
 * THE TAIL IS BORN A BULLET, and everything that described the node stays with
 * the head — its children, note, mark, date and edges. That is Workflowy's
 * split read through this format: the row you were typing in is still that row,
 * and what came off it is a new line that has not been said anything about yet.
 * The alternative — carrying the mark or the note across — would be this op
 * inventing a claim about a node nobody has described.
 */
const planSplit = (
  scope: Scope,
  request: Extract<Request, { op: "split" }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  // Both halves are titles, so both are judged the way a title is. The
  // sentences differ because the two mistakes are different ones: a caller that
  // sent an empty head means "put an empty row above this", which this format
  // cannot hold, and one that sent an empty tail asked for a split with nothing
  // on the other side of it.
  if (request.title.trim() === "") {
    return Result.fail(
      new UsageFailure({
        reason: `a node needs a title, so \`${node.title}\` cannot keep an empty one — ` +
          `there is no split that leaves a blank row behind`,
      }),
    )
  }
  if (request.rest.trim() === "") {
    return Result.fail(
      new UsageFailure({
        reason:
          `there is nothing to split off \`${node.title}\` — the new node would have no title`,
      }),
    )
  }

  const id = freshId(scope, new Set())
  const ords = placed(
    siblingsOf(scope.derived, file, node.parent),
    id,
    { after: node.id },
  )
  if (Result.isFailure(ords)) return Result.fail(ords.failure)

  const head: RegularNode = { ...node, title: request.title }
  const tail: RegularNode = {
    id,
    ...(node.parent === undefined ? {} : { parent: node.parent }),
    ord: ordFor(ords.success, id),
    title: request.rest,
    // A node coming into being, so it is CREATED rather than changed — the same
    // stamp a capture writes, because this is the other way a node is born.
    created: scope.context.now(),
  }

  return Result.succeed({
    files: [{
      file,
      nodes: withOrds(
        [...replacing(recordsOf(scope, file), node.id, touched(scope, head)), tail],
        ords.success,
      ),
    }],
    // The write is ABOUT the new node: it is what the caller does not yet have
    // an id for, and it is where a caret that just split a line belongs.
    id,
    title: request.rest,
    file,
    summary: `split: ${node.title}`,
    captured: mintedOf([tail]),
  })
}

/**
 * Two nodes into one: this node's title appended to the sibling above it, which
 * adopts what hung under it — and its own record into the trash.
 *
 * {@link planSplit} backwards, and one plan for the same reason, with more at
 * stake: a merge is a retitle, a note, N reparentings and an archive, and a
 * sequence of those that stops in the middle leaves the outline saying
 * something nobody wrote — a title merged with the children still hanging off a
 * row that is about to go, or a row archived with its children gone into it.
 *
 * WHAT SURVIVES is the whole of the semantics, and every line of it is a
 * decision:
 *
 *   - **the titles are concatenated, with nothing between them.** They were one
 *     line before somebody split it; Workflowy joins them the same way, and any
 *     separator this op invented would be text the caller did not type.
 *   - **the notes are concatenated too**, one blank line apart, and a node with
 *     none simply takes the other's. A note that disappeared off the page would
 *     be the silent loss this codebase refuses — and "it is in the archive" is
 *     not an answer, because nobody looks there for the note of a row that is
 *     still on screen.
 *   - **the children move**, in order, to the end of the surviving node's own.
 *     A keystroke may not orphan work, and archiving them with their parent
 *     would take a branch away that nobody asked about.
 *   - **the mark, the date and the edges go WITH THE RECORD into the archive.**
 *     The format allows one mark per node and the surviving row already has its
 *     own answer, so there is no merge of two; nothing is destroyed, because the
 *     record keeps its id in `Archive.olai` and `Put back` returns it. What
 *     this op owes is that the loss is never SILENT, which is what the
 *     {@link nudge} is for — a `done` that left the live outline is exactly the
 *     news a person is owed.
 *
 * THE SIBLING ABOVE IS READ, never named. "The row above" is a fact about the
 * set, so it is answered against the snapshot this write is judged on — which
 * is what lets the write gate re-plan the request when the store moves under
 * it, exactly as it re-plans `set_done`.
 */
const planMerge = (
  scope: Scope,
  request: Extract<Request, { op: "merge" }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const archive = archiveBeside(file)
  if (isArchived(file)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` is in \`${file}\` — an archive is read rather than ` +
          `edited, so put it back first`,
      }),
    )
  }
  const mayArchive = writable(scope, archive)
  if (Result.isFailure(mayArchive)) return Result.fail(mayArchive.failure)

  const joined = merging(scope.derived, target.success)
  if (Result.isFailure(joined)) return Result.fail(joined.failure)
  const { into, adopted, title, desc } = joined.success

  const records = recordsOf(scope, file)
  const merged = touched(scope, withField({ ...into, title }, "desc", desc ?? null))

  const reparented = new Map(
    appendedUnder([records], into.id, adopted.map((child) => child.node))
      .map((record) => [record.id, record]),
  )

  // The two questions the survivors answer, asked one after the other rather
  // than nested: which rows this file keeps, and what each of them becomes.
  const keeps = records
    .filter((record) => record.id !== node.id)
    .map((record) =>
      record.id === into.id ? merged : reparented.get(record.id) ?? record
    )

  // DOOR TWO, at the arrival nobody would think to look for: the adopted rows
  // move UNDER the survivor, so a branch somebody called finished can acquire
  // an unfinished task by way of a Backspace at the start of a line. The
  // merged node's own mark goes to the archive with its record, so it is the
  // rows it hands over that this asks about — placements excluded, as
  // everywhere.
  const brings = () =>
    adopted.some((child) =>
      !isMirror(child.node) && holdsOpenWork(scope, child.node as RegularNode)
    )

  const { existing, scaffold, buried } = buriedIn(scope, archive, node)
  const nudge = carriedOff(scope, node)
  return Result.succeed(arriving(scope, { file, parent: into.id }, brings, {
    files: [
      { file, nodes: keeps },
      { file: archive, nodes: [...existing, ...scaffold, buried] },
    ],
    id: into.id,
    title,
    file,
    summary: `merge: ${title}`,
    ...(nudge === undefined ? {} : { nudge }),
  }))
}

/** What merging a node would produce: the row it joins, and the two texts that
 *  row ends up carrying. */
export interface Merging {
  /** The sibling above — the record that survives. */
  readonly into: RegularNode
  /** Its title with the merged node's run onto the end. */
  readonly title: string
  /** Their notes joined, or the one of them that exists, or neither. */
  readonly desc: string | undefined
  /** What hangs under the merged node, in the order it hangs — the rows the
   *  survivor adopts, and the rows an undo has to put back. Placements
   *  included: a mirror under it is a row like any other. */
  readonly adopted: ReadonlyArray<Located>
}

/**
 * WHAT A MERGE OF THIS NODE WOULD DO — one function, because two callers ask
 * it and their answers may not differ.
 *
 * The planner asks it to make the write. The keystroke resolver asks it to say
 * what would TAKE THAT WRITE BACK ({@link ../../server/src/edit.ts}) — the row
 * above put back, the branch put back under it, and its two texts restored
 * guarded by what the merge made them. All THREE facts are here for the same
 * reason `@olai/server`'s `among` is one spelling: "the sibling above" scanned
 * twice is two chances for an undo to name the wrong row, the branch read twice
 * is two chances to put it back in a different order, and the join spelled twice
 * is a guard that silently stops matching the day the separator changes. None of
 * them would fail anywhere a test without a browser could see.
 *
 * The joins themselves are the semantics. The titles run together with nothing
 * between them: they were one line before somebody split them, and any
 * separator invented here is text the caller did not type. The notes take a
 * blank line, because they are markdown blocks and running two paragraphs
 * together would change what they say — and a node with no note simply takes
 * the other's, which is the case that matters most.
 *
 * It takes the node already RESOLVED, so it neither repeats the caller's
 * lookup nor answers a second time for an id that is a placement — both
 * callers narrow before they get here, and both refuse a mirror in the ops
 * layer's own words.
 */
export const merging = (
  derived: Derived,
  at: LocatedRegular,
): Result.Result<Merging, OpFailure> => {
  const row = siblingsOf(derived, at.file, at.node.parent)
  const above = row[row.findIndex((sibling) => sibling.node.id === at.node.id) - 1]
  if (above === undefined) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${at.node.title}\` is the first of its siblings, so there is no row ` +
          `above it to merge into`,
      }),
    )
  }
  // A placement has no title, no note and no children of its own, so there is
  // nothing there for a merge to land in — the ops layer's own rule about
  // mirrors, in the sentence the row above earns rather than the one the id
  // named by the caller would get.
  if (isMirror(above.node)) {
    return Result.fail(
      new UsageFailure({
        reason: `the row above \`${at.node.title}\` is a mirror — a second placement of ` +
          `\`${above.node.mirror}\`, with no title of its own — so there is nothing ` +
          `there to merge into`,
      }),
    )
  }
  const into = above.node
  return Result.succeed({
    into,
    title: into.title + at.node.title,
    desc: into.desc === undefined
      ? at.node.desc
      : at.node.desc === undefined
      ? into.desc
      : `${into.desc}\n\n${at.node.desc}`,
    adopted: derived.children.get(at.node.id) ?? [],
  })
}

/**
 * What went into the trash with a merged record that is not its title or its
 * note — as the nudge that says so, or nothing when there was nothing.
 *
 * A merge takes a row off the page, and the fields the surviving row cannot
 * hold a second copy of go with it. That is the right answer (the format allows
 * one mark, and the survivor already has one) and it is exactly the kind of
 * answer that must not be silent: somebody who merged two lines and thereby
 * took a `done` out of the live outline is owed the sentence. Advice on a write
 * that LANDED, which is what a nudge is.
 */
const carriedOff = (scope: Scope, node: RegularNode): string | undefined => {
  const kept: Array<string> = []
  const mark = scope.derived.status.get(node.id)
  if (mark !== undefined) kept.push(`its \`${mark}\` mark`)
  if (node.date !== undefined) kept.push("its date")
  // The ATTACHED DOCUMENT is the same class as the mark and was quiet for one
  // review: a node carries one `doc`, so the survivor's own answer stands and
  // this one leaves the live outline with the record. A reader who put a file
  // on that row is owed the sentence exactly as much as one who ticked it off.
  if (node.doc !== undefined) kept.push(`its document \`${node.doc}\``)
  if (targetsOf(node).length > 0) kept.push("its edges")
  if (kept.length === 0) return undefined
  const said = kept.length === 1
    ? kept[0]
    : `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`
  return `\`${node.title}\` kept ${said} — that record is in the Trash with its id, ` +
    `and \`Put back\` returns it.`
}

// ── create ─────────────────────────────────────────────────────────────

/**
 * A brand-new outline under the served directory.
 *
 * `add` only writes into a file the set already holds — that is the refusal at
 * "is not one of the outlines under the served directory" — so an agent that
 * wants a fresh file has nowhere to go without this. The path is judged the
 * same way `/media/*` judges a picture name ({@link ../../surface/src/media.ts}):
 * relative, segment by segment, never resolving a `..`. The write itself is the
 * ordinary gate: stage → validate → rename → commit, which already knows how to
 * make a directory a nested path needs ({@link ../../store/src/disk.ts}).
 *
 * The seed is a whole CAPTURE, so a new outline is born holding everything it
 * is meant to hold. That is the same atomicity argument read one level up:
 * `create` then `add` was two plans, and a refused second one left an empty
 * outline on disk that nobody had asked for.
 */
const planCreate = (
  scope: Scope,
  request: Extract<Request, { op: "create" }>,
): Planned => {
  const file = outlinePath(request.file)
  if (file === null) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${request.file}\` is not a relative \`.olai\` path under the served ` +
          `directory (no absolute path, no \`..\`, no \`.\`, and the name must end ` +
          `in \`.olai\`)`,
      }),
    )
  }

  if (scope.set.files.includes(file)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${file}\` is already an outline under the served directory — create ` +
          `starts a new one; capture into this one with \`add_node\``,
      }),
    )
  }

  if (request.seed === undefined) {
    return Result.succeed({
      files: [{ file, nodes: [] }],
      id: file,
      title: file,
      file,
      summary: `create: ${file}`,
    })
  }

  // The seed is a CAPTURE — same fields, same records, same id rule, same walk
  // — so a new outline arrives holding everything it was born with. And it is
  // the same ONE plan: the file and its contents are validated together and
  // renamed together, so a seed that is refused leaves no file behind rather
  // than an empty outline nobody asked for.
  const seed = request.seed
  const into = minting()
  const chosen = idFor(scope, into.taken, seed.id)
  if (Result.isFailure(chosen)) return Result.fail(chosen.failure)
  const id = chosen.success

  const built = captured(scope, into, seed, {
    id,
    // Top level of a file that does not exist yet, so there is nobody to place
    // it among: the first key, the one an `add` mints with no siblings.
    parent: undefined,
    ord: nextOrd(null),
    below: NESTING,
    // …which is also why the seed is NOT anchored: with no siblings to land
    // among there is no placement, so `after` on a seed's root is the same
    // misspelling it is on any child, and is refused the same way.
  }, false)
  if (Result.isFailure(built)) return Result.fail(built.failure)
  const minted = built.success

  // ...and the same DOOR ONE, in the same place in the sequence and for the
  // same reason ({@link planAdd}): a seed is a capture, so a node born done
  // over a task born under it is the same self-contradiction spelled through
  // the other verb, and the nesting refusal speaks before anything walks the
  // tree. There is no door two here — a brand-new outline has no ancestors for
  // anything to arrive under.
  const contradicts = capturedOverOpenWork(seed)
  if (contradicts !== undefined) return Result.fail(contradicts)

  const under = minted.length - 1
  return Result.succeed({
    files: [{ file, nodes: minted }],
    id,
    title: seed.title,
    file,
    summary: under === 0
      ? `capture: ${seed.title}`
      : `capture: ${seed.title} (+${under})`,
    captured: mintedOf(minted),
  })
}

/**
 * A path this op may create as a new outline — or `null` for anything that is
 * not one relative outline path under the served root.
 *
 * Same discipline as `mediaTarget` in `@olai/surface`: judge segments after
 * they are read, refuse empty / `.` / `..` / separators / NUL rather than
 * resolving them, and require the name the format already treats as an outline.
 * Absolute paths (leading `/`) and Windows-style backslash separators never
 * become a segment that could be joined under the root by accident.
 */
export const outlinePath = (raw: string): string | null => creatable(raw, OUTLINE_EXT)

/** The same judgment for the other kind of file a call may mint: one relative
 *  `.md` under the served root. One rule, two extensions — the two create ops
 *  must not differ in what a path may smuggle, and both take their suffix from
 *  the format, because a mint that admits a name `fileKind` will not claim
 *  writes a file nothing ever reads back. */
export const documentPath = (raw: string): string | null => creatable(raw, DOCUMENT_EXT)

const creatable = (raw: string, extension: string): string | null => {
  if (raw === "" || raw.startsWith("/") || raw.includes("\\") || raw.includes("\0")) {
    return null
  }

  const segments: Array<string> = []
  for (const segment of raw.split("/")) {
    if (segment === "" || segment === "." || segment === "..") return null
    if (segment.includes("\0")) return null
    segments.push(segment)
  }
  if (segments.length === 0) return null

  const file = segments.join("/")
  return file.endsWith(extension) ? file : null
}

// ── archive ────────────────────────────────────────────────────────────

/**
 * A subtree out of a working outline and into `Archive.olai` beside it, with
 * the chain it hung off re-created there so the tree still reads years later.
 *
 * The racket reference's semantics, kept because they are what the archive is
 * FOR (docs/cli.md's `archive`):
 *
 *   - the scaffold above the node is one record per ancestor carrying its TITLE
 *     and nothing else — no dates, no marks, no notes. A chain the archive
 *     already has is merged into, matched by exact title at that level, and new
 *     arrivals append at the end, so the file reads in the order things were
 *     put away;
 *   - nothing is stamped. Archiving is not finishing: a done node keeps its
 *     date, an open node stays open;
 *   - IDS MOVE WITH THE NODE, so `mirror`, `after`, `blocks` and `see` targets
 *     go on resolving — the served directory is one set, and the archive is in
 *     it. That is why the scaffold nodes get MINTED ids rather than copies of
 *     the ancestors': an id is unique across the set, and a copy would collide
 *     with the live node it was copied from.
 */
const planArchive = (
  scope: Scope,
  request: Extract<Request, { op: "archive" }>,
): Planned => {
  const target = regularAt(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const archive = archiveBeside(file)
  if (isArchived(file)) {
    return Result.fail(
      new UsageFailure({ reason: `\`${node.title}\` is already in \`${archive}\`` }),
    )
  }

  for (const touched of [file, archive]) {
    const may = writable(scope, touched)
    if (Result.isFailure(may)) return Result.fail(may.failure)
  }

  const { keeps: source, descendants } = liftSubtree(scope, file, node.id)
  // The root is re-parented onto the scaffold; everything under it keeps the
  // `parent` it had, so the subtree arrives shaped exactly as it left.
  const { existing, scaffold, buried } = buriedIn(scope, archive, node)

  return Result.succeed({
    files: [
      { file, nodes: source },
      { file: archive, nodes: [...existing, ...scaffold, buried, ...descendants] },
    ],
    id: node.id,
    title: node.title,
    file: archive,
    summary: `archive: ${node.title}`,
  })
}

/**
 * A record ARRIVING in an archive: what the archive already holds, the chain of
 * ancestor titles it has to hang off, and the record re-parented onto the end
 * of that chain.
 *
 * ONE spelling, because two ops put a record into an archive: `archive` takes a
 * subtree (and appends its descendants after this record), and `merge` puts the
 * record it merged away there alone. Two copies would be two answers to "where
 * does this node hang in the archive" — and the second reader is exactly the one
 * who would not notice the first had changed.
 *
 * It answers the three PIECES rather than the whole file entry, because the two
 * callers write different files after it: the subtree's descendants follow the
 * record for `archive` and there are none for `merge`.
 */
const buriedIn = (
  scope: Scope,
  archive: string,
  node: Node,
): {
  readonly existing: ReadonlyArray<Node>
  readonly scaffold: ReadonlyArray<Node>
  readonly buried: Node
} => {
  const existing = recordsOf(scope, archive)
  // The chain, outermost first, as titles. It is the DEFINING file's ancestry:
  // the titles indented above the node in the outline it actually lives in.
  const { scaffold, parent } = scaffoldFor(
    scope,
    existing,
    ancestorsOf(scope.derived, node.id).map((crumb) => crumb.node.title),
  )
  return {
    existing,
    scaffold,
    buried: { ...withParent(node, parent), ord: appendedOrd([existing, scaffold], parent) },
  }
}

/**
 * The chain of ancestor titles, as records in the archive — merged into
 * whatever chain is already there, and minted for the rest.
 *
 * Matched by exact TITLE at each level, which is what makes the scaffold merge
 * rather than accumulate — and the ids it mints are fresh rather than copies of
 * the live ancestors', because an id is unique across the set and a copy would
 * collide with the node it was copied from.
 */
const scaffoldFor = (
  scope: Scope,
  /** What the archive already holds. */
  existing: ReadonlyArray<Node>,
  /** The ancestry, outermost first, as titles. */
  chain: ReadonlyArray<string>,
): { readonly scaffold: ReadonlyArray<Node>; readonly parent: string | undefined } => {
  const minted = new Set<string>()
  const scaffold: Array<Node> = []
  let parent: string | undefined
  let level: ReadonlyArray<Node> = existing.filter(
    (record) => record.parent === undefined,
  )
  for (const title of chain) {
    const merged = level.find(
      (record) => !isMirror(record) && record.title === title,
    )
    if (merged !== undefined) {
      parent = merged.id
      level = existing.filter((record) => record.parent === merged.id)
      continue
    }
    const id = freshId(scope, minted)
    minted.add(id)
    const record: RegularNode = {
      id,
      ...(parent === undefined ? {} : { parent }),
      ord: appendedOrd([existing, scaffold], parent),
      title,
    }
    scaffold.push(record)
    parent = id
    level = []
  }
  return { scaffold, parent }
}

/**
 * The node and everything under it, in file order.
 *
 * Descends the parent→children index `derive` already built rather than
 * rescanning the file until the answer stops growing — the index is the same
 * question asked once, for the whole set, and a repeat-until-stable scan over
 * the records was that question asked again in a worse shape.
 */
const subtreeOf = (
  scope: Scope,
  records: ReadonlyArray<Node>,
  id: string,
): ReadonlyArray<Node> => {
  const wanted = new Set<string>()
  const descend = (at: string): void => {
    if (wanted.has(at)) return
    wanted.add(at)
    for (const child of scope.derived.children.get(at) ?? []) descend(child.node.id)
  }
  descend(id)
  // Back in FILE order: the archive should read the way the outline did.
  return records.filter((record) => wanted.has(record.id))
}

/**
 * A subtree, lifted out of its file: what the file KEEPS, and the node's
 * descendants in file order. The node itself is deliberately not returned —
 * the caller holds it, and re-parenting it is the caller's decision — so the
 * two directions the trash has (`archive` out of a live outline, `unarchive`
 * out of the archive) share one answer to "what is the whole subtree" and
 * cannot drift about it.
 */
const liftSubtree = (
  scope: Scope,
  file: string,
  id: string,
): { readonly keeps: ReadonlyArray<Node>; readonly descendants: ReadonlyArray<Node> } => {
  const records = recordsOf(scope, file)
  const moving = subtreeOf(scope, records, id)
  const movingIds = new Set(moving.map((record) => record.id))
  return {
    keeps: records.filter((record) => !movingIds.has(record.id)),
    descendants: moving.filter((record) => record.id !== id),
  }
}

/** The largest `ord` already under `parent`, or `null` when nothing is.
 *
 *  One max scan rather than a filter-map-sort: `ord` is a base62 fractional
 *  index, so `>` on the string IS the comparison, and only the largest matters.
 *  `Archive.olai` is the one file in a set that grows without bound, and this
 *  runs once per ancestor level of every archive.
 *
 *  Split from {@link appendedOrd} because a merge appends a WHOLE ROW of
 *  adopted children and has to carry the key forward between them, which
 *  "give me the next one" cannot say. */
const lastOrd = (
  rows: ReadonlyArray<ReadonlyArray<Node>>,
  parent: string | undefined,
): string | null => {
  let last: string | null = null
  for (const records of rows) {
    for (const record of records) {
      if (record.parent === parent && (last === null || record.ord > last)) {
        last = record.ord
      }
    }
  }
  return last
}

/** An `ord` after everything already under `parent`. */
const appendedOrd = (
  rows: ReadonlyArray<ReadonlyArray<Node>>,
  parent: string | undefined,
): string => nextOrd(lastOrd(rows, parent))

/**
 * A whole ROW of records, moved to the end of what is already under `parent`,
 * keeping the order they were in.
 *
 * {@link appendedOrd} answers for ONE arrival; a row of them has to carry the
 * key forward between arrivals, and a caller doing that by hand is a mutable
 * cursor in the middle of a planner. What it is for is the merge's adopted
 * children, and "last, in order" is the same answer `unarchive` gives the
 * subtree it brings back.
 */
const appendedUnder = <N extends Node>(
  rows: ReadonlyArray<ReadonlyArray<Node>>,
  parent: string,
  moving: ReadonlyArray<N>,
): ReadonlyArray<N> => {
  let previous = lastOrd(rows, parent)
  return moving.map((record) => {
    const ord = nextOrd(previous)
    previous = ord
    return { ...withParent(record, parent), ord }
  })
}

// ── unarchive ──────────────────────────────────────────────────────────

/**
 * A subtree back OUT of an `Archive.olai` — the inverse `archive` waited for
 * (`parity-unarchive`), and the reason the trash was never a shredder.
 *
 * The subtree comes back INTACT and the ids come with it, which is the archive
 * op's own rule read in reverse: the set is one namespace, the node never left
 * it, so nothing here can collide and nothing has to be re-pointed. What has to
 * be DECIDED is where it lands, and the caller may not have said:
 *
 *   - a named `parent` or `file` is {@link landsIn}'s pair, judged the same way
 *     `add` judges it — except that an archive is refused as a destination,
 *     because putting something back INTO the trash is `archive`'s job and a
 *     caller who spells it here has the wrong op;
 *   - absent both, THE ARCHIVE'S OWN RECORD decides: the scaffold of ancestor
 *     titles above the node is matched back against the live outlines in the
 *     archive's directory. Titles, not ids — the scaffold's ids are minted
 *     (see {@link planArchive}) — so the match can fail two ways, and both are
 *     refusals that NAME what was found rather than guesses: nowhere (the
 *     chain was retitled, or archived itself) and more than one place (two
 *     branches spell the same path).
 *
 * It lands LAST among its new siblings. The archive does not record where in
 * the row a node sat — an `ord` is meaningless outside the sibling set it was
 * minted in — and a guess dressed as a restore would be worse than the honest
 * answer, which is the same one every other arrival gets.
 *
 * The scaffold is TIDIED on the way out: an ancestor the removal leaves with
 * nothing under it is dropped, provided it is bare (a title and a placement,
 * nothing else — exactly what {@link planArchive} mints) and nothing in the set
 * still names it. So archive-then-unarchive leaves the archive as it stood,
 * rather than accumulating empty husks of everywhere anything ever went — and
 * an ancestor that holds anything else, says anything else, or is pointed at
 * stays, because dropping it would not be tidying.
 */
const planUnarchive = (
  scope: Scope,
  request: Extract<Request, { op: "unarchive" }>,
): Planned => {
  const target = regularAt(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  if (!isArchived(file)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` is in \`${file}\`, which is not an archive — ` +
          `\`unarchive_node\` takes back what \`archive_node\` put away, and this ` +
          `one was never put away`,
      }),
    )
  }

  const landing = unarchiveLanding(scope, request, file, node)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  const { file: destination, parent } = landing.success

  const signpost = notASignpost(scope, node, destination, parent)
  if (Result.isFailure(signpost)) return Result.fail(signpost.failure)

  for (const touched of [file, destination]) {
    const may = writable(scope, touched)
    if (Result.isFailure(may)) return Result.fail(may.failure)
  }

  const { keeps, descendants } = liftSubtree(scope, file, node.id)

  // The archive after the removal, with the empty scaffold above the node
  // tidied away — deepest first, stopping at the first ancestor that still
  // holds anything, carries more than a scaffold record does, or is named by
  // something. "Named" is a lookup in `namedBy` — the format's own `targetsOf`
  // read backwards, built with the rest of the derivation — so a relation
  // added later still cannot slip past it, and an edge written from anywhere,
  // the returning subtree included, keeps its target. The child counts are one
  // pass, decremented as ancestors drop, so the walk never re-scans the one
  // file in a set that grows without bound.
  const byId = new Map(keeps.map((record) => [record.id, record]))
  const holding = new Map<string, number>()
  for (const record of keeps) {
    if (record.parent !== undefined) {
      holding.set(record.parent, (holding.get(record.parent) ?? 0) + 1)
    }
  }
  const dropped = new Set<string>()
  let up = node.parent
  while (up !== undefined) {
    const holder = byId.get(up)
    if (holder === undefined) break
    if (
      (holding.get(holder.id) ?? 0) > 0 ||
      !bareScaffold(holder) ||
      scope.derived.namedBy.has(holder.id)
    ) break
    dropped.add(holder.id)
    if (holder.parent !== undefined) {
      holding.set(holder.parent, (holding.get(holder.parent) ?? 0) - 1)
    }
    up = holder.parent
  }

  const already = recordsOf(scope, destination)
  const reparented: Node = {
    ...withParent(node, parent),
    ord: appendedOrd([already], parent),
  }

  // DOOR TWO, at the one arrival the archive itself sends, and the only one
  // that has to be asked TWICE. What it comes back under may have been called
  // finished in the meantime — and so may something inside it, since the
  // archive is where such a mark can legally be written
  // ({@link contradictedWithin}). The exemption is about where a node LIVES,
  // so both halves of it stop the moment the node stops living there.
  return Result.succeed(
    arriving(scope, {
      file: destination,
      parent,
      restoring: node.id,
    }, () => holdsOpenWork(scope, node), {
      files: [
        { file, nodes: keeps.filter((record) => !dropped.has(record.id)) },
        { file: destination, nodes: [...already, reparented, ...descendants] },
      ],
      id: node.id,
      title: node.title,
      file: destination,
      summary: `unarchive: ${node.title}`,
    }),
  )
}

/**
 * Where an unarchived subtree lands ({@link Landing}): the caller's `parent` /
 * `file` when either is given, the archive's own scaffold chain otherwise.
 *
 * The named half leans on {@link landsIn} for everything it can — the same
 * refusals `add` gives for an unknown parent or an unserved file — and adds
 * the one rule that is this op's: an archive is not a destination. The
 * resolved half is the inverse of {@link planArchive}'s scaffold walk, over
 * TITLES, against every live outline in the archive's own directory — which is
 * the only directory the node can have come from, since an archive sits
 * beside what it archives.
 */
const unarchiveLanding = (
  scope: Scope,
  request: Extract<Request, { op: "unarchive" }>,
  archive: string,
  node: RegularNode,
): Result.Result<Landing, OpFailure> => {
  if (request.parent !== undefined || request.file !== undefined) {
    const named = landsIn(scope, request)
    if (Result.isFailure(named)) return named
    if (isArchived(named.success.file)) {
      return Result.fail(
        new UsageFailure({
          reason: `that would put \`${node.title}\` back into \`${named.success.file}\` — ` +
            `unarchive takes things OUT of an archive; name a parent or file in a ` +
            `live outline`,
        }),
      )
    }
    return named
  }

  const beside = scope.set.files.filter((candidate) =>
    !isArchived(candidate) && archiveBeside(candidate) === archive
  )
  const chain = ancestorsOf(scope.derived, node.id).map((crumb) => crumb.node.title)

  if (chain.length === 0) {
    // Archived from the top level of SOME outline beside the archive — which
    // one was never recorded, because a scaffold of no ancestors says nothing.
    // One outline is no choice at all; more is the caller's.
    if (beside.length === 1) return Result.succeed({ file: beside[0]! })
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` was archived from the top level of an outline ` +
          `beside \`${archive}\`, and ${
            beside.length === 0
              ? "there is none now"
              : `there is more than one (${beside.map((f) => `\`${f}\``).join(", ")})`
          } — give \`file\` to say which it goes back into, or \`parent\` to put ` +
          `it somewhere else`,
      }),
    )
  }

  // The chain, walked FORWARD over the live outlines: every top-level node
  // spelling the first title, then every child of those spelling the next, so
  // what is left at the end is every place the whole chain reaches. Titles are
  // matched exactly, as the scaffold merge wrote them, and never through a
  // mirror — a placement spells no title of its own.
  let level: ReadonlyArray<Located> = beside
    .flatMap((candidate) => siblingsOf(scope.derived, candidate, undefined))
  let matches: ReadonlyArray<LocatedRegular> = []
  for (const title of chain) {
    matches = level.filter(
      (at): at is LocatedRegular => !isMirror(at.node) && at.node.title === title,
    )
    level = matches.flatMap((at) => scope.derived.children.get(at.node.id) ?? [])
  }

  const found = matches[0]
  if (matches.length === 1 && found !== undefined) {
    return Result.succeed({ file: found.file, parent: found.node.id })
  }
  return Result.fail(
    new UsageFailure({
      reason: `\`${node.title}\` was archived from under ${chainOf(chain)}, and that ` +
        `chain ${
          matches.length === 0
            ? `matches nothing in ${
              beside.length === 0
                ? `the outlines beside \`${archive}\` (there are none)`
                : beside.map((f) => `\`${f}\``).join(", ")
            } — it may have been retitled, or put away itself`
            : `matches more than one place (${
              matches.map((at) => `\`${at.node.id}\` (${at.file}:${at.line})`).join(", ")
            })`
        }. Give \`parent\` (it goes under that node) or \`file\` (top level) to ` +
        `say where it goes back`,
    }),
  )
}

/**
 * THE SIGNPOST IS NOT A NODE — the one thing in an archive that may not come
 * back out (review of #147, driven twice).
 *
 * `archive` writes two kinds of record. The subtree it MOVED keeps its own ids
 * and leaves a hole where it was; above that it mints a scaffold of the live
 * ancestors' TITLES, under ids nobody chose, so the archive still reads like
 * the tree it came out of. Only the first kind was ever put away. The second is
 * a copy of something that never left — restore one and the set gains a second
 * node carrying a title it already has, with the archive's rows hanging off the
 * copy instead of the original. It is also the click the Trash invites, because
 * the scaffold is the ROOT row: "put this pile back" reaches for it first.
 *
 * WHAT TELLS THE TWO APART, since nothing on disk marks a minted record: the
 * pair of conditions below, and each is doing its own work.
 *
 *   - BARE is the shape `archive` mints — a title standing at a place, nothing
 *     else ({@link bareScaffold}) — so anything carrying a mark, a date, a note
 *     or an edge is content and is never asked about;
 *   - A TWIN AT THE LANDING is the copy showing itself. A scaffold record
 *     exists precisely BECAUSE its ancestor is still live and still carries
 *     that title, so the node it would duplicate is sitting exactly where this
 *     one would land. Content that happens to be title-only left a hole behind
 *     it, so nothing there answers to its name.
 *
 * Asking only the first would have been the tempting rule and it is wrong: a
 * plain heading with rows under it — no mark, no date, no note — is the most
 * ordinary thing anybody archives, and refusing it would make the common case
 * unrestorable on the face that has no way to name a landing. Asking only the
 * second would refuse a real node somebody had re-created by hand under the
 * same name, which is theirs to have.
 */
const notASignpost = (
  scope: Scope,
  node: RegularNode,
  destination: string,
  parent: string | undefined,
): Result.Result<void, OpFailure> => {
  if (!bareScaffold(node)) return Result.succeed(undefined)
  const twin = siblingsOf(scope.derived, destination, parent).find(
    (at) => !isMirror(at.node) && at.node.title === node.title,
  )
  if (twin === undefined) return Result.succeed(undefined)
  return Result.fail(
    new UsageFailure({
      reason: `\`${twin.node.id}\` in \`${twin.file}\` is already called ` +
        `\`${node.title}\`, and this record carries nothing but that title — it is ` +
        `the title \`archive\` wrote above what was put away rather than something ` +
        `that was put away. Restoring it would stand a second one beside it and ` +
        `hang the archive's rows off the copy. Put back what is under it instead.`,
    }),
  )
}

/** Exactly what {@link planArchive} mints and nothing more: a title standing at
 *  a place. A record carrying anything else — a mark, a date, a note, an edge —
 *  was never a scaffold, whatever its shape suggests, and tidying it away would
 *  throw content out of the trash. */
const bareScaffold = (node: Node): boolean => {
  if (isMirror(node)) return false
  const { id: _id, parent: _parent, ord: _ord, title: _title, ...rest } = node
  return Object.keys(rest).length === 0
}


// ── empty the trash ────────────────────────────────────────────────────

/**
 * ONE ARCHIVE, EMPTIED — the first write in this planner that DESTROYS.
 *
 * Everything else here moves records between files or rewrites their fields;
 * `archive` was named a trash rather than a shredder precisely because nothing
 * in olai ever took a record out of the set. This one does, and the whole of
 * its design is about being the smallest thing that can:
 *
 *   - it names an ARCHIVE and no node. There is no way to spell "delete this
 *     one row", which is the shredder-aimed-at-a-row that #109's deferral is
 *     about and is still the human's to rule on. Emptying a bin is a different
 *     gesture from picking something out of one and burning it;
 *   - it writes that file with NO RECORDS and touches nothing else. The file
 *     itself stays — an archive that vanished and re-appeared on the next
 *     put-away would be a file blinking in the sidebar — and the whole trash is
 *     an `apply` of these, one per archive, so N archives are still one plan,
 *     one validation and one rename;
 *   - and it destroys no more than it says. The records leave through the same
 *     gate every other write goes through and are committed by whichever door
 *     commits everything else, so what git holds afterwards is exactly what git
 *     had already recorded — no more, and no less. A `doc` an archived node
 *     named is a FILE and stays: a document is not a node, nothing in this
 *     vocabulary names bytes, and a `.md` nobody points at is a thing a person
 *     can see.
 *
 * FOUR REFUSALS, and three of them are about which file this is. An outline the
 * set does not hold, and an outline that is not an archive, are both "you are
 * pointing at the wrong file" and say so in the archive's own terms. An archive
 * with nothing in it is refused rather than written as a no-op, which is the
 * rule `set_see` already keeps for a call that would change nothing — and it is
 * what makes "the trash is already empty" a sentence somebody reads rather than
 * a commit with no diff in it.
 *
 * THE FOURTH IS THE ONE THAT MATTERS, and it is {@link planUnmirror}'s rule
 * read over a set instead of over one record. Ids move with a node when it is
 * archived — that is `archive`'s own promise, and it is why a mirror or an
 * `after` naming something you put away goes on resolving — so deleting those
 * records can leave live outlines naming ids nothing declares, which is a set
 * the validator condemns (`unknown-target`). The write gate would catch it and
 * refuse with the validator's rows; this refuses FIRST, in the vocabulary of
 * the thing somebody actually has to do, naming what still points in. What
 * points in from INSIDE the same emptying is not a dependent: those records go
 * when they go.
 */
const planEmpty = (
  scope: Scope,
  request: Extract<Request, { op: "empty" }>,
): Planned => {
  const file = request.file
  // "Is this a file the directory serves, and can it be written?" is
  // {@link landsIn}'s own pair, asked with no `parent` — the same two refusals
  // `add_node` gives for a file it cannot reach, in the same words. Spelling
  // them again here would be one wording for an unserved path in `add` and
  // another in `empty`, drifting the first time either is edited.
  const named = landsIn(scope, { file })
  if (Result.isFailure(named)) return Result.fail(named.failure)

  if (!isArchived(file)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${file}\` is not an archive, and \`empty_trash\` empties the TRASH — ` +
          `an \`${ARCHIVE}\` beside an outline, which is where \`archive_node\` puts ` +
          `things. Nothing here deletes out of a live outline; \`archive_node\` is ` +
          `how a node leaves one.`,
      }),
    )
  }

  const records = recordsOf(scope, file)
  if (records.length === 0) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${file}\` is already empty, so there is nothing to delete`,
      }),
    )
  }

  // Every record STAYING that names one that is going — {@link heldBy}, the
  // one question `remove_mirror` asks about a single placement, asked here
  // about a whole pile.
  const held = heldBy(scope, new Set(records.map((record) => record.id)))
  if (held.length > 0) {
    // The agreement, spelled out once each above the sentence rather than five
    // times inside it. This is the refusal somebody actually has to act on, and
    // a template carrying five ternaries is a template nobody reads back to
    // check that it still says what it means.
    const one = held.length === 1
    const record = one ? "a record" : "records"
    const it = one ? "it" : "them"
    const thatNames = one ? "that names" : "those name"
    const itNames = one ? "it names" : "they name"
    return Result.fail(
      new UsageFailure({
        reason: `\`${file}\` still has ${record} pointed INTO it from outside: ` +
          `${capped(held, (naming) => naming)}. Deleting what ${thatNames} would ` +
          `leave ${it} pointing at nothing, so nothing was written — re-point or ` +
          `retire ${it} first, or \`unarchive_node\` what ${itNames} back out.`,
      }),
    )
  }

  return Result.succeed({
    files: [{ file, nodes: [] }],
    // A file op answers with its PATH where a node op answers with an id and a
    // title, which is `create_outline`'s own shape and for its reason: there is
    // no node here for either field to be about, and inventing one would be a
    // reply naming a record this write has just deleted.
    id: file,
    title: file,
    file,
    summary: `empty: ${file} (${records.length} ${
      records.length === 1 ? "record" : "records"
    })`,
  })
}

// ── duplicate ──────────────────────────────────────────────────────────

/**
 * A node and everything under it, written again as the sibling below it.
 *
 * IT READS THE SUBTREE RATHER THAN TAKING ONE, which is what makes it the
 * shortest op in this file that produces the most records: what the copy says
 * is already on disk, so there is nothing to describe and nothing a caller can
 * get wrong. The request is one id ({@link ../../format/src/writing.ts}'s
 * `DuplicateRequest`, where the semantics are argued).
 *
 * THREE DECISIONS ARE MADE HERE, and each of them is the same decision read
 * from a different angle — that the copy is a second THING and not a second
 * claim on the first:
 *
 *   - **every id in it is fresh** ({@link copiesOf}), so nothing in the set
 *     resolves to two records and nothing that pointed at the original now
 *     points at both;
 *   - **what the copy points AT follows that split** ({@link repointed}). A
 *     reference inside the subtree is re-aimed at the copy of what it named, so
 *     the copy is self-contained; one that leaves the subtree keeps its target,
 *     because that target was never copied. A MIRROR is copied as a mirror —
 *     the placement, not the identity — which is the roadmap's own word for it:
 *     a second view of a node is not a second node, and expanding one into a
 *     twin would be this op inventing content nobody wrote;
 *   - **the two STAMPS are the copy's own**, exactly as they are on a captured
 *     node ({@link capturedNode}): `created` is now, and there is no `changed`
 *     on a record nobody has written to yet. Every other field — the mark and
 *     its instant, the date, the rule, the note, the properties, the attached
 *     `doc` — comes across verbatim.
 *
 * THE ORDS BELOW THE ROOT ARE COPIED VERBATIM, and that falls out of the ids
 * being fresh: each copied child sits among copied siblings only, so the keys
 * that sorted them sort them again. The one key this op has to mint is the
 * ROOT's, which lands it immediately after the node it copies among that node's
 * real siblings ({@link placed}).
 *
 * WHAT IT REFUSES is what every op that names a node refuses: an id nothing
 * declares, an id that is a MIRROR (a placement is not a node — `add_mirror`
 * places a second one), and a file the set could not read. There is no rule of
 * its own, and deliberately: a subtree that is legal on disk is legal written
 * twice, because the copy is isomorphic to something the validator has already
 * approved.
 */
const planDuplicate = (
  scope: Scope,
  request: Extract<Request, { op: "duplicate" }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const records = recordsOf(scope, file)
  const subtree = subtreeOf(scope, records, node.id)
  const copies = copiesOf(scope, subtree)

  const id = copies.of(node.id)
  const ords = placed(siblingsOf(scope.derived, file, node.parent), id, { after: node.id })
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ordFor(ords.success, id)

  const written = subtree.map((record): Node => {
    // The ROOT joins the original's row; everything below it hangs off the copy
    // of whatever it hung off, which is in hand because a subtree is closed
    // under its own children.
    const at = record.id === node.id
      ? { parent: node.parent, ord }
      : {
        parent: record.parent === undefined ? undefined : copies.of(record.parent),
        ord: record.ord,
      }
    const placement = { id: copies.of(record.id), ord: at.ord }
    // The two arms of the record, branched BEFORE anything is built, so each is
    // written as the shape it is rather than assembled once and cast twice.
    // A placement points with `mirror` and with nothing else — the format's own
    // reason for it being a separate struct — so this arm is exhaustive by the
    // type, and {@link repointed} answers for the other.
    return isMirror(record)
      ? { ...withParent(record, at.parent), ...placement, mirror: copies.target(record.mirror) }
      : borne(scope, {
        ...repointed(withParent(record, at.parent), copies.target),
        ...placement,
      })
  })

  const under = written.length - 1
  return Result.succeed(
    arriving(scope, { file, parent: node.parent }, () => holdsOpenWork(scope, node), {
      files: [{ file, nodes: withOrds([...records, ...written], ords.success) }],
      id,
      title: node.title,
      file,
      summary: under === 0
        ? `duplicate: ${node.title}`
        : `duplicate: ${node.title} (+${under})`,
      // The placements are absent from it for the reason they are absent from a
      // capture's: `captured` names NODES, and a mirror has no title of its own
      // to report ({@link ../../format/src/writing.ts}'s `WriteResult`).
      captured: mintedOf(
        written.filter((record): record is RegularNode => !isMirror(record)),
      ),
    }),
  )
}

/**
 * The COPY of every record in the subtree — and the two questions anybody asks
 * of it, which answer a miss differently.
 *
 * ONE socket rather than a map plus two readers, because the difference between
 * those two answers IS the op's rule and it is only legible with them side by
 * side: {@link Copies.of} is asked about a record this write is MAKING and a
 * miss is a defect, while {@link Copies.target} is asked about an id a record
 * NAMES and a miss is the ordinary case — the whole "inside follows the copy,
 * outside keeps its target" half of the semantics is that fallback. Handed out
 * as a map, the fallback would be one `?? id` at each call site, free to appear
 * at the structural ones too, where it would silently land a copied child at
 * top level instead of throwing.
 */
interface Copies {
  /** The copy of a record this write is MAKING, by the id it replaces. Every
   *  record in the subtree has one — they are all decided before anything is
   *  built — so a miss is a defect in this file rather than anything a caller
   *  can act on, which is {@link ordFor}'s arrangement one map over. */
  readonly of: (id: string) => string
  /** A TARGET, as the copy names it: the copy of what it named when that was
   *  inside the subtree, and the thing itself when it was not. The fallback is
   *  the rule rather than a tolerance — a reference out of the subtree points
   *  at something this write did not copy, and there is nothing else it could
   *  mean. */
  readonly target: (id: string) => string
}

/** Fresh ids for the whole subtree, decided before any record is built —
 *  because a record's references may name a node that comes LATER in file order
 *  and a half-built map would re-point some of them and not others. */
const copiesOf = (scope: Scope, subtree: ReadonlyArray<Node>): Copies => {
  const taken = new Set<string>()
  const copies = new Map<string, string>()
  for (const record of subtree) {
    const fresh = freshId(scope, taken)
    taken.add(fresh)
    copies.set(record.id, fresh)
  }
  return {
    of: (id) => {
      const copy = copies.get(id)
      if (copy === undefined) throw new Error(`the subtree copy did not include \`${id}\``)
      return copy
    },
    target: (id) => copies.get(id) ?? id,
  }
}

/**
 * One node's references, re-aimed by `target` — the EDGE fields, which is every
 * way a regular record names another one.
 *
 * The fields are the format's own closed list rather than a list spelled here:
 * {@link targetsOf} answers what a record points at AND with which field, which
 * is the same function the validator reads forwards and `remove_mirror` reads
 * backwards. So a fourth relation added to the format is re-pointed by this op
 * the day it exists, rather than being the one field a copy quietly leaves
 * aimed at the original.
 */
const repointed = (
  node: RegularNode,
  target: (id: string) => string,
): RegularNode => {
  const named = targetsOf(node)
  if (named.length === 0) return node
  const next: Draft<RegularNode> = { ...node }
  // One pass per FIELD rather than per target: `targetsOf` answers a pair per
  // id, so a node with three `after` edges names that field three times.
  for (const field of new Set(named.map(([which]) => which))) {
    // Unreachable — a regular record does not point with `mirror`, which is a
    // placement's whole content — and spelled so the closed list stays the
    // thing being read rather than a list of three this file chose.
    if (field === "mirror") continue
    const ids = node[field]
    if (ids !== undefined) next[field] = ids.map(target)
  }
  return next
}

// ── several writes, one plan ───────────────────────────────────────────

/**
 * A run of ops, folded into ONE plan — what `apply` and `update` are both made
 * of, and the only place in this file that plans more than one thing.
 *
 * **IT CALLS {@link plan}, WHICH IS THE WHOLE DESIGN.** There is no batch
 * planner: there is the planner, run N times, each time against the reading the
 * run before it left behind ({@link ./following.ts}). Every refusal is
 * therefore the single verb's own refusal, in the single verb's own words, made
 * at the single verb's own moment — a shadowed property key, an unknown id
 * answered with the closest one, an `after` edge named as a loop, a `done` that
 * would come to stand over unfinished work. Nothing here decides anything about
 * an outline, and nothing here can drift from what one call does, because it IS
 * what one call does.
 *
 * **WHAT IT MERGES, and why each is that way:**
 *
 *   - the FILES, by path, LAST WINS. Every plan is whole files, and a plan made
 *     against the reading its predecessors produced already holds their work —
 *     so the last plan to touch a file is that file, finished. Anything else
 *     would be two writers of one path. The DOCUMENTS the same way: no verb in
 *     the batched list writes one today, and the day one joins it the merge is
 *     already right rather than a field somebody has to notice;
 *   - `captured`, CONCATENATED in op order, so a caller that captured three
 *     subtrees across a batch gets every id it did not choose;
 *   - the `nudge`s, JOINED. Each is news about a write that landed — a mark
 *     re-opened, a parent whose last task just finished — and news does not
 *     stop being true for arriving beside other news;
 *   - `id` / `title` / `file` from the LAST op. One answer has to name one node
 *     and the ops name several; the last one is the only choice that is right
 *     for `update`, where the run is one node and the last plan is the only one
 *     that has seen every field this call wrote (a retitle followed by a mark
 *     reports the NEW title). `captured` is where a batch's real inventory is.
 *
 * **WHAT IT DOES NOT DO IS WRITE, VALIDATE OR RETRY.** One plan comes out, and
 * the write gate does to it exactly what it does to every other plan: validates
 * the set it would produce once, renames once, produces one revision. That is
 * the atomicity, and it is inherited rather than implemented.
 */
const folded = (
  scope: Scope,
  ops: ReadonlyArray<BatchedRequest>,
  /** What a refused op's failure LOOKS LIKE to the caller. `apply` names the
   *  index; `update` hands the verb's refusal back untouched, because the caller
   *  wrote fields rather than a list and there is no index to name. */
  dress: (index: number, op: BatchedRequest, failure: OpFailure) => OpFailure,
  /** The commit subject, off the subjects of the ops it is made of and the last
   *  plan of the run — which is the only one that has seen every op's work, and
   *  the only place the FINAL title of a node this run retitled is written. */
  summarize: (summaries: ReadonlyArray<string>, last: Plan) => string,
): Planned => {
  const fold = folding(scope)
  const files = new Map<string, FilePlan>()
  const documents = new Map<string, DocumentPlan>()
  const captured: Array<Minted> = []
  const nudges: Array<string> = []
  const summaries: Array<string> = []
  let last: Plan | undefined
  let at: Reading = scope

  for (const [index, op] of ops.entries()) {
    const made = plan(at, scope.context, op)
    if (Result.isFailure(made)) return Result.fail(dress(index, op, made.failure))
    const one = made.success

    for (const planned of one.files) files.set(planned.file, planned)
    for (const planned of one.documents ?? []) documents.set(planned.file, planned)
    if (one.captured !== undefined) captured.push(...one.captured)
    if (one.nudge !== undefined) nudges.push(one.nudge)
    summaries.push(one.summary)
    last = one

    // NOT after the last op: nothing is judged against the set it leaves, and
    // producing that set means serialising and parsing every file it touched
    // for a reading nobody reads. A one-op batch therefore costs exactly what
    // the op costs.
    if (index === ops.length - 1) break
    const next = fold(one)
    if (Result.isFailure(next)) return Result.fail(next.failure)
    at = next.success
  }

  // Unreachable: both callers refuse an empty run before they get here, with a
  // sentence of their own about what to give instead.
  if (last === undefined) {
    return Result.fail(new UsageFailure({ reason: "nothing to do" }))
  }

  return Result.succeed({
    files: [...files.values()],
    ...(documents.size === 0 ? {} : { documents: [...documents.values()] }),
    id: last.id,
    title: last.title,
    file: last.file,
    ...(captured.length === 0 ? {} : { captured }),
    summary: summarize(summaries, last),
    ...(nudges.length === 0 ? {} : { nudge: nudges.join(" ") }),
  })
}

/**
 * A refused op, named by where it sat in the batch.
 *
 * The KIND is carried across rather than flattened — a batch whose third op
 * named a missing id is a `not-found`, and a caller that switches on the kind
 * must not be told `usage` because the refusal changed hands on the way out.
 * `named` and the validator's `errors` ride along for the same reason: the
 * detail is what the refusal was FOR.
 */
const refusedAt = (index: number, op: BatchedRequest, failure: OpFailure): OpFailure => {
  const reason = `\`ops[${index}]\` (\`${op.op}\`) was refused, so nothing in this ` +
    `batch was written: ${failure.message}`
  switch (failure._tag) {
    case "NotFoundFailure":
      return new NotFoundFailure({
        reason,
        ...(failure.named === undefined ? {} : { named: failure.named }),
      })
    case "ValidationFailure":
      return new ValidationFailure({ reason, errors: failure.errors })
    case "BusyFailure":
      return new BusyFailure({ reason })
    case "UsageFailure":
      return new UsageFailure({ reason })
  }
}

const planApply = (
  scope: Scope,
  request: Extract<Request, { op: "apply" }>,
): Planned => {
  const ops = request.ops
  if (ops.length === 0) {
    return Result.fail(
      new UsageFailure({
        reason:
          "give at least one op — `apply` runs a list of the write verbs you already " +
          "have, in order, as one write",
      }),
    )
  }
  if (ops.length > BATCH_AT_MOST) {
    return Result.fail(
      new UsageFailure({
        reason: `a batch runs at most ${BATCH_AT_MOST} ops and this one has ` +
          `${ops.length}, so nothing was written. Split it: each call is still one ` +
          `validation and one revision, and a batch that large is a plan nobody can ` +
          `read in a refusal.`,
      }),
    )
  }
  return folded(
    scope,
    ops,
    refusedAt,
    (summaries) =>
      `apply: ${summaries.length} op${summaries.length === 1 ? "" : "s"} — ${
        capped(summaries, (one) => one)
      }`,
  )
}

/**
 * Several fields of ONE node, folded into the verbs that write them.
 *
 * The desugaring is the whole implementation, and the ORDER of it is the one
 * decision this function makes: `title`, `desc`, `date`, the properties in the
 * order the caller wrote them, `after`, and the MARK LAST. Everything before
 * the mark is a fact about the node; the mark is a claim about it, and a claim
 * is judged against the node this call has finished making. `{mark: "doing",
 * after: ["order"]}` therefore meets `set_doing`'s gate with the edge already
 * in place, and is refused — which is the answer a caller asking for both in one
 * breath should get, and the opposite order would have landed a `doing` and
 * drawn it blocked a frame later.
 *
 * `after` REPLACES, and this is where that becomes a difference of what is
 * written: the whole list arrives, the difference against what the node holds is
 * computed, and `set_after` is handed exactly that difference. So the edges an
 * update does not mention come OFF — which is what "this is the list" means —
 * while every refusal is still the incremental verb's, including its no-op one:
 * a list identical to what is there changes nothing, and is turned away rather
 * than written.
 */
const planUpdate = (
  scope: Scope,
  request: Extract<Request, { op: "update" }>,
): Planned => {
  // Resolved FIRST, so an id nothing declares is answered before any field is
  // read — the same refusal, in the same place in the call, as every other verb
  // that names one node.
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { node } = target.success

  const id = request.id
  const ops: Array<BatchedRequest> = []
  const wrote: Array<string> = []

  // A CONDITION ON A WRITE THAT IS NOT HAPPENING is a caller that mis-typed one
  // of the two fields, and it is refused rather than ignored — the whole reason
  // `was` is spelled here at all is that a conditional silently going missing is
  // the failure this shape had to close.
  const was = request.was ?? {}
  for (const field of ["title", "desc"] as const) {
    if (was[field] !== undefined && request[field] === undefined) {
      return Result.fail(
        new UsageFailure({
          reason: `\`was.${field}\` says what this write expects \`${field}\` to hold, ` +
            `but this call does not write \`${field}\` — give the new value too, or ` +
            `drop the condition. Nothing was written.`,
        }),
      )
    }
  }

  if (request.title !== undefined) {
    ops.push({
      op: "title",
      id,
      title: request.title,
      // `set_title`'s OWN field, handed straight through — so the condition is
      // tested inside the plan and therefore on every attempt the write gate
      // makes, which is the whole point of it living there rather than here.
      ...(was.title === undefined ? {} : { was: was.title }),
    })
    wrote.push("title")
  }
  if (request.desc !== undefined) {
    ops.push({
      op: "desc",
      id,
      desc: request.desc,
      // `null` is a real answer here — "expects no note at all" — which is why
      // the test is on the key being present, exactly as `set_desc`'s is.
      ...(was.desc === undefined ? {} : { was: was.desc }),
    })
    wrote.push("note")
  }
  // THE DATE AND THE RULE ARE A PAIR, and which of them goes first is decided
  // by which way the pair is MOVING — the one place in this fold where the
  // fixed order bends.
  //
  // It bends because of what a fold IS here: each op is planned against the set
  // the ops before it left, and that set is assembled through the parser
  // ({@link ./following.ts}), so every INTERMEDIATE record has to be one the
  // format can read. A rule needs a date under it, so starting a recurrence
  // must schedule first — and STOPPING one must take the rule off first, or the
  // date is cleared out from under a rule that is still there and
  // `{date: null, repeat: null}` — a perfectly sensible thing to say — is
  // abandoned for a state it was on its way out of. Removal before addition,
  // which is the order every one of these calls actually means.
  //
  // `apply` needs no such rule and does not have one, and the difference is
  // not an oversight: a batch is ops somebody ORDERED, so the order is the
  // caller's to get right and the refusal names which one failed. `update` is
  // FIELDS, which have no order at all — so the planner has to choose one, and
  // this is the only choice that can work for both directions.
  const stopping = request.repeat === null
  const repeatOp = (): void => {
    if (request.repeat === undefined) return
    ops.push({ op: "repeat", id, repeat: request.repeat })
    wrote.push("repeat")
  }
  if (stopping) repeatOp()
  if (request.date !== undefined) {
    ops.push({ op: "date", id, date: request.date })
    wrote.push("date")
  }
  if (!stopping) repeatOp()
  for (const [key, value] of Object.entries(request.props ?? {})) {
    ops.push({ op: "prop", id, key, value })
    wrote.push(`\`${key}\``)
  }
  if (request.after !== undefined) {
    // The list, handed to `set_after` as the whole `add` plus whatever it
    // displaces — never as a difference on both sides. That is what carries the
    // incremental verb's refusals unchanged, the no-op one included: a list
    // identical to what is there arrives as an `add` of every target the node
    // already names, which is precisely the call that answers "already comes
    // after exactly …". A pre-computed difference would have arrived empty and
    // been refused for naming nothing, which is a sentence about a call the
    // caller did not make.
    //
    // `held` is read from the reading this call STARTED at rather than from
    // inside the fold, and the fixed field order above is what makes that
    // correct: nothing planned before `after` touches a node's `after`.
    const held = node.after ?? []
    const want = request.after
    ops.push({
      op: "after",
      id,
      add: want,
      remove: held.filter((one) => !want.includes(one)),
    })
    wrote.push("after")
  }
  if (request.mark !== undefined) {
    if (request.mark === null) {
      // THE ONE REFUSAL HERE THAT NO SINGLE VERB MAKES, named as the exception
      // it is: `mark: null` has no single-verb spelling — `set_done`,
      // `set_doing` and `set_todo` each have to be TOLD which mark they are
      // undoing — so "there is no mark to take off" is a sentence this shape
      // needs and none of them has. It is worded after `set_prop`'s refusal for
      // a key that is not there, which is the same gesture over the other kind
      // of absence. Every other refusal in this function is the single verb's,
      // verbatim, because every other field is that verb's own request.
      //
      // The node is read from the reading this call STARTED at, which is right
      // because nothing before the mark in the fold touches a mark — and it is
      // the only field here that reads across the fold, so the fixed order
      // above is what makes it true.
      const stored = storedMarker(node)
      if (stored === undefined) {
        return Result.fail(
          new UsageFailure({
            reason: `\`${node.title}\` carries no mark, so there is none to take off`,
          }),
        )
      }
      ops.push({ op: stored, id, undo: true })
      wrote.push(`un-${stored}`)
    } else {
      ops.push({ op: request.mark, id })
      wrote.push(request.mark)
    }
  }

  if (ops.length === 0) {
    return Result.fail(
      new UsageFailure({
        reason:
          "give at least one field to write — `title`, `desc`, `date`, `repeat`, " +
          "`props`, `after` or `mark`",
      }),
    )
  }

  return folded(
    scope,
    ops,
    // The verb's own refusal, UNDRESSED. A caller of `update` wrote fields, not
    // a list, so there is no index to name — and a `set_prop` refusal about a
    // shadowed key reads exactly as it does when `set_prop` is what was called.
    (_index, _op, failure) => failure,
    // The fields, not the sub-summaries: `update: the header (title, note,
    // done)` says what one gesture did, where five subjects strung together
    // would say it five times about one node. The title is the LAST plan's,
    // which is the new one when this call retitled.
    (_summaries, last) => `update: ${last.title} (${wrote.join(", ")})`,
  )
}

// ── the edges: see, after ──────────────────────────────────────────────

/**
 * The one thing an `after` edge may not do: close a loop.
 *
 * Read over `derive`'s ordering graph — `blocks` normalised in, both ends
 * resolved to NODES — which is the same graph the validator's acyclicity rule
 * walks, so this refusal and that error cannot disagree about whether two
 * records mean one edge. In particular a deadlock closing through a MIRROR is
 * one loop rather than two dead ends: naming a placement in `after` names the
 * node standing at it.
 *
 * The write would be refused either way — the gate re-validates the whole set
 * — but the validator's report is about a file that does not exist yet, and an
 * agent that is told which loop it would close can fix the call instead of the
 * file. So the message NAMES it, with the validator's own arrow.
 */
/** The node an edge target NAMES — a placement resolved to the node standing at
 *  it, which is how `derive` resolves both ends of every ordering edge. Spelled
 *  once because two callers ask it about one graph: the verb that writes an
 *  edge onto a node that exists ({@link cycling}) and the capture that writes
 *  one onto a node being born ({@link wiring}), and a loop refused by one of
 *  them and not the other would be two answers to "is `x` the same node as the
 *  placement `y`". */
const standingAt = (scope: Scope, target: string): string =>
  nodeNamed(scope.derived, target)?.node.id ?? target

const cycling = (scope: Scope, node: RegularNode, target: string): OpFailure | null =>
  closesLoop(
    (id) => scope.derived.after.get(id) ?? [],
    node.id,
    target,
    standingAt(scope, target),
  )

/**
 * The refusal itself, over whatever ordering graph the caller is holding.
 *
 * TWO graphs ask now, which is why the walk and the sentence are split from the
 * one that reads the derivation. `set_after` asks over the set's edges, which is
 * `derive`'s own normalised map. A CAPTURE asks over that map plus the edges the
 * capture is bringing with it ({@link wiring}) — nodes that do not exist yet,
 * pointing at each other and at nodes that do — and there is no derivation of a
 * tree nobody has written. The words are identical because they are these words,
 * once.
 */
const closesLoop = (
  edges: (id: string) => Iterable<string>,
  /** The node the edge is being written ON. */
  id: string,
  /** The target AS THE CALLER SPELLED IT — what the sentence quotes. */
  target: string,
  /** …and as the graph knows it: a placement resolved to the node standing at
   *  it, or the spelling itself when the graph is not the set's. */
  named: string,
): OpFailure | null => {
  const back = pathTo(named, id, edges)
  if (back === null) return null
  // `back` already ends where it started from, so the node's own id in front of
  // it IS the closed loop: `a → b → a`, and `a → a` for an edge onto itself.
  return new UsageFailure({
    reason: `\`${id}\` after \`${target}\` closes a loop — ${
      chainOf([id, ...back])
    } — and \`after\` (counting \`blocks\`) must stay acyclic, so nothing in it ` +
      `could ever start first`,
  })
}

/**
 * The edge fields an op may WRITE, and everything that differs between them:
 * the words a refusal about one uses, and the rule an add has to survive.
 *
 * One descriptor per field rather than a table of words beside a rule passed in
 * at the call site — the two are the same decision, and split apart a third
 * field would be two edits in two shapes with nothing to say they belong
 * together.
 *
 * `blocks` is not among them, and that is the format's own sugar rule read as a
 * writing rule: `a blocks b` IS `b after a`, so a writer that could spell both
 * would put one relation on disk two ways and leave every reader normalising.
 * Nothing stops a person writing `blocks` by hand — the format takes it and
 * `derive` folds it in — but an op writes the arrow one way. That is why this
 * list is narrower than the format's own edge fields rather than a copy of it.
 */
const EDGE = {
  see: {
    /** How the refusal for a node that carries none reads. */
    none: "has no `see` targets",
    /** …and for one that already says exactly what was asked for. */
    exact: "already sees exactly",
    /** Nothing: a `see` is a link and no more, so a loop of them is two notes
     *  pointing at each other, which is a thing people write on purpose. */
    forbid: (): null => null,
  },
  after: {
    none: "has no `after` edges",
    exact: "already comes after exactly",
    forbid: cycling,
  },
} as const satisfies Record<string, {
  readonly none: string
  readonly exact: string
  readonly forbid: (scope: Scope, node: RegularNode, target: string) => OpFailure | null
}>

/** The fields above — deliberately NOT the format's `after | blocks | see`,
 *  which is what a record may CARRY. */
type WritableEdge = keyof typeof EDGE

/**
 * Add and/or remove edge targets on a node — the whole of `set_see` and
 * `set_after`, which are one gesture over two fields.
 *
 * INCREMENTAL rather than a whole-array replace: an agent that has just
 * discovered one reference should not have to re-state every other one it
 * already set, and a call that says nothing is refused rather than writing the
 * array back unchanged.
 *
 * The refusal for a target that does not exist is {@link unknownId}, which
 * is the validator's own did-you-mean one moment earlier — the validator would
 * catch it too, with `file:line`, and an agent that can correct before the write
 * costs nobody a round trip.
 *
 * What differs between the two fields is what the edges MEAN, and that is
 * {@link EDGE}'s to say: `see` is free (no ordering, no blocking, cycles fine),
 * while `after` is the ordering graph and an add that closes a loop is refused
 * ({@link cycling}).
 */
const planEdges = (
  scope: Scope,
  field: WritableEdge,
  request: {
    readonly id: string
    readonly add?: ReadonlyArray<string> | undefined
    readonly remove?: ReadonlyArray<string> | undefined
  },
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const add = request.add ?? []
  const remove = request.remove ?? []
  if (add.length === 0 && remove.length === 0) {
    return Result.fail(
      new UsageFailure({
        reason:
          `give \`add\` and/or \`remove\` — at least one target to change on this ` +
          `node's \`${field}\``,
      }),
    )
  }

  for (const id of add) {
    if (!scope.derived.byId.has(id)) return Result.fail(unknownId(scope, id))
    const refused = EDGE[field].forbid(scope, node, id)
    if (refused !== null) return Result.fail(refused)
  }

  // Existing order preserved; removes drop out; adds that are new append.
  // Re-adding one already listed is a silent no-op for that id, and removing
  // one that was never there is the same — the refusal below catches a plan
  // that would write nothing.
  const drop = new Set(remove)
  const next: Array<string> = []
  for (const id of node[field] ?? []) {
    if (!drop.has(id)) next.push(id)
  }
  for (const id of add) {
    if (!next.includes(id)) next.push(id)
  }

  const previous = node[field] ?? []
  if (
    previous.length === next.length &&
    previous.every((id, index) => id === next[index])
  ) {
    return Result.fail(
      new UsageFailure({
        reason: previous.length === 0
          ? `\`${node.title}\` ${EDGE[field].none}, and nothing to add was named`
          : `\`${node.title}\` ${EDGE[field].exact} ${
            previous.map((id) => `\`${id}\``).join(", ")
          } — nothing would change`,
      }),
    )
  }

  const draft: Draft<RegularNode> = { ...node }
  if (next.length === 0) delete draft[field]
  else draft[field] = next

  return Result.succeed({
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, touched(scope, draft)) }],
    id: node.id,
    title: node.title,
    file,
    summary: `${field}: ${node.title}`,
  })
}

const planSee = (
  scope: Scope,
  request: Extract<Request, { op: "see" }>,
): Planned => planEdges(scope, "see", request)

const planAfter = (
  scope: Scope,
  request: Extract<Request, { op: "after" }>,
): Planned => planEdges(scope, "after", request)

// ── mirrors ────────────────────────────────────────────────────────────

/**
 * A second PLACEMENT of a node that already exists.
 *
 * The record is `{id, parent?, ord, mirror}` and cannot be anything else: it is
 * built here, from a request that has no field for a title or a mark, so "a
 * mirror carries nothing but its four" is unrepresentable rather than checked
 * (docs/format.md's Two record shapes). What the op decides is only where the
 * placement goes — the same landing and the same `before`/`after` an `add` gets
 * — and what it may show.
 *
 * TWO refusals are its own, and both are about the target:
 *
 *   - an id nothing declares, refused with the closest one that is
 *     ({@link unknownId}). The validator would say so too; saying it here
 *     costs the agent nothing and the write never happens;
 *   - a CONTAINMENT cycle: a mirror placed inside the subtree it shows expands
 *     forever, so the walk that would draw it is the walk that has to refuse it
 *     ({@link showsInto}).
 *
 * A chain — a mirror of a mirror — is allowed, because the format allows it and
 * `follow` resolves it: what a second pointer to a pointer shows is the node at
 * the end of it. It is the one case where the target a record names and the node
 * a reader sees are different records, and every answer here uses the node.
 */
const planMirror = (
  scope: Scope,
  request: Extract<Request, { op: "mirror" }>,
): Planned => {
  const landing = landsIn(scope, request)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  const { file, parent } = landing.success

  if (!scope.derived.byId.has(request.target)) {
    return Result.fail(unknownId(scope, request.target))
  }

  if (parent !== undefined) {
    const loop = showsInto(scope, request.target, parent)
    if (loop !== null) {
      return Result.fail(
        new UsageFailure({
          reason:
            `\`${parent}\` is inside what \`${request.target}\` shows — ${loop} — so a ` +
            `mirror of it there would expand forever. A mirror may not be placed ` +
            `inside the subtree it shows.`,
        }),
      )
    }
  }

  const chosen = idFor(scope, new Set<string>(), request.id)
  if (Result.isFailure(chosen)) return Result.fail(chosen.failure)
  const id = chosen.success

  const ords = placed(siblingsOf(scope.derived, file, parent), id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ordFor(ords.success, id)

  const record: MirrorNode = {
    id,
    ...(parent === undefined ? {} : { parent }),
    ord,
    mirror: request.target,
  }

  const title = shownTitle(scope, request.target)
  return Result.succeed({
    files: [
      { file, nodes: withOrds([...recordsOf(scope, file), record], ords.success) },
    ],
    // The PLACEMENT's id — it is what `remove_mirror` takes, and nobody may
    // have chosen it — under the TARGET's title, which is what a person reading
    // the log recognises.
    id,
    title,
    file,
    summary: `mirror: ${title}`,
  })
}

/**
 * The loop a record drawn under `parent` would close, or `null` — asked of what
 * `target` DRAWS.
 *
 * The graph is `@olai/format`'s `drawnFrom` and the walk over it is that
 * package's `drawingPath`, which is what the validator's containment rule
 * walks. That sharing is the point rather than a convenience: a second copy
 * here would be a placement this op allowed and the write gate then refused,
 * which is a refusal the tool that planned it did not know it was heading for.
 * (It was a second WALK over the shared graph until the move grew this check —
 * and a rule that walks a shared graph its own way is a second answer with
 * extra steps.)
 *
 * TWO OPS ASK IT, and the difference is only what `target` is. `add_mirror`
 * asks about the node the new placement would SHOW: that placement has exactly
 * one way in — it is a child of `parent` — so the question is whether drawing
 * the target ever reaches `parent`, and a top-level placement (no parent) has
 * no way in at all. `move_node` asks about the record being MOVED, which is
 * the same question one level out: everything that record draws — its own
 * subtree, and whatever the placements inside it show — is about to hang under
 * `parent`.
 */
const showsInto = (
  scope: Scope,
  target: string,
  parent: string,
): string | null => {
  const path = drawingPath(scope.derived, target, parent)
  return path === null ? null : chainOf(path)
}

/** What to call a placement in a summary and a reply: the TITLE of the node it
 *  shows, chain followed, because that is the thing a person reading a commit
 *  log recognises. The id it was named by is the fallback, for the one case
 *  where the chain does not end at a node — a set the validator has condemned,
 *  which a plan can still be asked about. */
const shownTitle = (scope: Scope, target: string): string =>
  nodeNamed(scope.derived, target)?.node.title ?? target

/**
 * Retire a placement.
 *
 * Removing a mirror deletes a LINE, not a node: the target keeps its title, its
 * mark, its children and its own place in whatever outline defines it, and
 * every other placement of it stays exactly where it was. That is the whole
 * semantic, and it is why this is not `archive_node` (which MOVES a node and its
 * subtree into `Archive.olai`, ids and all) and not a delete of anything —
 * there is no op in this layer that destroys content, and this one does not
 * become the first by accident.
 *
 * So the refusal for a regular node is not a technicality. `remove_mirror` on
 * the id of a node would be a caller asking to unsay something it never said,
 * and answering it by archiving the node — the nearest thing that "removes" it
 * — would put a subtree away nobody asked to put away.
 *
 * A placement something else still NAMES is refused here too, and that is a
 * correction (2026-08-11 review): it was left to the validator, on the grounds
 * that this file refuses only what it can refuse without re-validating. The
 * refusal was safe — nothing landed — but it was not an answer anyone could
 * act on. What came back was a row about the file the write would have
 * produced, saying `mirror` names `now-install`, which no node declares, about
 * a record the caller never touched — and, because an id that has just been
 * deleted is by definition unknown, sometimes with a did-you-mean pointing at
 * a NEIGHBOUR of the thing the caller asked to remove. A refusal that teaches
 * the wrong lesson is worse than one that teaches none.
 *
 * It is still not re-validation: {@link dependents} is a lookup in the
 * snapshot's own derivation, the same kind of thing the containment walk is,
 * and the index it reads is the format's `targetsOf` reversed, so a relation
 * added later cannot slip past it. The validator remains the backstop for
 * everything else.
 */
const planUnmirror = (
  scope: Scope,
  request: Extract<Request, { op: "unmirror" }>,
): Planned => {
  const located = scope.derived.byId.get(request.id)
  if (located === undefined) return Result.fail(unknownId(scope, request.id))
  const { file, node } = located

  if (!isMirror(node)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${request.id}\` is a node, not a mirror. \`remove_mirror\` retires a ` +
          `PLACEMENT — one line showing a node in a second location — and never ` +
          `touches the node itself; \`archive_node\` is what puts a node and its ` +
          `subtree away.`,
      }),
    )
  }

  const may = writable(scope, file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  const held = dependents(scope, node.id)
  if (held.length > 0) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${node.id}\` is still named by ${held.join(", ")} — retiring it would ` +
          `leave ${held.length === 1 ? "that" : "those"} pointing at nothing. Re-point ` +
          `${held.length === 1 ? "it" : "them"} at \`${node.mirror}\` (the node this ` +
          `placement shows), or retire ${held.length === 1 ? "it" : "them"} first.`,
      }),
    )
  }

  const title = shownTitle(scope, node.mirror)
  return Result.succeed({
    files: [
      {
        file,
        nodes: recordsOf(scope, file).filter((record) => record.id !== node.id),
      },
    ],
    id: node.id,
    title,
    file,
    summary: `unmirror: ${title}`,
  })
}

/**
 * What would be left pointing at nothing if this record went — each named with
 * the field that names it and where that line is.
 *
 * A mirror is addressable like any other record, so anything may name one: a
 * second placement chained onto it, or an `after` / `blocks` / `see` written at
 * it. WHICH fields those are is the format's answer rather than a list kept
 * here — `Derived.namedBy` is `targetsOf` reversed over the whole set — and a
 * list of edge fields in this file is one a fourth relation would silently fall
 * out of, with the write it should have refused landing.
 *
 * RAW, which is why it is that index and not the canonical reverse ones beside
 * it: what a refusal has to quote is what the records SAY. An `after` written
 * at this placement resolves, in `edgesTo`, to the node the placement shows —
 * so asking there would find nothing to refuse, about the one record whose
 * removal is the reason to ask.
 *
 * `parent` is not among them because a mirror cannot be one: the validator
 * refuses a record whose parent is a placement, so no set this planner is ever
 * handed has a child hanging off one.
 */
// ── documents ──────────────────────────────────────────────────────────

/**
 * Replace one document's text, whole.
 *
 * The op that is not about a node, and the shortest plan there is: the text IS
 * the file, so there is no placement to compute, no records to re-emit, and
 * nothing the format's writer has to be asked about. It still rides the whole
 * gate — validate the set the write would produce, stage, rename, commit — so
 * a document write is audit-trailed and revision-published exactly as a node
 * write is, and an open page sees it the way it sees a `git pull`.
 *
 * IT WRITES DOCUMENTS, and that is narrower than "a file the set holds". The
 * set carries every BODIED file — a `.html` rides the same collection and the
 * same probe — and this verb is `write_document`: what it takes is what it is
 * named for, asked of the format's registry rather than of which list the path
 * turned up in. So a `.html` is not found here, and the sentence a caller gets
 * is the one below, naming `create_document` and the nearest document. That is
 * the whole of why the page for one has no Edit control (`@olai/web`'s
 * `document/faces.tsx`): the affordance would be a door onto this refusal.
 *
 * TWO refusals are its own:
 *
 *   - a path the set does not hold, with the closest one that exists — the
 *     `write`/`create` split, so a typo cannot mint a file;
 *   - a `was` the file no longer says. THE CONFLICT STORY: the same file can be
 *     edited in vim while a browser holds it open, and a caller that says what
 *     it read is refused, on every retry the write gate makes, when the disk
 *     has moved since ({@link TitleRequest}'s `was`, at file size). The refusal
 *     deliberately does not quote either text — a document is not a title, and
 *     the caller re-reads the file rather than a sentence.
 */
const planWriteDocument = (
  scope: Scope,
  request: Extract<Request, { op: "doc" }>,
): Planned => {
  // The kind is asked of the REQUESTED path rather than of every entry: a
  // `.html` is refused by its own name, and the walk over the set is then only
  // what the near-miss list below needs — which is the failure path.
  const document = fileKind(request.file) === "document"
    ? scope.set.documents.find((entry) => entry.file === request.file)
    : undefined
  if (document === undefined) {
    const near = didYouMean(
      request.file,
      scope.set.documents
        .filter((entry) => fileKind(entry.file) === "document")
        .map((entry) => entry.file),
    )
    return Result.fail(
      new NotFoundFailure({
        reason: near === ""
          ? `\`${request.file}\` is not a document under the served directory — ` +
            `\`create_document\` is what starts one`
          : `\`${request.file}\` is not a document under the served directory${near}`,
        named: request.file,
      }),
    )
  }

  // A document the directory holds but could not READ decodes to nothing, and
  // overwriting nothing would drop whatever the file really says — which is
  // `writable`'s own rule, read of the other kind of file.
  const may = writable(scope, request.file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  // The same conditional-write check the two text fields make, over a whole
  // file: one function decides "did this still say what the caller thought",
  // and the callers differ only in the sentence a reader gets.
  const conflict = stale(
    request.was,
    document.text,
    `\`${request.file}\` has changed since it was read — the text on disk is ` +
      `not what this write expected to replace, so nothing was written. Read the ` +
      `document again and re-derive your edit from what it says now.`,
  )
  if (conflict !== null) return Result.fail(conflict)

  return Result.succeed({
    files: [],
    documents: [{ file: request.file, text: request.text }],
    id: request.file,
    title: request.file,
    file: request.file,
    summary: `doc: ${request.file}`,
  })
}

/**
 * A brand-new document under the served directory.
 *
 * `create_outline`'s twin: the path is judged by the same segment rules with
 * the other extension ({@link documentPath}), a path the set already holds is
 * refused — write refuses a missing file and create an existing one, so a typo
 * can never quietly mint a document — and the write gate's stage → validate →
 * rename already knows how to make the directories a nested path needs. The
 * sidebar sees the new file the way it sees everything: on the revision the
 * write publishes.
 */
const planCreateDocument = (
  scope: Scope,
  request: Extract<Request, { op: "create-doc" }>,
): Planned => {
  const file = documentPath(request.file)
  if (file === null) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${request.file}\` is not a relative \`.md\` path under the served ` +
          `directory (no absolute path, no \`..\`, no \`.\`, and the name must end ` +
          `in \`.md\`)`,
      }),
    )
  }

  if (scope.set.documents.some((entry) => entry.file === file)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${file}\` is already a document under the served directory — create ` +
          `starts a new one; \`write_document\` is what edits this one`,
      }),
    )
  }

  return Result.succeed({
    files: [],
    documents: [{ file, text: request.text ?? "" }],
    id: file,
    title: file,
    file,
    summary: `create: ${file}`,
  })
}

/**
 * WHAT WOULD BE LEFT POINTING AT NOTHING — the one question two removals ask,
 * over a set of ids rather than over one.
 *
 * Both writes that take records OUT of the set have to ask it, and they are
 * asking the same thing: `remove_mirror` about a single placement, and
 * `empty_trash` about every record in an archive. A second spelling would be
 * two answers to "who still names this" — and, worse, two formats for the
 * sentence that names them, in the two refusals a person is most likely to
 * meet one after the other.
 *
 * `namedBy` is the format's own `targetsOf` read backwards, built with the rest
 * of the derivation — so a relation the format grows later still cannot slip
 * past this, and asking the question costs a lookup per id rather than a walk
 * of the corpus.
 *
 * WHAT IS GOING IS NOT A DEPENDENT OF ITSELF, and that is why the argument is a
 * SET rather than an id with a self-check beside it. A record naming another
 * record in the same removal goes when it goes; so does one naming itself. Read
 * with a set of one, that is exactly the old self-check, which is what makes
 * this one function rather than a generalisation with a special case in it.
 *
 * One entry per NAMING RECORD, not per edge: a live row pointing at three of
 * the records being deleted is one thing to re-point and reads as one.
 */
const heldBy = (scope: Scope, going: ReadonlySet<string>): ReadonlyArray<string> => {
  const held = new Map<string, string>()
  for (const id of going) {
    for (const naming of scope.derived.namedBy.get(id) ?? []) {
      if (going.has(naming.at.node.id)) continue
      held.set(
        naming.at.node.id,
        `\`${naming.at.node.id}\` (${
          naming.fields.map((field) => `\`${field}\``).join(", ")
        }, ${naming.at.file}:${naming.at.line})`,
      )
    }
  }
  return [...held.values()]
}

/** {@link heldBy} of one record — what `remove_mirror` asks about the placement
 *  it is retiring. */
const dependents = (scope: Scope, id: string): ReadonlyArray<string> =>
  heldBy(scope, new Set([id]))
