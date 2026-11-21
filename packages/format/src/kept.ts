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
 * HELD ON THE OBJECT IT IS OF, under a symbol: the record's node, the
 * document. Not a field of either — both are values that travel (a record to
 * the browser on an outline's entry, a document's face on its head), and a
 * reading is the server's to keep, not the wire's: a symbol-keyed slot is not
 * enumerable, so no encoding and no spread carries it, and an edited record —
 * a new node — is a new text with no reading until it is asked. Decode fills
 * the slot ({@link ./document.ts}); a record built anywhere else is read the
 * first time it is asked. The reading lives exactly as long as its text.
 */
import { proseIn } from "@olai/prose/frontmatter.ts"
import { read, type Read } from "@olai/prose/read.ts"

import type { RegularNode } from "./node.ts"

/** A record's reading: its title's, and its note's when it has one. */
export interface RecordRead {
  readonly title: Read
  readonly desc: Read | null
}

const KEPT: unique symbol = Symbol("olai.read")

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

/** What a record's title and note say. */
export const recordRead = (node: RegularNode): RecordRead =>
  keptOn<RecordRead>(node) ?? keep(node, {
    title: read(node.title),
    desc: node.desc === undefined ? null : read(node.desc),
  })

/** What a document's prose says: the reading decode kept on it, or — for a
 *  document built anywhere else — its body read now, frontmatter off. */
export const bodyRead = (document: { readonly body: string }): Read =>
  keptOn<Read>(document) ?? keep(document, read(proseIn(document.body)))

/** Keep a document's reading on it — decode's one call, made once the
 *  document it read the prose of exists. */
export const keepBodyRead = <D extends object>(document: D, said: Read): D => {
  keep(document, said)
  return document
}
