import { DeadLink, deadLinksOf } from "./dead-links.ts"

import type { Claims } from "./kinds.ts"
import { Schema } from "effect"

import { Address, addressOf } from "./address.ts"
import { Agenda, type AgendaDay, agendaOf } from "./agenda.ts"
import { Reference, referencesOf } from "./backlinks.ts"
import { Custom, customOf } from "./custom.ts"
import { dailyNotesOn, DayGroup, datedOn } from "./dates.ts"
import { type Derived, type InTheWay, nodeNamed, nodesOf, Row, rowsOf } from "./derive.ts"
import type { Face } from "./document.ts"
import { bodyKind, FileKind, fileKind } from "./kinds.ts"
import { consult, Door, Licence, type Vault } from "./meaning.ts"
import { ID_SHAPE, isPutAway, isTrashed, type LocatedRegular, propertiesIn } from "./node.ts"
import { markdownPaths } from "./rules.ts"
import { BrokenFile } from "./set.ts"
import { pinTargetIn } from "./shelf.ts"
import { declarationsIn, type KindVocabulary, NO_KINDS } from "./typing.ts"
import type { Reading } from "./validate.ts"
import { Zoomed, zoom } from "./zoom.ts"

export const PageRequest = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("at"), address: Schema.NullOr(Address) }),
  Schema.Struct({ kind: Schema.Literal("day"), date: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("agenda"), today: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("trash") }),
])
export type PageRequest = typeof PageRequest.Type

export const TrashGroup = Schema.Struct({
  file: Schema.String,
  rows: Schema.Array(Row),
})
export type TrashGroup = typeof TrashGroup.Type

export const Named = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  file: Schema.String,
})
export type Named = typeof Named.Type

export const Shown = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("outline"),
    file: Schema.String,
    rows: Schema.Array(Row),
  }),
  Schema.Struct({
    kind: Schema.Literal("node"),
    zoomed: Zoomed,
    backlinks: Schema.Array(Reference),
  }),
  Schema.Struct({
    kind: Schema.Literal("document"),
    file: Schema.String,
    referrers: Schema.Array(Reference),
    props: Custom,
  }),
  Schema.Struct({
    kind: Schema.Literal("day"),
    date: Schema.String,
    groups: Schema.Array(DayGroup),
    notes: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    kind: Schema.Literal("agenda"),
    date: Schema.String,
    agenda: Agenda,
  }),
  Schema.Struct({
    kind: Schema.Literal("trash"),
    files: Schema.Array(Schema.String),
    groups: Schema.Array(TrashGroup),
    records: Schema.Int,
  }),
  Schema.Struct({ kind: Schema.Literal("broken"), file: BrokenFile }),
  Schema.Struct({
    kind: Schema.Literal("nothing"),
    sought: FileKind,
    requested: Schema.NullOr(Schema.String),
  }),
])
export type Shown = typeof Shown.Type

export const PageReading = Schema.Struct({
  shows: Shown,
  deadLinks: Schema.optional(Schema.Record(Schema.String, Schema.Array(DeadLink))),
  names: Schema.Array(Named),
  doors: Schema.Array(Door),
  licences: Schema.Array(Licence),
})
export type PageReading = typeof PageReading.Type

export type FiledPageRequest = Extract<PageRequest, { readonly kind: "at" | "trash" }>
export const FiledPageRequest = PageRequest.check(
  Schema.makeFilter(
    (request: PageRequest) => request.kind === "at" || request.kind === "trash",
    { expected: "a file, node, or trash page request" },
  ),
) as typeof PageRequest & { readonly Type: FiledPageRequest }

type FiledShown = Exclude<PageReading["shows"], { readonly kind: "day" | "agenda" }>
export type FiledPageReading = Omit<PageReading, "shows"> & { readonly shows: FiledShown }
export const FiledPageReading = PageReading.check(
  Schema.makeFilter(
    (reading: PageReading) => reading.shows.kind !== "day" && reading.shows.kind !== "agenda",
    { expected: "a file, node, or trash page reading" },
  ),
) as typeof PageReading & { readonly Type: FiledPageReading }

export type DocumentPageRequest = {
  readonly kind: "at"
  readonly address: Extract<NonNullable<Extract<PageRequest, { readonly kind: "at" }>["address"]>, { readonly kind: "document" }>
}
export const DocumentPageRequest = FiledPageRequest.check(Schema.makeFilter(request => {
  if (request.kind !== "at" || request.address?.kind !== "document") return false
  return true
})) as typeof FiledPageRequest & { readonly Type: DocumentPageRequest }

export const samePageReading: (a: PageReading, b: PageReading) => boolean = Schema
  .toEquivalence(PageReading)

export const samePageRequest: (a: PageRequest, b: PageRequest) => boolean = Schema
  .toEquivalence(PageRequest)

