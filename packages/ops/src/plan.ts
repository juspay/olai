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
  bodyKind,
  chainOf,
  isArchived,
  derive,
  type Derived,
  didYouMean,
  drawnFrom,
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
  nodesOf,
  type OpFailure,
  ordBetween,
  OUTLINE_EXT,
  shadowFor,
  siblingsOf,
  standingBefore,
  type OutlineSet,
  type RegularNode,
  storedMarker,
  targetsOf,
  unfinishedUnder,
  withCustom,
  UsageFailure,
  ValidationFailure,
  type Capture,
  type Minted,
  NESTING,
  type WriteRequest as Request,
} from "@olai/format"
import { Result } from "effect"

import { index } from "./query.ts"

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

export const plan = (
  set: OutlineSet,
  context: Context,
  request: Request,
): Planned => {
  // `index`, not a fresh `derive`: the derivation is memoised per SET
  // (`./query.ts`), and every caller of this has already read that set — a
  // tool call to answer the request, the editor to resolve a keystroke. A
  // second derivation per write is the whole corpus walked again for an answer
  // already in hand, and the editor made that a per-keystroke cost.
  const derived = index(set)
  const scope = { set, derived, context }

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
    case "unarchive":
      return planUnarchive(scope, request)
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
  }
}

// ── the shared middle ──────────────────────────────────────────────────

interface Scope {
  readonly set: OutlineSet
  readonly derived: Derived
  readonly context: Context
}

/** A field set to a value, or removed when the value is `null`. `undefined` is
 *  how the format spells absent, and the writer omits it — so this is the one
 *  place "clear the date" turns into "there is no `date` key". */
