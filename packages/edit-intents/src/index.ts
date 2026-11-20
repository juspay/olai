import { mintExt } from "@olai/format"
import {
  captureInto,
  customOf as customOfNode,
  type Derived,
  isTrashed,
  TRASH_FILE,
  isMirror,
  type Located,
  type LocatedRegular,
  markdownAt,
  mintedInto,
  nodeNamed,
  nodesOf,
  type OpFailure,
  outlinePaths,
  PIN_NAME_UNWRITABLE,
  PINS,
  pinsIn,
  pinTitle,
  type Reading,
  siblingsOf,
  MARKS,
  settles,
  type Status,
  UsageFailure,
} from "@olai/format"
import { merging, notFound, type Request } from "@olai/ops"
import type { Edit } from "@olai/surface"
import { Result } from "effect"

type Resolved = Result.Result<Request, OpFailure>

export const reresolves = (edit: Edit): boolean =>
  edit.verb === "capture" || edit.verb === "pin"

export const requestFor = (at: Reading & { readonly outlineRow: string }, edit: Edit): Resolved => {
  switch (edit.verb) {
    case "add":
      return addRequest(at, edit)
    case "capture":
      return captureInto(at.claims, at.outlineRow, outlinePaths(at.set), { title: edit.title })
    case "pin":
      return pinRequest(at, edit)
    case "move":
      return moveRequest(at.derived, edit)
    case "under":
      return Result.succeed({ op: "move", id: edit.id, parent: edit.parent })
    case "toggle": {
      const undo = at.derived.status.get(edit.id) === edit.mark
      return Result.succeed({ op: edit.mark, id: edit.id, ...(undo ? { undo } : {}) })
    }
    case "walk":
      return walkRequest(at.derived, edit)
    case "title":
      return Result.succeed({
        op: "title",
        id: edit.id,
        title: edit.title,
        ...(edit.was === undefined ? {} : { was: edit.was }),
        ...(edit.pinned === undefined ? {} : { pinned: edit.pinned }),
      })
    case "desc":
      return Result.succeed({
        op: "desc",
        id: edit.id,
        desc: edit.desc,
        ...(edit.was === undefined ? {} : { was: edit.was }),
      })
    case "date":
      return Result.succeed({ op: "date", id: edit.id, date: edit.date })
    case "repeat":
      return Result.succeed({ op: "repeat", id: edit.id, repeat: edit.repeat })
    case "prop":
      return Result.succeed({
        op: "prop",
        id: edit.id,
        key: edit.key,
        value: edit.value,
        ...(edit.was === undefined ? {} : { was: edit.was }),
      })
    case "split":
      return Result.succeed({
        op: "split",
        id: edit.id,
        title: edit.title,
        rest: edit.rest,
        ...(edit.under === true ? { under: true } : {}),
      })
    case "merge":
      return Result.succeed({
        op: "merge",
        id: edit.id,
        ...(edit.title === undefined ? {} : { title: edit.title }),
      })
    case "unmirror":
      return Result.succeed({ op: "unmirror", id: edit.id })
    case "mirror":
      return mirrorRequest(at, edit)
    case "trash":
      return Result.succeed({ op: "trash", id: edit.id })
    case "duplicate":
      return Result.succeed({ op: "duplicate", id: edit.id })
    case "untrash":
      return Result.succeed({
        op: "untrash",
        id: edit.id,
        ...(edit.parent === undefined ? {} : { parent: edit.parent }),
        ...(edit.file === undefined ? {} : { file: edit.file }),
      })
    case "see":
    case "after":
      return Result.succeed({
        op: edit.verb,
        id: edit.id,
        ...(edit.add === undefined ? {} : { add: edit.add }),
        ...(edit.remove === undefined ? {} : { remove: edit.remove }),
      })
    case "place":
      return placeRequest(at.derived, edit)
    case "mark":
      return markRequest(at.derived, edit)
    case "remove":
      return removeRequest(at.derived, edit)
    case "doc":
      return Result.succeed({
        op: "doc",
        file: edit.file,
        text: edit.text,
        ...(edit.was === undefined ? {} : { was: edit.was }),
      })
    case "docNew":
      return Result.succeed({ op: "create-doc", file: edit.file })
    case "outlineNew":
      return Result.succeed({ op: "create", file: edit.file })
    case "emptyTrash":
      return emptyTrashRequest(at, edit)
    case "fileDelete":
      return Result.succeed({ op: "delete", file: edit.file })
  }
}

