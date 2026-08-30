/**
 * WHAT THE VALIDATOR JUDGED — as data, not as a log.
 *
 * A validation used to answer with a flat `ReadonlyArray<OutlineError>`, and
 * every consumer re-partitioned that list for the one question it actually had.
 * They got it wrong differently, and the three ways are on the roadmap: the
 * write gate reduced the list to one boolean, so a single broken file froze
 * writes to every healthy one and the refusal could not name the culprit
 * (`broken-file-blocks-healthy-writes`); the banner had nothing but the rows,
 * so 135 of them ran down every page in the app (`last-good-banner-flood`); and
 * boot applied a blanket "any error refuses the set", so two dangling `see`
 * edges served nothing at all (`cold-boot-all-or-nothing`).
 *
 * The findings are the same findings. What is new is that the questions are
 * asked HERE, once, and answered off one value:
 *
 *   - {@link implicating} / {@link implicatedBy} — which files a finding is
 *     ABOUT. `Reach` in `./errors.ts` already named this axis for the staging
 *     rule (`set-across-files` is the code an unreadable file can invent); this
 *     is the same axis read per finding rather than per code.
 *   - {@link admits} — the WRITE GATE's question, and it is per file. Its
 *     answer has no whole-set member: there is no way to spell "the set is
 *     invalid, so no" at a write, only "`lanes.olai` is what stops this", which
 *     is what makes the freeze unspellable through this socket rather than
 *     merely fixed at one call site.
 *   - {@link summary} — a BOUNDED per-file face any surface may draw. The
 *     banner draws this; the enumeration stays where a reader asked for it.
 *   - {@link tierOf} — what a finding DOES to a load, as a consultable
 *     classification rather than as a blanket buried in the validator.
 *
 * IT IS A STRUCT AND NOT A BRANDED ARRAY, and that is the whole of the shape
 * argument: `.length > 0` on a list is exactly the reduction this module exists
 * to take out of the callers' hands. A caller holding a {@link Verdict} that
 * wants a boolean has to say which files it is asking about.
 *
 * The findings inside are still the product `./errors.ts` describes — every one
 * naming `file:line`, in presentation order (`./rules.ts`'s `reportOf`) — and
 * the surfaces whose whole promise is that nothing is summarised away read them
 * directly. Summarising is what the banner over a still-live tree does; it is
 * not what the error PAGE does, and neither is asked to do the other's job.
 */

import { Schema } from "effect"

import { type ErrorCode, implicatedBy, OutlineError, stageOf } from "./errors.ts"
import { byPath } from "./paths.ts"

/**
 * The judgement a validation refuses with.
 *
 * ONE FIELD TODAY, and the reason it is a struct all the same is above: what
 * this type publishes is the QUESTIONS below, and a list publishes `length`.
 * A second field would go here the day a finding carries something no row does
 * — which is exactly where the boot policy's carried findings will land
 * ({@link Tier}).
 */
export const Verdict = Schema.Struct({
  /** Every finding, in presentation order — the parse errors first, the
   *  withheld guesses already taken out (`./rules.ts`'s `reportOf`, which is
   *  what assembles this). */
  findings: Schema.Array(OutlineError),
})
export type Verdict = typeof Verdict.Type

/** Nothing is wrong. One value rather than a fresh `{findings: []}` per read,
 *  because it is what a cell defaults to and what a clean load publishes, and
 *  a surface comparing frames by identity should see one thing. */
export const NOTHING_WRONG: Verdict = { findings: [] }

/** The findings, as a verdict. The one constructor: a caller assembling the
 *  struct by hand is a caller who could assemble a different one. */
export const verdictOf = (findings: ReadonlyArray<OutlineError>): Verdict =>
  findings.length === 0 ? NOTHING_WRONG : { findings }

/** Is there anything to say at all? Not a whole-set write gate — that question
 *  is {@link admits}' and has no boolean — but the one bit a surface needs to
 *  decide whether to draw ITSELF. */
