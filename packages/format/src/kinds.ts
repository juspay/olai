/**
 * WHICH files a served directory is made of — the one place that list exists.
 *
 * A served directory is somebody's folder, and olai claims part of it: an
 * outline is a `.org`, a document is a `.md`, hypertext is a `.html`, a table
 * is a `.csv`, a picture is a `.png` (and the seven other spellings of one), a
 * printed document is a `.pdf` — and everything else, a `README`, a `.ts`, is
 * not part of the set at all. That is one decision, and before this file it was
 * four: a chain of
 * `endsWith` in the
 * format, a ternary deciding how a file decodes (`@olai/ops`' codec), a second
 * ternary deciding which list of the set it lands in (./set.ts), and a union in
 * the client naming the two kinds the sidebar draws. The rename of PR #177 and
 * the glyphs of PR #174 each had to find all of them.
 *
 * So the answer is a TABLE, and everything else asks it. What that buys is the
 * shape of the next PR of this kind, and the three kinds this file gained with
 * the viewers are that promise being spent: a new kind is one entry HERE, and
 * the type checker then names every place that owes it a drawing — a `Record`
 * over {@link FileKind} goes red rather than quietly falling through the last
 * arm of a ternary. What it does NOT buy, and does not pretend to, is the
 * drawings themselves: a glyph has to be drawn, a page has to be rendered, and
 * no table can do that for you. The registry decides; the surfaces draw; the
 * sweep in `@olai/tests`' `kinds.test.ts` is what says nobody spelled a suffix
 * outside this file.
 *
 * **A table is not a framework.** The fields below are exactly the four things
 * every kind has an answer to — what a file is CALLED, whether its content is a
 * tree of records or a body carried verbatim, whether the loaded set keeps that
 * content or only the path, and whether the reader's own browser fetches the
 * bytes — and nothing was added for a type that does not exist. A fact only one
 * kind has (where an archive goes, which files a `doc` may point at, what a
 * day's note is named) stays where that kind's rule lives, because a column
 * that is `null` for five of six rows is a union wearing a table's clothes.
 *
 * The FOURTH column arrived with the viewers and is worth the sentence, since
 * this header spent a paragraph on there being three: a `.pdf` and a `.png` are
 * drawn by pointing an element at the file's own URL, exactly as a previewed
 * `.html` is, and the route that answers those URLs needs the list. That is a
 * question the other three columns cannot answer between them — a `.csv` holds
 * text and is not kept and is still not fetched, because its page is handed the
 * text over the wire — so it is a column rather than a rule spelled beside the
 * route out of the three that were already here.
 *
 * **CODE that DECIDES reads this; PROSE that DESCRIBES spells it out.** The
 * rule PR #177 wrote beside `OUTLINE_EXT` is unchanged and now covers every
 * kind: the hundred docstrings, tool descriptions and refusal messages that
 * say `.org` or `.md` in words go on saying them in words — they are read by
 * a person, not by a branch, and interpolating a constant into a sentence buys
 * nothing while costing the one thing a message has, which is that you can
 * grep for it.
 */

import { Schema } from "effect"

/**
 * The one suffix that is spelled twice in this file, and the reason it is.
 *
 * A picture is the one kind with more than one spelling ({@link FILE_KINDS}),
 * and `.svg` is the one of its spellings that a SECOND rule has to be able to
 * name: markdown may point at a picture and deliberately not at an SVG, since
 * an SVG is a document that can script (`./documents.ts`'s `PICTURE_EXTENSIONS`
 * subtracts exactly this). Same terms as {@link OUTLINE_EXT} at the foot of
 * this file — a caller that needs the SPELLING rather than the verdict — and
 * the same one reason: the alternative is that list retyping eight suffixes
 * beside a ninth it leaves out, which is the second answer this file exists to
 * prevent.
 */
export const SVG_EXT = ".svg"

/** What is true of a kind of served file, for every kind, in the four respects
 *  all of them have an answer to. */
