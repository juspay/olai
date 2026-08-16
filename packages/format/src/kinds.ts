/**
 * WHICH files a served directory is made of — the one place that list exists.
 *
 * A served directory is somebody's folder, and olai claims part of it: an
 * outline is a `.olai`, a document is a `.md`, hypertext is a `.html`, and
 * everything else — a `README`, a `.png`, a `.ts` — is not part of the set at
 * all. That is one decision, and before this file it was four: a chain of
 * `endsWith` in the
 * format, a ternary deciding how a file decodes (`@olai/ops`' codec), a second
 * ternary deciding which list of the set it lands in (./set.ts), and a union in
 * the client naming the two kinds the sidebar draws. The rename of PR #177 and
 * the glyphs of PR #174 each had to find all of them.
 *
 * So the answer is a TABLE, and everything else asks it. What that buys is the
 * shape of the next PR of this kind: a fourth type is one entry HERE, and the
 * type checker then names every place that owes it a drawing — a `Record` over
 * {@link FileKind} goes red rather than quietly falling through the last arm of
 * a ternary. What it does NOT buy, and does not pretend to, is the drawings
 * themselves: a glyph has to be drawn, a page has to be rendered, and no table
 * can do that for you. The registry decides; the surfaces draw; the sweep in
 * `@olai/tests`' `kinds.test.ts` is what says nobody spelled a suffix outside
 * this file.
 *
 * **A table is not a framework.** The fields below are exactly the three
 * things the kinds already share — what a file is CALLED, whether its content
 * is a tree of records or a body carried verbatim, and whether the loaded set
 * keeps that content or only the path — and nothing was added for a type that
 * does not exist. A fact only one kind has (where
 * an archive goes, which files a `doc` may point at, what a day's note is
 * named) stays where that kind's rule lives, because a column that is `null`
 * for two of three rows is a union wearing a table's clothes.
 *
 * **CODE that DECIDES reads this; PROSE that DESCRIBES spells it out.** The
 * rule PR #177 wrote beside `OUTLINE_EXT` is unchanged and now covers every
 * kind: the hundred docstrings, tool descriptions and refusal messages that
 * say `.olai` or `.md` in words go on saying them in words — they are read by
 * a person, not by a branch, and interpolating a constant into a sentence buys
 * nothing while costing the one thing a message has, which is that you can
 * grep for it.
 */

/** What is true of a kind of served file, for every kind, in the three respects
 *  all of them have an answer to. */
interface Claim {
  /** The suffix that claims a file, matched exactly as it is written here — a
   *  near miss is a miss (`notes.md.txt` is nobody's). */
  readonly ext: string
  /**
   * What the file's content IS once it is read: a tree of RECORDS the
   * validator judges, or a BODY carried verbatim and interpreted at view time.
   *
   * It is here rather than in whatever reads a directory because two layers
   * that cannot see each other branch on it — the codec that decodes a file
   * (`@olai/ops`) and the assembly that sorts decoded files into the set
   * (./set.ts) — and them disagreeing is a `.html` parsed as an outline, which
   * is a directory full of errors about a file nobody meant as records.
   */
  readonly holds: "nodes" | "text"
  /**
   * Whether the loaded set KEEPS what the file holds, or keeps only its path
   * and reads the content when somebody asks for it.
   *
   * The question every kind has an answer to is "what does one loaded
   * directory cost to hold", and the answer is not the same for all three. An
   * outline's records ARE the set — every rule reads them, so they are kept. A
   * document's text is what a conditional write is judged against and what a
   * writer must reproduce, so it is kept too. A `.html` is the one file olai
   * only ever SHOWS: nothing validates it, no op writes it, no rule reads it,
   * and a saved page with its pictures inlined is megabytes. Keeping it bought
   * nothing and cost the directory's whole content in resident memory, for as
   * long as the process ran.
   *
   * So it is here, beside `holds`, rather than in whatever reads a directory:
   * three layers that cannot see each other branch on it — the store's probe,
   * which does not read what nothing will keep; the codec, which decodes such
   * a file from its NAME (`@olai/ops`); and the server, which reads the body
   * when a reader opens it. What they must not disagree about is which files
   * those are.
   */
  readonly kept: boolean
}

/**
 * Every kind of file olai claims.
 *
 * `.olai` is the outline: the records this app is about. `.md` is the
 * document: prose beside the outlines, which a node may attach and a day may
 * be named for. `.html` is hypertext: a page somebody saved or a tool built,
 * sitting in the vault with everything else — olai SHOWS it and never writes
 * it, so it has no editor, no create verb, `write_document` refuses it by
 * asking for a document (`@olai/ops`), and its body is the one content the set
 * does not keep ({@link Claim.kept}).
 *
 * The third is called hypertext rather than "page" because the client already
 * calls what is on screen a page (`@olai/web`'s `page.ts`), and one word for
 * two things in one repository is an ambiguity every later reader pays for.
 * `.htm` is deliberately not a second suffix: one spelling per kind, and a
 * vault that wants the other one can say so when somebody actually has one.
 */
export const FILE_KINDS = {
  outline: { ext: ".olai", holds: "nodes", kept: true },
  document: { ext: ".md", holds: "text", kept: true },
  hypertext: { ext: ".html", holds: "text", kept: false },
} as const satisfies Record<string, Claim>

/** What a served file can be. Derived from the table rather than declared
 *  beside it, so the union cannot name a kind the table does not claim. */
export type FileKind = keyof typeof FILE_KINDS

