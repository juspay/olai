/**
 * The loaded set: what one served directory amounts to once it is read and
 * found valid.
 *
 * ONE COLLECTION. A served directory is a list of DOCUMENTS — outlines,
 * markdown, and the four kinds olai only shows — and the nodes are the
 * substructure of one of those arms ({@link ./document.ts}). It was two lists until PR 2 of the
 * first-class-documents arc: this module built the union of what each file
 * decoded to and then tore it apart into a `nodes` collection beside a
 * `documents` one, and every feature written since imported the `nodes` half.
 * That is the habit the arc is about, and the enforcement is structural rather
 * than reviewed-for: there is no node-only list here to import, so treating
 * both kinds evenly is what the type hands you and treating them unevenly is
 * work.
 *
 * WHAT IT COSTS, said plainly, because the old shape was flat on purpose: a
 * walk that wants every record of the directory now walks the outlines and
 * their nodes rather than one array. That is the same records in the same
 * order, one level of nesting deeper, and it is paid once per validation
 * ({@link ./validate.ts} flattens for the derivation, which is the one reader
 * that needs a list). What it BUYS is that no other reader can ask for that
 * list without saying which documents it is skipping.
 *
 * These are Schemas rather than plain interfaces because the records inside
 * them are: a set is assembled out of the same values the validator approves,
 * and the client renders those verbatim and derives everything else with the
 * same functions the validator used ({@link ./derive.ts}).
 */

import { Result, Schema } from "effect"

import {
  bodiedDocument,
  Document,
  isBodied,
  isOutline,
  type Markdown,
  type Outline,
  outlineDocument,
  type Unkept,
} from "./document.ts"
import { OutlineError } from "./errors.ts"
import { bodyKind } from "./kinds.ts"
import { Located } from "./node.ts"
import { byPath } from "./paths.ts"

/**
 * A file of the set that could not be read, and why.
 *
 * It rides in the SET rather than only in the error report because the two
 * answer different questions. The report is "what must be fixed"; this is
 * "what does `pantry.olai` show" — and the answer, for a file whose lines do
 * not parse, is its own errors, in place, while every other outline stays live
 * (the hybrid error scope, resolved 2026-08-09). A view that had only the
 * report would have to guess which outline a `file:line` belonged to and hope
 * the two lists agreed.
 */
export const BrokenFile = Schema.Struct({
  file: Schema.String,
  errors: Schema.Array(OutlineError),
})
export type BrokenFile = typeof BrokenFile.Type

export const OutlineSet = Schema.Struct({
  /**
   * EVERY served file, as the document it decoded to, in path order — put
   * there by {@link assemble} rather than inherited from whoever handed the
   * files over, so the order is the same whichever caller assembled the set.
   *
   * Including the files that did not parse: one keeps its place here with
   * nothing in it (no nodes, or an empty body) and its errors go to
   * {@link OutlineSet.broken}. That is what makes a directory with one bad file
   * a directory the sidebar still lists in full.
   */
  documents: Schema.Array(Document),
  /** The files above that could not be read. Their content is absent from the
   *  document that holds their place, which is exactly what makes the rest of
   *  the set renderable. */
  broken: Schema.Array(BrokenFile),
})
export type OutlineSet = typeof OutlineSet.Type

/**
 * What one decoded file contributes to the set's records — nothing for a
 * document that holds no records, and nothing for a file that did not parse.
 *
 * {@link assemble}'s per-file answer, asked one file at a time, and here rather
 * than at the asker for that reason: which files hold records is this module's
 * sentence, and a second reading of it somewhere above would be a caller
 * deciding for itself that a `.md` holds none. What asks is the store's codec,
 * building the delta a patched validation takes ({@link ./patch.ts}) out of the
 * files a probe re-decoded — the same values `assemble` reads, one path at a
 * time instead of all of them.
 *
 * `undefined` answers the same as a failure: a path the map does not hold
 * contributes no records, which is what the delta means by a file with none.
 */
export const nodesIn = <E>(
  decoded: Result.Result<Document, E> | undefined,
): ReadonlyArray<Located> =>
  decoded === undefined || Result.isFailure(decoded) || !isOutline(decoded.success)
    ? NO_NODES
    : decoded.success.nodes

/** A file with no records in it: ONE list, shared, since most of the calls
 *  above are about a file that has none. */
const NO_NODES: ReadonlyArray<Located> = []

