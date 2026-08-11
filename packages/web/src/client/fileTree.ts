/**
 * The served directory as a TREE rather than two flat lists.
 *
 * Outlines (`.jsonl`) and documents (`.md`) share one walk: a folder shows
 * everything it holds, the way a reader of the same directory sees it, and the
 * way the racket original's sidebar did. The alternative — two sections that
 * each re-spell every nested path as a string — is what this replaces: once a
 * corpus has depth (`Daily/2026-08.jsonl`, `brainstorming/*.md`), the path
 * string wraps and the folder is nowhere to click.
 *
 * Pure: paths in, rows out. Collapse, active marking and the link each file
 * is are the drawer's business, not this one's. Order matches `sortByPath`
 * (./paths.ts) segment by segment, so a directory's children land where
 * descending into it would put them.
 */

/** What a leaf of the tree is: the two kinds of file the sidebar draws. */
export type FileOf = "outline" | "document"

/** One row of the tree. A directory carries its own root-relative path so
 *  collapse state can key on it without re-walking parents; a file carries
 *  the full path the rest of the app already names pages by. */
export type FileRow =
  | {
      readonly kind: "dir"
      readonly name: string
      /** Root-relative path of this directory (`notes`, `Daily/2026`). */
      readonly path: string
      readonly children: ReadonlyArray<FileRow>
    }
  | {
      readonly kind: "file"
      readonly name: string
      /** Root-relative path the page routes already use. */
      readonly file: string
      readonly of: FileOf
    }

/** Mutable under construction; frozen into `FileRow` on the way out. */
interface Building {
  readonly dirs: Map<string, Building>
  readonly files: Map<string, { readonly file: string; readonly of: FileOf }>
}

const empty = (): Building => ({ dirs: new Map(), files: new Map() })

const put = (root: Building, file: string, of: FileOf): void => {
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

/** Children of one directory, sorted the way path order would list them:
 *  names only, because every child is already one segment deep from here. */
const freeze = (node: Building, prefix: string): ReadonlyArray<FileRow> => {
  const rows: FileRow[] = []
  for (const name of [...node.dirs.keys()].sort()) {
    const path = prefix === "" ? name : `${prefix}/${name}`
    rows.push({
      kind: "dir",
      name,
      path,
      children: freeze(node.dirs.get(name) as Building, path),
    })
  }
  for (const name of [...node.files.keys()].sort()) {
    const entry = node.files.get(name) as { readonly file: string; readonly of: FileOf }
    rows.push({ kind: "file", name, file: entry.file, of: entry.of })
  }
  // One list, dirs and files mixed by name: `a/` before `b.jsonl` before `c/`,
  // which is what a reader of the directory sees and what segment-by-segment
  // path order already produces for the flat lists this replaces.
  rows.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  return rows
}

/** Build the tree from the two sets the wire hands the client. Order of the
 *  inputs does not matter; a path that appears in both is a document last, so
 *  a file that is somehow both is not two rows (the set cannot produce that —
 *  an outline and a document have different extensions — but the tree is
 *  still one row per path). */
export const fileTree = (
  outlines: Iterable<string>,
  documents: Iterable<string>,
): ReadonlyArray<FileRow> => {
  const root = empty()
  for (const file of outlines) put(root, file, "outline")
  for (const file of documents) put(root, file, "document")
  return freeze(root, "")
}
