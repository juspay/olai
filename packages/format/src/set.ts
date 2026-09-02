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
  isMarkdown,
  isOutline,
  type Markdown,
  type Outline,
  outlineDocument,
  type Unkept,
} from "./document.ts"
import { BrokenFile, type OutlineError } from "./errors.ts"
import { bodyKind } from "./kinds.ts"
import { Located } from "./node.ts"
import { byPath } from "./paths.ts"
import { admits, darkened, type Verdict, verdictOf } from "./verdict.ts"

/**
 * A file of the set that is BROKEN, and why — {@link ./errors.ts}'s shape,
 * re-exported here because this is the collection that carries it.
 *
 * It rides in the SET rather than only in the error report because the two
 * answer different questions. The report is "what must be fixed"; this is
 * "what does `pantry.org` show" — and the answer is its own errors, in place,
 * while every other outline stays live. A view that had only the report would
 * have to guess which outline a `file:line` belonged to and hope the two lists
 * agreed.
 *
 * IT IS EVERY KIND OF BROKEN NOW, which is the whole of the per-file ruling
 * (2026-08-29). It used to mean "would not parse" — the hybrid error scope of
 * 2026-08-09, where one file's unreadable LINES cost the reader that file and
 * nothing else, while a file that read perfectly and said something the set
 * could not hold took the whole vault off the screen instead. Both are one
 * thing here: a file the set holds a PLACE for and no content, listed in the
 * sidebar, drawing its own errors on its own page, with every healthy neighbour
 * live and writable beside it. {@link ./verdict.ts}'s `blamed` is what decides
 * which files a finding puts in here.
 */
