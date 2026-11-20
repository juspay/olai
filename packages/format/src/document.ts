import { Schema } from "effect"

import { Address, addressOf, DocumentPath, printAddress, Slug, Tag } from "./address.ts"
import { Custom } from "./custom.ts"
import { tagsIn, writtenTags } from "./derive.ts"
import { frontmatterIn, proseIn } from "./frontmatter.ts"
import { bytesOf, firstLine, linksIn, recordLinks } from "./documents.ts"
import { fileKind, type Claims, stemOf } from "./kinds.ts"
import { isMirror, Located } from "./node.ts"
import { slugsIn } from "./slug.ts"

export const Face = Schema.Struct({
  path: DocumentPath,
  title: Schema.String,
  links: Schema.Array(Address),
  tags: Schema.Array(Tag),
  props: Custom,
})
export type Face = typeof Face.Type

export interface FaceHead {
  readonly path: DocumentPath
  readonly title: string
}

export const faceOf = ({ path, title, links, tags, props }: Document): Face => ({
  path,
  title,
  links,
  tags,
  props,
})

export const Outline = Schema.Struct({
  kind: Schema.String,
  holds: Schema.Literal("nodes"),
  ...Face.fields,
  nodes: Schema.Array(Located),
})
export type Outline = typeof Outline.Type

export const Markdown = Schema.Struct({
  kind: Schema.String,
  holds: Schema.Literal("text"),
  kept: Schema.Literal(true),
  opaque: Schema.optionalKey(Schema.Literal(true)),
  ...Face.fields,
  body: Schema.String,
  bytes: Schema.Int,
  headings: Schema.Array(Slug),
})
export type Markdown = typeof Markdown.Type

export const Unkept = Schema.Struct({
  kind: Schema.String,
  holds: Schema.Literals(["text", "bytes"]),
  kept: Schema.Literal(false),
  ...Face.fields,
})
export type Unkept = typeof Unkept.Type

export const Document = Schema.Union([Outline, Markdown, Unkept])
export type Document = typeof Document.Type

export const outlineDocument = (
  claims: Claims,
  file: string,
  nodes: ReadonlyArray<Located>,
): Outline => {
  const links: Array<Address> = []
  const tags: Array<Tag> = []
  const seen = new Set<string>()
  const written = new Set<string>()
  const add = (address: Address | null): void => {
    if (address === null) return
    const key = printAddress(address)
    if (seen.has(key)) return
    seen.add(key)
    links.push(address)
  }
  for (const located of nodes) {
    for (const address of recordLinks(claims, located)) add(address)
    if (isMirror(located.node)) continue
    for (const tag of writtenTags(located.node)) {
      if (written.has(tag)) continue
      written.add(tag)
      tags.push(tag)
    }
  }
  return {
    kind: fileKind(claims, file) ?? (() => { throw new Error(`unclaimed outline: ${file}`) })(),
    holds: "nodes",
    path: pathOf(file),
    title: stemOf(claims, file),
    links,
    tags,
    props: {},
    nodes,
  }
}

export const bodiedDocument = (claims: Claims, file: string, text: string | null): Markdown | Unkept => {
  const path = pathOf(file)
  const kind = fileKind(claims, file)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  if (claim === undefined || claim.holds === "nodes") throw new Error(`not a claimed body: ${file}`)
  if (!claim.kept) {
    return { kind: claim.kind, holds: claim.holds, kept: false, path, title: stemOf(claims, file), links: [], tags: [], props: {} }
  }
  if (claim.holds !== "text") throw new Error(`cannot retain binary content: ${file}`)
  const body = text ?? ""
  if (claim.opaque === true) {
    return {
      kind: claim.kind,
      holds: "text",
      kept: true,
      opaque: true,
      path,
      title: stemOf(claims, file),
      links: [],
      tags: [],
      props: {},
      body,
      bytes: bytesOf(body),
      headings: [],
    }
  }
  const prose = proseIn(body)
  return {
    kind: claim.kind,
    holds: "text",
    kept: true,
    path,
    title: firstLine(body) || stemOf(claims, file),
    links: linksIn(claims, file, prose),
    tags: tagsIn(prose),
    props: frontmatterIn(body),
    body,
    bytes: bytesOf(body),
    headings: slugsIn(body),
  }
}

export const bodyOf = (document: Document): string | null =>
  isKeptText(document) ? document.body : null

export const isOutline = (document: Document): document is Outline =>
  document.holds === "nodes"

export const isBodied = (document: Document): document is Markdown | Unkept =>
  document.holds !== "nodes"

export const isKeptText = (document: Document): document is Markdown =>
  document.holds === "text" && document.kept

export const isMarkdown = (document: Document): document is Markdown =>
  document.holds === "text" && document.kept && document.opaque !== true

export const isOpaque = (document: Document): boolean =>
  document.holds === "text" && document.kept && document.opaque === true

const pathOf = (file: string): DocumentPath => file as DocumentPath

export const sameFace: (a: Face, b: Face) => boolean = Schema.toEquivalence(Face)
