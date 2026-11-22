/**
 * WHERE A TEXT BECOMES A READING — this package's one door onto
 * `@olai/prose`'s `read`, and so onto the Markdown parser.
 *
 * Everything else here asks what a text SAYS and never reads one: the face,
 * the references fold, the tag index, the dead-link reading, search. They ask
 * the reading decode kept beside the text (`./kept.ts`), which imports no
 * parser. This module is the other half — the few places that turn bytes into
 * a reading, which is to say a DECODE: an outline file's records, a
 * document's prose, and a record `@olai/ops` is planning and has not written
 * yet.
 *
 * IT IS NOT RE-EXPORTED FROM `./index.ts`, and that is the whole reason it is
 * its own file. Every importer of `@olai/format` — the browser's first paint
 * among them — would otherwise carry ~150 KB of parser for a parse it never
 * makes, and a test with no DOM would fail on loading it, since the parser's
 * browser build of the entity decoder reaches for `document` as it loads.
 * `@olai/format/read` is the door, named by the handful of callers that
 * decode: the store's codec, `@olai/ops`, and the fixtures a test builds a
 * directory out of. `@olai/bundle`'s `fence.test.ts` holds the client's
 * first-load chunk to it.
 */
import { proseIn } from "@olai/prose/frontmatter.ts"
import { read, type Read } from "@olai/prose/read.ts"
import type { Refusal } from "@olai/prose/parse.ts"
import type { Slug } from "@olai/prose/slug.ts"

import {
  bodiedFace,
  type Document,
  type Markdown,
  type Outline,
  outlineDocument,
  type Unkept,
} from "./document.ts"
import { bodyRead, carryRecordReads, keepRecordRead, keptRecordRead, type RecordRead } from "./kept.ts"
import type { Claims } from "./kinds.ts"
import { isMirror, type Located, type RegularNode } from "./node.ts"

/**
 * One record read — its title, and its note when it has one — and kept on it.
 *
 * Idempotent: a record already read is handed back what it was read as, so a
 * caller holding a record from a decode pays nothing. A fixture that builds a
 * record by hand calls this before asking any rule what it says.
 */
export const readRecord = (node: RegularNode): RecordRead =>
  keptRecordRead(node)
  ?? keepRecordRead(node, { title: read(node.title), desc: node.desc === undefined ? null : read(node.desc) })

/**
 * A DECODED OUTLINE: its records read, then folded into the face the file
 * amounts to (`./document.ts`'s `outlineDocument`).
 *
 * `previous` is the document this file decoded to at the revision before, when
 * the caller holds one: a record whose title and note did not change keeps the
 * reading it had (`./kept.ts`'s `carryRecordReads`), so a write reads the
 * texts it changed and no others. The carry is here, before the reading, for
 * exactly that reason — a carried record is one this never reads.
 */
export const readOutline = (
  claims: Claims,
  file: string,
  nodes: ReadonlyArray<Located>,
  previous?: Document,
): Outline => {
  if (previous !== undefined && previous.holds === "nodes") carryRecordReads(nodes, previous.nodes)
  for (const located of nodes) if (!isMirror(located.node)) readRecord(located.node)
  return outlineDocument(claims, file, nodes)
}

/**
 * The document a BODIED file amounts to, its prose read once — `.md` text
 * through the parser with its frontmatter taken off, and the reading kept on
 * the face for every later reader of the body.
 *
 * The arms, and why the prose one is the only one that reads, are
 * `./document.ts`'s {@link bodiedFace}: this is that function told how a text
 * is read.
 */
export const bodiedDocument = (claims: Claims, file: string, text: string | null): Markdown | Unkept =>
  bodiedFace(claims, file, text, (body) => read(proseIn(body)))

/**
 * The slugs of a whole body, in document order and never repeated — the list a
 * face carries, and the ids the page draws: both are the reading's, numbered
 * once there. A heading that slugs to nothing is not an element this document
 * has.
 *
 * WHY THE RULE IS NOT IN THE RENDERER. Two things have to agree about a slug
 * and they run in different processes. The FACE says which headings a document
 * has ({@link ./document.ts}), so a backlink onto `README.md#install` can be
 * checked and a page can say what it points at; the BROWSER puts the id on the
 * `<h2>` it draws, so the address lands somewhere. Both ask one reading of the
 * body, which makes each heading's slug once with `@olai/prose`'s `slugOf` —
 * so a slug is never spelled twice, and every heading the page draws is one
 * the face lists.
 */
export const slugsIn = (body: string): ReadonlyArray<Slug> =>
  read(proseIn(body)).headings.flatMap((heading) => heading.slug === null ? [] : [heading.slug])

/** A text of a decoded document the parser threw on, and which text it was. */
export interface Unread {
  /** `prose`, or the record's id and the field: `kitchen title`. */
  readonly where: string
  readonly refusal: Refusal
}

/**
 * EVERY TEXT OF A DECODED DOCUMENT THE PARSER COULD NOT READ. The parser
 * throwing is a bug — the bounds keep every shape it is slow on to
 * milliseconds (`@olai/prose`'s `parse.ts`) — and a bug the page alone says
 * is one nobody who runs the server hears of, so the codec hands each of these
 * to the server's log (`@olai/ops`'s `codecFor`).
 *
 * Read off the readings decode kept: a walk of the records and no parse.
 */
export const unreadIn = (document: Document): ReadonlyArray<Unread> => {
  const found: Array<Unread> = []
  if (document.holds === "nodes") {
    for (const located of document.nodes) {
      if (isMirror(located.node)) continue
      const said = keptRecordRead(located.node)
      if (said?.title.refused !== undefined) found.push({ where: `${located.node.id} title`, refusal: said.title.refused })
      if (said?.desc?.refused !== undefined) found.push({ where: `${located.node.id} note`, refusal: said.desc.refused })
    }
  } else if (document.kept && !("opaque" in document && document.opaque === true)) {
    const refusal = bodyRead(document).refused
    if (refusal !== undefined) found.push({ where: "prose", refusal })
  }
  return found
}