export { BrokenFile }

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
  files: ReadonlyMap<string, Result.Result<Document, Verdict>>,
): OutlineSet => {
  const documents: Array<Document> = []
  const broken: Array<BrokenFile> = []

  // The paths are put in order FIRST, so the list below comes out in it and
  // does not have to be sorted afterwards.
  for (const path of [...files.keys()].sort(byPath)) {
    const decoded = files.get(path)!
    if (Result.isFailure(decoded)) {
      // The FINDINGS, unwrapped: a {@link ./verdict.ts} is what either half of
      // the codec answers when it says no, and a file that would not decode is
      // one file's worth of it — no set, so nothing to admit and nothing to
      // summarise. What a broken file's own page draws is its rows.
      broken.push({ file: path, errors: decoded.failure.findings })
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
 *  identically before it had a name.
 *
 *  HELD WITH THE SET ({@link heldFor}), which is what makes {@link brokenIn}
 *  above a lookup rather than a map built to answer one key: a single write asks
 *  that question at half a dozen gates (`@olai/ops`' `writable`), and a fold
 *  click asks it once per file it names — each of which was a fresh map
 *  (roadmap `perf-homes-files`, `perf-batch-assemble`). */
export const brokenBy = (
  set: OutlineSet,
): ReadonlyMap<string, ReadonlyArray<OutlineError>> => {
  const held = heldFor(set)
  return held.broken ??= new Map(set.broken.map((entry) => [entry.file, entry.errors]))
}

/**
 * WHAT, IN THIS SET, STOPS A WRITE TO THESE FILES — or `null` when nothing
 * does.
 *
 * The write gate's question, and it is per file. A served directory with a
 * broken outline in it is a directory that goes on ACCEPTING WRITES to every
 * healthy file (the per-file ruling, 2026-08-29): the set is published, the
 * broken file draws its own errors, and a write three directories away is not
 * what is wrong with anything. So the gate asks about the files THIS write puts
 * down and about nothing else, and the answer is the rows of the first of them
 * the set holds no content for — first rather than all, because a refusal is a
 * sentence somebody reads and the second blocker is one fix away from being the
 * first.
 *
 * IT IS ASKED OF THE SET AND NOT OF A REFUSAL, which is where this differs from
 * {@link ./verdict.ts}'s `admits` and is the whole of what the ruling moved. A
 * validation no longer refuses a directory over one file — it publishes the
 * directory with that file withheld ({@link withheld}) — so "is anything wrong
 * with these files" is a question about the value the validator ANSWERED with,
 * not about a value it declined to answer at all. `@olai/store`'s `Codec`
 * carries it as `stopping`, over either arm.
 *
 * THE WRITE THAT MENDS is admitted by the same line, and nothing here has to
 * know it is one: a commit is judged on the set it WOULD make, so a write that
 * fixes `lanes.org` wholly leaves a set with nothing to say about `lanes.org`
 * and lands, and one that half-fixes it is stopped by what is left. There is no
 * repair case and no exception for it — there is one rule, asked of the tree
 * the write would leave behind.
 *
 * WHICH FILES THE WRITE IS ANSWERABLE FOR is the whole of what `standing` adds,
 * and it is a longer ASK rather than a second question. "The files this write
 * puts down" is not "the files this write breaks": moving a `ref` variant out
 * of the root its declaration names strands every value that says its id, in a
 * file the write never opened. So the ask is `paths` PLUS whatever this write
 * darkened ({@link ./verdict.ts}'s `darkened`) — the write's own files first,
 * in the order it put them down, so the blocker a multi-file write is named is
 * unchanged. #439 held this line at the store over a candidate the codec
 * refused; per-file publishing means there is no refusal there to read, so it
 * is held here, where both sets are.
 *
 * A FILE THAT WAS ALREADY DARK IS IN NEITHER HALF of that ask, which is the
 * per-file ruling still standing: it is off every page and refusing its own
 * writes already, and a write three directories away is not what is wrong with
 * it.
 *
 * THIS IS WHERE THE PROMISE LIVES, and #439's planner fence over declarations
 * is now the SENTENCE rather than the guarantee. That fence enumerates six
 * verbs a declaration can arrive through and refuses each while an existing
 * governed value does not fit; the incident it was written for reaches here as
 * a set where the value's file was lit and would be dark, so this rule turns it
 * back with no enumeration to keep in step (`./verdict.test.ts` pins that). The
 * fence is worth keeping for what it SAYS — file, node and value, as `usage`,
 * before any bytes are staged — and worth not relying on, because a list of
 * doors is a list somebody adds to.
 *
 * `standing` IS REQUIRED, and there is deliberately no arity that asks the
 * first half alone. This is the WRITE GATE's verb — one production caller,
 * `@olai/ops`' codec — and a set always has a predecessor by the time a commit
 * is judged against it (`@olai/store`'s `commit` proves it non-null before the
 * codec is asked). A caller who wants "is anything wrong with these files in
 * this set" is asking {@link ./verdict.ts}'s `admits`, which is the question
 * under this one and is exported for it.
 */
export const stopping = (
  set: OutlineSet,
  paths: ReadonlyArray<string>,
  standing: OutlineSet,
): Verdict | null => {
  // ONE QUESTION, ONE ANSWER SHAPE ({@link ./verdict.ts}'s `admits`): which of
  // these files something is wrong with, and its rows. This is that answer
  // spelled as the store's `E` — a verdict, because that is what the seam
  // carries — and the blocker's identity is not thrown away by the spelling:
  // every row in it names the file, which is how the sentence downstream
  // recovers it.
  const admission = admits(set.broken, [...paths, ...darkened(standing.broken, set.broken)])
  return admission._tag === "admitted" ? null : verdictOf(admission.rows)
}

/**
 * THE SET WITH THESE FILES' CONTENT WITHDRAWN — each one keeping its place and
 * carrying its errors, exactly as a file that would not parse always has.
 *
 * This is the carry half of the per-file ruling, and it is the half a tier
 * table alone could never have been ({@link ./verdict.ts} said so while the
 * ruling was still owed: "a class moved to `carried` must also be CARRIED
 * somewhere a reader can see it"). {@link assemble} already does this for a
 * file the DECODER refused; this does it for a file the whole-set rules found
 * something about, off the same `broken` list, so there is one meaning of
 * broken in the system and one place a reader looks for it.
 *
 * THE CONTENT GOES, and that is deliberate rather than incidental: the broken
 * file's page shows its errors and NOT a stale tree (the ruling's second half),
 * and a mirror or a `see` from a healthy file into a withheld one resolves to
 * the honest dangling face the derivation already has a word for
 * ({@link ./derive.ts}'s `follow`) rather than to a record the validator has
 * just said the set cannot hold. A duplicate id is the case that makes this
 * unarguable: while it stands, `byId` keeps one of the two claims, and drawing
 * anybody's `see` at it is drawing a coin toss.
 *
 * IT IS NOT A NEW JUDGEMENT. The rules run over the WHOLE decoded set, always;
 * this is applied to what gets PUBLISHED. So withholding a file can never
 * invent a finding against a healthy neighbour — the edges into it dangle in
 * the published view and were resolved in the judged one — and the next
 * validation starts from the full set again, which is what makes the answer
 * stable rather than a cascade that eats the directory one file per revision.
 *
 * THE SET ITSELF COMES BACK when there is nothing to withhold that `assemble`
 * has not already withheld, identity and all: a healthy directory pays one
 * comparison of two empty lists, and a directory whose only trouble is a file
 * that would not parse is the value it always was.
 */
export const withheld = (
  set: OutlineSet,
  broken: ReadonlyArray<BrokenFile>,
): OutlineSet => {
  if (sameBroken(set.broken, broken)) return set
  // The files `assemble` already emptied keep the very documents it put there:
  // this is the same withdrawal said twice, and minting a second empty outline
  // for a path that already holds one would move a value nothing changed.
  const held = new Set(set.broken.map((entry) => entry.file))
  const withdrawn = new Set(broken.map((entry) => entry.file))
  return {
    documents: set.documents.map((document) =>
      withdrawn.has(document.path) && !held.has(document.path)
        ? emptyDocument(document.path)
        : document
    ),
    broken,
  }
}

/** Whether these are the files the set already holds no content for, and for
 *  the same reasons — rows compared by IDENTITY, since both lists are cut from
 *  one validation's findings and a row that is a different object is a row
 *  something else made. */
const sameBroken = (
  held: ReadonlyArray<BrokenFile>,
  next: ReadonlyArray<BrokenFile>,
): boolean =>
  held.length === next.length &&
  held.every((entry, at) => {
    const other = next[at] as BrokenFile
    return entry.file === other.file && entry.errors.length === other.errors.length &&
      entry.errors.every((row, index) => row === other.errors[index])
  })

/**
 * The readings of a set that every caller was building for itself, held against
 * the set they are readings OF.
 *
 * THREE OF THEM, and each was a walk of the directory at a call site that reads
 * as a lookup: which files are broken ({@link brokenBy}), which outlines the
 * directory serves ({@link outlinePaths}), and that list as a membership test
 * ({@link outlineNames}). Each is a pure function of the set and none of them
 * is worth a field — most sets are never asked any of the three, and `assemble`
 * building all three would put a walk of the corpus in front of every write.
 *
 * KEYED ON THE SET, in a `WeakMap`, and that is a lifetime rule rather than a
 * cache with an invalidation policy. A set is a VALUE: `assemble` mints a new
 * one per revision and the fold mints one per op ({@link withDocuments}), so
 * two revisions are two keys and there is no moment at which an entry could
 * describe a set that has moved. What holds this honest is the same law the
 * carried index layers keep ({@link ./overlay.ts}): the arrays a set is made of
 * belong to the revision that assembled it and nobody writes through them. An
 * entry lives exactly as long as the set does, and a revision nobody holds any
 * more takes its readings with it.
 *
 * A LAZY FIELD PER READING rather than one object built on first ask, so a
 * caller that only ever wants the broken map does not pay for the paths.
 */
interface Held {
  broken?: ReadonlyMap<string, ReadonlyArray<OutlineError>>
  paths?: ReadonlyArray<string>
  names?: ReadonlySet<string>
}

const HELD = new WeakMap<OutlineSet, Held>()

const heldFor = (set: OutlineSet): Held => {
  const held = HELD.get(set)
  if (held !== undefined) return held
  const fresh: Held = {}
  HELD.set(set, fresh)
  return fresh
}

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
 *  a listing, a refusal that says which files there are, the inbox convention
 *  a capture is aimed by. HELD WITH THE SET ({@link heldFor}): a capture asks
 *  it per keystroke, and it is two allocations over every served file. */
export const outlinePaths = (set: OutlineSet): ReadonlyArray<string> => {
  const held = heldFor(set)
  return held.paths ??= outlinesIn(set).map((outline) => outline.path)
}

/**
 * The same list as a MEMBERSHIP TEST — "does this directory serve an outline at
 * that path".
 *
 * Four callers were spelling it as `new Set(outlinePaths(set))`, which is a
 * walk of the directory and a second copy of it to answer one `has` — the fold
 * memory's question once per fold click (`@olai/ops`' `homes`), the untrash
 * signpost's once per record, the panel's per write, the committing survey's
 * per write and per sweep. Held with the set for that reason, and named so the
 * callers stop building it: what they want is not the list.
 *
 * It is NOT {@link documentAt} narrowed, and the difference matters at exactly
 * one path: this answers about the OUTLINES, so a `.md` sitting where an
 * outline was asked about is absent here and present there. A caller that wants
 * the document whatever kind it is wants that function.
 */
export const outlineNames = (set: OutlineSet): ReadonlySet<string> => {
  const held = heldFor(set)
  return held.names ??= new Set(outlinePaths(set))
}

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
  set.documents.filter(isMarkdown)

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
 * WHO ASKS, since `perf-batch-assemble`: the round trip that pins those
 * invariants (`./set.test.ts`), and the batch fold's REFERENCE ARM — the fold
 * itself used to take the directory apart and put it back together per op, and
 * that spelling is kept as the differential's other side
 * (`@olai/ops`' `following.testlib.ts`) precisely so the carried set can be
 * proved equal to it at every op rather than by inspection. The fold's live
 * path is {@link withDocuments} below.
 */
export const apart = (
  set: OutlineSet,
): Map<string, Result.Result<Document, Verdict>> => {
  const files = new Map<string, Result.Result<Document, Verdict>>()
  for (const broken of set.broken) {
    files.set(broken.file, Result.fail(verdictOf(broken.errors)))
  }
  for (const document of set.documents) {
    if (files.has(document.path)) continue
    files.set(document.path, Result.succeed(document))
  }
  return files
}

/**
 * THE SET WITH THESE FILES WRITTEN INTO IT — the same value {@link assemble}
 * would build from the same files, reached without taking the directory apart
 * and sorting it again.
 *
 * **WHY IT EXISTS.** The batch fold plans each op against the set the op before
 * it would leave, and it built that set by inverting the whole directory into a
 * map, swapping the touched files in and re-assembling — a fresh path SORT of
 * every served file, per op, so a hundred-op batch paid for the directory a
 * hundred times (roadmap `perf-batch-assemble`; `assemble`'s own header
 * measures what that sort is). Nothing about the answer needed it: the set it
 * starts from is already in path order, and an op touches one file or two.
 *
 * **WHAT IT IS EQUAL TO**, which is the whole contract and is one line:
 *
 *     withDocuments(set, written)  ≡  assemble(apart(set) + written)
 *
 * Same documents in the same path order, same `broken` in the same order, and
 * a file that WAS broken and is now written leaves `broken` exactly as
 * re-assembling would have left it. `@olai/ops`' `following.equivalence.test.ts`
 * holds the two to each other at every op of scripted batches; this side is one
 * pass over the documents and a binary search per file written, and that side
 * is the sort.
 *
 * **IT COPIES, and the copy is the point.** The arrays are rebuilt rather than
 * written into, so the set a caller is already holding cannot move under it —
 * the aliasing law the carried index layers keep ({@link ./overlay.ts}), owed
 * here for the same reason: the fold hands each intermediate set to a planner
 * that may refuse, and the set the batch STARTED from is the caller's. What is
 * shared is the documents themselves, which are values nobody writes through.
 * A pass over an array of references is not what was expensive.
 *
 * **A DOCUMENT AND NOT A DECODE.** Everything this is handed parsed — the fold
 * writes files it has just serialised and read back — so there is no failure
 * arm to take and no way for this to put a file INTO `broken`. A caller holding
 * a file that did not decode wants {@link assemble}, which is what the store's
 * probe already goes through.
 */
export const withDocuments = (
  set: OutlineSet,
  written: Iterable<Document>,
): OutlineSet => {
  const swapped = new Map<string, Document>()
  for (const document of written) swapped.set(document.path, document)
  // An op that wrote nothing leaves the set it was given, identity and all —
  // which is what the fold's first op does to the reading it starts from.
  if (swapped.size === 0) return set

  // The files this set does not hold a place for yet, in path order: they are
  // the only ones that MOVE anything, and there is at most a handful of them.
  const arriving = [...swapped.values()]
    .filter((document) => documentAt(set, document.path) === undefined)
    .sort((one, other) => byPath(one.path, other.path))

  const documents: Array<Document> = []
  let next = 0
  for (const held of set.documents) {
    // Everything sorting before this path goes in first, which is what keeps
    // the promise {@link assemble} makes about the order.
    while (next < arriving.length && byPath((arriving[next] as Document).path, held.path) < 0) {
      documents.push(arriving[next++] as Document)
    }
    documents.push(swapped.get(held.path) ?? held)
  }
  while (next < arriving.length) documents.push(arriving[next++] as Document)

  // A file that is written is a file that READ, so it leaves `broken` — and the
  // array is left alone, identity and all, when nothing written was in it,
  // which is every batch that does not mend a file.
  const mended = set.broken.some((entry) => swapped.has(entry.file))
  return {
    documents,
    broken: mended ? set.broken.filter((entry) => !swapped.has(entry.file)) : set.broken,
  }
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
