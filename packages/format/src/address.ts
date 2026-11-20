import { Schema } from "effect"

import { type Claims, fileKind, holdsBody } from "./kinds.ts"

export const DocumentPath = Schema.String.check(
  Schema.makeFilter((path: string) => relativePath(path), {
    expected: "a non-empty relative path with no parent segments",
  }),
).pipe(Schema.brand("DocumentPath"))
export type DocumentPath = typeof DocumentPath.Type

export const NodeId = Schema.String.pipe(Schema.brand("NodeId"))
export type NodeId = typeof NodeId.Type

export const Slug = Schema.String.pipe(Schema.brand("Slug"))
export type Slug = typeof Slug.Type

export const Tag = Schema.String.pipe(Schema.brand("Tag"))
export type Tag = typeof Tag.Type

export const AtDocument = Schema.Struct({
  kind: Schema.Literal("document"),
  path: DocumentPath,
})
export type AtDocument = typeof AtDocument.Type

export const AtOutline = AtDocument
export type AtOutline = typeof AtOutline.Type

export const AtNode = Schema.Struct({
  kind: Schema.Literal("node"),
  id: NodeId,
})
export type AtNode = typeof AtNode.Type

export const AtRow = Schema.Struct({
  kind: Schema.Literal("row"),
  path: DocumentPath,
  id: NodeId,
})
export type AtRow = typeof AtRow.Type

export const AtHeading = Schema.Struct({
  kind: Schema.Literal("heading"),
  path: DocumentPath,
  slug: Slug,
})
export type AtHeading = typeof AtHeading.Type

export const Address = Schema.Union([AtDocument, AtNode, AtRow, AtHeading])
export type Address = typeof Address.Type

const nodeId = (id: string): NodeId => id as NodeId
const slug = (text: string): Slug => text as Slug

export const addressOf = (
  claims: Claims,
  document: string | null,
  element: string | null,
): Address | null => {
  const named = element === null || element === "" ? null : element
  if (document === null || document === "") {
    return named === null ? null : { kind: "node", id: nodeId(named) }
  }
  const claimed = claimedDocument(claims, document)
  if (claimed === null) return null
  const { kind, path } = claimed
  if (named === null) return { kind: "document", path }
  return holdsBody(claims, kind)
    ? { kind: "heading", path, slug: slug(named) }
    : { kind: "row", path, id: nodeId(named) }
}

export const writtenAddress = (
  address: Address,
): { readonly path: string; readonly element: string | undefined } => {
  if (address.kind === "node") {
    return { path: "", element: encodeURIComponent(address.id) }
  }
  const path = spellPath(address.path)
  if (address.kind === "document") return { path, element: undefined }
  return {
    path,
    element: encodeURIComponent(address.kind === "row" ? address.id : address.slug),
  }
}

export const printAddress = (address: Address): string => {
  const { path, element } = writtenAddress(address)
  return element === undefined ? path : `${path}#${element}`
}

export const parseAddress = (claims: Claims, text: string): Address | null => {
  const cut = text.indexOf("#")
  const document = cut === -1 ? text : text.slice(0, cut)
  const element = cut === -1 ? "" : spelled(text.slice(cut + 1))
  const path = readPath(document)
  return path === null ? null : addressOf(claims, path, element)
}

export const splitAddress = (address: string): Split => {
  const hash = address.indexOf("#")
  const whole = hash === -1 ? address : address.slice(0, hash)
  const fragment = hash === -1 ? undefined : address.slice(hash + 1)
  const cut = whole.indexOf("?")
  return {
    pathname: cut === -1 ? whole : whole.slice(0, cut),
    search: cut === -1 ? "" : whole.slice(cut + 1),
    fragment,
  }
}

export interface Split {
  readonly pathname: string
  readonly search: string
  readonly fragment: string | undefined
}

export const addressAt = (claims: Claims, at: string): Address | null => {
  if (!at.startsWith("/")) return null
  const { pathname, fragment } = splitAddress(at.slice(1))
  return parseAddress(claims, (pathname === ZOOM ? "" : pathname) + (fragment === undefined ? "" : `#${fragment}`))
}

const ZOOM = "zoom/"

export const addressWritten = (title: string): string =>
  linkedTitle(title)?.at ?? title.trim()

export const titleAddress = (title: string): string | undefined => {
  const text = title.trim()
  if (!text.startsWith("/") && !text.startsWith("[")) return undefined
  const address = addressWritten(text)
  return /\s/.test(address) ? undefined : address
}

export const linkedTitle = (
  title: string,
): { readonly label: string; readonly at: string } | undefined => {
  const linked = LINKED.exec(title.trim())
  return linked === null ? undefined : { label: linked[1] ?? "", at: linked[2] ?? "" }
}

const LINKED = /^\[([^\]]*)\]\(([^()\s]+)\)$/

export const pinTitle = (at: string, name: string): string | undefined => {
  const label = name.trim()
  const address = at.trim()
  if (label === "") return address
  if (UNWRITABLE.test(label)) return undefined
  return `[${label}](${escaped(address)})`
}

export const PIN_NAME_UNWRITABLE =
  "a pin's name is written as a link's label, so it cannot hold a “]” or a line break"

const UNWRITABLE = /[\]\r\n]/

const escaped = (address: string): string =>
  address.replace(
    /[()\s]/g,
    (one) => `%${one.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  )

const relativePath = (path: string): boolean =>
  !path.includes("\\") && path.split("/").every(segment => segment !== "" && segment !== "." && segment !== "..")

interface ClaimedDocument {
  readonly kind: string
  readonly path: DocumentPath
}

const claimedDocument = (claims: Claims, path: string): ClaimedDocument | null => {
  if (!relativePath(path)) return null
  const kind = fileKind(claims, path)
  return kind === null ? null : { kind, path: path as DocumentPath }
}

export const claimedOf = (claims: Claims, path: string): DocumentPath | null =>
  claimedDocument(claims, path)?.path ?? null

export const outlineAt = (claims: Claims, at: AtDocument): AtOutline | null => {
  const claimed = claimedDocument(claims, at.path)
  return claimed !== null && claims.byKind.get(claimed.kind)?.holds === "nodes" ? at : null
}

export const spellPath = (path: string): string =>
  ENCODE_URI_COMPONENT_UNRESERVED_WITH_SLASH.test(path)
    ? path
    : path.split("/").map(encodeURIComponent).join("/")

const classed = (characters: ReadonlyArray<string>): string =>
  characters.map((one) => `\\u${one.charCodeAt(0).toString(16).padStart(4, "0")}`).join("")

const ENCODE_URI_COMPONENT_UNRESERVED_WITH_SLASH = new RegExp(
  `^[${
    classed([
      ...Array.from({ length: 128 }, (_, code) => String.fromCharCode(code))
        .filter((character) => encodeURIComponent(character) === character),
      "/",
    ])
  }]*$`,
)

export const readPath = (text: string): string | null => {
  if (!text.includes("%")) return text
  const segments = text.split("/").map(spelled)
  return segments.includes(null) ? null : segments.join("/")
}

/** `decodeURIComponent` THROWS on a malformed escape (`%`, `%ZZ`, `%2`). */
const spelled = (text: string): string | null => {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}
