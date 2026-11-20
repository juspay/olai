import {
  proseIn,
  addressOf,
  referencesOf,
  deadLinksIn,
  deadLinkSaid,
  markdownAt,
  outlineCalled,
  TRASH,
  claimedOf,
  outlineAt as admitOutline,
  ancestorsOf,
  BATCH_AT_MOST,
  type BatchedRequest,
  BusyFailure,
  canonicalRepeat,
  type Capture,
  chainOf,
  countedChildren,
  type Custom,
  type Declared,
  declarationsOf,
  declaredFor,
  declaringOf,
  type KindVocabulary,
  derive,
  type Derived,
  mintExt,
  type Claims,
  didYouMean,
  drawingPath,
  fileKind,
  isMirror,
  isTrashed,
  type Located,
  type LocatedRegular,
  markdownIn,
  MARKS,
  type Minted,
  type MirrorNode,
  NESTING,
  nextOccurrence,
  type Node,
  nodeNamed,
  nodesOf,
  NotFoundFailure,
  nothing,
  type OpFailure,
  ordBetween,
  pinsIn,
  propertiesIn,
  type Reading,
  type RegularNode,
  REPEAT_GRAMMAR,
  resolvedDoc,
  type Settled,
  settles,
  shadowFor,
  siblingsOf,
  spanOf,
  standingBefore,
  type Status,
  storedMarker,
  storedValue,
  targetsOf,
  TRASH_FILE,
  type Typed,
  unfitHeld,
  unfinished,
  unfinishedWithin,
  UsageFailure,
  ValidationFailure,
  verdictOf,
  withCustom,
  wrongDeclaration,
  type WriteRequest as Request,
} from "@olai/format"

import { unclaimedPath } from "./refusals.ts"
import { Result } from "effect"

import { factsOf, type SetFacts } from "./facts.ts"
import { folding } from "./following.ts"
import {
  missingId,
  notANode,
  noSuchDocument,
  notFound,
  notLoadedBecause,
  outlineAt,
} from "./refusals.ts"

export interface FilePlan {
  readonly file: string
  readonly nodes: ReadonlyArray<Node>
}

export interface DocumentPlan {
  readonly file: string
  readonly text: string
}

export interface Plan {
  readonly files: ReadonlyArray<FilePlan>
  readonly documents?: ReadonlyArray<DocumentPlan>
  readonly removed?: ReadonlyArray<string>
  readonly id: string
  readonly title: string
  readonly file: string
  readonly captured?: ReadonlyArray<Minted>
  readonly summary: string
  readonly nudge?: string
}

export interface Context {
  readonly mint: () => string
  readonly now: () => string
}

type Planned = Result.Result<Plan, OpFailure>

type Draft<N> = { -readonly [K in keyof N]: N[K] }

const planTitle = (scope: Scope, request: Extract<Request, { op: "title" }>): Planned => {
  const located = regularAt(scope, request.id)
  if (Result.isFailure(located)) return Result.fail(located.failure)
  if (request.pinned && (located.success.file !== pinsIn(scope.claims, scope.derived.byFile.keys())
    || located.success.node.parent !== undefined)) {
    return Result.fail(new UsageFailure({ reason: "this row is no longer pinned — reopen the pin you want to rename" }))
  }
  const next: RegularNode = { ...located.success.node, title: request.title }
  const bent = declarationRefused(scope, located.success.file, next)
  if (bent !== undefined) return Result.fail(bent)
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
}