export const isClean = (verdict: Verdict): boolean => verdict.findings.length === 0

// ── which files a finding is about ──────────────────────────────────────

/** The findings FILED ON one file, in the order the verdict holds them.
 *
 *  Two questions live here and they used to SHARE ONE AXIS — the breakage
 *  `5dfef3ed` landed made them visibly two. WHICH FILES ONE FINDING IS
 *  *ABOUT* is `./errors.ts`'s ({@link implicatedBy}) — site plus every row it
 *  names related, because the error view renders both halves of one
 *  judgement and the byte-check at the write door can name only files the
 *  verdict names. WHICH FILE THE FINDING IS *FILED ON* is the finding's own
 *  `file`: a `bad-prop` site's record is wrong; the declaration that judged
 *  it is not — a write gate asking "which file is broken" needs the one the
 *  write could fix. The shared axis bred the old sentence again — one bad
 *  value in one ordinary file freezing every write to the declarations file
 *  is exactly the shape `broken-file-blocks-healthy-writes` exists to make
 *  unspellable.
 *
 *  File-first rather than related-including, and the consumers follow: the
 *  write gate's `admits` and the banner's per-file faces both ask the
 *  broken-file question; the about-one is for the error view and the drift
 *  check, whose doors are the finding, not the file.
 */
export const implicating = (
  verdict: Verdict,
  file: string,
): ReadonlyArray<OutlineError> =>
  verdict.findings.filter((finding) => finding.file === file)

/** Every file any finding NAMES, in path order — the rows' whole reach,
 *  the set the error view draws cross-file colour from and the set the drift
 *  check's ask names. `summary` asks one level DOWN: per file the finding is
 *  FILED ON, not every file it looked at — the two share `byPath`'s order
 *  and nothing else ({@link implicating} is that split).
 */
export const implicatedIn = (verdict: Verdict): ReadonlyArray<string> => {
  const files = new Set<string>()
  for (const finding of verdict.findings) {
    for (const file of implicatedBy(finding)) files.add(file)
  }
  return [...files].sort(byPath)
}

// ── the write gate's question ───────────────────────────────────────────

/**
 * Whether a write may go through, and WHAT STOPS IT when it may not.
 *
 * There is no third member and there is not going to be one. "The set is
 * invalid" is not an answer a write can be given here, because it is not an
 * answer anybody could act on: the write that was refused with it
 * (`broken-file-blocks-healthy-writes`) was innocent, and the sentence read as
 * an indictment of it.
 */
export type Admission =
  | { readonly _tag: "admitted" }
  /** The blocker, named — and its rows, so the refusal can show its work
   *  without the caller going back to the verdict for them. */
  | {
    readonly _tag: "implicated"
    readonly file: string
    readonly rows: ReadonlyArray<OutlineError>
  }

export const ADMITTED: Admission = { _tag: "admitted" }

/**
 * Is a write to exactly these files admissible against this verdict?
 *
 * ADMITTED means no finding in hand is about any of them: whatever is wrong
 * with the served directory, this write is not it and never was. The store's
 * gate spends that answer to let the write land while the broken file goes on
 * being broken beside it — reads have degraded per file since 2026-08-09 and
 * writes did not, and the asymmetry was the bug.
 *
 * IMPLICATED names the FIRST file, in the order the caller asked about them,
 * that something is wrong with. First rather than all of them because a refusal
 * is a sentence somebody reads, and the second blocker is one fix away from
 * being the first.
 *
 * A directory that could not be READ implicates everything: there is no file
 * whose health could be asserted when the listing itself failed, so the answer
 * is that finding's own site, whichever files were asked about. (In practice a
 * write never reaches here in that state — the store's probe fails first — and
 * a socket whose safety rests on that is not one.)
 */