type Home = { readonly parent: string } | { readonly file: string }
type Neighbour =
  | { readonly after: string; readonly before?: never }
  | { readonly before: string; readonly after?: never }
type Landing = Home | (Home & Neighbour)

const landingFor = (
  at: Reading,
  anchor: Extract<Edit, { verb: "add" }>["at"],
): Result.Result<Landing, OpFailure> => {
  if (anchor.kind === "first") return Result.succeed({ file: anchor.file })
  const target = at.derived.byId.get(anchor.id)
  if (target === undefined) return Result.fail(notFound(at.derived, anchor.id))
  if (anchor.kind === "under") return Result.succeed({ parent: anchor.id })
  const parent = target.node.parent
  return Result.succeed({
    ...(parent === undefined ? { file: target.file } : { parent }),
    ...(anchor.kind === "before" ? { before: anchor.id } : { after: anchor.id }),
  })
}

const addRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "add" }>,
): Resolved => {
  const landing = landingFor(at, edit.at)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  return Result.succeed({ op: "add", ...landing.success, title: edit.title, ...(edit.desc === undefined ? {} : { desc: edit.desc }) })
}

const mirrorRequest = (
  at: Reading,
  edit: Extract<Edit, { verb: "mirror" }>,
): Resolved => {
  const landing = landingFor(at, edit.at)
  if (Result.isFailure(landing)) return Result.fail(landing.failure)
  return Result.succeed({ op: "mirror", ...landing.success, target: edit.target })
}

const pinRequest = (
  at: Reading & { readonly outlineRow: string },
  edit: Extract<Edit, { verb: "pin" }>,
): Resolved => {
  const title = pinTitle(edit.at, edit.name ?? "")
  if (title === undefined) {
    return Result.fail(new UsageFailure({ reason: PIN_NAME_UNWRITABLE }))
  }
  const shelf = pinsIn(at.claims, outlinePaths(at.set))
  const ext = mintExt(at.claims, at.outlineRow)
  if (shelf === undefined && ext === null) return Result.fail(new UsageFailure({ reason: `the ${at.outlineRow} row is off, so no outline can be created` }))
  return Result.succeed(
    shelf === undefined
      ? { op: "create", file: mintedInto(`${PINS}${ext}`), seed: { title } }
      : { op: "add", file: shelf, title },
  )
}

const emptyTrashRequest = (
  at: Reading & { readonly outlineRow: string },
  edit: Extract<Edit, { verb: "emptyTrash" }>,
): Resolved => {
  const piles = outlinePaths(at.set).filter(
    (file) => isTrashed(at.claims, file),
  )
  if (piles.length > 1) {
    return Result.fail(refusal(`ambiguous-convention: more than one Trash file: ${piles.join(", ")}`))
  }
  if (piles.length === 0 || nodesOf(at.derived, piles[0]!).length === 0) {
    return Result.fail(refusal("The Trash is already empty"))
  }
  return Result.succeed({
    op: "empty",
    file: piles[0]!,
    ...(edit.was === undefined ? {} : { was: edit.was }),
  })
}

const moveRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "move" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  const { row, at } = among(derived, located)

  switch (edit.how) {
    case "up": {
      const above = row[at - 1]
      if (above === undefined) {
        return Result.fail(
          refusal("Already at the top"),
        )
      }
      return Result.succeed({ op: "move", id: edit.id, before: above.node.id })
    }
    case "down": {
      const below = row[at + 1]
      if (below === undefined) {
        return Result.fail(
          refusal("Already at the bottom"),
        )
      }
      return Result.succeed({ op: "move", id: edit.id, after: below.node.id })
    }
    case "in": {
      const above = row[at - 1]
      if (above === undefined) {
        return Result.fail(
          refusal("There is no row above to indent under"),
        )
      }
      const parent = nodeNamed(derived, above.node.id)
      if (parent === undefined) {
        return Result.fail(
          refusal(
            "Can't indent: the row above mirrors a row that isn't loaded",
          ),
        )
      }
      return Result.succeed({ op: "move", id: edit.id, parent: parent.node.id })
    }
    case "out": {
      const parent = located.node.parent
      if (parent === undefined) {
        return Result.fail(
          refusal("Already at the top level"),
        )
      }
      const above = derived.byId.get(parent)
      return Result.succeed({
        op: "move",
        id: edit.id,
        parent: above?.node.parent ?? null,
        after: parent,
      })
    }
  }
}

const placeRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "place" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  const parent = edit.parent === null ? undefined : derived.byId.get(edit.parent)
  const home = parent?.file ?? edit.file ?? located.file
  const into = edit.parent === null && edit.file !== undefined ? { file: edit.file } : {}
  if (edit.after !== null) {
    return Result.succeed({
      op: "move",
      id: edit.id,
      parent: edit.parent,
      ...into,
      after: edit.after,
    })
  }
  const first = siblingsOf(derived, home, edit.parent ?? undefined)
    .find((sibling) => sibling.node.id !== edit.id)
  return Result.succeed({
    op: "move",
    id: edit.id,
    parent: edit.parent,
    ...into,
    ...(first === undefined ? {} : { before: first.node.id }),
  })
}

const markRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "mark" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  if (edit.mark !== null) {
    return Result.succeed({ op: edit.mark, id: edit.id })
  }
  const stored = derived.status.get(edit.id)
  if (stored === undefined) {
    return Result.fail(
      refusal(`\`${nameOf(located)}\` carries no mark, so there is none to take off`),
    )
  }
  return Result.succeed({ op: stored, id: edit.id, undo: true })
}

const NEXT: Record<Status, Status | null> = {
  todo: "doing",
  doing: null,
  done: "todo",
  cancelled: "todo",
}

const walkRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "walk" }>,
): Resolved => {
  const stored = derived.status.get(edit.id)
  return markRequest(derived, {
    verb: "mark",
    id: edit.id,
    mark: stored === undefined ? "todo" : NEXT[stored],
  })
}

const removeRequest = (
  derived: Derived,
  edit: Extract<Edit, { verb: "remove" }>,
): Resolved => {
  const located = derived.byId.get(edit.id)
  if (located === undefined) return Result.fail(notFound(derived, edit.id))
  const under = derived.children.get(edit.id) ?? []
  if (under.length > 0) {
    return Result.fail(
      refusal(
        `\`${nameOf(located)}\` has ${under.length} ${
          under.length === 1 ? "row" : "rows"
        } under it now — undo takes back the row it added, not what was put under it`,
      ),
    )
  }
  return Result.succeed({ op: "trash", id: edit.id })
}

const marking = (request: Request): request is Extract<Request, { op: Status }> =>
  MARKS.some((mark) => mark === request.op)

export const inverseOf = (
  at: Reading,
  edit: Edit,
  request: Request,
  applied: string,
): ReadonlyArray<Edit> => {
  switch (edit.verb) {
    case "add":
    case "capture":
    case "pin":
      return [{ verb: "remove", id: applied }]
    case "move":
    case "place":
    case "under":
      return placementOf(at.derived, edit.id)
    case "toggle":
    case "walk":
    case "mark":
      return markOf(
        at.derived,
        edit.id,
        marking(request) && settles(request.op) && request.undo !== true,
      )
    case "title":
    case "desc":
      return textOf(at.derived, edit)
    case "date":
      return dateOf(at.derived, edit.id)
    case "repeat":
      return repeatOf(at.derived, edit.id)
    case "prop":
      return propOf(at.derived, edit)
    case "split":
      return [{ verb: "merge", id: applied }]
    case "merge":
      return unmergeOf(at.derived, edit.id, edit.title)
    case "remove":
    case "trash":
      return unarchiveOf(at.derived, edit.id)
    case "see":
    case "after":
      return edgesOf(at.derived, edit)
    case "untrash":
      return [{ verb: "trash", id: edit.id }]
    case "duplicate":
      return [{ verb: "trash", id: applied }]
    case "mirror":
      return [{ verb: "unmirror", id: applied }]
    case "unmirror":
      return []
    case "emptyTrash":
      return []
    case "doc":
      return documentTextOf(at, edit)
    case "docNew":
    case "outlineNew":
      return []
    case "fileDelete":
      return []
  }
}