const planDesc = (scope: Scope, request: Extract<Request, { op: "desc" }>): Planned =>
  planEdit(
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

const planDate = (scope: Scope, request: Extract<Request, { op: "date" }>): Planned =>
  planEdit(
    scope,
    request.id,
    (node) => withField(node, "date", request.date),
    (node) => `date: ${node.title} -> ${node.date ?? "(cleared)"}`,
  )

const planRepeat = (scope: Scope, request: Extract<Request, { op: "repeat" }>): Planned =>
  planEdit(
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


export interface Scope extends Reading {
  readonly outlineRow: string
  readonly context: Context
  readonly typed: Typed
  readonly facts: SetFacts
}

export const typedIn = (at: Reading, kinds: KindVocabulary): Typed => {
  let documents: ReadonlySet<string> | undefined
  return {
    declarations: declarationsOf(at.derived, kinds),
    derived: at.derived,
    kinds,
    get documents(): ReadonlySet<string> {
      return documents ??= new Set(markdownIn(at.set).map((entry) => entry.path))
    },
  }
}

const locus = (capture: Capture, failure: OpFailure): OpFailure =>
  new UsageFailure({
    reason: `\`${capture.title}\` carries a property this vault refuses: ` +
      `${failure.message} Nothing was written.`,
  })

const NO_PROPS: Readonly<Record<string, string>> = {}

export const scoping = (
  at: Reading,
  context: Context,
  kinds: KindVocabulary,
  outlineRow: string,
): Scope => ({
  ...at,
  outlineRow,
  context,
  facts: factsOf(at.claims, at.set),
  typed: typedIn(at, kinds),
})

export const rescoped = (scope: Scope, at: Reading, facts: SetFacts): Scope => ({
  ...at,
  outlineRow: scope.outlineRow,
  context: scope.context,
  facts,
  typed: typedIn(at, scope.typed.kinds),
})

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

const editable = (
  scope: Scope,
  id: string,
): Result.Result<LocatedRegular, OpFailure> => {
  const target = regularAt(scope, id)
  if (Result.isFailure(target)) return target
  const may = writable(scope, target.success.file)
  return Result.isFailure(may) ? Result.fail(may.failure) : target
}

const unknownId = (scope: Scope, id: string): OpFailure => notFound(scope.derived, id)

const pathTo = (
  from: string,
  to: string,
  edges: (id: string) => Iterable<string>,
): ReadonlyArray<string> | null => {
  const seen = new Set<string>()
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

const regularAt = (scope: Scope, id: string): Result.Result<LocatedRegular, OpFailure> => {
  const located = scope.derived.byId.get(id)
  if (located === undefined) return Result.fail(unknownId(scope, id))
  if (isMirror(located.node)) {
    return Result.fail(notANode(id, located.node.mirror))
  }
  return Result.succeed(located as LocatedRegular)
}

const writable = (scope: Scope, file: string): Result.Result<void, OpFailure> => {
  const broken = scope.facts.broken.get(file)
  if (broken !== undefined) {
    return Result.fail(
      new ValidationFailure({
        reason: `\`${file}\` ${notLoadedBecause(scope.claims, file)} — writing it would drop that. ` +
          `Fix the file first.`,
        verdict: verdictOf(broken),
      }),
    )
  }
  return Result.succeed(undefined)
}

interface Landing {
  readonly file: string
  readonly parent?: string | undefined
}

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
  const outline = outlineAt(scope.facts, file)
  if (Result.isFailure(outline)) return Result.fail(outline.failure)
  const may = writable(scope, file)
  if (Result.isFailure(may)) return Result.fail(may.failure)
  return Result.succeed({ file })
}

const freshId = (scope: Scope, taken: ReadonlySet<string>): string => {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = scope.context.mint()
    if (!scope.derived.byId.has(candidate) && !taken.has(candidate)) return candidate
  }
  throw new Error("could not mint an unused node id")
}

const recordsOf = (scope: Scope, file: string): ReadonlyArray<Node> =>
  nodesOf(scope.derived, file).map((located) => located.node)

const replacing = (
  records: ReadonlyArray<Node>,
  id: string,
  next: Node,
): ReadonlyArray<Node> =>
  records.map((record) => (record.id === id ? next : record))

interface Anchor {
  readonly before?: string | undefined
  readonly after?: string | undefined
}

const nextOrd = (previous: string | null): string => {
  const next = ordBetween(previous, null)
  if (next === null) throw new Error("the order encoding ran out of keys")
  return next
}

interface SiblingOrd {
  readonly id: string
  readonly ord: string
}

type SiblingRow = ReadonlyArray<SiblingOrd>

const placed = (
  siblings: ReadonlyArray<Located>,
  moving: string,
  placement: Anchor,
): Result.Result<SiblingRow, OpFailure> => {
  if (placement.before !== undefined && placement.after !== undefined) {
    return Result.fail(
      new UsageFailure({ reason: "give `before` or `after`, not both" }),
    )
  }

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

  const order = [...row.slice(0, at), null, ...row.slice(at)]
  const renumbered: Array<SiblingOrd> = []
  let previous: string | null = null
  for (const entry of order) {
    const next = nextOrd(previous)
    renumbered.push({ id: entry === null ? moving : entry.node.id, ord: next })
    previous = next
  }
  return Result.succeed(renumbered)
}

const ordFor = (ords: SiblingRow, id: string): string => {
  const ord = ords.find((entry) => entry.id === id)?.ord
  if (ord === undefined) throw new Error("the placement did not include the new record")
  return ord
}

const withOrds = (
  records: ReadonlyArray<Node>,
  ords: SiblingRow,
): ReadonlyArray<Node> => {
  const byId = new Map(ords.map((entry) => [entry.id, entry.ord]))
  return records.map((record) => {
    const ord = byId.get(record.id)
    return ord === undefined ? record : { ...record, ord }
  })
}

const planAdd = (
  scope: Scope,
  request: Extract<Request, { op: "add" }>,
): Planned => {
  const landing = landsIn(scope, request)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  const { file, parent } = landing.success

  const into = minting()
  const root = idFor(scope, into.taken, request.id)
  if (Result.isFailure(root)) return Result.fail(root.failure)
  const id = root.success

  const ords = placed(siblingsOf(scope.derived, file, parent), id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)
  const ord = ordFor(ords.success, id)

  const built = capturePlan(scope, into, request, file, { id, parent, ord, below: NESTING }, true)
  if (Result.isFailure(built)) return Result.fail(built.failure)
  const minted = built.success

  const under = minted.length - 1
  return Result.succeed(arriving(scope, { file, parent }, () => mintsOpenWork(minted), {
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

const mintedUnder = (minted: ReadonlyArray<RegularNode>, id: string): ReadonlyArray<RegularNode> => {
  const under = new Set([id])
  const open: Array<RegularNode> = []
  for (const record of minted) {
    if (record.id === id || record.parent === undefined || !under.has(record.parent)) continue
    under.add(record.id)
    if (unfinished(storedMarker(record))) open.push(record)
  }
  return open
}

const mintsOpenWork = (minted: ReadonlyArray<RegularNode>): boolean =>
  minted.some((record) => unfinished(storedMarker(record)))

const mintedOverOpenWork = (minted: ReadonlyArray<RegularNode>): OpFailure | undefined => {
  for (const record of minted) {
    if (storedMarker(record) !== "done") continue
    const open = mintedUnder(minted, record.id)
    if (open.length === 0) continue
    const one = open.length === 1
    const named = capped(open, (child) => `\`${child.title}\``)
    return new UsageFailure({
      reason: `\`${record.title}\` is captured done over ${open.length} ` +
        `unfinished ${one ? "task" : "tasks"} in the same call: ${named}. ` +
        `Done-hidden hides a done ` +
        `node WITH its subtree, so the capture would land already invisible ` +
        `— capture ${one ? "that one" : "those"} without a mark, or ` +
        `\`${record.title}\` without the \`done\`. Nothing was written.`,
    })
  }
  return undefined
}

const mintedOf = (records: ReadonlyArray<RegularNode>): ReadonlyArray<Minted> =>
  records.map((record) => ({ id: record.id, title: record.title }))

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

interface At {
  readonly id: string
  readonly parent?: string | undefined
  readonly ord: string
}

const capturedNode = (
  scope: Scope,
  capture: Capture,
  at: At,
  stored: Readonly<Record<string, string>>,
): RegularNode => {
  const node: Draft<RegularNode> = {
    id: at.id,
    ...(at.parent === undefined ? {} : { parent: at.parent }),
    ord: at.ord,
    title: capture.title,
  }
  if (capture.mark !== undefined) {
    node[capture.mark] = marker(scope, capture.mark)
    if (capture.mark === "doing") node.started = scope.context.now()
  }
  if (capture.date !== undefined) node.date = capture.date
  if (capture.desc !== undefined) node.desc = capture.desc
  const props = Object.entries(stored)
  if (props.length > 0) {
    let custom: Custom = {}
    for (const [key, value] of props) custom = withCustom(custom, key.trim(), value)
    if (!nothing(custom)) node.custom = custom
  }
  return borne(scope, node)
}

interface Wire {
  readonly id: string
  readonly see?: ReadonlyArray<string> | undefined
  readonly after?: ReadonlyArray<string> | undefined
}

interface Minting {
  readonly taken: Set<string>
  readonly records: Array<RegularNode>
  readonly wires: Array<Wire>
}

const minting = (): Minting => ({ taken: new Set(), records: [], wires: [] })

const emit = (
  scope: Scope,
  into: Minting,
  capture: Capture,
  file: string,
  at: At & { readonly below: number },
): OpFailure | null => {
  if (capture.title.trim() === "") {
    return new UsageFailure({ reason: "a node needs a title" })
  }
  for (const key of Object.keys(capture.props ?? {})) {
    const named = propKey(key.trim())
    if (named !== undefined) return named
  }
  const stored = typedProps(scope, file, capture.props)
  if (Result.isFailure(stored)) return locus(capture, stored.failure)
  const born = capturedNode(scope, capture, at, stored.success)
  const bent = declaredWrong(scope, file, born)
  if (bent !== undefined) return bent
  into.records.push(born)
  if ((capture.see?.length ?? 0) > 0 || (capture.waitsOn?.length ?? 0) > 0) {
    into.wires.push({ id: at.id, see: capture.see, after: capture.waitsOn })
  }

  const children = capture.children ?? []
  if (children.length === 0) return null

  if (at.below === 0) {
    return new UsageFailure({
      reason:
        `a capture nests at most ${NESTING} levels of \`children\`, and ` +
        `\`${capture.title}\` is already that deep, so nothing was written. Capture ` +
        `down to \`${capture.title}\` first — THAT answer's \`captured\` gives it an ` +
        `id — then hang the rest off it with a second \`outlines_add\`.`,
    })
  }

  let previous: string | null = null
  for (const child of children) {
    const ord = nextOrd(previous)
    const id = idFor(scope, into.taken, child.id)
    if (Result.isFailure(id)) return id.failure
    const refused = emit(scope, into, child, file, {
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

const capturePlan = (
  scope: Scope,
  into: Minting,
  capture: Capture,
  file: string,
  at: At & { readonly below: number },
  anchored: boolean,
): Result.Result<ReadonlyArray<RegularNode>, OpFailure> => {
  const bent = misplacedAfter(capture, anchored, at.below)
  if (bent !== undefined) return Result.fail(bent)
  const refused = emit(scope, into, capture, file, at)
  if (refused !== null) return Result.fail(refused)
  const wired = wiring(scope, into)
  if (Result.isFailure(wired)) return wired
  const unfit = refuseCaptureDeclaration(scope, file, wired.success)
  if (unfit !== undefined) return Result.fail(unfit)
  const contradicts = mintedOverOpenWork(wired.success)
  return contradicts === undefined ? wired : Result.fail(contradicts)
}

const misplacedAfter = (
  capture: Capture,
  anchored: boolean,
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

  const has = (target: string): boolean =>
    into.taken.has(target) || scope.derived.byId.has(target)
  const minting: Iterable<string> = into.taken
  const graphed = (target: string): string =>
    into.taken.has(target) ? target : standingAt(scope, target)

  const born = new Map<string, Wire>()
  for (const wire of into.wires) {
    for (const target of [...(wire.see ?? []), ...(wire.after ?? [])]) {
      if (!has(target)) return Result.fail(missingId(target, scope.derived.byId, minting))
    }
    born.set(wire.id, {
      id: wire.id,
      ...(wire.see === undefined ? {} : { see: [...new Set(wire.see)] }),
      ...(wire.after === undefined ? {} : { after: [...new Set(wire.after)] }),
    })
  }

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

const UNMARKED = {
  done: "undone",
  cancelled: "uncancelled",
  doing: "not-doing",
  todo: "not-todo",
} as const satisfies Record<Status, string>

const marker = (scope: Scope, mark: Status): string | true =>
  settles(mark) ? scope.context.now() : true

const touched = <N extends Node>(scope: Scope, node: N): N =>
  isMirror(node) ? node : { ...node, changed: scope.context.now() }

const borne = (scope: Scope, node: RegularNode): RegularNode => {
  const next: Draft<RegularNode> = { ...node, created: scope.context.now() }
  delete next.changed
  return next
}

const WALKING_BACK = {
  done: (title: string) =>
    `\`${title}\` is done. Undo that first — nothing should decide on your ` +
    `behalf that finished work is not finished.`,
  cancelled: (title: string) =>
    `\`${title}\` is cancelled. Undo that first — nothing should decide on ` +
    `your behalf that work somebody called off is back on, and the instant it ` +
    `was called off at is on that day's page.`,
} as const satisfies Record<Settled, (title: string) => string>

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
  if (!undo && stored !== undefined && settles(stored)) {
    return Result.fail(new UsageFailure({ reason: WALKING_BACK[stored](node.title) }))
  }
  if (!undo && mark === "doing") {
    const held = heldUp(scope, node)
    if (held !== undefined) return Result.fail(held)
  }

  if (!undo && mark === "done") {
    const sweeping = sweepingOpenWork(scope, file, node)
    if (sweeping !== undefined) return Result.fail(sweeping)
  }

  const next: Draft<RegularNode> = { ...node }
  for (const other of MARKS) delete next[other]
  if (!undo) next[mark] = marker(scope, mark)

  if (!undo && mark === "doing") {
    next.started = scope.context.now()
  }

  if (!undo && settles(mark)) {
    const closed = next[mark]
    if (stored === "doing") {
      if (node.started !== undefined && typeof closed === "string") {
        const round = spanOf(node.started, closed)
        if (round !== undefined) next.worked = (node.worked ?? 0) + round
      }
    } else {
      delete next.started
    }
  } else if (stored === "doing" && (undo || mark !== "doing")) {
    if (node.started !== undefined) {
      const round = spanOf(node.started, scope.context.now())
      if (round !== undefined) next.worked = (node.worked ?? 0) + round
    }
    delete next.started
  }

  const again = recurring(scope, file, node, mark, undo)
  if (again !== undefined) delete next.repeat

  const summary = undo
    ? `${UNMARKED[mark]}: ${node.title}`
    : again === undefined
    ? `${mark}: ${node.title}`
    : `${mark}: ${node.title} (next: ${again.spawned.date})`

  const said = again === undefined
    ? nudged(scope, file, node, mark, undo)
    : `\`${node.title}\` repeats ${node.repeat} — the next one is on ${again.spawned.date}.`

  const records = replacing(recordsOf(scope, file), node.id, touched(scope, next))

  return Result.succeed(arriving(
    scope,
    { file, parent: node.parent },
    () => !undo && (unfinished(mark) || again !== undefined),
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

interface Recurrence {
  readonly spawned: RegularNode & { readonly date: string }
  readonly ords: SiblingRow
}

const recurring = (
  scope: Scope,
  file: string,
  node: RegularNode,
  mark: Status,
  undo: boolean,
): Recurrence | undefined => {
  if (undo || mark !== "done" || node.repeat === undefined) return undefined
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
  if (Result.isFailure(ords)) {
    throw new Error(
      `the occurrence after \`${node.title}\` could not be placed beside it: ` +
        ords.failure.message,
    )
  }
  const spawned: RegularNode & { readonly date: string } = {
    ...capturedNode(scope, {
      title: node.title,
      mark: "todo",
      date: nextDate,
      ...(node.desc === undefined ? {} : { desc: node.desc }),
    }, { id, parent: node.parent, ord: ordFor(ords.success, id) }, NO_PROPS),
    date: nextDate,
    repeat: node.repeat,
  }
  return { spawned, ords: ords.success }
}

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

const nudged = (
  scope: Scope,
  file: string,
  node: RegularNode,
  mark: Status,
  undo: boolean,
): string | undefined => {
  if (undo) return undefined
  if (mark === "cancelled") return stillStanding(scope, file, node)
  if (mark !== "done") return undefined

  const above = node.parent === undefined
    ? undefined
    : scope.derived.byId.get(node.parent)?.node
  if (above === undefined || isMirror(above)) return undefined
  const held = storedMarker(above)
  if (!(held === undefined || unfinished(held))) return undefined
  return unfinishedWithin(scope.derived, above.id)
      .every((task) => task.node.id === node.id)
    ? `every task under \`${above.title}\` is done now — mark it done too if ` +
      `the branch is finished.`
    : undefined
}

const stillStanding = (
  scope: Scope,
  file: string,
  node: RegularNode,
): string | undefined => {
  if (isTrashed(scope.claims, file)) return undefined
  const open = unfinishedWithin(scope.derived, node.id)
  if (open.length === 0) return undefined

  const one = open.length === 1
  const named = capped(open, (task) => {
    const mark = scope.derived.status.get(task.node.id)
    return `\`${task.node.title}\` (\`${task.node.id}\`, ${mark})`
  })
  return `\`${node.title}\` is cancelled, but ${open.length} ` +
    `${one ? "task under it is" : "tasks under it are"} still unfinished and ` +
    `still owed: ${named}. Nothing was hidden and nothing was refused — cancel ` +
    `${one ? "it" : "them"} too if ${one ? "it is" : "they are"} not happening ` +
    `either.`
}

const NAMED_AT_MOST = 5

const capped = <T>(all: ReadonlyArray<T>, name: (one: T) => string): string =>
  all.slice(0, NAMED_AT_MOST).map(name).join(", ") +
  (all.length > NAMED_AT_MOST ? `, and ${all.length - NAMED_AT_MOST} more` : "")

const sweepingOpenWork = (
  scope: Scope,
  file: string,
  node: RegularNode,
): OpFailure | undefined => {
  if (isTrashed(scope.claims, file)) return undefined
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
      `page. Finish ${one ? "that" : "those"} first — or cancel ` +
      `${one ? "it" : "them"} if ${one ? "it is" : "they are"} not happening, ` +
      `since a cancelled task has settled and stands in nobody's way (and ` +
      `neither does an unmarked bullet, if you would rather take the mark off).`,
  })
}

const NOTHING_ABOVE: ReadonlyArray<LocatedRegular> = []

const staleDoneAbove = (
  scope: Scope,
  file: string,
  parent: string | undefined,
): ReadonlyArray<LocatedRegular> => {
  if (parent === undefined || isTrashed(scope.claims, file)) return NOTHING_ABOVE
  const at = scope.derived.byId.get(parent)
  if (at === undefined || isMirror(at.node)) return NOTHING_ABOVE
  const chain = [...ancestorsOf(scope.derived, parent), at as LocatedRegular]
  const done = chain.filter((one) => storedMarker(one.node) === "done")
  return done.length === 0 ? NOTHING_ABOVE : done
}

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

const holdsOpenWork = (scope: Scope, node: RegularNode): boolean =>
  unfinished(storedMarker(node)) || unfinishedWithin(scope.derived, node.id).length > 0

const arriving = (
  scope: Scope,
  at: {
    readonly file: string
    readonly parent: string | undefined
    readonly restoring?: string
  },
  brings: () => boolean,
  plan: Plan,
): Plan => {
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
    summary: `${plan.summary} (reopened: ${titles.join(", ")})`,
    nudge: plan.nudge === undefined ? said : `${said} ${plan.nudge}`,
  }
}

const planEdit = (
  scope: Scope,
  id: string,
  edit: (node: RegularNode) => RegularNode,
  summarize: (node: RegularNode) => string,
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

const typedProps = (
  scope: Scope,
  file: string,
  props: Readonly<Record<string, string>> | undefined,
): Result.Result<Readonly<Record<string, string>>, OpFailure> => {
  if (props === undefined) return Result.succeed(NO_PROPS)
  const stored: Record<string, string> = {}
  for (const [key, value] of Object.entries(props)) {
    const said = storedValue(scope.typed, file, key.trim(), value, scope.context.now())
    if (Result.isFailure(said)) {
      return Result.fail(new UsageFailure({ reason: said.failure }))
    }
    stored[key] = said.success
  }
  return Result.succeed(stored)
}

const isPropertiesFile = (scope: Scope, file: string): boolean =>
  propertiesIn(scope.claims, [...scope.derived.byFile.keys(), file]) === file

const declarationsExcept = (
  declarations: Typed["declarations"],
  id: string,
): Map<string, Declared> => {
  const next = new Map(declarations)
  for (const [key, one] of next) {
    if (one.at === id) next.delete(key)
  }
  return next
}

const declaredWrong = (
  scope: Scope,
  file: string,
  node: RegularNode,
): OpFailure | undefined => {
  if (!isPropertiesFile(scope, file)) return undefined
  const claimed = new Set(declarationsExcept(scope.typed.declarations, node.id).keys())
  const wrong = wrongDeclaration(
    scope.derived,
    { file, line: 0, node },
    claimed,
    scope.typed.kinds,
  )
  return wrong === undefined ? undefined : new UsageFailure({ reason: wrong.said })
}

const governedUnfit = (
  scope: Scope,
  file: string,
  node: RegularNode,
  extra: ReadonlySet<string> = NO_EXTRA,
): OpFailure | undefined => {
  if (!isPropertiesFile(scope, file)) return undefined
  const reading = declaringOf(scope.derived, node)
  if (reading === undefined) return undefined
  const { key, declared } = reading
  const declarations = declarationsExcept(scope.typed.declarations, node.id)
  declarations.set(key, declared)
  const typed: Typed = {
    declarations,
    derived: scope.typed.derived,
    get documents() {
      return scope.typed.documents
    },
    kinds: scope.typed.kinds,
  }
  const held = unfitHeld(typed, key)
  const unfit = extra.size === 0 || declared.type.kind !== "ref"
    ? held
    : held.filter((one) => !one.members.every((member) => extra.has(member)))
  if (unfit.length === 0) return undefined
  const n = unfit.length
  const named = capped(unfit, (one) =>
    `\`${one.file}\` \`${one.title}\` (\`${one.id}\`) holds "${one.value}"`)
  return new UsageFailure({
    reason: `\`${key}\` cannot be declared \`${declared.type.kind}\` while ` +
      `${n} existing ${n === 1 ? "value does" : "values do"} not fit: ${named}. ` +
      `The same fence \`outlines_prop\` already is — fix ` +
      `${n === 1 ? "that value" : "those values"} first (one \`apply\` can ` +
      `write them all), then declare. Nothing was written.`,
  })
}

const NO_EXTRA: ReadonlySet<string> = new Set()

const declarationRefused = (
  scope: Scope,
  file: string,
  node: RegularNode,
  extra: ReadonlySet<string> = NO_EXTRA,
): OpFailure | undefined =>
  declaredWrong(scope, file, node) ?? governedUnfit(scope, file, node, extra)

const underOf = (scope: Scope, node: RegularNode): string | undefined => {
  const reading = declaringOf(scope.derived, node)
  return reading?.declared.type.kind === "ref" ? reading.declared.type.under : undefined
}

const extraVariants = (
  root: RegularNode,
  records: ReadonlyArray<Node>,
  under: string | undefined,
): ReadonlySet<string> => {
  const parent = under ?? root.id
  const extra = new Set<string>()
  for (const one of records) {
    if (!isMirror(one) && one.parent === parent) extra.add(one.id)
  }
  return extra
}

const refuseCaptureDeclaration = (
  scope: Scope,
  file: string,
  minted: ReadonlyArray<RegularNode>,
): OpFailure | undefined => {
  const born = minted[0]
  if (born === undefined || born.parent !== undefined) return undefined
  return governedUnfit(scope, file, born, extraVariants(born, minted, underOf(scope, born)))
}

const refuseRecordsInProperties = (
  scope: Scope,
  file: string,
  records: ReadonlyArray<Node>,
): OpFailure | undefined => {
  if (!isPropertiesFile(scope, file)) return undefined
  const already = new Set<string>()
  for (const one of scope.typed.declarations.values()) already.add(one.at)
  for (const one of records) {
    if (isMirror(one) || one.parent !== undefined || already.has(one.id)) continue
    const refused = declarationRefused(
      scope,
      file,
      one,
      extraVariants(one, records, underOf(scope, one)),
    )
    if (refused !== undefined) return refused
  }
  return undefined
}

const propStale = (
  scope: Scope,
  located: LocatedRegular,
  key: string,
  was: string | null | undefined,
): OpFailure | null => {
  if (was === undefined) return null
  const node = located.node
  const held = node.custom?.[key]
  const text = held === undefined
    ? undefined
    : typeof held === "string" ? held : held.join(", ")
  const says = (found: string): OpFailure =>
    new UsageFailure({
      reason: was === null
        ? `\`${node.title}\` had no \`${key}\` when this write was ` +
          `readied, and it now says \`${found}\` — ` +
          `it has been written since, so nothing was written`
        : `\`${node.title}\`'s \`${key}\` is not the value this write expected to ` +
          `replace (\`${was}\`) — ${found}, so nothing was written`,
    })
  if (was === null) {
    if (text === undefined) return null
    return says(text)
  }
  if (text === undefined) return says("the key is gone")
  const said = storedValue(scope.typed, located.file, key, was, scope.context.now())
  const expected = Result.isFailure(said) ? was : said.success
  return expected === text ? null : says(`it now says \`${text}\``)
}

const planProp = (
  scope: Scope,
  request: Extract<Request, { op: "prop" }>,
): Planned => {
  const key = request.key.trim()
  const named = propKey(key)
  if (named !== undefined) return Result.fail(named)

  const located = regularAt(scope, request.id)
  if (Result.isFailure(located)) return Result.fail(located.failure)

  const moved = propStale(scope, located.success, key, request.was)
  if (moved !== null) return Result.fail(moved)

  let value: string | null = request.value
  if (value !== null && value !== "") {
    const said = typedProps(scope, located.success.file, { [key]: value })
    if (Result.isFailure(said)) return Result.fail(said.failure)
    value = said.success[key] ?? value
  }
  const next: RegularNode = {
    ...located.success.node,
    custom: withCustom(located.success.node.custom, key, value ?? undefined),
  }
  const bent = declarationRefused(scope, located.success.file, next)
  if (bent !== undefined) return Result.fail(bent)
  return planEdit(
    scope,
    request.id,
    (node) => ({ ...node, custom: withCustom(node.custom, key, value ?? undefined) }),
    (node) =>
      value === null || value === ""
        ? `prop: ${node.title} -> ${key} (cleared)`
        : `prop: ${node.title} -> ${key}=${value}`,
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

const stale = (
  was: string | null | undefined,
  now: string | null,
  reason: string,
): OpFailure | null =>
  was === undefined || was === now ? null : new UsageFailure({ reason })

const planMove = (
  scope: Scope,
  request: Extract<Request, { op: "move" }>,
): Planned => {
  const located = scope.derived.byId.get(request.id)
  if (located === undefined) return Result.fail(unknownId(scope, request.id))
  const { file, node } = located

  const may = writable(scope, file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  const landing = movesTo(scope, request, located)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  const { file: destination, parent } = landing.success
  const crosses = destination !== file

  if (crosses) {
    const trash = notThroughTheTrash(scope.claims, node, file, destination)
    if (trash !== null) return Result.fail(trash)
  }

  if (parent !== undefined && parent !== node.parent) {
    const inside = containing(scope, request.id, parent)
    if (inside !== null) {
      return Result.fail(
        new UsageFailure({
          reason: `\`${parent}\` is inside \`${request.id}\` — ${inside} — so the move ` +
            `would make a loop`,
        }),
      )
    }
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

  const ords = placed(siblingsOf(scope.derived, destination, parent), node.id, request)
  if (Result.isFailure(ords)) return Result.fail(ords.failure)

  const moved = touched(scope, withParent(node, parent))
  const title = isMirror(node) ? request.id : node.title

  const brings = () =>
    (crosses || parent !== node.parent) && !isMirror(node) &&
    holdsOpenWork(scope, node as RegularNode)

  const files: ReadonlyArray<FilePlan> = crosses
    ? crossing(scope, located, { file: destination, parent }, moved, ords.success)
    : [
      {
        file,
        nodes: withOrds(
          replacing(recordsOf(scope, file), node.id, moved),
          ords.success,
        ),
      },
    ]

  if (isPropertiesFile(scope, destination)) {
    const bent = refuseRecordsInProperties(
      scope,
      destination,
      [moved, ...liftSubtree(scope, file, node.id).descendants],
    )
    if (bent !== undefined) return Result.fail(bent)
  }

  return Result.succeed(arriving(scope, { file: destination, parent }, brings, {
    files,
    id: node.id,
    title,
    file: destination,
    summary: `move: ${title}`,
  }))
}

const movesTo = (
  scope: Scope,
  request: Extract<Request, { op: "move" }>,
  at: Located,
): Result.Result<Landing, OpFailure> => {
  if (request.parent !== undefined && request.parent !== null) {
    return landsIn(scope, { parent: request.parent })
  }
  if (request.file !== undefined) return landsIn(scope, { file: request.file })
  return Result.succeed({
    file: at.file,
    parent: request.parent === null ? undefined : at.node.parent,
  })
}

const notThroughTheTrash = (
  claims: Claims,
  node: Node,
  from: string,
  to: string,
): OpFailure | null => {
  const named = isMirror(node) ? node.id : node.title
  if (isTrashed(claims, to)) {
    return new UsageFailure({
      reason: `that would move \`${named}\` INTO \`${to}\`, and \`outlines_move\` does not ` +
        `put things away: \`outlines_trash\` is what moves a node and everything under it ` +
        `there, recording the outline it left so \`trash_restore\` can find its way back.`,
    })
  }
  if (isTrashed(claims, from)) {
    return new UsageFailure({
      reason: `\`${named}\` is in \`${from}\`, and what is put away comes back out ` +
        `through \`trash_restore\` — the op that tidies the scaffold above it and ` +
        `re-opens the marks that stop being true the moment the branch is live again. ` +
        `\`outlines_move\` does neither, so it would leave both behind.`,
    })
  }
  return null
}

const crossing = (
  scope: Scope,
  at: Located,
  landing: { readonly file: string; readonly parent: string | undefined },
  moved: Node,
  ords: SiblingRow,
): ReadonlyArray<FilePlan> => {
  const { keeps, descendants } = liftSubtree(scope, at.file, at.node.id)
  return [
    { file: at.file, nodes: keeps },
    {
      file: landing.file,
      nodes: withOrds(
        [
          ...recordsOf(scope, landing.file),
          moved,
          ...descendants,
        ],
        ords,
      ),
    },
  ]
}

const withParent = <N extends Node>(node: N, parent: string | undefined): N => {
  const next: Draft<N> & { parent?: string } = { ...node }
  if (parent === undefined) delete next.parent
  else next.parent = parent
  return next
}

const containing = (scope: Scope, id: string, parent: string): string | null => {
  const path = pathTo(parent, id, (at) => {
    const up = scope.derived.byId.get(at)?.node.parent
    return up === undefined ? [] : [up]
  })
  return path === null ? null : chainOf(path)
}

const planSplit = (
  scope: Scope,
  request: Extract<Request, { op: "split" }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

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
  const under = request.under === true
  const children = under ? scope.derived.children.get(node.id) ?? [] : []
  const ords = placed(
    siblingsOf(scope.derived, file, under ? node.id : node.parent),
    id,
    under
      ? (children.length === 0 ? {} : { before: (children[0] as Located).node.id })
      : { after: node.id },
  )
  if (Result.isFailure(ords)) return Result.fail(ords.failure)

  const head: RegularNode = { ...node, title: request.title }
  const tail: RegularNode = {
    id,
    ...(under ? { parent: node.id } : node.parent === undefined ? {} : { parent: node.parent }),
    ord: ordFor(ords.success, id),
    title: request.rest,
    created: scope.context.now(),
  }

  const bent = declarationRefused(scope, file, head) ??
    (under ? undefined : declarationRefused(scope, file, tail))
  if (bent !== undefined) return Result.fail(bent)

  return Result.succeed({
    files: [{
      file,
      nodes: withOrds(
        [...replacing(recordsOf(scope, file), node.id, touched(scope, head)), tail],
        ords.success,
      ),
    }],
    id,
    title: request.rest,
    file,
    summary: `split: ${node.title}`,
    captured: mintedOf([tail]),
  })
}

const planMerge = (
  scope: Scope,
  request: Extract<Request, { op: "merge" }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const archive = outlineCalled(scope.claims, scope.facts.outlines, TRASH) ?? TRASH_FILE(scope.claims, scope.outlineRow)
  if (archive === null) return Result.fail(new UsageFailure({ reason: `the ${scope.outlineRow} row is off, so no outline can be created` }))
  if (isTrashed(scope.claims, file)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` is in \`${file}\` — an archive is read rather than ` +
          `edited, so put it back first`,
      }),
    )
  }
  const mayArchive = writable(scope, archive)
  if (Result.isFailure(mayArchive)) return Result.fail(mayArchive.failure)

  const joined = merging(scope.derived, target.success, request.title)
  if (Result.isFailure(joined)) return Result.fail(joined.failure)
  const { into, adopted, title, desc } = joined.success

  const records = recordsOf(scope, file)
  const merged = touched(scope, withField({ ...into, title }, "desc", desc ?? null))

  const reparented = new Map(
    appendedUnder([records], into.id, adopted.map((child) => child.node))
      .map((record) => [record.id, record]),
  )

  const keeps = records
    .filter((record) => record.id !== node.id)
    .map((record) =>
      record.id === into.id ? merged : reparented.get(record.id) ?? record
    )

  const brings = () =>
    adopted.some((child) =>
      !isMirror(child.node) && holdsOpenWork(scope, child.node as RegularNode)
    )

  const { existing, scaffold, buried } = buriedIn(scope, archive, node, file)
  const nudge = carriedOff(scope, node)

  const bent = declarationRefused(
    scope,
    file,
    merged,
    extraVariants(merged, keeps, underOf(scope, merged)),
  )
  if (bent !== undefined) return Result.fail(bent)

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

export interface Merging {
  readonly into: RegularNode
  readonly title: string
  readonly desc: string | undefined
  readonly adopted: ReadonlyArray<Located>
}

export const merging = (
  derived: Derived,
  at: LocatedRegular,
  carried?: string,
): Result.Result<Merging, OpFailure> => {
  const row = siblingsOf(derived, at.file, at.node.parent)
  const above = row[row.findIndex((sibling) => sibling.node.id === at.node.id) - 1]
  const parent: Located | undefined = above === undefined && at.node.parent !== undefined
    ? derived.byId.get(at.node.parent)
    : undefined
  const over = above ?? parent
  if (over === undefined) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${at.node.title}\` is the first of its siblings, so there is no row ` +
          `above it to merge into`,
      }),
    )
  }
  if (isMirror(over.node)) {
    return Result.fail(
      new UsageFailure({
        reason: `the row above \`${at.node.title}\` is a mirror — a second placement of ` +
          `\`${over.node.mirror}\`, with no title of its own — so there is nothing ` +
          `there to merge into`,
      }),
    )
  }
  const into = over.node
  return Result.succeed({
    into,
    title: into.title + (carried ?? at.node.title),
    desc: into.desc === undefined
      ? at.node.desc
      : at.node.desc === undefined
      ? into.desc
      : `${into.desc}\n\n${at.node.desc}`,
    adopted: derived.children.get(at.node.id) ?? [],
  })
}

const carriedOff = (scope: Scope, node: RegularNode): string | undefined => {
  const kept: Array<string> = []
  const mark = scope.derived.status.get(node.id)
  if (mark !== undefined) kept.push(`its \`${mark}\` mark`)
  if (node.date !== undefined) kept.push("its date")
  if (targetsOf(node).length > 0) kept.push("its edges")
  if (kept.length === 0) return undefined
  const said = kept.length === 1
    ? kept[0]
    : `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`
  return `\`${node.title}\` kept ${said} — that record is in the Trash with its id, ` +
    `and \`Put back\` returns it.`
}

const planCreate = (
  scope: Scope,
  request: Extract<Request, { op: "create" }>,
): Planned => {
  const claim = scope.claims.byKind.get(scope.outlineRow)
  if (claim === undefined) return Result.fail(new UsageFailure({ reason: `the ${scope.outlineRow} row is off, so no outline can be created` }))
  if (claim.holds !== "nodes") return Result.fail(new UsageFailure({ reason: `the ${scope.outlineRow} row does not hold outlines` }))
  if (creatable(request.file, "") === null) return Result.fail(new UsageFailure({ reason: `\`${request.file}\` is not a relative file path under the served directory (no absolute path, no \`..\`, no \`.\`, and no directory the serve's walk prunes).` }))
  const path = claimedOf(scope.claims, request.file)
  if (path === null) return Result.fail(unclaimedPath(request.file, scope.facts.outlines))
  if (admitOutline(scope.claims, { kind: "document", path }) === null) {
    const actual = scope.claims.byKind.get(fileKind(scope.claims, path)!)!
    return Result.fail(new UsageFailure({ reason: `\`${path}\` is ${actual.article} ${actual.noun}; this verb takes an outline` }))
  }
  const file = outlinePath(scope.claims, scope.outlineRow, path)
  if (file === null) return Result.fail(new UsageFailure({ reason: `\`${request.file}\` is not a relative path using ${mintExt(scope.claims, scope.outlineRow)} under the served directory.` }))

  if (scope.facts.at(file)?.holds === "nodes") {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${file}\` is already an outline under the served directory — create ` +
          `starts a new one; capture into this one with \`outlines_add\``,
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
  const into = minting()
  const chosen = idFor(scope, into.taken, seed.id)
  if (Result.isFailure(chosen)) return Result.fail(chosen.failure)
  const id = chosen.success

  const built = capturePlan(scope, into, seed, file, {
    id,
    parent: undefined,
    ord: nextOrd(null),
    below: NESTING,
  }, false)
  if (Result.isFailure(built)) return Result.fail(built.failure)
  const minted = built.success

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

export const outlinePath = (claims: Claims, row: string, raw: string): string | null => {
  const ext = mintExt(claims, row)
  return ext === null || claims.byKind.get(row)?.holds !== "nodes" ? null : creatable(raw, ext)
}

export const documentPath = (claims: Claims, raw: string): string | null => {
  if (creatable(raw, "") === null) return null
  const claim = claims.byKind.get(fileKind(claims, raw) ?? "")
  return claim?.holds === "text" && claim.kept ? raw : null
}

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

  for (const directory of segments.slice(0, -1)) {
    if (directory.startsWith(".") || directory === "node_modules") return null
  }

  const file = segments.join("/")
  return file.endsWith(extension) ? file : null
}

const planTrash = (
  scope: Scope,
  request: Extract<Request, { op: "trash" }>,
): Planned => {
  const target = regularAt(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  const archive = outlineCalled(scope.claims, scope.facts.outlines, TRASH) ?? TRASH_FILE(scope.claims, scope.outlineRow)
  if (archive === null) return Result.fail(new UsageFailure({ reason: `the ${scope.outlineRow} row is off, so no outline can be created` }))
  if (isTrashed(scope.claims, file)) {
    return Result.fail(
      new UsageFailure({ reason: `\`${node.title}\` is already in \`${archive}\`` }),
    )
  }

  for (const touched of [file, archive]) {
    const may = writable(scope, touched)
    if (Result.isFailure(may)) return Result.fail(may.failure)
  }

  const { keeps: source, descendants } = liftSubtree(scope, file, node.id)
  const { existing, scaffold, buried } = buriedIn(scope, archive, node, file)
  const moved = descendants

  return Result.succeed({
    files: [
      { file, nodes: source },
      { file: archive, nodes: [...existing, ...scaffold, buried, ...moved] },
    ],
    id: node.id,
    title: node.title,
    file: archive,
    summary: `trash: ${node.title}`,
  })
}

const buriedIn = (
  scope: Scope,
  archive: string,
  node: Node,
  source: string,
): {
  readonly existing: ReadonlyArray<Node>
  readonly scaffold: ReadonlyArray<Node>
  readonly buried: Node
} => {
  const existing = recordsOf(scope, archive)
  const { scaffold, parent } = scaffoldFor(
    scope,
    existing,
    [source, ...ancestorsOf(scope.derived, node.id).map((crumb) => crumb.node.title)],
  )
  return {
    existing,
    scaffold,
    buried: { ...withParent(node, parent), ord: appendedOrd([existing, scaffold], parent) },
  }
}

const scaffoldFor = (
  scope: Scope,
  existing: ReadonlyArray<Node>,
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
  return records.filter((record) => wanted.has(record.id))
}

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

const appendedOrd = (
  rows: ReadonlyArray<ReadonlyArray<Node>>,
  parent: string | undefined,
): string => nextOrd(lastOrd(rows, parent))

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

const planUntrash = (
  scope: Scope,
  request: Extract<Request, { op: "untrash" }>,
): Planned => {
  const target = regularAt(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { file, node } = target.success

  if (!isTrashed(scope.claims, file)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` is in \`${file}\`, which is not the trash — ` +
          `\`trash_restore\` takes back what \`outlines_trash\` put away, and this ` +
          `one was never put away`,
      }),
    )
  }

  const landing = untrashLanding(scope, request, file, node)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  const { file: destination, parent } = landing.success

  const signpost = notASignpost(scope, node, destination, parent)
  if (Result.isFailure(signpost)) return Result.fail(signpost.failure)

  for (const touched of [file, destination]) {
    const may = writable(scope, touched)
    if (Result.isFailure(may)) return Result.fail(may.failure)
  }

  const { keeps, descendants } = liftSubtree(scope, file, node.id)

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

  const landingNodes: ReadonlyArray<Node> = [
    reparented,
    ...descendants,
  ]
  const bent = refuseRecordsInProperties(scope, destination, landingNodes)
  if (bent !== undefined) return Result.fail(bent)

  return Result.succeed(
    arriving(scope, {
      file: destination,
      parent,
      restoring: node.id,
    }, () => holdsOpenWork(scope, node), {
      files: [
        { file, nodes: keeps.filter((record) => !dropped.has(record.id)) },
        { file: destination, nodes: [...already, ...landingNodes] },
      ],
      id: node.id,
      title: node.title,
      file: destination,
      summary: `untrash: ${node.title}`,
    }),
  )
}

const untrashLanding = (
  scope: Scope,
  request: Extract<Request, { op: "untrash" }>,
  archive: string,
  node: RegularNode,
): Result.Result<Landing, OpFailure> => {
  if (request.parent !== undefined || request.file !== undefined) {
    const named = landsIn(scope, request)
    if (Result.isFailure(named)) return named
    if (isTrashed(scope.claims, named.success.file)) {
      return Result.fail(
        new UsageFailure({
          reason: `that would put \`${node.title}\` back into \`${named.success.file}\` — ` +
            `untrash takes things OUT of the trash; name a parent or file in a ` +
            `live outline`,
        }),
      )
    }
    return named
  }

  const titles = ancestorsOf(scope.derived, node.id).map((crumb) => crumb.node.title)
  if (titles.length === 0) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` is at the top of \`${archive}\` with no outline ` +
          `recorded above it — it is the title \`trash\` wrote for the file a ` +
          `pile came from, not something that was put away. Put back what is ` +
          `under it, or give \`parent\` / \`file\` to place this record as a new row`,
      }),
    )
  }

  const source = titles[0]!
  const rest = titles.slice(1)
  const live = scope.facts.outlines.filter((candidate) => !isTrashed(scope.claims, candidate))
  if (!live.includes(source)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` was put away from \`${source}\`, which is not a ` +
          `live outline now${
            live.length === 0
              ? ""
              : ` (the directory holds ${live.map((f) => `\`${f}\``).join(", ")})`
          }. Give \`file\` to say which it goes back into, or \`parent\` to put ` +
          `it somewhere else`,
      }),
    )
  }

  if (rest.length === 0) {
    return Result.succeed({ file: source })
  }

  let level: ReadonlyArray<Located> = siblingsOf(scope.derived, source, undefined)
  let matches: ReadonlyArray<LocatedRegular> = []
  for (const title of rest) {
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
      reason: `\`${node.title}\` was put away from under ${chainOf(rest)} in \`${source}\`, and that ` +
        `chain ${
          matches.length === 0
            ? `matches nothing there — it may have been retitled, or put away itself`
            : `matches more than one place (${
              matches.map((at) => `\`${at.node.id}\` (${at.file}:${at.line})`).join(", ")
            })`
        }. Give \`parent\` (it goes under that node) or \`file\` (top level) to ` +
        `say where it goes back`,
    }),
  )
}