export const admits = (
  verdict: Verdict,
  files: ReadonlyArray<string>,
): Admission => {
  const whole = verdict.findings.find((finding) => finding.code === "unreadable-directory")
  if (whole !== undefined) {
    return { _tag: "implicated", file: whole.file, rows: implicating(verdict, whole.file) }
  }
  for (const file of files) {
    const rows = implicating(verdict, file)
    if (rows.length > 0) return { _tag: "implicated", file, rows }
  }
  return ADMITTED
}

// ── the bounded face ────────────────────────────────────────────────────

/** What is the matter with one file, as one word. `unreadable` is the disk
 *  refusing to give it up, `unparsed` is lines that are not records, and
 *  `invalid` is a file that reads perfectly and says something the set cannot
 *  hold. Read off the codes, so it cannot drift from the rows underneath. */
export type FileState = "unreadable" | "unparsed" | "invalid"

/** One file's face: what is wrong with it, and how much. NO ROWS — that is the
 *  whole of the bound, and the rows are one `implicating` away for the surface
 *  whose job is to show them. */
export interface FileFace {
  readonly file: string
  readonly state: FileState
  /** Findings FILED ON this file. One finding, one face's count — the file
   *  the fix lives in is the one the face is for, so a cross-file finding is
   *  not double-counted across every file it looked at. */
  readonly count: number
}

/**
 * A bounded per-file face of the whole verdict.
 *
 * THE BOUND IS ON FILES, not on rows, because that is what a caller can hold to
 * a screen: `at most n` faces, each of them one line long whatever it is
 * counting, and a tail count for the rest. A 135-row afternoon is one face
 * saying 135 — which is the sentence the banner was always supposed to say
 * (`last-good-banner-flood`: "one sentence per broken file plus a row COUNT").
 *
 * `n` is the caller's clamp and belongs to the surface drawing it — a knob is
 * not a receptacle. What belongs here is that no surface can draw this
 * UNBOUNDED, because there is no way to ask for the rows through it.
 */
export interface Summary {
  /** At most `n`, in path order — the order the sidebar reads down. */
  readonly files: ReadonlyArray<FileFace>
  /** Filed-on files this face does not list. */
  readonly more: number
  /** Findings in the whole verdict. The counts above DO sum to this: one
   *  finding, one file's face — a cross-file finding is counted on the file
   *  it was filed on, not every file it looked at. */
  readonly total: number
}

export const summary = (verdict: Verdict, n: number): Summary => {
  // ONE face per file a finding is FILED ON, not per file any finding names
  // — the draught of `5dfef3ed` again: a cycle's steps or a bad value's
  // declaration are the row's OTHER sites, and the face the banner draws is
  // the file that reads broken, not the one the judgement reached through.
  // `implicatedIn`'s door stays open for the error view's whole row — the
  // two are now distinct axes by design rather than by coincidence.
  const filed = [...new Set(verdict.findings.map((finding) => finding.file))].sort(byPath)
  const faces = filed.map((file): FileFace => {
    const rows = implicating(verdict, file)
    return { file, state: stateOf(rows), count: rows.length }
  })
  return {
    files: faces.slice(0, Math.max(0, n)),
    more: Math.max(0, faces.length - Math.max(0, n)),
    total: verdict.findings.length,
  }
}

/** The worst thing said about one file, as its state: a disk that would not
 *  give it up outranks lines that would not parse, which outranks a file that
 *  reads and does not fit. */
const stateOf = (rows: ReadonlyArray<OutlineError>): FileState => {
  if (rows.some((row) => row.code === "unreadable-directory" || row.code === "unreadable-file")) {
    return "unreadable"
  }
  return rows.some((row) => stageOf(row.code) === "line") ? "unparsed" : "invalid"
}

// ── the severity shelf ──────────────────────────────────────────────────