interface Claim {
  /**
   * The suffixes that claim a file, matched exactly as they are written here —
   * a near miss is a miss (`notes.md.txt` is nobody's, and neither is
   * `SHOT.PNG`).
   *
   * A LIST, and one entry long for five of the six. `.htm` is still
   * deliberately not a second spelling of hypertext — one spelling per kind,
   * and a vault that wants the other one can say so when somebody actually has
   * one — and a PICTURE is the case that argument does not cover: `.png` and
   * `.webp` are not two spellings of one word, they are two encodings of the
   * one thing this app does with either, which is draw it in an `<img>`. A kind
   * per encoding would be six rows owing six identical glyphs, six identical
   * faces and six identical nouns, which is a table describing the file format
   * of a picture rather than what olai does with one.
   *
   * The FIRST is the one a mint writes and a refusal suggests typing
   * (`@olai/web`'s `file/completing.ts`, {@link OUTLINE_EXT} below). Nothing
   * mints a picture, so which of its eight comes first decides nothing; it is
   * the one a person would type.
   */
  readonly exts: readonly [string, ...Array<string>]
  /**
   * What the file's content IS once it is read: a tree of RECORDS the
   * validator judges, a BODY OF TEXT carried verbatim and interpreted at view
   * time, or BYTES nothing here can read at all.
   *
   * It is here rather than in whatever reads a directory because two layers
   * that cannot see each other branch on it — the codec that decodes a file
   * (`@olai/ops`) and the assembly that sorts decoded files into the set
   * (./set.ts) — and them disagreeing is a `.html` parsed as an outline, which
   * is a directory full of errors about a file nobody meant as records.
   *
   * `"bytes"` is the value the viewers added, and it is a statement about what
   * may be READ rather than about what may be shown: a `.pdf` and a `.png` have
   * a page like any other bodied file, and decoding either as UTF-8 to put it
   * on a wire would be handing a reader a mangled string of a file nobody asked
   * for in that form. So the body reader is told which files it may open at all
   * ({@link textKind}), and the pages for the other two point an element at the
   * bytes instead ({@link Claim.fetched}).
   */
  readonly holds: "nodes" | "text" | "bytes"
  /**
   * Whether the loaded set KEEPS what the file holds, or keeps only its path
   * and reads the content when somebody asks for it.
   *
   * The question every kind has an answer to is "what does one loaded
   * directory cost to hold", and the answer is not the same for all of them. An
   * outline's records ARE the set — every rule reads them, so they are kept. A
   * document's text is what a conditional write is judged against and what a
   * writer must reproduce, so it is kept too. Everything else is a file olai
   * only ever SHOWS: nothing validates it, no op writes it, no rule reads it,
   * and a saved page with its pictures inlined — or the pictures themselves —
   * is megabytes. Keeping them bought nothing and cost the directory's whole
   * content in resident memory, for as long as the process ran.
   *
   * So it is here, beside `holds`, rather than in whatever reads a directory:
   * three layers that cannot see each other branch on it — the store's probe,
   * which does not read what nothing will keep; the codec, which decodes such
   * a file from its NAME (`@olai/ops`); and the server, which reads the body
   * when a reader opens it. What they must not disagree about is which files
   * those are.
   */
  readonly kept: boolean
  /**
   * Whether the READER'S OWN BROWSER fetches this file's bytes, over HTTP from
   * the media route, rather than being handed its content by this app.
   *
   * The fourth question, and the one the route at the other end is the whole
   * reason for: `@olai/format`'s `isAsset` is the single allowlist `/media/*`
   * judges a request by (`@olai/server`'s `media.ts`), and what it admits is
   * exactly the kinds whose page is drawn by POINTING at the file — a frame's
   * `src` for hypertext, an `<img>` for a picture, an `<object>` for a `.pdf` —
   * plus the parts a saved page draws itself with, which are not kinds at all.
   *
   * It is not derivable from the three columns above, which is why it is a
   * column. A `.csv` holds text, is not kept, and is still `false`: its page is
   * handed the file's text on the wire like a document's, so serving the same
   * bytes raw would be a second way to read a file that already has a page —
   * the argument `./documents.ts`'s `ASSET_EXTENSIONS` makes for `.md` and
   * `.org`, and the one it makes against handing DATA to a previewed page.
   */
  readonly fetched: boolean
}