const notASignpost = (
  scope: Scope,
  node: RegularNode,
  destination: string,
  parent: string | undefined,
): Result.Result<void, OpFailure> => {
  if (!bareScaffold(node)) return Result.succeed(undefined)
  if (scope.facts.serves.has(node.title)) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${node.title}\` is the outline this pile came from — the title ` +
          `\`trash\` wrote above what was put away rather than something that was ` +
          `put away. Put back what is under it instead.`,
      }),
    )
  }
  const twin = siblingsOf(scope.derived, destination, parent).find(
    (at) => !isMirror(at.node) && at.node.title === node.title,
  )
  if (twin === undefined) return Result.succeed(undefined)
  return Result.fail(
    new UsageFailure({
      reason: `\`${twin.node.id}\` in \`${twin.file}\` is already called ` +
        `\`${node.title}\`, and this record carries nothing but that title — it is ` +
        `the title \`trash\` wrote above what was put away rather than something ` +
        `that was put away. Restoring it would stand a second one beside it and ` +
        `hang the trash's rows off the copy. Put back what is under it instead.`,
    }),
  )
}

const bareScaffold = (node: Node): boolean => {
  if (isMirror(node)) return false
  const { id: _id, parent: _parent, ord: _ord, title: _title, ...rest } = node
  return Object.keys(rest).length === 0
}