export const pageOf = (
  at: Reading & { readonly outlineRow?: string },
  request: PageRequest,
  kinds: KindVocabulary = NO_KINDS,
): PageReading => {
  const served = new Set(at.set.documents.map(face => face.path))
  const shows = shownOf(at, request)
  const { doors, licences } = answersFor(at, shows, kinds, served)
  const deadLinks: Record<string, ReadonlyArray<DeadLink>> = {}
  const warningRows = [...narrowableIn(shows)]
  if (shows.kind === "node" && shows.zoomed.kind === "node") warningRows.push(shows.zoomed.shows)
  for (const located of warningRows) {
    const links = deadLinksOf(located, served)
    if (links.length > 0) deadLinks[located.node.id] = links
  }
  return {
    shows,
    ...(Object.keys(deadLinks).length === 0 ? {} : { deadLinks }),
    names: namesFor(
      at.derived,
      shows,
      request.kind === "at" ? request.address : null,
      doors,
    ),
    doors,
    licences,
  }
}

const answersFor = (
  at: Reading,
  shows: Shown,
  kinds: KindVocabulary,
  served: ReadonlySet<string>,
): { readonly doors: ReadonlyArray<Door>; readonly licences: ReadonlyArray<Licence> } => {
  const documents = markdownPaths(at.set)
  const vault: Vault = {
    declarations: declarationsIn(at.derived, propertiesIn(at.claims, served), kinds),
    kinds,
    declares: (id) => nodeNamed(at.derived, id) !== undefined,
    serves: (file) => served.has(file),
    documents: (file) => documents.has(file),
  }
  const doors: Array<Door> = []
  const licences: Array<Licence> = []
  const asked = new Set<string>()
  const ask = (from: string, custom: Custom): void => {
    for (const [key, held] of Object.entries(custom)) {
      for (const value of typeof held === "string" ? [held] : held) {
        const triple = `${from}\u0000${key}\u0000${value}`
        if (asked.has(triple)) continue
        asked.add(triple)
        const { opens, word } = consult(vault, from, key, value)
        if (opens !== null) doors.push({ from, prop: key, value, opens })
        if (word !== null) licences.push({ from, prop: key, value, word })
      }
    }
  }
  for (const node of drawnIn(shows)) ask(node.file, customOf(node.node))
  if (shows.kind === "document") ask(shows.file, shows.props)
  return { doors, licences }
}

const outlinesAmong = (claims: Claims, faces: ReadonlyArray<Face>): ReadonlyArray<string> =>
  faces.filter((face) => claims.byKind.get(fileKind(claims, face.path) ?? "")?.holds === "nodes").map((face) => face.path)

export const shownOf = (at: Reading & { readonly outlineRow?: string }, request: PageRequest): Shown => {
  const { derived } = at
  const faces = at.set.documents
  if (request.kind === "agenda") {
    return { kind: "agenda", date: request.today, agenda: agendaOf(derived, request.today) }
  }
  if (request.kind === "trash") return trashOf(derived, faces)
  if (request.kind === "day") {
    return {
      kind: "day",
      date: request.date,
      groups: datedOn(derived, request.date),
      notes: dailyNotesOn(at.claims, faces.map((face) => face.path), request.date),
    }
  }

  const address = request.address
  if (address?.kind === "node") {
    const zoomed = zoom(derived, address.id)
    return {
      kind: "node",
      zoomed,
      backlinks: zoomed.kind === "node"
        ? referencesOf(at, addressOf(at.claims, null, zoomed.shows.node.id)!)
        : [],
    }
  }

  if (address !== null && (address.kind === "heading" || bodyKind(at.claims, address.path) !== null)) {
    const file = address.path
    const face = faces.find((one) => one.path === file)
    if (face === undefined) {
      return { kind: "nothing", sought: fileKind(at.claims, file) ?? "", requested: file }
    }
    return {
      kind: "document",
      file,
      referrers: referencesOf(at, { kind: "document", path: file }),
      props: face.props,
    }
  }

  const outlines = outlinesAmong(derived.claims, faces)
  const named = address === null ? null : address.path
  const file = named === null
    ? outlines.find((candidate) => !isPutAway(at.claims, candidate) && !candidate.startsWith("_olai/"))
      ?? outlines.find((candidate) => !isPutAway(at.claims, candidate))
    : outlines.includes(named)
    ? named
    : undefined
  if (file === undefined) {
    return {
      kind: "nothing",
      sought: named === null ? at.outlineRow ?? "" : fileKind(at.claims, named) ?? "",
      requested: named,
    }
  }
  if (isTrashed(at.claims, file)) return trashOf(derived, faces)
  const unreadable = at.set.broken.find((one) => one.file === file)
  return unreadable === undefined
    ? { kind: "outline", file, rows: rowsOf(derived, file) }
    : { kind: "broken", file: unreadable }
}

