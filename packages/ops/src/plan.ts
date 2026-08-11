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
  countedChildren,
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
  UsageFailure,
  ValidationFailure,
} from "@olai/format"
import { Result } from "effect"

import type { Request } from "./request.ts"

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
  /** The git commit subject, in the convention `olai` has always used:
   *  `capture:` / `done:` / `doing:` / `todo:` / `move:` / `archive:` / `create:` /
   *  `see:` and a title (or a path, when an outline is born empty). */
  readonly summary: string
  /** What the rollup would like the writer to notice, on a write that HAPPENED
   *  ({@link nudged}). Absent unless there is something to say. */
  readonly nudge?: string
}

/** The two impure things an op needs, handed in so the planner stays a
 *  function: a fresh id, and what day it is. */
export interface Context {
  /** A candidate id. Called again if the set already holds the one it gave. */
  readonly mint: () => string
  /** Today, as the ISO date a mark is stamped with. */
  readonly today: () => string
}

type Planned = Result.Result<Plan, OpFailure>

/** A record under construction. The format's structs are readonly — they
 *  describe what was READ — and every op here builds its replacement by
 *  copying one and changing a field, which is the one place that readonly is
 *  in the way rather than in the right. */
type Draft<N> = { -readonly [K in keyof N]: N[K] }

/** Where an archived subtree goes: beside the outline it left, always by this
 *  name — the same rule as the racket reference, so a directory that has been
 *  archived from before goes on reading the way it did. */
const ARCHIVE = "Archive.jsonl"

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
    const next = ordBetween(previous, null)
    if (next === null) throw new Error("the order encoding ran out of keys")
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

const planAdd = (
  scope: Scope,
  request: Extract<Request, { op: "add" }>,
): Planned => {
  if (request.title.trim() === "") {
    return Result.fail(new UsageFailure({ reason: "a node needs a title" }))
  }

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

  const id = request.id ?? freshId(scope, new Set())
  if (request.id !== undefined && scope.derived.byId.has(request.id)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${request.id}\` is already the id of a node in this set`,
      }),
    )
  }

  const ords = placed(siblingsOf(scope.derived, file, parent), id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ords.success.find((entry) => entry.id === id)?.ord
  if (ord === undefined) throw new Error("the placement did not include the new node")

  const node: RegularNode = {
    id,
    ...(parent === undefined ? {} : { parent }),
    ord,
    title: request.title,
    ...(request.date === undefined ? {} : { date: request.date }),
    ...(request.desc === undefined ? {} : { desc: request.desc }),
  }

  return Result.succeed({
    files: [
      { file, nodes: withOrds([...recordsOf(scope, file), node], ords.success) },
    ],
    id,
    title: request.title,
    file,
    summary: `capture: ${request.title}`,
  })
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
  if (!undo) next[mark] = scope.context.today()

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

  const own = unfinishedUnder(scope, node.id)
  if (own.length > 0) {
    said.push(
      `\`${node.title}\` is done over ${own.length} unfinished ` +
        `${own.length === 1 ? "task" : "tasks"}: ${titles(own)}. Done-hidden hides ` +
        `the branch, so mark those too if they are finished.`,
    )
  }

  // The parent as it reads AFTER this write: the node being marked is what
  // makes the difference, so a snapshot that still calls it unfinished would
  // never fire the one nudge worth having.
  const parent = node.parent === undefined ? undefined : scope.derived.byId.get(node.parent)
  if (
    parent !== undefined && !isMirror(parent.node) &&
    storedMarker(parent.node) !== "done" &&
    unfinishedUnder(scope, parent.node.id, node.id).length === 0
  ) {
    said.push(
      `every task under \`${parent.node.title}\` is done now — mark it done too if ` +
        `the branch is finished.`,
    )
  }

  return said.length === 0 ? undefined : said.join(" ")
}

/** The titles of `parent`'s counted children that are TASKS and not done —
 *  `done` read for `becoming`, the node this write is about, since the write
 *  is the thing the snapshot has not seen yet. A bullet is never in the list:
 *  it is not a task, so there is nothing under it to finish. */
const unfinishedUnder = (
  scope: Scope,
  parent: string,
  becoming?: string,
): ReadonlyArray<string> =>
  countedChildren(scope.derived, parent).flatMap((child) => {
    if (child.node.id === becoming) return []
    const status = scope.derived.status.get(child.node.id)
    return status === undefined || status === "done" ? [] : [child.node.title]
  })

const titles = (all: ReadonlyArray<string>): string =>
  all.map((title) => `\`${title}\``).join(", ")

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

  const seed = request.seed
  if (seed.title.trim() === "") {
    return Result.fail(new UsageFailure({ reason: "a node needs a title" }))
  }

  const id = seed.id ?? freshId(scope, new Set())
  if (seed.id !== undefined && scope.derived.byId.has(seed.id)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${seed.id}\` is already the id of a node in this set`,
      }),
    )
  }

  // First (and only) row of an empty parent: the same key an `add` would mint
  // when there are no siblings yet.
  const ord = ordBetween(null, null)
  if (ord === null) throw new Error("the order encoding ran out of keys")

  const node: RegularNode = {
    id,
    ord,
    title: seed.title,
    ...(seed.date === undefined ? {} : { date: seed.date }),
    ...(seed.desc === undefined ? {} : { desc: seed.desc }),
  }

  return Result.succeed({
    files: [{ file, nodes: [node] }],
    id,
    title: seed.title,
    file,
    summary: `capture: ${seed.title}`,
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
  const next = ordBetween(last, null)
  if (next === null) throw new Error("the order encoding ran out of keys")
  return next
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