const planEmpty = (
  scope: Scope,
  request: Extract<Request, { op: "empty" }>,
): Planned => {
  const file = request.file
  const named = landsIn(scope, { file })
  if (Result.isFailure(named)) return Result.fail(named.failure)

  if (!isTrashed(scope.claims, file)) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${file}\` is not the trash, and \`trash_empty\` empties \`${TRASH_FILE(scope.claims, scope.outlineRow) ?? TRASH}\` ` +
          `— the one file \`outlines_trash\` writes. Nothing here deletes out of a ` +
          `live outline; \`outlines_trash\` is how a node leaves one.`,
      }),
    )
  }

  const going = recordsOf(scope, file)
  if (going.length === 0) {
    return Result.fail(
      new UsageFailure({
        reason: `\`${file}\` is already empty, so there is nothing to delete`,
      }),
    )
  }

  if (request.was !== undefined && request.was !== going.length) {
    return Result.fail(
      new UsageFailure({
        reason: `the Trash held ${request.was} ${
          request.was === 1 ? "record" : "records"
        } when this was asked for and holds ${going.length} now, so nothing was ` +
          `deleted — something was put away or put back in between. Look again and ` +
          `ask again.`,
      }),
    )
  }

  const held = heldBy(scope, new Set(going.map((record) => record.id)))
  if (held.length > 0) {
    const one = held.length === 1
    const record = one ? "a record" : "records"
    const it = one ? "it" : "them"
    const thatNames = one ? "that names" : "those name"
    const itNames = one ? "it names" : "they name"
    return Result.fail(
      new UsageFailure({
        reason: `\`${file}\` still has ${record} pointed INTO it from ` +
          `outside: ${capped(held, (naming) => naming)}. Deleting what ${thatNames} ` +
          `would leave ${it} pointing at nothing, so nothing was written — re-point ` +
          `or retire ${it} first, or \`trash_restore\` what ${itNames} back out.`,
      }),
    )
  }

  return Result.succeed({
    files: [{ file, nodes: [] }],
    id: file,
    title: file,
    file,
    summary: `empty: ${file} (${going.length} ${
      going.length === 1 ? "record" : "records"
    })`,
  })
}

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
    const at = record.id === node.id
      ? { parent: node.parent, ord }
      : {
        parent: record.parent === undefined ? undefined : copies.of(record.parent),
        ord: record.ord,
      }
    const placement = { id: copies.of(record.id), ord: at.ord }
    return isMirror(record)
      ? { ...withParent(record, at.parent), ...placement, mirror: copies.target(record.mirror) }
      : borne(scope, {
        ...repointed(withParent(record, at.parent), copies.target),
        ...placement,
      })
  })

  const under = written.length - 1
  const bent = refuseRecordsInProperties(scope, file, written)
  if (bent !== undefined) return Result.fail(bent)
  return Result.succeed(
    arriving(scope, { file, parent: node.parent }, () => holdsOpenWork(scope, node), {
      files: [{ file, nodes: withOrds([...records, ...written], ords.success) }],
      id,
      title: node.title,
      file,
      summary: under === 0
        ? `duplicate: ${node.title}`
        : `duplicate: ${node.title} (+${under})`,
      captured: mintedOf(
        written.filter((record): record is RegularNode => !isMirror(record)),
      ),
    }),
  )
}

