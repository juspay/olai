import {
  proseIn,
  deadLinksIn,
  deadLinksOf,
  deadLinkFields,
  type Claims,
  claimedOf,
  ancestorTitles,
  addressOf,
  referencesOf,
  blockersOf,
  bodiedIn,
  brokenBy,
  brokenIn,
  completingTags,
  countedChildren,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SUBTREE_DEPTH,
  type Derived,
  declarationsOf,
  type Detail,
  type DocumentBody,
  type DocumentSummary,
  errorLine,
  follow,
  type Found,
  heldCustom,
  type HomesAnswer,
  type HomesRequest,
  isMirror,
  isProjectable,
  type KindVocabulary,
  NO_KINDS,
  isRegular,
  LEGAL_FIELDS,
  type LocatedRegular,
  markdownAt,
  markdownIn,
  MARKS,
  matchingDocuments,
  type NamedAnswer,
  type NamedRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  narrowingOf,
  NodeId,
  matching,
  type MovingAnswer,
  type MovingRequest,
  movingOf,
  nodeNamed,
  nodesOf,
  nothing,
  type OpFailure,
  type OutlineError,
  type OutlineSet,
  outlineNames,
  outlinePaths,
  type OutlineSummary,
  type PageReading,
  type PageRequest,
  type PathsAnswer,
  parseFilter,
  pageOf,
  rankedTogether,
  type Placed,
  type Placement,
  type ProjectedPlaced,
  PROJECTABLE,
  type Projectable,
  type Projected,
  type ProjectedSubtree,
  progressOf,
  tookOf,
  type Reading,
  type Reference,
  ranked,
  siblingsOf,
  type SearchAnswer,
  type SearchHit,
  type SearchRequest,
  type Stamps,
  type Status,
  type Subtree,
  type SubtreeAnswer,
  type SubtreeRequest,
  type TagsAnswer,
  type TagsRequest,
  tagText,
  titleParts,
  UsageFailure,
} from "@olai/format"

import { Result } from "effect"

import { askedOf } from "./asked.ts"
import { noSuchDocument, notLoaded, outlineAt } from "./refusals.ts"

export const foundOf = (derived: Derived, located: LocatedRegular): Found => {
  const status = derived.status.get(located.node.id)
  return {
    id: located.node.id,
    title: located.node.title,
    file: located.file,
    line: located.line,
    ...(status === undefined ? {} : { status }),
    path: ancestorTitles(derived, located.node.id),
    ...carriedOf(located.node, heldCustom(located.node.custom)),
  }
}

const carriedOf = (
  node: LocatedRegular["node"],
  custom: ReturnType<typeof heldCustom>,
): Pick<Found, "parent" | "see" | "after" | "custom"> =>
  ({
    ...(nothing(node.parent) ? {} : { parent: node.parent }),
    ...(nothing(node.see) ? {} : { see: node.see }),
    ...(nothing(node.after) ? {} : { after: node.after }),
    ...(nothing(custom) ? {} : { custom }),
  })

export const narrowing = (
  at: Reading,
  request: NarrowingRequest,
  now: string,
  kinds: KindVocabulary,
): NarrowingAnswer =>
  narrowingOf(at, request, now, kinds)

export const named = (
  derived: Derived,
  request: NamedRequest,
): NamedAnswer => {
  const named: Array<NamedAnswer["named"][number]> = []
  for (const id of new Set(request.ids)) {
    const at = nodeNamed(derived, id)
    if (at === undefined) continue
    named.push({ asked: id, id: at.node.id, title: at.node.title })
  }
  return { named }
}

export const homes = (
  at: Reading,
  request: HomesRequest,
): HomesAnswer => {
  const homes: Array<HomesAnswer["homes"][number]> = []
  for (const id of new Set(request.ids)) {
    const found = at.derived.byId.get(id)
    if (found === undefined) continue
    homes.push({ id, file: found.file })
  }
  const served = outlineNames(at.set)
  const broken = brokenBy(at.set)
  const loaded = [...new Set(request.files)].filter(
    (file) => served.has(file) && !broken.has(file),
  )
  return { homes, loaded }
}

export const page = (
  at: Reading,
  request: PageRequest,
  kinds: KindVocabulary,
): PageReading => pageOf(at, request, kinds)

export const moving = (derived: Derived, request: MovingRequest): MovingAnswer =>
  movingOf(derived, request)

export const tags = (
  derived: Derived,
  request: TagsRequest,
): TagsAnswer => ({ tags: completingTags(derived, request) })

const stampsOf = (node: LocatedRegular["node"]): Stamps =>
  Object.fromEntries(
    MARKS.flatMap((mark) => node[mark] === undefined ? [] : [[mark, node[mark]]]),
  )

