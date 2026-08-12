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
  chainOf,
  derive,
  type Derived,
  didYouMean,
  drawnFrom,
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
  siblingsOf,
  type OutlineSet,
  type RegularNode,
  storedMarker,
  unfinishedUnder,
  UsageFailure,
  ValidationFailure,
} from "@olai/format"
import { Result } from "effect"

import { type Capture, type Minted, NESTING, type Request } from "./request.ts"

/** One outline, as the records it will hold after the write. */
export interface FilePlan {
  readonly file: string
  readonly nodes: ReadonlyArray<Node>
}

export interface Plan {
  readonly files: ReadonlyArray<FilePlan>
  /** The node the op was about, and where it lives once the write lands. */
  readonly id: string
  readonly title: string
  readonly file: string
  /** Every node a capture created, parent before child. Absent unless the op
   *  made a subtree — {@link Applied}'s own field says why. */
  readonly captured?: ReadonlyArray<Minted>
  /** The git commit subject, in the convention `olai` has always used:
   *  `capture:` / `done:` / `doing:` / `todo:` / `move:` / `archive:` / `create:` /
   *  `see:` / `after:` / `mirror:` / `unmirror:` and a title (or a path, when an
   *  outline is born empty). A placement's subject names what it SHOWS — the
   *  target's title — since a mirror has none of its own. */
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
  const derived = derive(set.nodes)
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
      )
    case "desc":
      return planEdit(
        scope,
        request.id,
        (node) => withField(node, "desc", request.desc),
        (node) => `note: ${node.title}`,
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
    case "move":
      return planMove(scope, request)
    case "archive":
      return planArchive(scope, request)
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
 */
const unknownId = (scope: Scope, id: string): OpFailure => {
  // The CLAUSE is the format's too, not just the budget behind it: a refusal
  // and a load error say "did you mean" in one voice or in two.
  const near = didYouMean(id, scope.derived.byId.keys())
  return new NotFoundFailure({
    reason: near === ""
      ? `\`${id}\` is not a node in the loaded set, and nothing in it is spelled ` +
        `close enough to be a typo of it — \`search_nodes\` finds a node by title, ` +
        `id or \`#tag\``
      : `\`${id}\` is not a node in the loaded set${near}`,
    named: id,
  })
}

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

/** The record with this id, or the refusal that says so. A MIRROR is not an
 *  answer: it is a second placement of a node that lives elsewhere, and every
 *  op edits the node. */
const regularAt = (scope: Scope, id: string): Result.Result<LocatedRegular, OpFailure> => {
  const located = scope.derived.byId.get(id)
  if (located === undefined) return Result.fail(unknownId(scope, id))
  if (isMirror(located.node)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${id}\` is a mirror — a second placement of \`${located.node.mirror}\`, ` +
          `not a node of its own. Name \`${located.node.mirror}\` instead.`,
      }),
    )
  }
  return Result.succeed(located as LocatedRegular)
}

/**
 * A file this op may write, or the refusal that says why not.
 *
 * An outline whose lines did not parse contributes no records to the set, so
 * re-emitting it from the set would erase everything in it. That has to be a
 * refusal, and it has to be the one that says which lines are broken — fix the
 * file, then edit it.
 */
const writable = (scope: Scope, file: string): Result.Result<void, OpFailure> => {
  const broken = scope.set.broken.find((entry) => entry.file === file)
  if (broken !== undefined) {
    return Result.fail(
      new ValidationFailure({
        reason:
          `\`${file}\` has lines that do not parse, so its records are not loaded — ` +
          `writing it would drop them. Fix the file first.`,
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
  nodesOf(scope.set.nodes, file).map((located) => located.node)

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

  // The floor of the unrolled schema ({@link ./request.ts}'s `NESTING`). Only
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
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, next) }],
    id: node.id,
    title: node.title,
    file,
    summary,
    ...(note === undefined ? {} : { nudge: note }),
  })
}

/**
 * What the rollup has to say about a mark that has just been written — and it
 * is a REMARK, never a refusal.
 *
 * A mark is a stored fact on the node that carries it, so nothing here can
 * make a write illegal: the two things a rollup notices are the two a person
 * usually wants noticed, and both arrive after the fact.
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
 *  made twice. */