interface Copies {
  readonly of: (id: string) => string
  readonly target: (id: string) => string
}

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

const repointed = (
  node: RegularNode,
  target: (id: string) => string,
): RegularNode => {
  const named = targetsOf(node)
  if (named.length === 0) return node
  const next: Draft<RegularNode> = { ...node }
  for (const field of new Set(named.map(([which]) => which))) {
    if (field === "mirror") continue
    const ids = node[field]
    if (ids !== undefined) next[field] = ids.map(target)
  }
  return next
}

const folded = (
  scope: Scope,
  ops: ReadonlyArray<BatchedRequest>,
  dress: (index: number, op: BatchedRequest, failure: OpFailure) => OpFailure,
  summarize: (summaries: ReadonlyArray<string>, last: Plan) => string,
): Planned => {
  const fold = folding(scope)
  const files = new Map<string, FilePlan>()
  const documents = new Map<string, DocumentPlan>()
  const captured: Array<Minted> = []
  const nudges: Array<string> = []
  const summaries: Array<string> = []
  let last: Plan | undefined
  let at: Scope = scope

  for (const [index, op] of ops.entries()) {
    const made = plan(at, op)
    if (Result.isFailure(made)) return Result.fail(dress(index, op, made.failure))
    const one = made.success

    for (const planned of one.files) files.set(planned.file, planned)
    for (const planned of one.documents ?? []) documents.set(planned.file, planned)
    if (one.captured !== undefined) captured.push(...one.captured)
    if (one.nudge !== undefined) nudges.push(one.nudge)
    summaries.push(one.summary)
    last = one

    if (index === ops.length - 1) break
    const next = fold(one)
    if (Result.isFailure(next)) return Result.fail(next.failure)
    at = next.success
  }

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
      return new ValidationFailure({ reason, verdict: failure.verdict })
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

const planUpdate = (
  scope: Scope,
  request: Extract<Request, { op: "update" }>,
): Planned => {
  const target = editable(scope, request.id)
  if (Result.isFailure(target)) return Result.fail(target.failure)
  const { node } = target.success

  const id = request.id
  const ops: Array<BatchedRequest> = []
  const wrote: Array<string> = []

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
      ...(was.title === undefined ? {} : { was: was.title }),
    })
    wrote.push("title")
  }
  if (request.desc !== undefined) {
    ops.push({
      op: "desc",
      id,
      desc: request.desc,
      ...(was.desc === undefined ? {} : { was: was.desc }),
    })
    wrote.push("note")
  }
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
    (_index, _op, failure) => failure,
    (_summaries, last) => `update: ${last.title} (${wrote.join(", ")})`,
  )
}