/**
 * Every kind of file olai claims.
 *
 * `.org` is the outline: the records this app is about. `.md` is the
 * document: prose beside the outlines, which a node may attach and a day may
 * be named for. The other four are the files olai SHOWS and never writes —
 * they have no editor and no create verb, `write_document` refuses each of them
 * by asking for a document (`@olai/ops`), and none of their bodies is content
 * the set keeps ({@link Claim.kept}):
 *
 *   - `.html` is hypertext: a page somebody saved or a tool built, drawn in a
 *     sandboxed frame pointed at the file's own URL (`@olai/surface`'s
 *     `seal.ts` is the whole security argument);
 *   - `.csv` is the table: text this app really does read, parsed into rows
 *     when a reader opens it, drawn as a table and never as a spreadsheet,
 *     because nothing here writes one back;
 *   - a picture is the eight raster and vector spellings of the one thing an
 *     `<img>` draws. `.svg` is among them and is drawn as an `<img>` for
 *     exactly the reason it is NOT a picture markdown may name: an SVG is a
 *     document that can script, and an `<img>` is the element that will not run
 *     it (`@olai/server`'s `media.ts` is the response that holds the other half
 *     of that promise);
 *   - `.pdf` is the printed document, handed to the browser's own viewer.
 *
 * Hypertext is called that rather than "page" because the client already
 * calls what is on screen a page (`@olai/web`'s `page.ts`), and one word for
 * two things in one repository is an ambiguity every later reader pays for.
 */
export const FILE_KINDS = {
  outline: { exts: [".org"], holds: "nodes", kept: true, fetched: false },
  document: { exts: [".md"], holds: "text", kept: true, fetched: false },
  hypertext: { exts: [".html"], holds: "text", kept: false, fetched: true },
  csv: { exts: [".csv"], holds: "text", kept: false, fetched: false },
  image: {
    exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", SVG_EXT],
    holds: "bytes",
    kept: false,
    fetched: true,
  },
  pdf: { exts: [".pdf"], holds: "bytes", kept: false, fetched: true },
} as const satisfies Record<string, Claim>

/** What a served file can be. Derived from the table rather than declared
 *  beside it, so the union cannot name a kind the table does not claim. */
export type FileKind = keyof typeof FILE_KINDS

/** ...and the SCHEMA of that union, read off the same table for the same
 *  reason — because a page reading says which kind a reader ASKED for when the
 *  directory holds nothing by that name (`./page.ts`), and that answer travels.
 *  Two derivations of one table, never a list beside it. */
export const FileKind = Schema.Literals(
  Object.keys(FILE_KINDS) as ReadonlyArray<FileKind>,
)

/**
 * The kinds whose content is a BODY — everything a reader opens as a rendered
 * page rather than as a tree of rows.
 *
 * Derived from `holds`, which is the whole point: an entry written with
 * anything but `holds: "nodes"` widens this union on its own, and every
 * `Record<BodyKind, _>` in the app — the faces a document page can wear —
 * goes red naming exactly what the new type still owes.
 *
 * It is `holds` NOT BEING RECORDS rather than `holds` being text, and that is
 * the one place the viewers changed a derivation rather than adding to a table:
 * a `.pdf` is a page in every sense this union is about — it has an address, a
 * heading, a "the directory does not hold that" screen and a face — and the
 * fact that nothing here can read its bytes is the NEXT question down
 * ({@link TextKind}), asked by the body reader and by nobody who draws.
 */
export type BodyKind = {
  [K in FileKind]: (typeof FILE_KINDS)[K]["holds"] extends "nodes" ? never : K
}[FileKind]

