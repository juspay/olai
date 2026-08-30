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
 *   - {@link blamed} — which files a finding is ABOUT, filed under them.
 *     `Reach` in `./errors.ts` already named this axis for the staging rule
 *     (`set-across-files` is the code an unreadable file can invent) and
 *     `implicatedBy` reads it per finding; this is that answer for a whole
 *     report, and it is the one partition of a verdict there is.
 *   - {@link admits} — how a REFUSAL is read, and it is per file. Its
 *     answer has no whole-set member: there is no way to spell "the set is
 *     invalid, so no" at a write, only "`lanes.olai` is what stops this", which
 *     is what makes the freeze unspellable through this socket rather than
 *     merely fixed at one call site.
 *   - {@link struck} — the write gate's other half, and the same answer shape:
 *     which file this write took off the screen that was ON it. Asked as a
 *     DIFFERENCE against what was already published, so a file that was
 *     already dark stops nothing and a bystander this write darkened stops
 *     everything.
 *   - {@link summaryOf} — a BOUNDED per-file face any surface may draw, off
 *     the per-file entries {@link blamed} files. The banner draws this; the
 *     enumeration stays where a reader asked for it.
 *   - {@link admits} / {@link summaryOf} — the two questions asked OF that
 *     partition: what stops a write to these files, and a bounded face any
 *     surface may draw.
 *
 * ## THE TIER SHELF IS GONE, and the ruling is why
 *
 * This module used to publish `tierOf` — a `Record<ErrorCode, Tier>` saying
 * which classes `refuse` a load and which are `carried` past it — set to
 * exactly what the validator did before the table existed, with the question of
 * what should sit on it left open as `#human` (roadmap `verdict-boot-policy`).
 * The human answered on 2026-08-29 and the answer has no second value in it:
 * **every finding is per file**. A broken `.olai` degrades ALONE, at a cold
 * boot and at runtime alike; nothing a file can say takes another file off the
 * screen or refuses a write to it.
 *
 * So the shelf is a table with one row, and a table with one row is a fact
 * spelled as a mechanism. What replaced it is {@link blamed}, which does the
 * OTHER half the shelf's own prose said was owed — "a class moved to `carried`
 * must also be CARRIED somewhere a reader can see it" — by filing every finding
 * under the files it breaks, in the shape the set already carries a file that
 * would not parse (`./errors.ts`'s `BrokenFile`). The tier was the decision;
 * the carry is what makes it true, and there is no longer a way to write down
 * the decision without it.
 *
 * WHAT STILL REFUSES A LOAD is one thing and it is not a class of finding: a
 * DIRECTORY nobody could read has no set to degrade per file, and that arrives
 * on the store's errors channel rather than through a validation at all
 * (`@olai/ops`' `codec.ts`, `unreadable`).
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

import { type BrokenFile, implicatedBy, OutlineError, stageOf } from "./errors.ts"
import { byPath } from "./paths.ts"

/**
 * The judgement a validation refuses with.
 *
 * ONE FIELD TODAY, and the reason it is a struct all the same is above: what
 * this type publishes is the QUESTIONS below, and a list publishes `length`.
 * A second field would go here the day a finding carries something no row does.
 *
 * WHAT IT NO LONGER MEANS is "the set could not be loaded". Since the per-file
 * ruling a validation answers with a set whatever it found, and this value is
 * what a REFUSED WRITE carries and what the store's errors channel says about a
 * directory it could not read at all — never a reason a reader's outlines are
 * off the screen.
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
   *  without the caller going looking for them. */
  | {
    readonly _tag: "implicated"
    readonly file: string
    readonly rows: ReadonlyArray<OutlineError>
  }

/** Nothing stops this write. One value rather than a fresh struct per ask —
 *  it is the answer almost every write gets. */
const ADMITTED: Admission = { _tag: "admitted" }

/**
 * Is a write to exactly these files admissible, given what is broken?
 *
 * ADMITTED means no entry in hand is about any of them: whatever is wrong with
 * the served directory, this write is not it and never was. The store's gate
 * spends that answer to let the write land while the broken file goes on being
 * broken beside it — reads have degraded per file since 2026-08-09 and writes
 * did not, and the asymmetry was the bug.
 *
 * IMPLICATED names the FIRST file, in the order the caller asked about them,
 * that something is wrong with. First rather than all of them because a refusal
 * is a sentence somebody reads, and the second blocker is one fix away from
 * being the first.
 *
 * IT TAKES THE PER-FILE ENTRIES, which is the axis the whole system reads now,
 * and that is what makes it ONE question rather than two. It used to take a
 * `Verdict` and re-partition it per file — so the write gate's own path asked
 * it of a SET (`./set.ts`'s `stopping`, which had the entries already) while
 * the refusal's sentence asked it of the verdict that gate had just built out
 * of one entry's rows, deriving the blocker's identity a second time from a
 * value that was made by knowing it. Both callers reach the entries now: a set
 * carries them, and a caller holding a verdict gets them from {@link blamed},
 * which is the same step every other reader of a verdict makes.
 *
 * A directory that could not be READ implicates everything: there is no file
 * whose health could be asserted when the listing itself failed, so the answer
 * is that entry, whichever files were asked about. (In practice a write never
 * reaches here in that state — the store's probe fails first — and a socket
 * whose safety rests on that is not one.)
 *
 * TWO SMALL SCANS AND NO INDEX, deliberately: a directory has a handful of
 * broken files at most and a commit puts down one or two, so a map built to
 * answer one question would cost more than the question. The caller that asks
 * per file across a whole listing has `./set.ts`'s `brokenBy`, which is held
 * with the set.
 */
export const admits = (
  broken: ReadonlyArray<BrokenFile>,
  files: ReadonlyArray<string>,
): Admission => {
  const whole = broken.find((entry) =>
    entry.errors.some((row) => row.code === "unreadable-directory")
  )
  if (whole !== undefined) {
    return { _tag: "implicated", file: whole.file, rows: whole.errors }
  }
  for (const file of files) {
    const entry = broken.find((one) => one.file === file)
    if (entry !== undefined && entry.errors.length > 0) {
      return { _tag: "implicated", file, rows: entry.errors }
    }
  }
  return ADMITTED
}

/**
 * WHICH FILE THIS WRITE PUT OUT — a file that is broken now, was not broken
 * before, and is not one of the files the write put down.
 *
 * {@link admits} is the question "is this write's own ground clear"; this is
 * the other half of the same gate, and it is the one #441's per-file publishing
 * left unasked. A write is judged on the set it WOULD make, and that set can
 * hold a file the write never touched and just took off every page: moving a
 * `ref` variant out of the root its declaration names strands every value that
 * says its id, in whatever third file holds them. #439's law is that an ops
 * write must never mint a state the next load refuses even when the findings
 * sit on files it did not write — it enforced that at the store, over a
 * REFUSAL, and per-file publishing means there is no refusal left to read.
 *
 * THE BASELINE IS WHAT WAS ALREADY PUBLISHED, which is the whole of how this
 * keeps `broken-file-blocks-healthy-writes` closed. A file that was dark before
 * this write is not this write's, however dark it is afterwards: it is already
 * off every page, it already refuses its own writes, and refusing an unrelated
 * write over it is exactly the freeze the per-file ruling took down. So the
 * question is a DIFFERENCE and not a state, and only a file that crossed from
 * lit to dark can stop anything.
 *
 * PER FILE AND NOT PER ROW, for the same reason: a write that adds a seventh
 * finding to a file already carrying six changes nothing a reader can see, and
 * comparing rows would make every already-broken file a wall again — the
 * freeze re-entering one row at a time. What a person can see is a file leaving
 * the screen, and that is what this refuses.
 *
 * THE WRITE'S OWN FILES ARE NOT BYSTANDERS. They are {@link admits}' question,
 * asked over the same set, and a write that breaks the file it is writing is
 * refused there with that file's rows. Spelled here rather than assumed from
 * the call order, so this answers correctly whoever asks it.
 *
 * IN PATH ORDER, first only — `broken` arrives from {@link blamed} sorted, and
 * a refusal is a sentence somebody reads.
 */
export const struck = (
  standing: ReadonlyArray<BrokenFile>,
  broken: ReadonlyArray<BrokenFile>,
  files: ReadonlyArray<string>,
): Admission => {
  if (broken.length === 0) return ADMITTED
  const before = new Set(standing.map((entry) => entry.file))
  const written = new Set(files)
  for (const entry of broken) {
    if (entry.errors.length === 0) continue
    if (before.has(entry.file) || written.has(entry.file)) continue
    return { _tag: "implicated", file: entry.file, rows: entry.errors }
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
 *  whole of the bound, and the rows are on the entry {@link blamed} filed, for
 *  the surface whose job is to show them. */
export interface FileFace {
  readonly file: string
  readonly state: FileState
  /** Findings implicating this file. A cross-file finding counts in each file
   *  it names, which is what makes these counts a per-FILE fact rather than a
   *  partition of the total. */
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
  /** Implicated files this face does not list. */
  readonly more: number
  /** Rows across every implicated file, listed or not — the sum of the counts
   *  above, including the tail this face does not name. A cross-file finding is
   *  ONE finding and TWO rows here, because it is two files somebody has to
   *  open, which is what this number is a size of. */
  readonly total: number
}

/**
 * THE ONE FACE CONSTRUCTOR, off the per-file entries a SET carries.
 *
 * Nothing is re-partitioned here — the entries are what {@link blamed} filed and
 * what each broken file's own page draws — so the sentence over somebody else's
 * page and the rows on the page it names cannot come to disagree about a count.
 *
 * IT TAKES ENTRIES AND NOT A VERDICT, and there is deliberately no second
 * constructor that takes one. There was: `summary(verdict, n)` was
 * `summaryOf(blamed(verdict.findings), n)` spelled as an export, which is two
 * ways to build one shape and hides the step that matters — a verdict becomes
 * per-file ENTRIES first, and everything downstream of that is per file. The
 * one caller that starts from a verdict (a directory that could not be read,
 * which arrives on the errors channel with no set to carry it) composes the two
 * at its own call site, where the composition reads as the sentence it is.
 *
 * `total` is the sum of the entries' rows rather than a count of findings, and
 * the difference is a cross-file finding: it breaks two files, so it is one
 * finding and two rows to the directory a reader has to go and fix.
 */
export const summaryOf = (broken: ReadonlyArray<BrokenFile>, n: number): Summary => {
  const faces = broken.map((entry): FileFace => ({
    file: entry.file,
    state: stateOf(entry.errors),
    count: entry.errors.length,
  }))
  const clamp = Math.max(0, n)
  return {
    files: faces.slice(0, clamp),
    more: Math.max(0, faces.length - clamp),
    total: faces.reduce((sum, face) => sum + face.count, 0),
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
// ── what a load does with a finding ─────────────────────────────────────

/**
 * THE REPORT, FILED UNDER THE FILES IT BREAKS — in path order, each entry
 * carrying its own rows in the order the report holds them.
 *
 * This is what a load does with a finding, and it replaced a table (see this
 * module's header for the shelf that stood here and the ruling that took it
 * down). Every finding is per file now, so what a validation OWES its caller is
 * not "does this refuse" but "which files does this take off the screen" — and
 * that is a partition of the report rather than a policy over it.
 *
 * WHICH FILES ONE FINDING BREAKS is the file it was found in, plus every
 * related site that did not say otherwise — the FILED-ON plane of
 * `./errors.ts`'s two, where the ABOUT plane ({@link implicatedBy}) reaches
 * every named site unfiltered and stays that way for the readers whose
 * question really is "which files is this finding about at all" (the drift
 * check `@olai/ops` pays at a refusal is the one that needs the judge).
 *
 * A finding whose second site SHARES THE FAULT breaks both, and that is most
 * of them: two files that both claim `boxes` are two files nobody can draw the
 * second of, and a cycle that closes through three is three. "Which file is
 * broken" has no single answer there (`./errors.ts`'s `isCrossFile`) — blaming
 * one end would put a page on screen whose records the validator has just
 * refused, and picking WHICH end is the guess the report itself declines to
 * make. So both ends go dark, both carry the same row, and the reader reaches
 * the fix from wherever they were standing.
 *
 * A finding whose second site is NAMED AND NOT AT FAULT breaks one, and there
 * are two shapes of it: the judgement's ground (`bad-prop`'s declaration —
 * the judge is named so the fixer knows who said no) and the thing a broken
 * record REACHED AT (`foreign-parent`'s parent — the file that declares it
 * did nothing but be pointed at, and the edit that fixes the finding is in
 * the file holding the `parent`). Darkening those was
 * `broken-file-blocks-healthy-writes` re-entering through the blame axis: a
 * file that is nobody's fault went errors-only and stopped accepting writes.
 * The rule that makes the finding is what knows which kind of site it just
 * named, and says so on the site ({@link ./errors.ts}'s `Related.broken`) —
 * one axis over the rows every reader already draws, rather than a per-code
 * table beside them that can come to disagree with what the rows say.
 *
 * A WITHHELD FINDING BREAKS NOTHING, and it is what closes the cold-boot
 * incident. This is asked of the REPORT (`./rules.ts`'s `reportOf`) and not of
 * the raw findings, so a rule that could not decide because some file did not
 * parse has already been taken out of it: two `see` edges into a file whose
 * lines are mid-edit are a GUESS about ids that may well be in there, and a
 * guess may not darken the healthy page that holds the edge. What the reader
 * gets instead is the dangling face the derivation already draws — which is the
 * ruling's own answer to what an edge into a broken file resolves to, arrived
 * at by not inventing a finding rather than by teaching the renderer a case.
 */
export const blamed = (
  report: ReadonlyArray<OutlineError>,
): ReadonlyArray<BrokenFile> => {
  const files = new Map<string, Array<OutlineError>>()
  for (const finding of report) {
    // The site it was FILED ON, always. The related sites, USUALLY — the
    // exception is the one the two-plane ruling draws: a site the finding
    // NAMES but does not break, which is the ground it was judged on
    // (`bad-prop`'s declaration) or the thing it reached at
    // (`foreign-parent`'s parent). Pulling THOSE files' pages dark would be
    // the broken-file-blocks-healthy-writes sentence said through the
    // loader's mouth instead of the gate's. A duplicate's other claim and a
    // cycle's steps say nothing and are the common case: every named site
    // breaks.
    //
    // `.some` and not `.find`'s first answer: one file named twice — once as
    // ground, once as broken — is dark, whichever order the rows came in.
    const darkened = implicatedBy(finding).filter((file) =>
      file === finding.file ||
      (finding.related ?? []).some((one) => one.file === file && one.broken !== false)
    )
    for (const file of darkened) {
      const rows = files.get(file)
      if (rows === undefined) files.set(file, [finding])
      else rows.push(finding)
    }
  }
  return [...files.keys()].sort(byPath).map((file) => ({
    file,
    errors: files.get(file) as ReadonlyArray<OutlineError>,
  }))
}