/**
 * What a finding DOES to a load.
 *
 * `refuses` holds the last good snapshot and serves nothing at a cold boot;
 * `carried` is a hole the rest of the set is rendered around — the file keeps
 * its place, its own page says so, and nobody else's page moves.
 *
 * HALF OF THIS ALREADY EXISTED and was never written down as a tier: a file
 * whose LINES do not parse has degraded in place since 2026-08-09
 * (`./validate.ts`'s error scope), while every set-level rule shared one
 * blanket. The table below is that arrangement said out loud, with the set half
 * finally spellable.
 */
export type Tier = "refuses" | "carried"

/**
 * THE ONE LINE OF POLICY, and it is deliberately not architecture.
 *
 * Which classes brick a boot is a RULING and the human's to make (roadmap
 * `verdict-boot-policy`, `#human`): a dangling `see` is arguably the same class
 * as a stale ref-prop — a flag with a did-you-mean, not a brick — and two of
 * them served an empty vault on 2026-08-25, chat included. The debate that
 * produced this module refused to smuggle that call into the shape, so what
 * ships here is the SHELF: every class named, consultable, and set to exactly
 * what the validator did before this table existed.
 *
 * SO IT IS BEHAVIOUR-PRESERVING BY CONSTRUCTION: every `set` code refuses (the
 * old blanket), every `line` code is carried (the old error scope), and
 * `./verdict.test.ts` pins that equivalence against `stageOf` for the whole
 * catalogue rather than against this file's own opinion of it.
 *
 * TURNING ONE IS NOT A ONE-LINE EDIT, and whoever holds the ruling should know
 * it before they make it: a class moved to `carried` must also be CARRIED
 * somewhere a reader can see it, the way a parse failure rides in the set's
 * `broken` entry and draws on its own file's page (`./set.ts`'s `BrokenFile`).
 * Flipping a value here without that would make the finding true, consultable
 * and invisible — which is the silent-staleness shape the same sitting spent
 * its third finding on. The tier is the decision; the carry is its other half.
 *
 * It lives beside the verdict rather than in `./errors.ts`'s catalogue for the
 * same reason: the catalogue is what the format KNOWS about a code — its
 * spelling, its prose, the phase that catches it, and the reach the staging
 * rule reads. What a class costs a boot is what this vault has DECIDED about
 * it. `satisfies Record<ErrorCode, Tier>` is what keeps the two from drifting
 * anyway: a new code is a type error here until somebody answers for it.
 */
const TIERS = {
  // ── one line, on its own: a hole the rest of the set renders around ──
  "not-json": "carried",
  "not-an-object": "carried",
  "bad-record": "carried",
  "bad-id": "carried",
  "several-marks": "carried",
  "bad-date": "carried",
  "bad-repeat": "carried",
  "unreadable-file": "carried",

  // ── the whole set: today's blanket, one row at a time ────────────────
  "duplicate-id": "refuses",
  "unknown-parent": "refuses",
  "foreign-parent": "refuses",
  "parent-not-a-node": "refuses",
  "parent-cycle": "refuses",
  "unknown-target": "refuses",
  "after-cycle": "refuses",
  "mirror-cycle": "refuses",
  "missing-doc": "refuses",
  "bad-prop": "refuses",
  "unreadable-directory": "refuses",
} as const satisfies Record<ErrorCode, Tier>

export const tierOf = (code: ErrorCode): Tier => TIERS[code]

/**
 * Does anything here stop the set loading?
 *
 * Asked of the RAW findings rather than of a report, and the difference is the
 * withheld ones: a rule that could not decide because some file did not parse
 * has still found something, and a snapshot whose nodes point at ids nobody can
 * resolve is not a set anything could draw (`./validate.ts` has said so since
 * the error scope was written). They are taken out of what a READER is shown
 * and they still refuse.
 */
export const refusesLoad = (
  findings: ReadonlyArray<{ readonly code: ErrorCode }>,
): boolean => findings.some((finding) => tierOf(finding.code) === "refuses")
