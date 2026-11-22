/**
 * WHAT DECODE READ, KEPT — each text of the directory read once, through
 * `@olai/prose`'s `read`, and the reading held beside the text it is of.
 *
 * A RECORD'S reading is its title's and its note's; a DOCUMENT'S is its prose
 * (the body with its frontmatter taken off). Everything that asks what a text
 * says — the face, the references fold, the tag index, the dead-link reading,
 * search — asks this, so the directory's prose is parsed once per text rather
 * than once per reader. The tree is not kept; the reading is.
 *
 * NO PARSER IS IMPORTED HERE, and that is the whole point of the file. This is
 * the SLOT — who may read it and who may fill it — and every rule module that
 * asks what a text says reaches the parser through nothing but this. The
 * reading is MADE in `./read.ts`, which is this package's one door onto
 * `@olai/prose`'s `read` and is not re-exported from `./index.ts`: so a
 * browser, or a test with no DOM, imports the rules without importing
 * ~150 KB of Markdown parser (`@olai/prose`'s `parse.ts` says what that
 * costs, and `@olai/bundle`'s `fence.test.ts` holds the first-load chunk to
 * it).
 *
 * HELD ON THE OBJECT IT IS OF, under a symbol: the record's node, the
 * document. Not a field of either — both are values that travel (a record to
 * the browser on an outline's entry, a document's face on its head), and a
 * reading is the server's to keep, not the wire's: a symbol-keyed slot is not
 * enumerable, so no encoding and no spread carries it. The reading lives
 * exactly as long as its text.
 *
 * A TEXT WITH NO READING IS A DEFECT, not a parse to make here: {@link
 * recordRead} and {@link bodyRead} THROW rather than read, because the caller
 * that holds such a record is the one that skipped the decode, and a quiet
 * parse on demand is what put the parser in every rule module in the first
 * place. Everything that mints a record or a document goes through
 * `./read.ts` — the store's decode of an outline, the document face, `@olai/ops`
 * reading the record it is planning — and a fixture that builds one by hand
 * reads it the same way.
 */
import type { Read } from "@olai/prose/read.ts"

import { isMirror, type Located, type RegularNode } from "./node.ts"

/** A record's reading: its title's, and its note's when it has one. */
export interface RecordRead {
  readonly title: Read
  readonly desc: Read | null
}

const KEPT: unique symbol = /* @__PURE__ */ Symbol("olai.read")

const keep = <A>(holder: object, made: A): A => {
  Object.defineProperty(holder, KEPT, { value: made, enumerable: false, writable: false, configurable: false })
  return made
}

/** The reading kept on an object, if one was. Only {@link keep} writes the
 *  slot, and each caller reads back the type it keeps there. */
const keptOn = <A>(holder: object): A | undefined => {
  const held: unknown = Reflect.get(holder, KEPT)
  return held === undefined ? undefined : held as A
}

/** What a record's title and note say, or `undefined` when nothing read it —
 *  the one asker is `./read.ts`, which reads it then. Every other reader asks
 *  {@link recordRead}, which does not offer the second answer. */
export const keptRecordRead = (node: RegularNode): RecordRead | undefined => keptOn<RecordRead>(node)

/** Keep what a record's title and note say. `./read.ts`'s call, and nobody
 *  else's: it is the one module that may turn a text into a reading. */
export const keepRecordRead = (node: RegularNode, said: RecordRead): RecordRead => keep(node, said)

/** What a record's title and note say, as it was read when its file was
 *  decoded. A record nothing read is a defect in the caller — see the header. */
export const recordRead = (node: RegularNode): RecordRead => {
  const said = keptOn<RecordRead>(node)
  if (said === undefined) throw new Error(unread(`record \`${node.id}\``, node.title))
  return said
}

/**
 * A FILE DECODED AGAIN keeps what it already read: each record of `nodes`
 * whose title and note are the same strings as the record with its id in
 * `previous` — the file's records at the revision before — takes that
 * record's reading, the same object, and is not read again. One title changed
 * in a file of two thousand records reads one text. A record with no match,
 * or a changed one, is read by `./read.ts` right after this.
 */
export const carryRecordReads = (
  nodes: ReadonlyArray<Located>,
  previous: ReadonlyArray<Located>,
): void => {
  if (previous.length === 0) return
  const before = new Map<string, RegularNode>()
  for (const located of previous) if (!isMirror(located.node)) before.set(located.node.id, located.node)
  for (const located of nodes) {
    const node = located.node
    if (isMirror(node) || keptOn<RecordRead>(node) !== undefined) continue
    const was = before.get(node.id)
    if (was === undefined || was.title !== node.title || was.desc !== node.desc) continue
    const said = keptOn<RecordRead>(was)
    if (said !== undefined) keep(node, said)
  }
}

/** What a document's prose says, as it was read when the document was built.
 *  A document nothing read is a defect in the caller — see the header. */
export const bodyRead = (document: { readonly body: string }): Read => {
  const said = keptOn<Read>(document)
  if (said === undefined) throw new Error(unread("document", document.body))
  return said
}

/** Keep a document's reading on it — `./read.ts`'s one call, made once the
 *  document it read the prose of exists. */
export const keepBodyRead = <D extends object>(document: D, said: Read): D => {
  keep(document, said)
  return document
}

/** What a reader is told when it holds a text nothing read. It names the text
 *  — the first line of it, which is what a person recognises a record by — and
 *  the door that would have read it, because the fix is always at the place
 *  the value was MADE and never here. */
const unread = (what: string, text: string): string => {
  const first = text.split("\n", 1)[0] ?? ""
  const shown = first.length > 60 ? `${first.slice(0, 60)}…` : first
  return `no reading was kept for this ${what} (\`${shown}\`), so what it says cannot be asked here. ` +
    "Whatever made it must read it: `@olai/format/read`'s `readOutline`, `bodiedDocument` or `readRecord`."
}