interface Wants {
  readonly named: ReadonlySet<Projectable>
  readonly keys: ReadonlySet<string>
}

const unknownField = (field: string): UsageFailure =>
  new UsageFailure({
    reason:
      `\`${field}\` is not a field \`fields\` names — the legal ones are ` +
      LEGAL_FIELDS +
      "; `id` rides every row already.",
  })

interface RowParts {
  readonly node: LocatedRegular["node"]
  readonly status: Status | undefined
  readonly carried: Pick<Found, "parent" | "see" | "after" | "custom">
  readonly held: ReturnType<typeof heldCustom>
  readonly wants: Wants
}

const FIELDS_READ = {
  title: ({ node }) => node.title,
  parent: ({ carried }) => carried.parent,
  status: ({ status }) => status,
  took: ({ node }) => tookOf(node),
  done: ({ node }) => node.done,
  cancelled: ({ node }) => node.cancelled,
  doing: ({ node }) => node.doing,
  todo: ({ node }) => node.todo,
  started: ({ node }) => node.started,
  worked: ({ node }) => node.worked,
  date: ({ node }) => node.date,
  repeat: ({ node }) => node.repeat,
  desc: ({ node }) => node.desc,
  created: ({ node }) => node.created,
  changed: ({ node }) => node.changed,
  see: ({ carried }) => carried.see,
  after: ({ carried }) => carried.after,
  custom: ({ held, wants }) => {
    const picked = wants.named.has("custom")
      ? held
      : Object.fromEntries(
          Object.entries(held).filter(([key]) => wants.keys.has(key)),
        )
    return nothing(picked) ? undefined : picked
  },
} satisfies Record<Projectable, (parts: RowParts) => unknown>

const CUSTOM_PREFIX = "custom."

const projectionOf = (
  fields: ReadonlyArray<string>,
): Result.Result<Wants, UsageFailure> => {
  const named = new Set<Projectable>()
  const keys = new Set<string>()
  for (const field of fields) {
    if (field === "id") continue
    if (field.startsWith(CUSTOM_PREFIX)) {
      const key = field.slice(CUSTOM_PREFIX.length)
      if (key === "") return Result.fail(unknownField(field))
      keys.add(key)
      continue
    }
    if (!isProjectable(field)) return Result.fail(unknownField(field))
    named.add(field)
  }
  return Result.succeed({ named, keys })
}

const shapedOf = (
  derived: Derived,
  located: LocatedRegular,
  wants: Wants,
): Projected => {
  const node = located.node
  const held = heldCustom(node.custom)
  const parts: RowParts = {
    node,
    status: derived.status.get(node.id),
    carried: carriedOf(node, held),
    held,
    wants,
  }
  return {
    id: node.id,
    ...Object.fromEntries(
      PROJECTABLE.flatMap((name) => {
        if (!wants.named.has(name) && !(name === "custom" && wants.keys.size !== 0)) {
          return []
        }
        const value = FIELDS_READ[name](parts)
        return value === undefined ? [] : [[name, value]] as const
      }),
    ),
  }
}

export const detail = (
  at: Reading,
  id: string,
  fields?: ReadonlyArray<string> | undefined,
  served?: ReadonlySet<string>,
): Result.Result<Detail | null, OpFailure> => {
  const derived = at.derived
  let wants: Wants | undefined
  if (fields !== undefined) {
    const checked = projectionOf(fields)
    if (Result.isFailure(checked)) return Result.fail(checked.failure)
    wants = checked.success
  }
  const located = derived.byId.get(id)
  if (located === undefined || !isRegular(located)) return Result.succeed(null)
  const node = located.node
  const progress = progressOf(derived, id)
  const took = tookOf(node)
  const placements = placementsOf(derived, id)
  const placed = placedUnder(derived, id)
  const referencedBy = referrersOf(at, id)
  const blockedBy = waitingFor(derived, id)
  return Result.succeed({
    ...foundOf(derived, located),
    ...(served === undefined ? {} : deadLinkFields(deadLinksOf(located, served))),
    ...(node.date === undefined ? {} : { date: node.date }),
    ...(node.repeat === undefined ? {} : { repeat: node.repeat }),
    ...(node.desc === undefined ? {} : { desc: node.desc }),
    ...(node.created === undefined ? {} : { created: node.created }),
    ...(node.changed === undefined ? {} : { changed: node.changed }),
    ...(node.started === undefined ? {} : { started: node.started }),
    ...(node.worked === undefined ? {} : { worked: node.worked }),
    ...stampsOf(node),
    tags: titleParts(node.title).flatMap((part) =>
      part.kind === "tag" ? [tagText(part)] : []
    ),
    ...(progress === undefined ? {} : { progress }),
    ...(took === undefined ? {} : { took }),
    children: countedChildren(derived, id).map((child) =>
      wants === undefined ? foundOf(derived, child) : shapedOf(derived, child, wants)
    ),
    ...(placements.length === 0 ? {} : { mirrors: placements }),
    ...(placed.length === 0 ? {} : { placed }),
    ...(referencedBy.length === 0 ? {} : { referencedBy }),
    ...(blockedBy.length === 0 ? {} : { blockedBy }),
  })
}