const standingAt = (scope: Scope, target: string): string =>
  nodeNamed(scope.derived, target)?.node.id ?? target

const cycling = (scope: Scope, node: RegularNode, target: string): OpFailure | null =>
  closesLoop(
    (id) => scope.derived.after.get(id) ?? [],
    node.id,
    target,
    standingAt(scope, target),
  )

const closesLoop = (
  edges: (id: string) => Iterable<string>,
  id: string,
  target: string,
  named: string,
): OpFailure | null => {
  const back = pathTo(named, id, edges)
  if (back === null) return null
  return new UsageFailure({
    reason: `\`${id}\` after \`${target}\` closes a loop — ${
      chainOf([id, ...back])
    } — and \`after\` (counting \`blocks\`) must stay acyclic, so nothing in it ` +
      `could ever start first`,
  })
}

const EDGE = {
  see: {
    none: "has no `see` targets",
    exact: "already sees exactly",
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

type WritableEdge = keyof typeof EDGE

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
    id,
    title,
    file,
    summary: `mirror: ${title}`,
  })
}

const showsInto = (
  scope: Scope,
  target: string,
  parent: string,
): string | null => {
  const path = drawingPath(scope.derived, target, parent)
  return path === null ? null : chainOf(path)
}

const shownTitle = (scope: Scope, target: string): string =>
  nodeNamed(scope.derived, target)?.node.title ?? target

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
          `\`${request.id}\` is a node, not a mirror. \`outlines_unmirror\` retires a ` +
          `PLACEMENT — one line showing a node in a second location — and never ` +
          `touches the node itself; \`outlines_trash\` is what puts a node and its ` +
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