/**
 * Decoded files into the set the validator judges.
 *
 * The assembly is a statement about the format — which files are served, what
 * order they are in, what a file that would not decode still leaves sayable —
 * so it lives beside the rules rather than in whatever read the directory. A
 * caller supplies bytes and gets back the one shape everything above it
 * renders.
 *
 * IT IS NOW A COLLECT rather than a sort, and that is the sum paying for
 * itself. This function used to answer four questions per file — which list it
 * belongs to, what it holds, where its records go, what an unreadable one
 * leaves behind — out of two different places, because the value's shape and
 * the file's name each knew half of it. A decode hands over a {@link Document}
 * now: the arm IS the answer, and the face is already built (at the decode,
 * once per file per change, which is where a walk of somebody's prose belongs
 * — `./document.ts` says why not here).
 *
 * A file that FAILED to decode is still a file that was found. It keeps its
 * place in `documents` as an EMPTY one of its kind — an outline with no
 * records, a document with no text — and its errors go to `broken`. That is
 * the whole of what one unreadable file costs the set, and it is what lets the
 * sidebar go on listing a file whose lines somebody is in the middle of fixing.
 *
 * IN PATH ORDER ({@link ./paths.ts}'s `byPath`), and it sorts for itself rather
 * than inheriting that from whoever built the map. {@link OutlineSet.documents}
 * promises it and every reader spends it: `list_outlines` answers in it, a
 * search tie breaks on it, the sidebar draws it. Until #208 the promise held
 * only because the one caller in the tree walks a directory in sorted order —
 * so a caller that built its map any other way got a set that broke the
 * promise silently, and the write gate was exactly such a caller: it assembles
 * the last probe's files with the written ones swapped in, which puts a path
 * that did not exist before at the END of the map and, for a file sorting
 * first, at the wrong end of the published list. Sorting here makes the
 * documented order a fact about `assemble` rather than a fact about its
 * callers, and makes the set a function of the map's ENTRIES rather than of the
 * order they were put in.
 *
 * WHICH order that is stopped being a plain `.sort()` in slice 4 of
 * `model-indices`: the promise was always the WALK's, and a bare code-point
 * sort keeps it for every pair of paths except the one where a file and a
 * directory share a name — which is exactly the pair a patched view and a
 * client's own sort came to disagree about ({@link ./paths.ts}).
 */
export const assemble = (
  files: ReadonlyMap<string, Result.Result<Document, ReadonlyArray<OutlineError>>>,
): OutlineSet => {
  const documents: Array<Document> = []
  const broken: Array<BrokenFile> = []

  // The paths are put in order FIRST, so the list below comes out in it and
  // does not have to be sorted afterwards.
  for (const path of [...files.keys()].sort(byPath)) {
    const decoded = files.get(path)!
    if (Result.isFailure(decoded)) {
      broken.push({ file: path, errors: decoded.failure })
      documents.push(emptyDocument(path))
    } else documents.push(decoded.success)
  }
  return { documents, broken }
}

/**
 * WHY the set holds no content for one file — its errors — or `undefined` for a
 * file it read.
 *
 * The one question two ops ask before they trust the set about a path, and it
 * was a `.find` at each of them. It reads as a lookup either way; what it was
 * missing is a NAME, because the fact it establishes is subtle and both
 * callers turn on it: a file in `broken` is one the set holds a PLACE for and
 * no content — an outline whose lines did not parse contributes no records, a
 * document whose read failed contributes an empty body ({@link assemble}) —
 * and neither of those absences means the file is empty.
 *
 * The two callers then say different things about it, correctly, and that is
 * exactly why the SENTENCE is not here: `write_document` refuses because
 * re-emitting the file from the set would erase what is really in it, and
 * `read_document` refuses because handing back the empty text would be a body
 * nobody read. One fact, two verbs, two consequences.
 */
export const brokenIn = (
  set: OutlineSet,
  file: string,
): ReadonlyArray<OutlineError> | undefined => brokenBy(set).get(file)

/** The same fact for a WHOLE ANSWER rather than one path — every listing walks
 *  the files and asks it per row, and a `.find` per row is files × broken on
 *  the first call an agent makes. Both listings built this map inline and
 *  identically before it had a name. */
export const brokenBy = (
  set: OutlineSet,
): ReadonlyMap<string, ReadonlyArray<OutlineError>> =>
  new Map(set.broken.map((entry) => [entry.file, entry.errors]))

/**
 * ONE DOCUMENT, by the path a caller named — or `undefined` for a path this
 * directory does not serve.
 *
 * The point lookup every "is that file there" was, and there were a dozen of
 * them, each `.includes` over whichever of the two old lists the caller
 * happened to be thinking about — which is precisely how a feature came to
 * work for one kind and not the other. There is one list now, so there is one
 * question, and the ANSWER carries the kind: a caller that only draws outlines
 * has to say so, in a line a reader can see.
 *
 * FOUND RATHER THAN WALKED TO, since `perf-published-maps`: {@link assemble}
 * puts the list in path order and sorts for itself rather than trusting its
 * caller (see its header), so a path names a POSITION and this is a binary
 * search over {@link ./paths.ts}'s own comparator rather than a walk of the
 * directory. That matters where it is asked once per file the disk moved
 * — `@olai/server`'s `published.ts` asks it for every path a probe re-decoded,
 * and a walk there made publishing a `git pull` quadratic in the vault — and it
 * costs the three callers that ask it once nothing at all. It is the SAME
 * comparator the order was made with, which is what makes the search exact:
 * `byPath` sorts the separator first, so a plain `<` would look in the wrong
 * half for the one pair where a file and a directory share a name.
 */