const waitingFor = (derived: Derived, id: string): ReadonlyArray<Found> =>
  blockersOf(derived, id).map((one) => foundOf(derived, one.at))

const referrersOf = (at: Reading, id: string): ReadonlyArray<Reference> =>
  referencesOf(at, addressOf(at.claims, null, id)!)

function placedAmong(
  derived: Derived,
  siblings: ReturnType<typeof siblingsOf>,
): ReadonlyArray<Placed>
function placedAmong(
  derived: Derived,
  siblings: ReturnType<typeof siblingsOf>,
  wants: Wants,
): ReadonlyArray<ProjectedPlaced>
function placedAmong(
  derived: Derived,
  siblings: ReturnType<typeof siblingsOf>,
  wants?: Wants,
): ReadonlyArray<Placed> | ReadonlyArray<ProjectedPlaced> {
  return siblings.flatMap((child) => {
    if (!isMirror(child.node)) return []
    const found = follow(derived, child)
    if (found.kind !== "found") return []
    return [{
      id: child.node.id,
      file: child.file,
      line: child.line,
      ...(child.node.parent === undefined ? {} : { parent: child.node.parent }),
      shows: wants === undefined
        ? foundOf(derived, found.shows)
        : shapedOf(derived, found.shows, wants),
    }]
  })
}

function placedUnder(
  derived: Derived,
  id: string,
): ReadonlyArray<Placed>
function placedUnder(
  derived: Derived,
  id: string,
  wants: Wants,
): ReadonlyArray<ProjectedPlaced>
function placedUnder(
  derived: Derived,
  id: string,
  wants?: Wants,
): ReadonlyArray<Placed> | ReadonlyArray<ProjectedPlaced> {
  const siblings = derived.children.get(id) ?? []
  return wants === undefined
    ? placedAmong(derived, siblings)
    : placedAmong(derived, siblings, wants)
}

const placementsOf = (
  derived: Derived,
  id: string,
): ReadonlyArray<Placement> =>
  [...(derived.mirrorsOf.get(id) ?? [])].flatMap((mirror) => {
    const at = derived.byId.get(mirror)
    if (at === undefined) return []
    return [{
      id: at.node.id,
      file: at.file,
      line: at.line,
      ...(at.node.parent === undefined ? {} : { parent: at.node.parent }),
    }]
  })

const armOf = (
  request: SubtreeRequest,
): { id: string } | { file: string } | "both" | "neither" =>
  request.id !== undefined
    ? request.file !== undefined ? "both" : { id: request.id }
    : request.file !== undefined ? { file: request.file } : "neither"