const trashOf = (derived: Derived, faces: ReadonlyArray<Face>): Shown => {
  const files = outlinesAmong(derived.claims, faces).filter(file => isTrashed(derived.claims, file))
  return {
    kind: "trash",
    files,
    groups: files
      .map((file) => ({ file, rows: rowsOf(derived, file) }))
      .filter((group) => group.rows.length > 0),
    records: files.reduce((count, file) => count + nodesOf(derived, file).length, 0),
  }
}

const namesFor = (
  derived: Derived,
  shows: Shown,
  address: Address | null,
  doors: ReadonlyArray<Door>,
): ReadonlyArray<Named> => {
  const wanted = new Set<string>()
  if (address?.kind === "node") wanted.add(address.id)
  for (const door of doors) if (door.opens.kind === "node") wanted.add(door.opens.id)
  for (const node of drawnIn(shows)) {
    for (const id of node.node.see ?? []) wanted.add(id)
    for (const id of node.node.after ?? []) wanted.add(id)
    const written = pinTargetIn(derived.claims, node.node.title)
    if (written !== undefined) wanted.add(written)
    for (const value of Object.values(customOf(node.node))) {
      for (const one of typeof value === "string" ? [value] : value) {
        if (ID_SHAPE.test(one)) wanted.add(one)
      }
    }
  }
  const named: Array<Named> = []
  for (const id of wanted) {
    const found = nodeNamed(derived, id)
    if (found !== undefined) named.push({ id, title: found.node.title, file: found.file })
  }
  return named
}

export function* narrowableIn(shows: Shown): Generator<LocatedRegular> {
  switch (shows.kind) {
    case "outline":
      yield* inRows(shows.rows)
      return
    case "node":
      if (shows.zoomed.kind === "node") yield* inRows(shows.zoomed.children)
      return
    case "day":
      yield* inGroups(shows.groups)
      return
    case "agenda":
      yield* inDays(shows.agenda.overdue)
      yield* inGroups(shows.agenda.today)
      yield* inDays(shows.agenda.upcoming)
      return
    case "trash":
      for (const group of shows.groups) yield* inRows(group.rows)
      return
    case "document":
    case "broken":
    case "nothing":
      return
  }
}

function* drawnIn(shows: Shown): Generator<LocatedRegular> {
  yield* narrowableIn(shows)
  yield* referencedIn(shows)
}

function* referencedIn(shows: Shown): Generator<LocatedRegular> {
  switch (shows.kind) {
    case "outline":
      yield* waitedOnIn(shows.rows)
      return
    case "node":
      if (shows.zoomed.kind === "node") {
        yield shows.zoomed.shows
        yield* shows.zoomed.trail
        yield* inWay(shows.zoomed.blocked)
        yield* waitedOnIn(shows.zoomed.children)
      }
      for (const backlink of shows.backlinks) {
        if ("file" in backlink.source) yield backlink.source
      }
      return
    case "document":
      for (const referrer of shows.referrers) {
        if ("file" in referrer.source) yield referrer.source
      }
      return
    case "day":
      yield* situatedIn(shows.groups)
      return
    case "agenda":
      for (const day of shows.agenda.overdue) yield* situatedIn(day.groups)
      yield* situatedIn(shows.agenda.today)
      for (const day of shows.agenda.upcoming) yield* situatedIn(day.groups)
      return
    case "trash":
      for (const group of shows.groups) yield* waitedOnIn(group.rows)
      return
    case "broken":
    case "nothing":
      return
  }
}

function* inRows(rows: ReadonlyArray<Row>): Generator<LocatedRegular> {
  for (const row of rows) {
    if (row.kind === "node" || row.kind === "mirror") yield row.shows
    yield* inRows(row.children)
  }
}

function* waitedOnIn(rows: ReadonlyArray<Row>): Generator<LocatedRegular> {
  for (const row of rows) {
    yield* inWay(row.blocked)
    yield* waitedOnIn(row.children)
  }
}

function* inGroups(groups: ReadonlyArray<DayGroup>): Generator<LocatedRegular> {
  for (const group of groups) for (const entry of group.nodes) yield entry.shows
}

function* inDays(days: ReadonlyArray<AgendaDay>): Generator<LocatedRegular> {
  for (const day of days) yield* inGroups(day.groups)
}

function* situatedIn(groups: ReadonlyArray<DayGroup>): Generator<LocatedRegular> {
  for (const group of groups) {
    for (const entry of group.nodes) {
      yield* entry.trail
      yield* inWay(entry.blocked)
    }
  }
}

function* inWay(blocked: ReadonlyArray<InTheWay>): Generator<LocatedRegular> {
  for (const one of blocked) yield one.at
}
