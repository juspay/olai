import type { Claim, Claims } from "@olai/format"
import { fileKind, nameOf } from "@olai/format"

export type FileRow =
  | {
      readonly kind: "dir"
      readonly name: string
      readonly path: string
      readonly children: ReadonlyArray<FileRow>
    }
  | {
      readonly kind: "file"
      readonly name: string
      readonly file: string
      readonly of: Claim["kind"]
    }

export const rowKey = (row: FileRow): string =>
  row.kind === "dir" ? `dir:${row.path}` : `file:${row.file}`

interface Building {
  readonly dirs: Map<string, Building>
  readonly files: Map<string, { readonly file: string; readonly of: Claim["kind"] }>
}

const empty = (): Building => ({ dirs: new Map(), files: new Map() })

const put = (root: Building, file: string, of: Claim["kind"]): void => {
  const segments = file.split("/")
  let at = root
  for (let i = 0; i < segments.length - 1; i++) {
    const name = segments[i] as string
    let next = at.dirs.get(name)
    if (next === undefined) {
      next = empty()
      at.dirs.set(name, next)
    }
    at = next
  }
  const name = segments[segments.length - 1] as string
  at.files.set(name, { file, of })
}

const freeze = (claims: Claims, node: Building, prefix: string): ReadonlyArray<FileRow> => {
  const rows: FileRow[] = []
  for (const [name, child] of node.dirs) {
    const path = prefix === "" ? name : `${prefix}/${name}`
    rows.push({
      kind: "dir",
      name,
      path,
      children: freeze(claims, child, path),
    })
  }
  for (const [, entry] of node.files) {
    rows.push({
      kind: "file",
      name: nameOf(claims, entry.file),
      file: entry.file,
      of: entry.of,
    })
  }
  rows.sort((left, right) => {
    if (left.name !== right.name) return left.name < right.name ? -1 : 1
    const a = rowKey(left), b = rowKey(right)
    return a < b ? -1 : a > b ? 1 : 0
  })
  return rows
}

export const fileTree = (claims: Claims, files: Iterable<string>, holds: "nodes" | "reference"): ReadonlyArray<FileRow> => {
  const root = empty()
  for (const file of files) {
    const of = fileKind(claims, file)
    if (of === null) continue
    const isOutline = claims.byKind.get(of)?.holds === "nodes"
    const keep = holds === "nodes" ? isOutline : !isOutline
    if (keep) put(root, file, of)
  }
  return freeze(claims, root, "")
}

export const dirsIn = (rows: ReadonlyArray<FileRow>): ReadonlySet<string> => {
  const out = new Set<string>()
  const walk = (level: ReadonlyArray<FileRow>): void => {
    for (const row of level) {
      if (row.kind !== "dir") continue
      out.add(row.path)
      walk(row.children)
    }
  }
  walk(rows)
  return out
}

export const ancestorDirs = (file: string): ReadonlyArray<string> => {
  const segments = file.split("/")
  if (segments.length <= 1) return []
  const out: string[] = []
  for (let i = 1; i < segments.length; i++) {
    out.push(segments.slice(0, i).join("/"))
  }
  return out
}