/**
 * ...AND ITS COMPLEMENT: the kinds whose content is a TREE OF RECORDS — the
 * files something can WALK, as against the files it can only show.
 *
 * One entry today, which is why it is a derivation and not the word `"outline"`
 * written down. The table is what decides: a second record-holding kind widens
 * this union and narrows {@link BodyKind} in the same edit, and neither has to
 * be remembered.
 *
 * ## Its reader, and the near miss it exists to catch
 *
 * A plugin's doorbell declares WHICH KINDS OF FILE it can be pointed at
 * (`@olai/plugin-api`'s `PluginServerHalf.wake.kinds`), and a doorbell that
 * derives its watched set by WALKING a file's records — kolu reads the terminals
 * a board's un-done nodes claim — can only ever name kinds from this union. Its
 * declaration is annotated with it, and the annotation is the whole guard: the
 * words travel to the picker as plain strings, so nothing downstream can tell a
 * kind that cannot work from one that can.
 *
 * {@link FileKind} IS NOT THAT GUARD, and the difference is the defect this
 * union was added for. `FileKind` catches `"hologram"` — a word the registry
 * does not claim — and passes `"document"`, which is a word it does claim and a
 * file that holds no records at all. A doorbell declaring one would be offered
 * `.md` files by the picker, would derive the empty set from whichever was
 * picked, and would be beaten for by a heartbeat reporting a live watch: the
 * exact screenshot defect (the human, 2026-09-01) that the declaration was added
 * to close, reachable with the type checker happy. Bounded to this union it is
 * the same class of error as `"hologram"`, caught in the plugin that wrote it.
 *
 * CORE STILL CANNOT KNOW whether a doorbell can walk a kind, and does not: a
 * plugin that really does read a document's prose declares `"document"` and is
 * right to. What this union says is narrower and checkable — that a plugin which
 * walks RECORDS may not name a kind that has none — and it says it where the
 * plugin writes it down rather than where core reads it.
 */
export type NodeKind = {
  [K in FileKind]: (typeof FILE_KINDS)[K]["holds"] extends "nodes" ? K : never
}[FileKind]

/**
 * The bodied kinds whose content is TEXT — the files something in this process
 * may read as a string.
 *
 * One question, asked by the two ends of the body wire: the server, which reads
 * a body for whoever is holding one open (`@olai/server`'s `bodies.ts`), and
 * the revision that says which paths are owed one (`published.ts`). A `.pdf`
 * announced as a body somebody could ask for would be a promise to hand back a
 * megabyte of binary decoded as UTF-8, which is not the file and not an error
 * either.
 */
export type TextKind = {
  [K in FileKind]: (typeof FILE_KINDS)[K]["holds"] extends "text" ? K : never
}[FileKind]

/**
 * The bodied kinds the set keeps NO content of — the files olai only ever
 * SHOWS.
 *
 * Derived from `kept` over the bodied kinds, and it exists for one consumer:
 * the arm of {@link ./document.ts}'s sum that is a face and nothing else. Four
 * kinds share that arm and each carries its own tag, so which one a file lands
 * on is still the registry's answer — and the day a kind arrives whose body IS
 * kept, `Exclude<BodyKind, "document">` stops being assignable to this and the
 * constructor that files it goes red, rather than quietly filing it there.
 */
export type UnkeptKind = {
  [K in BodyKind]: (typeof FILE_KINDS)[K]["kept"] extends false ? K : never
}[BodyKind]

/** ...and that union as the LITERALS the schema is built from, off the same
 *  table for {@link FileKind}'s reason. */
export const UNKEPT_KINDS: ReadonlyArray<UnkeptKind> = Object.entries(FILE_KINDS)
  .filter(([, claim]) => claim.holds !== "nodes" && !claim.kept)
  .map(([kind]) => kind as UnkeptKind)

/** The table as pairs, once, so the walk below is not `Object.entries` per
 *  call: `fileKind` is asked of every entry of every directory walk. */
const CLAIMS = Object.entries(FILE_KINDS) as ReadonlyArray<readonly [FileKind, Claim]>

/**
 * The suffix a served file's name ends in, and the kind that claims it — or
 * `null` for a file that is not part of the set at all.
 *
 * The walk both readings below are made of, in one place rather than two, for
 * the reason {@link bareOf}'s docstring gives about two callers each answering
 * one question for themselves: WHICH suffix claimed a file and HOW MANY
 * characters that is are the same fact, and a picture is the first kind for
 * which the second cannot be read off the first.
 *
 * The order of the table decides nothing: no registered suffix ends in
 * another, and ./kinds.test.ts is what holds that.
 */
