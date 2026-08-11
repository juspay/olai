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
  derive,
  type Derived,
  isMirror,
  type Located,
  type LocatedRegular,
  MARKS,
  type Node,
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
   *  `see:` and a title (or a path, when an outline is born empty). */
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
      // `move:` is the racket convention for a node's date, and a date IS what
      // it named there.
      return planEdit(
        scope,
        request.id,
        (node) => withField(node, "date", request.date),
        (node) => `move: ${node.title} -> ${node.date ?? "(cleared)"}`,
      )
    case "move":
      return planMove(scope, request)
    case "archive":
      return planArchive(scope, request)
    case "create":
      return planCreate(scope, request)
    case "see":
      return planSee(scope, request)
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

const notFound = (id: string): OpFailure =>
  new NotFoundFailure({
    reason: `no node in the loaded set has the id \`${id}\``,
    named: id,
  })

/** The record with this id, or the refusal that says so. A MIRROR is not an
 *  answer: it is a second placement of a node that lives elsewhere, and every
 *  op edits the node. */
const regularAt = (scope: Scope, id: string): Result.Result<LocatedRegular, OpFailure> => {
  const located = scope.derived.byId.get(id)
  if (located === undefined) return Result.fail(notFound(id))
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

interface Placement {
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
  placement: Placement,
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
  let file: string
  let parent: string | undefined
  if (request.parent !== undefined) {
    const target = regularAt(scope, request.parent)
    if (Result.isFailure(target)) return Result.fail(target.failure)
    // The file is the PARENT's, always: `parent` is same-file by the format,
    // so a `file` that disagreed would be a set the validator rejects.
    file = target.success.file
    parent = request.parent
  } else {
    if (request.file === undefined) {
      return Result.fail(
        new UsageFailure({
          reason: "give `parent` (the node goes under it) or `file` (it goes at top level)",
        }),
      )
    }
    file = request.file
    if (!scope.set.files.includes(file)) {
      return Result.fail(
        new NotFoundFailure({
          reason:
            `\`${file}\` is not one of the outlines under the served directory: ` +
            `${scope.set.files.join(", ") || "there are none"}`,
          named: file,
        }),
      )
    }
  }

  const may = writable(scope, file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  // Every id in the tree is decided before any record is built, and the set of
  // ids this call has claimed is what makes the second collision — one child
  // against another — a refusal rather than a duplicate the validator finds.
  const taken = new Set<string>()
  const root = idFor(scope, taken, request)
  if (Result.isFailure(root)) return Result.fail(root.failure)
  const id = root.success

  const ords = placed(siblingsOf(scope.derived, file, parent), id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ords.success.find((entry) => entry.id === id)?.ord
  if (ord === undefined) throw new Error("the placement did not include the new node")

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
 * The id one captured node will carry: the one it chose, or a minted one.
 *
 * "Free" has two halves and both refuse: an id the SET already holds, and one
 * another node in this same call has claimed. The second only exists because a
 * capture mints many ids at once — and it is also what a cycle attempt looks
 * like from here, since a child naming its own ancestor's chosen id is naming
 * an id that is already spoken for.
 */
const idFor = (
  scope: Scope,
  taken: Set<string>,
  capture: Capture,
): Result.Result<string, OpFailure> => {
  const chosen = capture.id
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
    const id = idFor(scope, taken, child)
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
  if (located === undefined) return Result.fail(notFound(request.id))
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
    if (wouldContainItself(scope, request.id, parent)) {
      return Result.fail(
        new UsageFailure({
          reason: `\`${parent}\` is inside \`${request.id}\`, so the move would make a loop`,
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

/** Is `parent` inside the subtree rooted at `id`? The validator would catch the
 *  cycle, but its message is about a set on disk; this one is about the move. */
const wouldContainItself = (scope: Scope, id: string, parent: string): boolean => {
  const seen = new Set<string>()
  let at: string | undefined = parent
  while (at !== undefined && !seen.has(at)) {
    if (at === id) return true
    seen.add(at)
    at = scope.derived.byId.get(at)?.node.parent
  }
  return false
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
  const chosen = idFor(scope, taken, seed)
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

// ── see ────────────────────────────────────────────────────────────────

/**
 * Add and/or remove free cross-references on a node.
 *
 * `see` is the format's open-ended pointer — no ordering, no blocking, cycles
 * fine — and the only work here that is not already the validator's is the
 * TEACHING refusal for a target that does not exist. The validator would catch
 * that too, with `file:line`; this one names the ids the set DOES hold, the
 * same way an unknown outline file lists the ones under the served directory,
 * so an agent can correct without a second round-trip to `search_nodes`.
 */
const planSee = (
  scope: Scope,
  request: Extract<Request, { op: "see" }>,
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
          "give `add` and/or `remove` — at least one target to change on this node's `see`",
      }),
    )
  }

  // Refuse the first unknown add, with the set's ids so the next call can
  // name one that exists. Same shape as an unknown `file` on `add`.
  for (const id of add) {
    if (!scope.derived.byId.has(id)) {
      const known = [...scope.derived.byId.keys()].sort().join(", ") ||
        "there are none"
      return Result.fail(
        new NotFoundFailure({
          reason: `\`${id}\` is not a node in the loaded set: ${known}`,
          named: id,
        }),
      )
    }
  }

  // Existing order preserved; removes drop out; adds that are new append.
  // Re-adding one already listed is a silent no-op for that id, and removing
  // one that was never there is the same — the refusal below catches a plan
  // that would write nothing.
  const drop = new Set(remove)
  const next: Array<string> = []
  for (const id of node.see ?? []) {
    if (!drop.has(id)) next.push(id)
  }
  for (const id of add) {
    if (!next.includes(id)) next.push(id)
  }

  const previous = node.see ?? []
  if (
    previous.length === next.length &&
    previous.every((id, index) => id === next[index])
  ) {
    return Result.fail(
      new UsageFailure({
        reason: previous.length === 0
          ? `\`${node.title}\` has no see targets, and nothing to add was named`
          : `\`${node.title}\` already sees exactly ${
            previous.map((id) => `\`${id}\``).join(", ")
          } — nothing would change`,
      }),
    )
  }

  const draft: Draft<RegularNode> = { ...node }
  if (next.length === 0) delete draft.see
  else draft.see = next

  return Result.succeed({
    files: [{ file, nodes: replacing(recordsOf(scope, file), node.id, draft) }],
    id: node.id,
    title: node.title,
    file,
    summary: `see: ${node.title}`,
  })
}