export const subtree = (
  at: Reading,
  request: SubtreeRequest,
): Result.Result<SubtreeAnswer, OpFailure> => {
  const depth = request.depth ?? DEFAULT_SUBTREE_DEPTH
  const wantsNotes = request.withDesc !== false

  const arm = armOf(request)
  if (arm === "both") {
    return Result.fail(
      new UsageFailure({
        reason: "`id` and `file` are two different reads — give one. `id` is a " +
          "node and what hangs under it; `file` is a whole outline. " +
          "`search_nodes` with `file` is how a query is narrowed to one outline.",
      }),
    )
  }
  if (arm === "neither") {
    return Result.fail(
      new UsageFailure({
        reason: "give `id` (a node and what hangs under it) or `file` " +
          "(a whole outline: every top-level node in it)",
      }),
    )
  }

  let wants: Wants | undefined
  if (request.fields !== undefined) {
    const checked = projectionOf(request.fields)
    if (Result.isFailure(checked)) return Result.fail(checked.failure)
    wants = checked.success
    if (request.withDesc !== undefined) {
      return Result.fail(
        new UsageFailure({
          reason:
            "`fields` is the whole shape of each row — `withDesc` is the " +
            "default projection's note dial, and there is nothing left of it " +
            "to turn. Name `desc` in `fields` for the notes, and drop " +
            "`withDesc` altogether.",
        }),
      )
    }
  }

  const served = new Set(at.set.documents.map(one => one.path))
  const walk = (located: LocatedRegular, left: number): Subtree => {
    const children = countedChildren(at.derived, located.node.id)
    const placed = placedUnder(at.derived, located.node.id)
    return {
      ...foundOf(at.derived, located),
      ...deadLinkFields(deadLinksOf(located, served)),
      ...(located.node.date === undefined ? {} : { date: located.node.date }),
      ...(wantsNotes && located.node.desc !== undefined
        ? { desc: located.node.desc }
        : {}),
      children: left <= 0 ? [] : children.map((child) => walk(child, left - 1)),
      ...(placed.length === 0 ? {} : { placed }),
      ...(left <= 0 && children.length > 0 ? { truncated: true as const } : {}),
    }
  }
  const shapedWalk = (wants: Wants, located: LocatedRegular, left: number): ProjectedSubtree => {
    const children = countedChildren(at.derived, located.node.id)
    const placed = placedUnder(at.derived, located.node.id, wants)
    return {
      ...shapedOf(at.derived, located, wants),
      ...deadLinkFields(deadLinksOf(located, served)),
      children: left <= 0 ? [] : children.map((child) => shapedWalk(wants, child, left - 1)),
      ...(placed.length === 0 ? {} : { placed }),
      ...(left <= 0 && children.length > 0 ? { truncated: true as const } : {}),
    }
  }

  if ("id" in arm) {
    const located = at.derived.byId.get(arm.id)
    if (located === undefined || !isRegular(located)) {
      return Result.succeed({ missing: arm.id })
    }
    return Result.succeed(
      wants === undefined ? walk(located, depth) : shapedWalk(wants, located, depth),
    )
  }

  const outline = outlineAt(askedOf(at.claims, at.set), arm.file)
  if (Result.isFailure(outline)) return Result.fail(outline.failure)
  const broken = brokenIn(at.set, arm.file)
  if (broken !== undefined) return Result.fail(notLoaded(at.claims, arm.file, broken))
  const top = siblingsOf(at.derived, arm.file, undefined)
  const roots = top.filter(isRegular)
  if (wants === undefined) {
    const placed = placedAmong(at.derived, top)
    return Result.succeed({
      file: arm.file,
      roots: roots.map((root) => walk(root, depth)),
      ...(placed.length === 0 ? {} : { placed }),
    })
  }
  const placed = placedAmong(at.derived, top, wants)
  return Result.succeed({
    file: arm.file,
    roots: roots.map((root) => shapedWalk(wants, root, depth)),
    ...(placed.length === 0 ? {} : { placed }),
  })
}

const torn = (file: string, errors: ReadonlyArray<OutlineError>) => ({
  file,
  unreadable: errors.map(errorLine),
})

export const outlines = (
  set: OutlineSet,
  derived: Derived,
): ReadonlyArray<OutlineSummary> => {
  const broken = brokenBy(set)
  return outlinePaths(set).map((file): OutlineSummary => {
    const errors = broken.get(file)
    if (errors !== undefined) return torn(file, errors)
    const own = nodesOf(derived, file).filter(isRegular)
    return {
      file,
      nodes: own.length,
      roots: own
        .filter((located) => located.node.parent === undefined)
        .map((located) => located.node.title),
    }
  })
}

export const paths = (claims: Claims, outlineRow: string, set: OutlineSet): PathsAnswer => ({
  paths: outlinePaths(set), outlineRow,
  claims: [...claims.byKind.values()].map(({ format: _format, ...claim }) => claim),
})

export const documents = (set: OutlineSet): ReadonlyArray<DocumentSummary> => {
  const broken = brokenBy(set)
  return markdownIn(set).map((entry): DocumentSummary => {
    const errors = broken.get(entry.path)
    if (errors !== undefined) return torn(entry.path, errors)
    const props = heldCustom(entry.props)
    return {
      file: entry.path,
      title: entry.title,
      bytes: entry.bytes,
      ...(nothing(props) ? {} : { props }),
    }
  })
}

export const document = (
  claims: Claims,
  set: OutlineSet,
  file: string,
): Result.Result<DocumentBody, OpFailure> => {
  const entry = markdownAt(set, file)
  if (entry === undefined) {
    return Result.fail(
      noSuchDocument(claims, set, file, "`markdown_index` says what is"),
    )
  }
  const broken = brokenIn(set, file)
  if (broken !== undefined) return Result.fail(notLoaded(claims, file, broken))
  return Result.succeed({ file, text: entry.body, ...deadLinkFields(deadLinksIn(file, proseIn(entry.body), new Set(set.documents.map(one => one.path)))) })
}