/**
 * The kinds whose content is a BODY — everything a reader opens as a rendered
 * page rather than as a tree of rows.
 *
 * Derived from `holds`, which is the whole point: an entry written with
 * `holds: "text"` widens this union on its own, and every `Record<BodyKind, _>`
 * in the app — the faces a document page can wear — goes red naming exactly
 * what the new type still owes.
 */
export type BodyKind = {
  [K in FileKind]: (typeof FILE_KINDS)[K]["holds"] extends "text" ? K : never
}[FileKind]

/** The table as pairs, once, so the walk below is not `Object.entries` per
 *  call: `fileKind` is asked of every entry of every directory walk. */
const CLAIMS = Object.entries(FILE_KINDS) as ReadonlyArray<readonly [FileKind, Claim]>

/**
 * What a served file is, by its name — or `null` for a file that is not part
 * of the set at all.
 *
 * It lives in the FORMAT rather than in whatever happens to read a directory,
 * because it is a statement about the format: the error that says "no such
 * `.md` file is served" and the field documented as "every outline found" are
 * both in this package, and the store, the ops layer and the client each need
 * the same answer for a different reason. None of them can import the others.
 *
 * The order of the table decides nothing: no registered suffix ends in
 * another, and ./kinds.test.ts is what holds that.
 */
export const fileKind = (path: string): FileKind | null => {
  for (const [kind, claim] of CLAIMS) {
    if (path.endsWith(claim.ext)) return kind
  }
  return null
}

/** Whether a kind's content is a body rather than records — the question the
 *  codec and the assembly both ask, in the form that narrows a `FileKind` to
 *  the ones a page can draw. */
export const holdsText = (kind: FileKind): kind is BodyKind =>
  FILE_KINDS[kind].holds === "text"

/** The bodied file a path names, or `null` — `fileKind` with the outlines
 *  taken out, for the readers that only ever wanted the drawable ones (the
 *  page a `/doc/…` address opens, the link a markdown file makes). */
export const bodyKind = (path: string): BodyKind | null => {
  const kind = fileKind(path)
  return kind !== null && holdsText(kind) ? kind : null
}

/**
 * Whether the set holds this file's PATH AND NOT ITS CONTENT — by name, which
 * is the form every caller wants: a `.html` is `true`, an outline and a
 * document are `false`, and so is a file no kind claims, since the set is not
 * holding that at all. It is the ONLY reader of the `kept` column, the way
 * `bodyKind` is the only reader of `holds` outside {@link holdsText}.
 *
 * One question with one name, because three layers that cannot see each other
 * ask it and each of them was deriving it in two steps: the codec, which
 * decodes such a file from its name (`@olai/ops`); the server, which reads the
 * body when a reader opens it and must answer for a KEY that may be no file at
 * all; and this package's own fixtures, which must produce the set a load
 * really produces. `bodyKind` is the same move one row up ({@link fileKind} +
 * {@link holdsText}); this is {@link fileKind} + {@link Claim.kept}.
 */
export const unkept = (path: string): boolean => {
  const kind = fileKind(path)
  return kind !== null && !FILE_KINDS[kind].kept
}

/**
 * EVERY registered suffix, as the strings themselves.
 *
 * {@link fileKind} is this question wherever a function can be called, and
 * wherever one can be called it is the answer. This is the same list for the
 * one caller that cannot call anything: the click handler `@olai/surface`'s
 * `seal.ts` puts inside a previewed page is TEXT in a template literal, running
 * in a frame with no imports and no module system, and what it has to decide
 * about the link under the reader's finger is whether that address names a file
 * this app has a page for. So the list is interpolated into the script and the
 * decision stays the registry's — as against a `.html` written out over there,
 * which is the second answer this file exists to prevent.
 *
 * EVERY kind rather than the bodied ones, and that is the whole of what the
 * click handler needs to know: all three have a page. A `.md` and a `.html` are
 * read at `/doc/`, an outline is a tree at `/o/`, and WHICH of those a path
 * opens at is not a question a frame can answer or needs to — the app looks the
 * path up in the list it belongs to and routes it there (`@olai/web`'s
 * `page.ts`). So the frame claims a click by whether olai draws that kind of
 * file at all, which is exactly this table's own question.
 *
 * Same terms as {@link OUTLINE_EXT} and {@link DOCUMENT_EXT} below, and the same
 * one reason: a caller that needs the SPELLING rather than the verdict.
 */
export const FILE_EXTS: ReadonlyArray<string> = CLAIMS.map(([, claim]) => claim.ext)

/**
 * The outline's suffix, by name.
 *
 * Two things that are not `fileKind` need the string itself and cannot get it
 * from a boolean: the conventional file names derived from it (`Archive.olai`,
 * `Inbox.olai` — ./node.ts) and the mint that refuses a path which would not
 * be claimed back (`@olai/ops`' `outlinePath`). Retyping it in either place is
 * not a type error; it is a file the walk stops claiming, or an op that
 * refuses a path the sidebar just offered.
 */
export const OUTLINE_EXT = FILE_KINDS.outline.ext

/** The document's, on the same terms and for the same one reason: `create_document`
 *  mints a path, and a mint that admits a name `fileKind` will not claim writes
 *  a document nothing ever reads back.
 *
 *  Deliberately NOT `@olai/surface`'s `DOCUMENT_EXTENSIONS`, which answers a
 *  different question — what may be handed to an agent as a path — with five
 *  entries. The one string they share means a different thing on each side. */
export const DOCUMENT_EXT = FILE_KINDS.document.ext