const claimOf = (path: string): readonly [FileKind, string] | null => {
  for (const [kind, claim] of CLAIMS) {
    for (const ext of claim.exts) {
      if (path.endsWith(ext)) return [kind, ext]
    }
  }
  return null
}

/**
 * What a served file is, by its name — or `null` for a file that is not part
 * of the set at all.
 *
 * It lives in the FORMAT rather than in whatever happens to read a directory,
 * because it is a statement about the format: the error that says "no such
 * `.md` file is served" and the field documented as "every outline found" are
 * both in this package, and the store, the ops layer and the client each need
 * the same answer for a different reason. None of them can import the others.
 */
export const fileKind = (path: string): FileKind | null => claimOf(path)?.[0] ?? null

/**
 * A served file's NAME with the suffix that claims it taken off — `roadmap` for
 * `docs/roadmap.org`, `2026-08-12` for `Daily/2026/08/2026-08-12.md` — and the
 * bare name for a file no kind claims, since there is no suffix of ours to take
 * off one of those.
 *
 * It is here because it is {@link fileKind}'s question asked one step further:
 * WHICH suffix a file has is the table's to answer, so how many characters come
 * off the end is the table's too. Two callers were each answering it for
 * themselves and had reached opposite rules — a commit subject spelled the
 * outline's suffix and left every other name whole, while the daily-note rule
 * cut at the last dot on purpose, so it would not be "taking the wrong number
 * of characters off" the day a second kind arrived. Both are right about the
 * file they were written for and neither is right about the other's:
 * `2026-08-12.md` keeps its suffix under the first, and `README` comes back as
 * `READM` under the second, because `lastIndexOf(".")` of `-1` drops the last
 * character instead of nothing.
 *
 * So the rule is the registry's, and it is the only one that is right about
 * both: cut what the table says is there, and cut nothing when it says there is
 * nothing. ./stem.test.ts holds the two retired rules beside this one and shows,
 * per name, that this one sides with whichever of them was right about that
 * file — the daily-note rule for a `.md`, the commit-subject rule for a name no
 * kind claims — and never invents a third answer. It is NOT that the divergent
 * names go unpassed: every daily note is one of them. It is that no caller can
 * reach a name where this rule would give it something its own rule would not.
 *
 * The BASENAME, so the directories above the file are gone first: a folder
 * named `2026-08-12` holding a `notes.md` has no bearing on what that document
 * is called, and a caller putting a stem in front of a reader means the name,
 * not the path.
 */
export const stemOf = (path: string): string => bareOf(path.slice(path.lastIndexOf("/") + 1))

/**
 * The same cut with the PATH left whole — `notes/plan` for `notes/plan.md`,
 * and the path itself for a file no kind claims.
 *
 * {@link stemOf} minus its basename step, and it is here rather than spelled
 * where it is wanted for that function's own reason: how many characters come
 * off the end is the TABLE's question, and the docstring above is the record of
 * two callers each answering it for themselves and reaching opposite rules. A
 * third caller doing the same arithmetic one package up would be that failure
 * again, in the direction a type checker cannot see.
 *
 * The two are one rule and one basename apart, so the difference between them
 * cannot drift: a caller wants the NAME (a stem in front of a reader) or the
 * PATH (a name to type back into a box — `@olai/web`'s `file/completing.ts`,
 * where offering `plan` for a `notes/plan.md` would quietly move the file to
 * the root).
 */
export const bareOf = (path: string): string => {
  const claim = claimOf(path)
  return claim === null ? path : path.slice(0, -claim[1].length)
}

/** Whether a kind's content is a body rather than records — the question the
 *  codec and the assembly both ask, in the form that narrows a `FileKind` to
 *  the ones a page can draw. */
export const holdsBody = (kind: FileKind): kind is BodyKind =>
  FILE_KINDS[kind].holds !== "nodes"

/** Whether a kind's body is TEXT — {@link holdsBody} one question narrower,
 *  for the body reader that has to open the file ({@link TextKind}). */
export const holdsText = (kind: FileKind): kind is TextKind =>
  FILE_KINDS[kind].holds === "text"