const edgesOf = (
  derived: Derived,
  edit: Extract<Edit, { verb: "see" | "after" }>,
): ReadonlyArray<Edit> => {
  const located = derived.byId.get(edit.id)
  if (located === undefined || isMirror(located.node)) return []
  const held = located.node[edit.verb] ?? []
  const added = (edit.add ?? []).filter((id) => !held.includes(id))
  const removed = (edit.remove ?? []).filter((id) => held.includes(id))
  if (added.length === 0 && removed.length === 0) return []
  return [{
    verb: edit.verb,
    id: edit.id,
    ...(removed.length === 0 ? {} : { add: removed }),
    ...(added.length === 0 ? {} : { remove: added }),
  }]
}

const documentTextOf = (
  at: Reading,
  edit: Extract<Edit, { verb: "doc" }>,
): ReadonlyArray<Edit> => {
  const document = markdownAt(at.set, edit.file)
  if (document === undefined) return []
  return [{ verb: "doc", file: edit.file, text: document.body, was: edit.text }]
}

const unarchiveOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  const parent = located.node.parent
  return [{
    verb: "untrash",
    id,
    ...(parent === undefined ? { file: located.file } : { parent }),
  }]
}

const unmergeOf = (derived: Derived, id: string, carried?: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  const joined = merging(derived, located as LocatedRegular, carried)
  if (Result.isFailure(joined)) return []
  const { into, adopted, title, desc } = joined.success
  return [
    ...unarchiveOf(derived, id),
    {
      verb: "place",
      id,
      parent: located.node.parent ?? null,
      after: into.id === located.node.parent ? null : into.id,
    },
    ...adopted.map((child, index): Edit => ({
      verb: "place",
      id: child.node.id,
      parent: id,
      after: index === 0 ? null : (adopted[index - 1] as Located).node.id,
    })),
    ...(title === into.title ? [] : textOf(derived, { verb: "title", id: into.id, title })),
    ...(desc === into.desc ? [] : textOf(derived, { verb: "desc", id: into.id, desc: desc ?? null })),
  ]
}

const placementOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined) return []
  const { row, at } = among(derived, located)
  const above = row[at - 1]
  return [{
    verb: "place",
    id,
    parent: located.node.parent ?? null,
    file: located.file,
    after: above?.node.id ?? null,
  }]
}

const textOf = (
  derived: Derived,
  edit: Extract<Edit, { verb: "title" | "desc" }>,
): ReadonlyArray<Edit> => {
  const located = derived.byId.get(edit.id)
  if (located === undefined || isMirror(located.node)) return []
  return edit.verb === "title"
    ? [{ verb: "title", id: edit.id, title: located.node.title, was: edit.title }]
    : [{ verb: "desc", id: edit.id, desc: located.node.desc ?? null, was: edit.desc }]
}

const dateOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  return [{ verb: "date", id, date: located.node.date ?? null }]
}

const repeatOf = (derived: Derived, id: string): ReadonlyArray<Edit> => {
  const located = derived.byId.get(id)
  if (located === undefined || isMirror(located.node)) return []
  return [{ verb: "repeat", id, repeat: located.node.repeat ?? null }]
}

const propOf = (
  derived: Derived,
  edit: Extract<Edit, { verb: "prop" }>,
): ReadonlyArray<Edit> => {
  const located = derived.byId.get(edit.id)
  if (located === undefined || isMirror(located.node)) return []
  const held = customOfNode(located.node)[edit.key]
  if (held !== undefined && typeof held !== "string") return []
  return [{
    verb: "prop",
    id: edit.id,
    key: edit.key,
    value: held ?? null,
    was: edit.value === null || edit.value === "" ? null : edit.value,
  }]
}

const markOf = (
  derived: Derived,
  id: string,
  settled: boolean,
): ReadonlyArray<Edit> => {
  const stored = derived.status.get(id) ?? null
  const back: Edit = { verb: "mark", id, mark: stored }
  return settled && stored !== null && !settles(stored)
    ? [{ verb: "mark", id, mark: null }, back]
    : [back]
}

const among = (
  derived: Derived,
  located: Located,
): { readonly row: ReadonlyArray<Located>; readonly at: number } => {
  const row = siblingsOf(derived, located.file, located.node.parent)
  return { row, at: row.findIndex((sibling) => sibling.node.id === located.node.id) }
}

const nameOf = (located: Located): string =>
  isMirror(located.node) ? located.node.id : located.node.title

const refusal = (reason: string): OpFailure => new UsageFailure({ reason })