const withField = <K extends "desc" | "date">(
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
export const notFound = (derived: Derived, id: string): OpFailure => {
  // The CLAUSE is the format's too, not just the budget behind it: a refusal
  // and a load error say "did you mean" in one voice or in two.
  const near = didYouMean(id, derived.byId.keys())
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
  const taken = new Set<string>()
  const root = idFor(scope, taken, request.id)
  if (Result.isFailure(root)) return Result.fail(root.failure)
  const id = root.success

  const ords = placed(siblingsOf(scope.derived, file, parent), id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ordFor(ords.success, id)

  const minted: Array<RegularNode> = []
  const refused = emit(scope, taken, minted, request, {
    id,
    parent,
    ord,
    below: NESTING,
  })
  if (refused !== null) return Result.fail(refused)

  // What came WITH the node the caller named. Only the commit line asks: the
  // answer says what it made whether that is one node or fifteen, and `(+0)`
  // would be a subject counting nothing.
  const under = minted.length - 1
  return Result.succeed({
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
  })
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
    // The instant it came into being, and the one place it is written. A node
    // gets no `changed` here: it has not been changed, it has been captured,
    // and `changed` absent beside a `created` is the honest answer for a node
    // nobody has written to since (./plan.ts's `touched`).
    created: scope.context.now(),
  }
  if (capture.mark !== undefined) node[capture.mark] = marker(scope, capture.mark)
  if (capture.date !== undefined) node.date = capture.date
  if (capture.desc !== undefined) node.desc = capture.desc
  return node
}

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
  taken: Set<string>,
  records: Array<RegularNode>,
  capture: Capture,
  /** Where this node lands, and how many further generations may hang off it. */
  at: At & { readonly below: number },
): OpFailure | null => {
  if (capture.title.trim() === "") {
    return new UsageFailure({ reason: "a node needs a title" })
  }
  records.push(capturedNode(scope, capture, at))

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
    const id = idFor(scope, taken, child.id)
    if (Result.isFailure(id)) return id.failure
    const refused = emit(scope, taken, records, child, {
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

  // Setting one mark CLEARS the others: a node carrying two is a record the
  // format rejects, so this is not tidiness — it is what makes the write valid.
  const next: Draft<RegularNode> = { ...node }
  for (const other of MARKS) delete next[other]
  // Only the node being marked is touched — every other record in the file is
  // re-emitted exactly as it was read, so a `true` or a day-only value
  // elsewhere stays the text it was.
  if (!undo) next[mark] = marker(scope, mark)

  const summary = undo
    ? `${UNMARKED[mark]}: ${node.title}`
    : `${mark}: ${node.title}`

  const note = nudged(scope, node, mark, undo)

  return Result.succeed({
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, touched(scope, next)) }],
    id: node.id,
    title: node.title,
    file,
    summary,
    ...(note === undefined ? {} : { nudge: note }),
  })
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
 * NOT the capture path, and that is a property of the format rather than an
 * omission: a node born marked (`add_node`'s `mark`) has no `after` edges of
 * its own — the capture schema's `after` is a sibling ANCHOR — and a `blocks`
 * pointing at an id the set does not declare yet is `unknown-target`, which
 * the validator refuses. A capture cannot arrive blocked.
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
 * What the rollup has to say about a mark that has just been written — and it
 * is a REMARK, never a refusal.
 *
 * A mark is a stored fact on the node that carries it, so nothing here can
 * make a write illegal: the two things a rollup notices are the two a person
 * usually wants noticed, and both arrive after the fact. That the FINISHING
 * verb only remarks while the STARTING verb refuses is argued one function up
 * ({@link heldUp}); this half of it stayed exactly as it was.
 *
 *   - a branch ticked done over tasks nobody finished. Sometimes exactly what
 *     was meant ("shipped, dropping the rest"), which is why it is said and
 *     not refused;
 *   - the last unfinished task under a parent going done, which is the moment
 *     somebody might want to tick the parent too — and now can, whatever else
 *     hangs off it.
 *
 * Deliberately not a load invariant. A set arrives from a git merge with
 * nobody to nudge, and a file that will not load is a worse answer to "these
 * two disagree" than a file that loads and says so.
 */
const nudged = (
  scope: Scope,
  node: RegularNode,
  mark: Status,
  undo: boolean,
): string | undefined => {
  if (undo || mark !== "done") return undefined

  const said: Array<string> = []

  // Both questions are the format's one answer, read twice: which child tasks
  // are still open. A second walk here would be a second rule about what
  // counts as unfinished, and the bullets are what it would get wrong.
  const own = unfinishedUnder(scope.derived, node.id)
  if (own.length > 0) {
    said.push(
      `\`${node.title}\` is done over ${own.length} unfinished ` +
        `${own.length === 1 ? "task" : "tasks"}: ` +
        `${own.map((child) => `\`${child.node.title}\``).join(", ")}. Done-hidden ` +
        `hides the branch, so mark those too if they are finished.`,
    )
  }

  // The parent as it reads AFTER this write. The snapshot still calls the node
  // being marked unfinished, so "nothing else is open" is what is asked —
  // waiting for the write to land would be waiting for the moment to pass.
  const above = node.parent === undefined
    ? undefined
    : scope.derived.byId.get(node.parent)?.node
  if (
    above !== undefined && !isMirror(above) && storedMarker(above) !== "done" &&
    unfinishedUnder(scope.derived, above.id).every((child) => child.node.id === node.id)
  ) {
    said.push(
      `every task under \`${above.title}\` is done now — mark it done too if ` +
        `the branch is finished.`,
    )
  }

  return said.length === 0 ? undefined : said.join(" ")
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
 * that fact.
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
  if (key === "") {
    return Result.fail(new UsageFailure({ reason: "a property needs a key" }))
  }
  const shadow = shadowFor(key)
  if (shadow !== undefined) {
    return Result.fail(
      new UsageFailure({
        reason: `${
          shadow.field
            ? `a node already says \`${key}\` with a field of its own`
            : `\`${key}\` is what a node's own fields already answer`
        }, so a property by that name would be a second answer to one question — ${shadow.door}`,
      }),
    )
  }

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
  }

  const ords = placed(siblingsOf(scope.derived, file, parent), node.id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)

  const moved = withParent(node, parent)
  // A mirror has no title of its own — it is a placement of a node that does —
  // so what the commit line calls it is the id it was named by.
  const title = isMirror(node) ? request.id : node.title
  return Result.succeed({
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
  })
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

  const { existing, scaffold, buried } = buriedIn(scope, archive, node)
  const nudge = carriedOff(scope, node)
  return Result.succeed({
    files: [
      { file, nodes: keeps },
      { file: archive, nodes: [...existing, ...scaffold, buried] },
    ],
    id: into.id,
    title,
    file,
    summary: `merge: ${title}`,
    ...(nudge === undefined ? {} : { nudge }),
  })
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
  const taken = new Set<string>()
  const chosen = idFor(scope, taken, seed.id)
  if (Result.isFailure(chosen)) return Result.fail(chosen.failure)
  const id = chosen.success

  const minted: Array<RegularNode> = []
  const refused = emit(scope, taken, minted, seed, {
    id,
    // Top level of a file that does not exist yet, so there is nobody to place
    // it among: the first key, the one an `add` mints with no siblings.
    parent: undefined,
    ord: nextOrd(null),
    below: NESTING,
  })
  if (refused !== null) return Result.fail(refused)

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

  const arriving = recordsOf(scope, destination)
  const reparented: Node = {
    ...withParent(node, parent),
    ord: appendedOrd([arriving], parent),
  }

  return Result.succeed({
    files: [
      { file, nodes: keeps.filter((record) => !dropped.has(record.id)) },
      { file: destination, nodes: [...arriving, reparented, ...descendants] },
    ],
    id: node.id,
    title: node.title,
    file: destination,
    summary: `unarchive: ${node.title}`,
  })
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
const cycling = (scope: Scope, node: RegularNode, target: string): OpFailure | null => {
  const named = nodeNamed(scope.derived, target)?.node.id ?? target
  const back = pathTo(named, node.id, (id) => scope.derived.after.get(id) ?? [])
  if (back === null) return null
  // `back` already ends where it started from, so the node's own id in front of
  // it IS the closed loop: `a → b → a`, and `a → a` for an edge onto itself.
  return new UsageFailure({
    reason: `\`${node.id}\` after \`${target}\` closes a loop — ${
      chainOf([node.id, ...back])
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
 * The loop a mirror of `target` under `parent` would close, or `null`.
 *
 * The graph is `@olai/format`'s `drawnFrom` — what drawing a record leads to
 * drawing — which is the same derivation the validator's containment rule
 * walks. That sharing is the point rather than a convenience: a second copy
 * here would be a placement this op allowed and the write gate then refused,
 * which is a refusal the tool that planned it did not know it was heading for.
 *
 * The new placement has exactly one way IN — it is a child of `parent` — so the
 * question is whether drawing what the target shows ever reaches `parent`, and
 * a top-level placement (no parent) has no way in at all.
 */
const showsInto = (
  scope: Scope,
  target: string,
  parent: string,
): string | null => {
  const path = pathTo(target, parent, (id) => {
    const at = scope.derived.byId.get(id)
    return at === undefined ? [] : drawnFrom(scope.derived, at.node)
  })
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

const dependents = (scope: Scope, id: string): ReadonlyArray<string> =>
  // `namedBy` is the format's own `targetsOf` read backwards, built with the
  // rest of the derivation — so a relation added later still cannot slip past
  // this, and asking the question stopped costing a walk of the corpus. A
  // record naming ITSELF is not a dependent of itself: it goes when it goes.
  (scope.derived.namedBy.get(id) ?? [])
    .filter((naming) => naming.at.node.id !== id)
    .map((naming) =>
      `\`${naming.at.node.id}\` (${
        naming.fields.map((field) => `\`${field}\``).join(", ")
      }, ${naming.at.file}:${naming.at.line})`
    )