const planWriteDocument = (
  scope: Scope,
  request: Extract<Request, { op: "doc" }>,
): Planned => {
  const document = scope.facts.markdown(request.file)
  if (document === undefined) {
    return Result.fail(
      noSuchDocument(
        scope.claims,
        scope.facts.set,
        request.file,
        "`markdown_create` is what starts one",
      ),
    )
  }

  const may = writable(scope, request.file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  const conflict = stale(
    request.was,
    document.body,
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

const planCreateDocument = (
  scope: Scope,
  request: Extract<Request, { op: "create-doc" }>,
): Planned => {
  if (creatable(request.file, "") === null) return Result.fail(new UsageFailure({ reason: `\`${request.file}\` is not a relative file path under the served directory (no absolute path, no \`..\`, no \`.\`, and no directory the serve's walk prunes).` }))
  if (claimedOf(scope.claims, request.file) === null) return Result.fail(unclaimedPath(request.file, [...scope.facts.serves]))
  const file = documentPath(scope.claims, request.file)
  if (file === null) {
    const kept = [...scope.claims.byKind.values()]
      .filter(claim => claim.holds === "text" && claim.kept)
      .flatMap(claim => claim.exts.map(ext => claim.under === undefined ? `\`${ext}\`` : `\`${ext}\` under \`${claim.under}\``))
    return Result.fail(
      new UsageFailure({
        reason: kept.length === 0
          ? "no row claims a kind of document this serve writes, so no document can be created"
          : `\`${request.file}\` is not a relative path under the served directory that any `
            + `document row claims (${kept.join(", ")}; no absolute path, no \`..\`, no \`.\`, `
            + `and no directory in it starts with \`.\` or is \`node_modules\` — the serve's `
            + `walk prunes those, so a file under one is never part of the set)`,
      }),
    )
  }

  if (scope.facts.at(file) !== undefined) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${file}\` is already a document under the served directory — create ` +
          `starts a new one; \`markdown_write\` is what edits this one`,
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

const namingDocument = (
  scope: Scope,
  file: string,
): ReadonlyArray<{ name: string; site: string; via: string }> => {
  const address = addressOf(scope.claims, file, null)
  const found: Array<{ name: string; site: string; via: string }> =
    address === null ? [] :
      referencesOf(scope, address).map(ref => ({
        name: "file" in ref.source ? ref.source.node.id : ref.source.path,
        site: "file" in ref.source ? `${ref.source.file}:${ref.source.line}` : ref.source.path,
        via: "link",
      }))
  let keyed: Set<string> | undefined
  for (const [key, declared] of scope.typed.declarations) {
    if (declared.type.kind === "doc") (keyed ??= new Set()).add(key)
  }
  for (const at of scope.derived.nodes) {
    if (isMirror(at.node)) continue
    if (keyed === undefined || at.node.custom === undefined) continue
    const custom: Record<string, string | ReadonlyArray<string>> = at.node.custom
    for (const [key, value] of Object.entries(custom)) {
      const declared = declaredFor(scope.typed.declarations, key)
      if (declared?.type.kind !== "doc") continue
      const held = typeof value === "string" ? [value] : value
      for (const one of held) {
        if (resolvedDoc(declared, at.file, one) === file) {
          found.push({ name: at.node.id, site: `${at.file}:${at.line}`, via: key })
          break
        }
      }
    }
  }
  return found
}

const planDelete = (scope: Scope, request: Extract<Request, { op: "delete" }>): Planned => {
  const kind = fileKind(scope.claims, request.file)
  const claim = kind === null ? undefined : scope.claims.byKind.get(kind)
  if (claim !== undefined && !claim.kept) {
    return Result.fail(
      new UsageFailure({
        reason:
          `\`${request.file}\` is ${claim.article} ${claim.noun} — olai only SHOWS files of this kind ` +
          `and never writes one, and that extends to removing one: it belongs to ` +
          `whatever put it there`,
      }),
    )
  }

  const document = scope.facts.at(request.file)
  if (document === undefined || kind === null) {
    const near = didYouMean(request.file, [
      ...scope.facts.outlines,
      ...markdownIn(scope.facts.set).map((entry) => entry.path),
    ])
    return Result.fail(
      new NotFoundFailure({
        reason: near === ""
          ? `\`${request.file}\` is not a file under the served directory — \`markdown_create\` ` +
            `starts a document and \`files_create\` an outline; nothing here deletes one ` +
            `that was never there`
          : `\`${request.file}\` is not a file under the served directory${near}`,
        named: request.file,
      }),
    )
  }

  const may = writable(scope, request.file)
  if (Result.isFailure(may)) return Result.fail(may.failure)

  if (claim?.holds === "nodes") {
    const held = recordsOf(scope, request.file)
    if (held.length > 0) {
      return Result.fail(
        new UsageFailure({
          reason:
            `\`${request.file}\` still holds ${held.length === 1 ? "a record" : `${held.length} records`} — ` +
            `${capped(held, (one) => `\`${one.id}\` (${shownTitle(scope, one.id)})`)}. Delete removes ` +
            `only an EMPTY outline: \`outlines_trash\` is what moves a record out of one`,
        }),
      )
    }
  } else {
    const outgoing = namingDocument(scope, request.file)
    if (outgoing.length > 0) {
      return Result.fail(
        new UsageFailure({
          reason:
            `\`${request.file}\` is still named by ${capped(outgoing, ({ name, site, via }) =>
              `\`${name}\` (\`${via}\`${site === name ? "" : `, ${site}`})`)} — deleting the file would leave ${outgoing.length === 1 ? "that" : "those"} ` +
            `pointing at nothing. Re-point ${outgoing.length === 1 ? "it" : "them"}, or delete the ` +
            `naming link or record first.`,
        }),
      )
    }
  }

  return Result.succeed({
    files: [],
    removed: [document.path],
    id: document.path,
    title: document.path,
    file: document.path,
    summary: `delete: ${document.path}`,
  })
}

const heldBy = (scope: Scope, going: ReadonlySet<string>): ReadonlyArray<string> => {
  const held = new Map<string, { at: Located; fields: Set<string> }>()
  const file = (naming: { at: Located; fields: Iterable<string> }): void => {
    if (going.has(naming.at.node.id)) return
    const entry = held.get(naming.at.node.id) ??
      { at: naming.at, fields: new Set<string>() }
    for (const field of naming.fields) entry.fields.add(field)
    held.set(naming.at.node.id, entry)
  }
  for (const id of going) {
    for (const naming of scope.derived.namedBy.get(id) ?? []) file(naming)
  }
  for (const naming of namingByProp(scope, going)) file(naming)
  return [...held.values()].map((entry) =>
    `\`${entry.at.node.id}\` (${
      [...entry.fields].map((field) => `\`${field}\``).join(", ")
    }, ${entry.at.file}:${entry.at.line})`
  )
}

const namingByProp = (
  scope: Scope,
  going: ReadonlySet<string>,
): ReadonlyArray<{ at: Located; fields: ReadonlyArray<string> }> => {
  const referring = new Set<string>()
  for (const [key, declared] of scope.typed.declarations) {
    if (declared.type.kind === "ref" || declared.type.kind === "node") referring.add(key)
  }
  if (referring.size === 0) return []
  const found: Array<{ at: Located; fields: ReadonlyArray<string> }> = []
  for (const at of scope.derived.nodes) {
    const custom = isMirror(at.node) ? undefined : at.node.custom
    if (custom === undefined) continue
    const fields: Array<string> = []
    for (const [key, value] of Object.entries(custom)) {
      if (declaredFor(scope.typed.declarations, key) === undefined) continue
      if (!referring.has(key.trim().toLowerCase())) continue
      const held = typeof value === "string" ? [value] : value
      if (held.some((one) => going.has(one))) fields.push(key)
    }
    if (fields.length > 0) found.push({ at, fields })
  }
  return found
}

const dependents = (scope: Scope, id: string): ReadonlyArray<string> =>
  heldBy(scope, new Set([id]))
const PLANNERS: {
  readonly [K in Request["op"]]: (
    scope: Scope,
    request: Extract<Request, { readonly op: K }>,
  ) => Planned
} = {
  add: planAdd,
  done: planMark,
  cancelled: planMark,
  doing: planMark,
  todo: planMark,
  title: planTitle,
  desc: planDesc,
  date: planDate,
  repeat: planRepeat,
  prop: planProp,
  move: planMove,
  split: planSplit,
  merge: planMerge,
  trash: planTrash,
  duplicate: planDuplicate,
  untrash: planUntrash,
  empty: planEmpty,
  create: planCreate,
  see: planSee,
  mirror: planMirror,
  unmirror: planUnmirror,
  after: planAfter,
  doc: planWriteDocument,
  "create-doc": planCreateDocument,
  delete: planDelete,
  update: planUpdate,
  apply: planApply,
}

export const VERBS: ReadonlyArray<Request["op"]> = Object.keys(PLANNERS) as ReadonlyArray<
  Request["op"]
>

export const plan = (scope: Scope, request: Request): Planned => {
  if (request.op !== "create" && request.op !== "create-doc" && "file" in request && typeof request.file === "string"
    && claimedOf(scope.claims, request.file) === null) return Result.fail(unclaimedPath(request.file, [...scope.facts.serves]))
  const planned = (PLANNERS[request.op] as (scope: Scope, request: Request) => Planned)(scope, request)
  if (Result.isFailure(planned) || !["title", "desc", "add", "create", "doc", "create-doc"].includes(request.op)) return planned
  const next = planned.success
  const served = new Set([...scope.set.documents.map(one => one.path), ...next.files.map(one => one.file), ...(next.documents ?? []).map(one => one.file)])
  const nudges: string[] = []
  const compare = (file: string, text: string | ReadonlyArray<string>, before: string | ReadonlyArray<string>) => {
    const previous = new Set(deadLinksIn(file, before, served).map(one => one.written))
    nudges.push(...deadLinksIn(file, text, served).filter(one => !previous.has(one.written)).map(deadLinkSaid))
  }
  for (const file of next.files) {
    for (const node of file.nodes) {
      if (isMirror(node)) continue
      const before = scope.derived.byId.get(node.id)?.node
      if (before !== undefined && !isMirror(before) && before.title === node.title && before.desc === node.desc) continue
      compare(file.file, [node.title, node.desc ?? ""], before === undefined || isMirror(before) ? "" : [before.title, before.desc ?? ""])
    }
  }
  for (const document of next.documents ?? []) compare(document.file, proseIn(document.text), proseIn(markdownAt(scope.set, document.file)?.body ?? ""))
  return nudges.length === 0 ? planned : Result.succeed({ ...next, nudge: [next.nudge, ...new Set(nudges)].filter(Boolean).join(" ") })
}