export const documentAt = (set: OutlineSet, path: string): Document | undefined => {
  const { documents } = set
  let low = 0
  let high = documents.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    const at = documents[middle] as Document
    const side = byPath(at.path, path)
    if (side === 0) return at
    if (side < 0) low = middle + 1
    else high = middle - 1
  }
  return undefined
}

/**
 * The OUTLINES of the set, in path order.
 *
 * A narrowing of the one collection rather than a second collection, and the
 * difference is the whole of what this arc changed: nobody is HANDED this, it
 * is asked for by name, and asking says out loud which documents the caller is
 * leaving out. What reads it is what is genuinely about records — the tree the
 * sidebar draws, the files an op may write, the derivation's input.
 */
export const outlinesIn = (set: OutlineSet): ReadonlyArray<Outline> =>
  set.documents.filter(isOutline)

/** The same narrowing to their PATHS, for the callers that want the names —
 *  a listing, a refusal that says which files there are, a membership test. */
export const outlinePaths = (set: OutlineSet): ReadonlyArray<string> =>
  outlinesIn(set).map((outline) => outline.path)

/**
 * ONE MARKDOWN DOCUMENT, by the path a caller named — or `undefined` for a
 * path this directory does not serve AS ONE, whether because nothing is there
 * or because what is there is an outline or a saved page.
 *
 * {@link documentAt} narrowed by the question three callers actually ask —
 * `read_document`, `write_document`'s refusal and the editor's undo — and it
 * is here rather than at each of them because they were spelling it as a
 * `.filter` of the whole collection followed by a `.find`, which allocates a
 * copy of every served document to look one up. One walk, no copy, and one
 * place that says which arm counts.
 */
export const markdownAt = (set: OutlineSet, path: string): Markdown | undefined => {
  const document = documentAt(set, path)
  return document?.kind === "document" ? document : undefined
}

/**
 * The MARKDOWN documents of the set, in path order — a `.md` and never a
 * `.html`.
 *
 * The other narrowing anybody asks for, and it is a different question from
 * "which files have a body": a `.html`, a `.csv`, a picture and a `.pdf` are
 * the files olai only SHOWS — nothing validates one, no op writes one, and the
 * set keeps the path without the bytes — so the validator deciding what a `doc`
 * may point at, the planner refusing a `write_document` and both document
 * reads all mean this list. Four callers asked it with four `.filter`s before
 * it had a name.
 */
export const markdownIn = (set: OutlineSet): ReadonlyArray<Markdown> =>
  set.documents.filter((document): document is Markdown => document.kind === "document")

/**
 * The BODIED documents of the set, in path order — every file the set keeps a
 * body SLOT for, whether or not it keeps the bytes.
 *
 * The third narrowing, and the one that is about STORAGE rather than about
 * meaning: a `.md`, a `.html`, a `.csv`, a picture and a `.pdf` are the files
 * a reader opens as a rendered page, they are published as one collection read
 * a key at a time (`@olai/server`), and the browser knows them as a key set.
 * {@link markdownIn} above is the narrower question — what a `doc` may point
 * at, what an op may write — and the two are not the same list, which is
 * exactly why both have a name.
 */
export const bodiedIn = (set: OutlineSet): ReadonlyArray<Markdown | Unkept> =>
  set.documents.filter(isBodied)

/**
 * A set taken back APART into the map {@link assemble} puts together — the
 * inverse, declared beside what it inverts.
 *
 * It is here rather than at its caller because it is a statement about
 * `assemble`'s own invariants, and they are easy to get subtly wrong from
 * outside: a file that did not decode keeps its PLACE in `documents` and is
 * listed in `broken`, so the broken paths have to be read FIRST and the walk
 * below has to skip whatever they already answered. Getting that backwards
 * turns an unreadable outline into an empty one, silently. `./set.test.ts`
 * holds the pair to a round trip rather than to a memory of one.
 *
 * WHAT IT CANNOT RECOVER, and does not pretend to: the errors of a file whose
 * place is held by an empty document, which is every broken file's — they are
 * in `broken`, and this hands them back as the failure that put them there.
 * Every readable document round-trips exactly, as the value it decoded to.
 *
 * Its one caller is `@olai/ops`' batch fold, which plans op two against the set
 * op one would leave — so it needs the map back to swap one file's records into
 * it. The alternative was a hand-written inverse a package away from the thing
 * it inverts.
 */
export const apart = (
  set: OutlineSet,
): Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>> => {
  const files = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>()
  for (const broken of set.broken) files.set(broken.file, Result.fail(broken.errors))
  for (const document of set.documents) {
    if (files.has(document.path)) continue
    files.set(document.path, Result.succeed(document))
  }
  return files
}

/**
 * The empty document that holds an unreadable file's PLACE — an outline with
 * no records, or a body with no text.
 *
 * Which of the two is the registry's answer ({@link ./kinds.ts}), asked of the
 * NAME, because a file that would not decode has no value to ask. That is the
 * one thing {@link assemble} still reads off a path rather than off an arm,
 * and it is the one thing it must: the whole point of the entry is that there
 * was nothing to decode.
 */
const emptyDocument = (file: string): Document =>
  bodyKind(file) === null ? outlineDocument(file, []) : bodiedDocument(file, "")