const planEdit = (
  scope: Scope,
  id: string,
  edit: (node: RegularNode) => RegularNode,
  summarize: (node: RegularNode) => string,
): Planned => {
  const target = editable(scope, id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const next = edit(node)
  if (next.title.trim() === "") {
    return Result.fail(new UsageFailure({ reason: "a node needs a title" }))
  }
  const summary = summarize(next)

  return Result.succeed({
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, next) }],
    id: node.id,
    title: next.title,
    file,
    summary,
  })
}

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
        nodes: withOrds(replacing(recordsOf(scope, file), node.id, moved), ords.success),
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
          `\`${request.file}\` is not a relative \`.jsonl\` path under the served ` +
          `directory (no absolute path, no \`..\`, no \`.\`, and the name must end ` +
          `in \`.jsonl\`)`,
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
 * not one relative `.jsonl` under the served root.
 *
 * Same discipline as `mediaTarget` in `@olai/surface`: judge segments after
 * they are read, refuse empty / `.` / `..` / separators / NUL rather than
 * resolving them, and require the name the format already treats as an outline.
 * Absolute paths (leading `/`) and Windows-style backslash separators never
 * become a segment that could be joined under the root by accident.
 */
export const outlinePath = (raw: string): string | null => {
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
  return file.endsWith(".jsonl") ? file : null
}

// ── archive ────────────────────────────────────────────────────────────

/**
 * A subtree out of a working outline and into `Archive.jsonl` beside it, with
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

  const cut = file.lastIndexOf("/")
  const archive = cut === -1 ? ARCHIVE : `${file.slice(0, cut + 1)}${ARCHIVE}`
  if (file === archive) {
    return Result.fail(
      new UsageFailure({ reason: `\`${node.title}\` is already in \`${archive}\`` }),
    )
  }

  for (const touched of [file, archive]) {
    const may = writable(scope, touched)
    if (Result.isFailure(may)) return Result.fail(may.failure)
  }

  // Everything under the node, by `parent` — which is same-file by the format,
  // so the walk never leaves this outline. The file's records are read ONCE and
  // shared with the walk: `recordsOf` filters and sorts the whole set.
  const records = recordsOf(scope, file)
  const moving = subtreeOf(scope, records, node.id)
  const movingIds = new Set(moving.map((record) => record.id))

  const source = records.filter((record) => !movingIds.has(record.id))
  const existing = recordsOf(scope, archive)

  // The chain, outermost first, as titles. It is the DEFINING file's ancestry:
  // the titles indented above the node in the outline it actually lives in.
  const chain = ancestorsOf(scope.derived, node.id).map((crumb) => crumb.node.title)

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
    const ord = appendedOrd([existing, scaffold], parent)
    const record: RegularNode = {
      id,
      ...(parent === undefined ? {} : { parent }),
      ord,
      title,
    }
    scaffold.push(record)
    parent = id
    level = []
  }

  // The root is re-parented onto the scaffold; everything under it keeps the
  // `parent` it had, so the subtree arrives shaped exactly as it left. Picked
  // out by id rather than by position: the walk answers in FILE order, and
  // nothing says a parent is written above its children.
  const root = moving.find((record) => record.id === node.id)
  const descendants = moving.filter((record) => record.id !== node.id)
  if (root === undefined) throw new Error("the subtree walk lost its own root")
  const reparented: Node = {
    ...withParent(root, parent),
    ord: appendedOrd([existing, scaffold], parent),
  }

  return Result.succeed({
    files: [
      { file, nodes: source },
      { file: archive, nodes: [...existing, ...scaffold, reparented, ...descendants] },
    ],
    id: node.id,
    title: node.title,
    file: archive,
    summary: `archive: ${node.title}`,
  })
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

/** An `ord` after everything already under `parent`.
 *
 *  One max scan rather than a filter-map-sort: `ord` is a base62 fractional
 *  index, so `>` on the string IS the comparison, and only the largest matters.
 *  `Archive.jsonl` is the one file in a set that grows without bound, and this
 *  runs once per ancestor level of every archive. */
const appendedOrd = (
  rows: ReadonlyArray<ReadonlyArray<Node>>,
  parent: string | undefined,
): string => {
  let last: string | null = null
  for (const records of rows) {
    for (const record of records) {
      if (record.parent === parent && (last === null || record.ord > last)) {
        last = record.ord
      }
    }
  }
  return nextOrd(last)
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
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, draft) }],
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
 * subtree into `Archive.jsonl`, ids and all) and not a delete of anything —
 * there is no op in this layer that destroys content, and this one does not
 * become the first by accident.
 *
 * So the refusal for a regular node is not a technicality. `remove_mirror` on
 * the id of a node would be a caller asking to unsay something it never said,
 * and answering it by archiving the node — the nearest thing that "removes" it
 * — would put a subtree away nobody asked to put away.
 *
 * What is NOT refused here is a placement something else points at: a chained
 * mirror, or an edge naming this id. That is the validator's to refuse, in its
 * own words with `file:line`, over the set the write would produce — this file
 * refuses only what it can refuse without re-validating.
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
