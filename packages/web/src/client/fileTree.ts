/**
 * The served directory as a TREE rather than flat lists.
 *
 * Every kind of served file shares one walk: a folder shows everything it
 * holds, the way a reader of the same directory sees it, and the way the racket
 * original's sidebar did. The alternative — a section per kind, each
 * re-spelling every nested path as a string — is what this replaces: once a
 * corpus has depth (`Daily/2026-08.olai`, `brainstorming/*.md`), the path
 * string wraps and the folder is nowhere to click.
 *
 * Pure: paths in, rows out. Collapse, active marking and the link each file
 * is are the drawer's business, not this one's. Order is by name at each
 * level, which is what segment-by-segment path order (`./paths.ts`) produces
 * for the flat lists this replaces.
 *
 * Every row carries a `key` (`dir:<path>` / `file:<path>`) so the drawer can
 * hold each place across frames the way the outline tree does (`Tree.tsx`):
 * this walk mints fresh objects every time, and `<For>` would compare them by
 * reference and rebuild the whole sidebar on one membership change.
 */

import { type FileKind, fileKind, stemOf } from "@olai/format"

/** One row of the tree. A directory carries its own root-relative path so
 *  collapse state can key on it without re-walking parents; a file carries
 *  the full path the rest of the app already names pages by. `key` is the
 *  stable identity of the PLACE — unique across dirs and files. */
export type FileRow =
  | {
      readonly kind: "dir"
      /** Stable place id for `<Key by="key">` — `dir:<path>`. */
      readonly key: string
      readonly name: string
      /** Root-relative path of this directory (`notes`, `Daily/2026`). */
      readonly path: string
      readonly children: ReadonlyArray<FileRow>
    }
  | {
      readonly kind: "file"
      /** Stable place id for `<Key by="key">` — `file:<path>`. */
      readonly key: string
      /** The stem the row draws — the suffix that claimed the file is the
       *  glyph's to say (`stemOf`), so `AGENTS.md` is `AGENTS`. */
      readonly name: string
      /** Root-relative path the page routes already use. */
      readonly file: string
      /** Which kind of served file it is — the format's own answer, read off
       *  the name (`@olai/format`'s registry) rather than carried in from
       *  whichever list this path arrived on. */
      readonly of: FileKind
    }

/** Mutable under construction; frozen into `FileRow` on the way out. */
interface Building {
  readonly dirs: Map<string, Building>
  readonly files: Map<string, { readonly file: string; readonly of: FileKind }>
}

const empty = (): Building => ({ dirs: new Map(), files: new Map() })

const put = (root: Building, file: string, of: FileKind): void => {
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

/** Children of one directory, sorted by name — dirs and files together, so
 *  `a/` sits where `a` sorts among the files beside it. */
const freeze = (node: Building, prefix: string): ReadonlyArray<FileRow> => {
  const rows: FileRow[] = []
  for (const [name, child] of node.dirs) {
    const path = prefix === "" ? name : `${prefix}/${name}`
    rows.push({
      kind: "dir",
      key: `dir:${path}`,
      name,
      path,
      children: freeze(child, path),
    })
  }
  for (const [, entry] of node.files) {
    rows.push({
      kind: "file",
      key: `file:${entry.file}`,
      name: stemOf(entry.file),
      file: entry.file,
      of: entry.of,
    })
  }
  // Sorted by the on-disk basename, not the stem: `a.md` and `a.olai` are two
  // files and the glyph is what tells them apart, so the order still has to
  // see the suffix. Folders sort as their own name, among those basenames.
  rows.sort((left, right) => {
    const a = sortKey(left)
    const b = sortKey(right)
    return a < b ? -1 : a > b ? 1 : 0
  })
  return rows
}

const sortKey = (row: FileRow): string =>
  row.kind === "dir" ? row.name : row.file.slice(row.file.lastIndexOf("/") + 1)

/**
 * Build the tree from the paths the wire hands the client.
 *
 * ONE list, whichever collection each path arrived on, and WHAT KIND each one
 * is comes off its name. The alternative — a list per kind, tagged by the
 * caller — is what this replaces, and the reason is not tidiness: the caller's
 * tag would be a second answer to a question `@olai/format` already settles,
 * free to disagree with the glyph, the route and the page that read the
 * registry directly. It also means a new kind of served file is not a third
 * argument here.
 *
 * Order of the input does not matter, and a path repeated is still one row: the
 * files of a level are a map keyed by name. A path no kind claims is dropped —
 * the wire cannot produce one, since every collection it comes from is built
 * from the same registry, and a tree row with no kind would have no glyph and
 * nowhere to link.
 */
export const fileTree = (files: Iterable<string>): ReadonlyArray<FileRow> => {
  const root = empty()
  for (const file of files) {
    const of = fileKind(file)
    if (of !== null) put(root, file, of)
  }
  return freeze(root, "")
}

/** Every directory the tree draws, by root-relative path.
 *
 *  Off the ROWS rather than off the paths they were built from, and that is the
 *  point: a folder exists exactly while `fileTree` above makes one, so the
 *  memory of which folders a reader left open (`fold/folders.ts`) is pruned
 *  against the same walk that decides what is on screen. Two derivations of
 *  "which folders are there" could disagree, and the way that shows is a
 *  folder quietly forgetting it was open while it is still being drawn. */
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

/** Directory paths that contain `file`, outermost first. Empty for a root
 *  file — there is no folder chain to open for `house.olai`. The sidebar
 *  uses this to keep the open file's ancestors unfolded so a collapsed-by-
 *  default tree never hides the selection. */
export const ancestorDirs = (file: string): ReadonlyArray<string> => {
  const segments = file.split("/")
  if (segments.length <= 1) return []
  const out: string[] = []
  for (let i = 1; i < segments.length; i++) {
    out.push(segments.slice(0, i).join("/"))
  }
  return out
}