/** The bodied file a path names, or `null` — `fileKind` with the outlines
 *  taken out, for the readers that only ever wanted the drawable ones (the
 *  page a document's address opens, the link a markdown file makes). */
export const bodyKind = (path: string): BodyKind | null => {
  const kind = fileKind(path)
  return kind !== null && holdsBody(kind) ? kind : null
}

/** The file a path names whose body is TEXT, or `null` — the same move one
 *  question narrower, for the wire that says whose body may be read at all
 *  (`@olai/server`'s `published.ts`). */
export const textKind = (path: string): TextKind | null => {
  const kind = fileKind(path)
  return kind !== null && holdsText(kind) ? kind : null
}

/**
 * Whether the set holds this file's PATH AND NOT ITS CONTENT — by name, which
 * is the form every caller wants: everything olai only shows is `true`, an
 * outline and a document are `false`, and so is a file no kind claims, since
 * the set is not holding that at all. It is the ONLY reader of the `kept`
 * column outside {@link UnkeptKind}, the way `bodyKind` is the only reader of
 * `holds` outside {@link holdsBody}.
 *
 * One question with one name, because three layers that cannot see each other
 * ask it and each of them was deriving it in two steps: the codec, which
 * decodes such a file from its name (`@olai/ops`); the server, which reads the
 * body when a reader opens it and must answer for a KEY that may be no file at
 * all; and this package's own fixtures, which must produce the set a load
 * really produces. `bodyKind` is the same move one row up ({@link fileKind} +
 * {@link holdsBody}); this is {@link fileKind} + {@link Claim.kept}.
 */
export const unkept = (path: string): boolean => {
  const kind = fileKind(path)
  return kind !== null && !FILE_KINDS[kind].kept
}

/**
 * Whether a reader's browser fetches this file itself — {@link Claim.fetched}
 * asked of a NAME, which is the form the one caller wants.
 *
 * That caller is `./documents.ts`'s `isAsset`, the allowlist the media route
 * judges every request by, and the reason this is a named function rather than
 * a lookup spelled there is the reason every other reading in this file is one:
 * the route is in a package the client cannot import, and a list of suffixes
 * over there would be a second answer to a question this table settles.
 */
export const isFetched = (path: string): boolean => {
  const kind = fileKind(path)
  return kind !== null && FILE_KINDS[kind].fetched
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
 * EVERY suffix of every kind rather than the bodied ones, and that is the whole
 * of what the click handler needs to know: all of them have a page. A `.md`, a
 * `.html`, a `.csv`, a picture and a `.pdf` are drawn as bodies, an outline is
 * a tree, and WHICH of those a path opens at is not a question a frame can
 * answer or needs to — the app looks the path up in the list it belongs to and
 * routes it there (`@olai/web`'s `page.ts`). So the frame claims a click by
 * whether olai draws that kind of file at all, which is exactly this table's
 * own question.
 *
 * Same terms as {@link OUTLINE_EXT} and {@link DOCUMENT_EXT} below, and the same
 * one reason: a caller that needs the SPELLING rather than the verdict.
 */
export const FILE_EXTS: ReadonlyArray<string> = CLAIMS.flatMap(([, claim]) => claim.exts)

/**
 * The outline's suffix, by name.
 *
 * Two things that are not `fileKind` need the string itself and cannot get it
 * from a boolean: the conventional file names derived from it (`Trash.org`,
 * `Inbox.org` — ./node.ts) and the mint that refuses a path which would not
 * be claimed back (`@olai/ops`' `outlinePath`). Retyping it in either place is
 * not a type error; it is a file the walk stops claiming, or an op that
 * refuses a path the sidebar just offered.
 */
export const OUTLINE_EXT = FILE_KINDS.outline.exts[0]

/** The document's, on the same terms and for the same one reason: `create_document`
 *  mints a path, and a mint that admits a name `fileKind` will not claim writes
 *  a document nothing ever reads back.
 *
 *  Deliberately NOT `@olai/surface`'s `DOCUMENT_EXTENSIONS`, which answers a
 *  different question — what may be handed to an agent as a path — with five
 *  entries. The one string they share means a different thing on each side. */
export const DOCUMENT_EXT = FILE_KINDS.document.exts[0]
