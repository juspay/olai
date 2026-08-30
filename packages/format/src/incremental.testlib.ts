/**
 * THE DIFFERENTIAL: one verdict, two ways of reaching it, replayed over
 * sequences of edits.
 *
 * `./incremental.ts` narrows the validator to what an edit touched, and the
 * claim it makes is an equivalence — so what holds it is a differential and not
 * a table of expectations. This module replays a SEQUENCE of revisions through
 * the real `validate`, exactly as the store drives it, and asks the SAME
 * function for the other answer. A case asserts an empty divergence list plus
 * enough counting to say the run was not vacuous.
 *
 * ## BOTH ARMS ARE `validate`, WHICH IS WHAT THE FLIP LEFT
 *
 * The narrowed verdict is the product's now (`./validate.ts`), so there is no
 * shadow running beside it to compare against and no divergence to log. What
 * replaced it is the one door this harness always drove:
 *
 *   - `validate(set, previous)` is the write, exactly as the store's codec
 *     makes it — the narrowed arm, whenever there is a reading to follow and a
 *     view that was really patched from it;
 *   - `validate(set)` with nothing to follow is the whole-corpus arm BY
 *     CONSTRUCTION — the six rules over every record, which is what a boot
 *     runs and what every validation ran before #383.
 *
 * So the equivalence is now stated in the product's own vocabulary: THE
 * VALIDATOR HANDED A PREVIOUS READING ANSWERS WHAT THE VALIDATOR HANDED
 * NOTHING ANSWERS, over the same set — and the comparison is of the REPORTS,
 * which is what a reader would have been shown, error scope and presentation
 * order and all. That is a sharper claim than the shadow's, because the second
 * arm is reached through the same door as the first rather than through a
 * function only the shadow called.
 *
 * WHAT THE COUNTERS ARE FOR is that half of it can be vacuous. A revision the
 * narrowing DECLINED runs the whole-corpus arm on both sides — the full
 * validator agreeing with itself — so a replay has to say how many revisions
 * really narrowed and which doors the rest went through
 * ({@link ./validate.ts}'s `Reached`, which is the one channel that can tell
 * them apart).
 *
 * THREE OF THE FIVE CLASSES THE SHADOW WATCHED FOR are the report comparison
 * below: a set accepted by one arm and refused by the other (`verdict`), a
 * finding one had and the other did not (`findings`), and the same findings in
 * a different order (`order`). The fourth, a carried `.md` list the walk does
 * not agree with, is checked directly — {@link ./validate.ts}'s `ledgerOf`
 * against both arms' views — and is a DOOR in the product besides
 * (`carriedDocuments` declines rather than answering). The fifth was the
 * narrowed arm THROWING, which the shadow caught and logged; nothing catches it
 * now, so it arrives here as a replay that raises and a suite that fails.
 *
 * A SEQUENCE and not a pair, which is the whole shape of it. The narrowing
 * rests on the reading a validation FOLLOWS, so nearly everything that can go
 * wrong with it goes wrong across three revisions rather than two: a ledger
 * carried past a refusal, a `.md` list that drifts one file at a time, an id
 * that leaves in one revision and comes back in the next, a delta spanning
 * several probes because the codec refused what one of them found. The store's
 * own discipline is reproduced here rather than approximated — `previous` is
 * the last reading anybody PUBLISHED, and the delta spans everything that has
 * moved since it, which is what {@link ../../store/src/codec.ts}'s `Since`
 * promises and why it keeps its lists rather than clearing them on a refusal.
 *
 * A REVISION IS A DIRECTORY, spelled the way `./scope.testlib.ts` spells one —
 * path to bytes, `.olai` and `.md` and `.html` alike, decoded through the same
 * door a load goes through ({@link decodedVault}). That is what lets the same
 * replay take a generated corpus and take THE REAL VAULT, pinned, and
 * it is why nothing here builds an `OutlineSet` by hand: a differential judged
 * against a set no load could produce proves something about itself.
 *
 * WHAT IT DOES NOT DO is decide what a verdict should be. That is
 * `./validate.test.ts`'s, against fixtures small enough to write down. This
 * module holds two implementations to one answer and has no opinion about what
 * the answer is.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`. {@link differing} is the exception it
 * EXPORTS for one: a differential whose comparator cannot see a difference is a
 * green suite that means nothing, so the comparator is a function of two lists
 * and `./incremental.test.ts` hands it differences directly.
 */

import { Result } from "effect"

import type { Document } from "./document.ts"
import { errorLine } from "./errors.ts"
import { type Verdict, verdictOf } from "./verdict.ts"

import { type Corpus, corpusOf, editOf, FILES, pick } from "./corpora.testlib.ts"
import { fileKind } from "./kinds.ts"
import { byPath } from "./paths.ts"
import { decodedVault } from "./scope.testlib.ts"
import { assemble, findingsIn, nodesIn } from "./set.ts"
import { baseOf, type PropDeclarations } from "./typing.ts"

import type { Cold, Reached, Reading } from "./validate.ts"
import { ledgerOf, validate, watching } from "./validate.ts"

/** One revision of the served directory: every path it holds and the bytes at
 *  it. The shape {@link ./scope.testlib.ts}'s `vaultAt` reads a real directory
 *  into, so a generated corpus and a real one are the same value here. */
export type Revision = ReadonlyMap<string, string>

/**
 * WHAT THE TWO ARMS SAID, when they did not say the same thing.
 *
 * It was a log line an orchestrator read while the narrowing was a shadow; it
 * is a FAILURE MESSAGE now, and the shape survived the move because what a
 * person needs at four in the morning and what a person needs from a red suite
 * are the same thing: which way the two parted, where, and the few lines that
 * differ rather than two reports to diff by eye.
 */
export interface Divergence {
  /**
   * WHICH WAY they differed, in one word:
   *
   *   - `verdict` — one arm passed the set and the other refused it. The worst
   *     one there is: this is a write accepted or rejected differently, which
   *     is the product's behaviour and not its wording;
   *   - `findings` — both refused, but not with the same findings;
   *   - `order` — the same findings, in a different order. Real, because the
   *     order is what a reader reads down and what two loads of one directory
   *     promise each other;
   *   - `ledger` — the two arms agreed about this set, and the narrowed one is
   *     carrying a `.md` list or a property vocabulary that the walk does not
   *     agree with. It has not produced a wrong finding YET and it will, and
   *     the next revision is where it would.
   */
  readonly why: "verdict" | "findings" | "order" | "ledger"
  /** WHICH REVISION of the replay, counting from one — where the shadow's entry
   *  carried a wall-clock instant, because the thing reading it was a person
   *  with a commit log rather than a suite with a sequence. */
  readonly revision: number
  /** The files the delta named — where to start looking. */
  readonly touched: ReadonlyArray<string>
  /** Whether each arm accepted the set. */
  readonly accepted: { readonly full: boolean; readonly incremental: boolean }
  /** How many findings each arm reported. The SIZE of the two reports, which is
   *  what the lists below no longer carry. */
  readonly counts: { readonly full: number; readonly incremental: number }
  /** Said by the full arm and not by the narrowed one — the findings the
   *  narrowing LOST. Under `ledger`, the entries the walk holds and the carry
   *  does not. Capped at {@link SAID}. */
  readonly missing: ReadonlyArray<string>
  /** Said by the narrowed arm and not by the full one — the findings the
   *  narrowing INVENTED. Under `ledger`, the entries the carry holds and the
   *  walk does not. Capped at {@link SAID}. */
  readonly invented: ReadonlyArray<string>
  /** How many lines the lists above dropped to stay under their caps. A number
   *  rather than a truncation nobody can see: an entry that says "twenty
   *  findings, and here are the first ten" is one a reader can act on, and one
   *  silently holding ten of twenty is one they cannot. */
  readonly elided: number
  /** WHERE the two reports part company, for the `order` case — the first index
   *  at which they differ and the line each arm has there. That case has
   *  nothing in `missing` or `invented` by definition (the findings are the
   *  same findings), and carrying BOTH reports whole is, on a badly broken
   *  directory, an assertion message the size of the report. */
  readonly parted?: {
    readonly at: number
    readonly full: string
    readonly incremental: string
  }
}

/**
 * How many lines of any one list an entry carries.
 *
 * A divergence is supposed to be impossible, so an entry is written to be READ
 * rather than to be complete: the first few findings and a count is what
 * somebody acts on. What is never capped is the COUNT —
 * {@link Divergence.counts} and {@link Divergence.elided} say how much was left
 * out, so the entry cannot read as smaller than it was.
 */
const SAID = 12

/** What a replay found. An equality to the empty list is the gate; every other
 *  field is a claim that the gate was asked anything at all. */
export interface Report {
  /** The whole point. */
  readonly divergences: ReadonlyArray<Divergence>
  /** Revisions the narrowing ANSWERED — the ones where the differential
   *  compared two different pieces of code. */
  readonly narrowed: number
  /** Revisions where the narrowing declined and the whole-corpus arm answered,
   *  and WHICH door each of them went through ({@link ./validate.ts}'s
   *  `Reached.why`). A count on its own is a floor a run can meet without
   *  having reached any particular kind — a suite asserting `whole > 60` over
   *  sixty first-loads would be asserting that a boot boots. */
  readonly whole: number
  readonly declined: Readonly<Record<string, number>>
  /** Narrowed revisions that had to walk the corpus ANYWAY, because the graph
   *  moved or a `.md` went away. The number the flip is worth arguing over, and
   *  a floor AND a ceiling here: all of them means the narrowing narrows
   *  nothing, none of them means the corpora never reparented anything. */
  readonly walked: number
  /**
   * Revisions the validator found something in — the ones whose published set
   * WITHHELD at least one file.
   *
   * A floor, and it is the floor `accepted` / `refused` used to be. Those two
   * counted a distinction that no longer exists: since the per-file ruling a
   * validation answers with a directory whatever it finds, so every revision is
   * accepted and none is refused. What is worth counting is whether the corpora
   * reach the DEGRADED shape at all — a stream this never fires on is a stream
   * that only ever tested a healthy vault.
   */
  readonly degraded: number
  /** Revisions whose set held a file that would not PARSE — where a finding is
   *  withheld rather than reported, which is the one case a broken file's rows
   *  come from the decoder rather than from the rules. */
  readonly unreadable: number
  readonly revisions: number
}

/**
 * Replay a sequence of revisions through the real validator, twice per
 * revision, and say where the two arms parted.
 *
 * The watcher is installed for the length of the replay and taken off in a
 * `finally`: a suite that left one behind would go on pushing into a dead
 * array from the next file's validations, and one that threw mid-replay would
 * leave it installed for the rest of the process.
 *
 * THE NARROWED ARM RUNS FIRST and it is the one that drives the sequence: what
 * it accepts is what gets published and followed, so the stream this harness
 * replays is the stream the store would have produced. The whole-corpus arm is
 * asked afterwards and its answer is thrown away — it decides nothing here,
 * which is the shadow's relationship to the product turned exactly around.
 */
export const replay = (revisions: Iterable<Revision>): Report => {
  const reached: Array<Reached> = []
  const divergences: Array<Divergence> = []
  // WHAT THE VALIDATION IN FRONT OF US DID — drained after each call rather
  // than accumulated, because there are TWO calls per revision and only the
  // first one is a fact about the narrowing. The second is `validate(set)`,
  // whose account is `first` every time by construction; counting it would put
  // one whole-corpus run per revision into the floors below and make the
  // `first` door a number about this harness.
  const account: Array<Reached> = []
  let degraded = 0
  let unreadable = 0
  let many = 0
  watching((one) => {
    account.push(one)
  })
  try {
    // THE DECODE CACHE, which is the probe's and is not an optimisation here.
    // A file nobody edited has to decode to THE SAME RECORD OBJECTS revision
    // after revision, because the identity check a patched view is taken on
    // compares the records themselves (`./validate.ts`'s `isSet`) — a harness
    // that re-parsed the whole directory every revision would hand the
    // validator a set whose every record is a new object, and every single
    // validation would rebuild. Which is exactly what this file did for its
    // first hour, and the counters said so.
    const decoded = new Map<string, Result.Result<Document, Verdict>>()
    let held: Revision = new Map()
    let published: Reading | null = null
    // What has moved since the last PUBLISHED revision, which is more than one
    // edit whenever the codec refused what a revision found — the store keeps
    // these rather than clearing them ({@link ../../store/src/codec.ts}'s
    // `Since`).
    //
    // A PATH LANDS IN EXACTLY ONE OF THE TWO, which is the store's own rule and
    // is reproduced here rather than approximated (`@olai/store`'s `absorb`): a
    // file deleted and put back is CHANGED, and one edited and then deleted is
    // REMOVED. The one way a path reaches both lists is the write gate naming
    // its own files beside what a probe already owed — deleted out of band,
    // written back by this commit — where the change is the later word, which is
    // why every reader applies the removals first. Two accumulating sets that
    // did not clear each other put a deleted `.md` in both lists with the
    // DELETION last, and the incremental validator's carried document list read
    // that as "removed, then back", which is the one divergence this harness
    // reported before it was itself corrected.
    const changed = new Set<string>()
    const removed = new Set<string>()
    for (const revision of revisions) {
      many++
      for (const file of held.keys()) {
        if (!revision.has(file)) {
          decoded.delete(file)
          removed.add(file)
          changed.delete(file)
        }
      }
      const moved = new Map<string, string>()
      for (const [file, text] of revision) {
        if (held.get(file) !== text) moved.set(file, text)
      }
      for (const [file, one] of decodedVault(moved)) {
        decoded.set(file, one)
        changed.add(file)
        removed.delete(file)
      }
      held = revision
      const set = assemble(decoded)
      if (set.broken.length > 0) unreadable++
      const touched = [...changed, ...removed]
      const verdict = validate(
        set,
        published === null ? undefined : {
          read: published,
          delta: {
            upserts: [...changed].map(
              (file) => [file, { nodes: nodesIn(decoded.get(file)) }] as const,
            ),
            removes: [...removed],
          },
        },
      )
      reached.push(...account.splice(0))
      // THE OTHER ARM, over the SAME set and with nothing to follow, which is
      // the whole-corpus validator by construction. Its view is its own — a
      // second derivation of the same records — and that is the point: it
      // shares no index, no ledger and no carry with the arm above, so an
      // agreement between them is an agreement between two readings of the
      // directory rather than two readings of one table.
      const whole = validate(set)
      account.length = 0
      const found = parting(many, touched, whole, verdict)
      if (found !== null) divergences.push(found)
      // A VALIDATION CANNOT REFUSE, so this arm cannot be taken and the
      // accumulation above always clears — which is the store's own discipline
      // read forwards: the snapshot moves on every revision now, so the delta a
      // validation follows never spans more than one probe. The failure arm is
      // still written because the type has one, and because a codec that DID
      // refuse would have to keep the two sets exactly this way.
      if (Result.isFailure(verdict)) continue
      if (verdict.success.set.broken.length > 0) degraded++
      published = verdict.success
      changed.clear()
      removed.clear()
    }
  } finally {
    watching(null)
  }
  return {
    divergences,
    narrowed: reached.filter((one) => one.kind === "narrowed").length,
    whole: reached.filter((one) => one.kind === "whole").length,
    declined: reached.reduce<Record<string, number>>((held, one) => {
      if (one.kind !== "whole") return held
      const why: Cold | "unsaid" = one.why ?? "unsaid"
      return { ...held, [why]: (held[why] ?? 0) + 1 }
    }, {}),
    walked: reached.filter((one) => one.walked === true).length,
    degraded,
    unreadable,
    revisions: many,
  }
}

/**
 * The two verdicts compared as REPORTS — what a reader would have been shown,
 * error scope and presentation order and all — and then the LEDGERS behind
 * them.
 *
 * The verdict first and the CARRY second, which is the order they matter in and
 * not the order they happen in: a wrong ledger that has not yet produced a
 * wrong finding is worth an entry, and it must not be the entry that hides one
 * that has.
 */
const parting = (
  revision: number,
  touched: ReadonlyArray<string>,
  whole: Result.Result<Reading, Verdict>,
  narrowed: Result.Result<Reading, Verdict>,
): Divergence | null => {
  const full = linesOf(whole)
  const said = linesOf(narrowed)
  const accepted = { full: Result.isSuccess(whole), incremental: Result.isSuccess(narrowed) }
  const counts = { full: full.length, incremental: said.length }
  const found = differing(full, said, accepted) ?? carried(whole, narrowed)
  return found === null ? null : raise(revision, touched, { ...found, accepted, counts })
}

/**
 * One verdict as the lines a reader reads down.
 *
 * OFF THE SET, since the per-file ruling, and that is a comparison this file
 * gained rather than lost. A validation answers with a directory whatever it
 * finds, and the report rides on the files it broke — so `findingsIn` reads it
 * back, and the two arms are now held to the same report on EVERY revision
 * instead of only on the ones a set was refused on. The failure arm is kept
 * because the type has one; nothing this harness drives can reach it.
 */
const linesOf = (verdict: Result.Result<Reading, Verdict>): ReadonlyArray<string> =>
  Result.isFailure(verdict)
    ? verdict.failure.findings.map(errorLine)
    : findingsIn(verdict.success.set).map(errorLine)

/** What a comparison decided, before {@link raise} stamps the revision and the
 *  place on it. */
type Told = Pick<Divergence, "why" | "missing" | "invented" | "parted">

/**
 * HOW TWO REPORTS DIFFER, or `null` when they do not — the whole of the
 * comparison, as a function of two lists of lines.
 *
 * Its own function, and exported, because it is the one thing here that has to
 * be tested directly rather than through a corpus (`./incremental.test.ts`): a
 * differential whose comparator cannot see a difference is a green suite that
 * means nothing, and reaching each of these three answers by writing a
 * validator that is wrong in exactly one way is a lot of machinery to prove
 * something about eight lines.
 */
export const differing = (
  full: ReadonlyArray<string>,
  said: ReadonlyArray<string>,
  accepted: Divergence["accepted"],
): Told | null => {
  const missing = held(full, said)
  const invented = held(said, full)
  if (accepted.full !== accepted.incremental) return { why: "verdict", missing, invented }
  if (missing.length > 0 || invented.length > 0) return { why: "findings", missing, invented }
  // THE SAME FINDINGS IN A DIFFERENT ORDER, and what the entry carries is WHERE
  // rather than both reports whole: the lists above are empty by definition
  // here, so the first index the two part at — with the line each arm has there
  // — is the entirety of what a reader could act on.
  const at = full.findIndex((line, which) => line !== said[which])
  return at === -1 ? null : {
    why: "order",
    missing: [],
    invented: [],
    parted: { at, full: full[at] ?? "", incremental: said[at] ?? "" },
  }
}

/**
 * Whether the two arms are carrying the same LEDGER — the `.md` paths and the
 * property vocabulary each of them reached its verdict against
 * ({@link ./incremental.ts}'s `Ledger`).
 *
 * The class the shadow called `ledger`, and the reason it is still asked when
 * the reports already agree: the carry is what the NEXT validation narrows
 * from, so a carry that has drifted is a wrong finding one revision from now
 * and a report comparison today cannot see it. Both halves are read back out
 * of the validator's own table ({@link ./validate.ts}'s `ledgerOf`), which is
 * the only door onto it and is exported for this.
 *
 * ONLY WHERE THERE ARE TWO LEDGERS TO COMPARE. A refused set is one nothing
 * follows, so the entry it leaves is one no narrowing will ever read, and the
 * arms' views are not in hand here anyway.
 */
const carried = (
  whole: Result.Result<Reading, Verdict>,
  narrowed: Result.Result<Reading, Verdict>,
): Told | null => {
  if (Result.isFailure(whole) || Result.isFailure(narrowed)) return null
  const walked = ledgerOf(whole.success.derived)
  const said = ledgerOf(narrowed.success.derived)
  if (walked === undefined || said === undefined) return null
  const missing = [
    ...held([...walked.known], [...said.known]),
    ...held(typings(walked.typing), typings(said.typing)),
  ]
  const invented = [
    ...held([...said.known], [...walked.known]),
    ...held(typings(said.typing), typings(walked.typing)),
  ]
  return missing.length === 0 && invented.length === 0
    ? null
    : { why: "ledger", missing, invented }
}

/**
 * A vocabulary as lines, one per key — the four fields `sameTyping` compares
 * and no others ({@link ./typing.ts} argues each: the kind, a `ref`'s roster,
 * where a path resolves from, and WHERE the key was declared, since a `ref`
 * with no `under` takes its variants from the declaring node's own children).
 *
 * Lines rather than a predicate so that the two vocabularies diff the way the
 * two reports do, through {@link held}, and an entry names the key AND what
 * each arm said about it.
 */
const typings = (said: PropDeclarations): ReadonlyArray<string> =>
  [...said].map(([key, declared]) => {
    const under = declared.type.kind === "ref" ? declared.type.under ?? "" : ""
    return `${key}=${declared.type.kind}${under === "" ? "" : ` under ${under}`}` +
      ` base ${baseOf(declared)} at ${declared.at}`
  }).sort()

/** The lines of one report that the other does not hold, counting REPEATS: a
 *  rule that said the same sentence twice where the other said it once is a
 *  divergence, and a plain set difference would call the two lists equal. */
const held = (
  said: ReadonlyArray<string>,
  against: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const left = new Map<string, number>()
  for (const line of against) left.set(line, (left.get(line) ?? 0) + 1)
  const only: Array<string> = []
  for (const line of said) {
    const many = left.get(line) ?? 0
    if (many === 0) only.push(line)
    else left.set(line, many - 1)
  }
  return only
}

/**
 * The entry, stamped with the revision and CUT TO SIZE.
 *
 * Every list an entry carries is capped here rather than at each of the places
 * one is built, and what was dropped is counted rather than quietly missing
 * ({@link SAID} argues both). `touched` is capped for the same reason the
 * findings are: a revision that rewrote a directory names every file in it, and
 * the entry a failing suite prints should say "these, and four hundred more"
 * rather than four hundred paths.
 */
const raise = (
  revision: number,
  touched: ReadonlyArray<string>,
  found: Told & Pick<Divergence, "accepted" | "counts">,
): Divergence => {
  const missing = found.missing.slice(0, SAID)
  const invented = found.invented.slice(0, SAID)
  return {
    why: found.why,
    revision,
    touched: touched.slice(0, SAID),
    accepted: found.accepted,
    counts: found.counts,
    missing,
    invented,
    elided: (touched.length - touched.slice(0, SAID).length) +
      (found.missing.length - missing.length) +
      (found.invented.length - invented.length),
    ...(found.parted === undefined ? {} : { parted: found.parted }),
  }
}

// ── the generated stream ───────────────────────────────────────────────

/**
 * The `.md` and `.html` files a generated directory can hold.
 *
 * ONE OF THEM LIVES IN A DIRECTORY NAMED AFTER AN OUTLINE BESIDE IT
 * (`a/notes.md`, next to `a.olai` and `a/inner.olai`), because `doc` is
 * resolved against the outline's OWN directory and the two readings of a
 * relative path only part company there. The `.html` is in the list for the
 * narrowing the `doc` rule makes that a plain membership test would not: the
 * set holds it, and a `doc` may not point at it.
 */
const DOCUMENTS = [
  "notes.md",
  "a/notes.md",
  "deep/notes.md",
  "_olai/notes.md",
  "page.html",
] as const

/**
 * What a record's `doc` says, drawn from its ID rather than from the stream.
 *
 * DETERMINISTIC PER RECORD, which is the whole reason this is a decoration and
 * not another arm of the generator: a file nobody edited has to come out byte
 * for byte identical every revision, or every revision would be a delta naming
 * every file and the narrowing would never be handed the case it exists for.
 *
 * TWO TARGETS, and both of them RESOLVE when the document pool holds the file:
 * one from every outline, one only from an outline in a subdirectory. A target
 * that could never resolve — `missing.md`, or a `doc` naming an outline or the
 * `.html` — would refuse the set for as long as the record lived, and a stream
 * that is refused forever never publishes a reading for the next validation to
 * follow. Those three are in the hand-written corners instead, where a
 * permanent refusal is the point rather than the end of the run.
 */
const DOC_TARGETS = ["notes.md", "../notes.md"] as const

/** A small stable hash of an id — enough to spread a pool of two dozen names
 *  over a handful of choices without a second random stream to keep in step. */
const spread = (id: string): number => {
  let held = 0
  for (let at = 0; at < id.length; at++) held = (held * 31 + id.charCodeAt(at)) % 1009
  return held
}

/** The one line that makes a file unparsable, appended so that everything above
 *  it is still the file the last revision held — which is what a person editing
 *  an outline in a text editor actually produces. */
const NOT_JSON = "\n{not json"

/** Where a record is in the corpus, and whether it is a placement — what
 *  {@link written} needs about every id the directory declares. */
interface Claim {
  readonly file: string
  readonly at: number
  readonly mirror: boolean
}

/** Every id the raw corpus declares, with its place — first claim wins, which
 *  is the rule `byId` keeps and therefore the one a repair has to keep too. */
const claimsIn = (files: Corpus): ReadonlyMap<string, Claim> => {
  const claims = new Map<string, Claim>()
  let at = 0
  for (const file of [...Object.keys(files)].sort(byPath)) {
    for (const line of (files[file] ?? "").split("\n").filter((one) => one !== "")) {
      const record = JSON.parse(line) as Record<string, unknown>
      const id = String(record["id"])
      at++
      if (!claims.has(id)) claims.set(id, { file, at, mirror: "mirror" in record })
    }
  }
  return claims
}

/**
 * ONE FILE, REPAIRED AGAINST THE DIRECTORY IT IS JOINING — the whole of what
 * this harness adds to `./corpora.testlib.ts`'s corpora, and the reason it has
 * to.
 *
 * That generator writes the AWKWARD sets on purpose, because `derive` answers
 * over sets the validator has condemned and the patcher has to agree with it
 * there. This differential cannot use them as they are, and the reason is the
 * store's own rule rather than a convenience: a set with a finding in it is
 * never published, so a stream of sets that are always refused never gives the
 * next validation a reading to follow — the narrowing would decline on every
 * revision, every assertion below would pass, and the run would prove nothing.
 * Measured before this existed: ten narrowed runs in fifteen hundred revisions.
 *
 * So a file is repaired AS IT IS WRITTEN, deterministically and from the raw
 * corpus alone, which keeps the one property the whole harness rests on: a file
 * nobody edited is not rewritten, so its text and its record objects are the
 * ones the last revision held.
 *
 *   - a record whose id an EARLIER record already claims is dropped, because a
 *     duplicate is the corner the patcher declines on and this stream would
 *     spend most of its revisions there ({@link CORNERS} covers it deliberately
 *     instead);
 *   - `parent` is pointed at an EARLIER record in the SAME file that is not a
 *     placement, or dropped — same-file is the format's rule and earlier is
 *     what makes a parent loop impossible to write by accident;
 *   - `mirror` is pointed at a declared node in ANOTHER file where there is
 *     one, so a placement is a placement rather than a dangling chain;
 *   - `after` keeps the targets declared EARLIER in the corpus and `blocks` the
 *     ones declared LATER, which is the same arrow read from either end and
 *     makes the ordering graph a DAG by construction;
 *   - `see` keeps whatever is declared, because nothing normalises it into the
 *     ordering graph and a loop of them is not a loop;
 *   - `doc` is attached to a twelfth of the records ({@link DOC_TARGETS}).
 *
 * WHAT IT DOES NOT REPAIR is where the refusals come from, and they are the
 * ones a directory really produces: a target another file DELETES later, a
 * `doc` whose `.md` is removed from the pool, a file that stops parsing. Every
 * one of those is another file moving under a record nobody edited — which is
 * the very shape the narrowing has to get right.
 *
 * SO THE REFUSAL COUNT IS NOT A COVERAGE FIGURE, and nobody may quote it as
 * one. What this stream refuses is `unknown-target`, `missing-doc` and the
 * unreadable file, over and over and at size. What it CANNOT refuse is
 * everything the repair takes out: a parent loop, a foreign parent, a parent
 * that is a placement, a mirror inside its own subtree, an ordering loop in
 * either spelling, a duplicate id. Those live in `./incremental.test.ts`'s
 * hand-written corners, one apiece, and the duplicate is not even a narrowed
 * refusal — it is a DECLINE, which is the right answer and is therefore no
 * differential of the duplicate rule at all.
 */
const written = (
  text: string,
  file: string,
  claims: ReadonlyMap<string, Claim>,
): string => {
  const own: Array<string> = []
  return text
    .split("\n")
    .filter((line) => line !== "")
    .flatMap((line) => {
      const record = JSON.parse(line) as Record<string, unknown>
      const id = String(record["id"])
      const claim = claims.get(id)
      if (claim === undefined || claim.file !== file || own.includes(id)) return []
      own.push(id)
      const written: Record<string, unknown> = { ...record }
      if ("mirror" in written) {
        const target = [...claims].find(([, one]) => !one.mirror && one.file !== file)
        if (target !== undefined) written["mirror"] = target[0]
      } else {
        for (const [field, keep] of [
          ["after", (one: Claim) => one.at < claim.at],
          ["blocks", (one: Claim) => one.at > claim.at],
          ["see", () => true],
        ] as const) {
          const targets = written[field]
          if (!Array.isArray(targets)) continue
          const held = targets.filter((target) => {
            const one = claims.get(String(target))
            return one !== undefined && keep(one)
          })
          if (held.length === 0) delete written[field]
          else written[field] = held
        }
        if (spread(id) % 12 === 0) {
          written["doc"] = DOC_TARGETS[spread(id) % DOC_TARGETS.length]
        }
      }
      const parent = written["parent"]
      if (parent !== undefined) {
        const above = own
          .slice(0, -1)
          .filter((one) => claims.get(one)?.mirror === false)
        const held = above[spread(String(parent)) % Math.max(above.length, 1)]
        if (held === undefined) delete written["parent"]
        else written["parent"] = held
      }
      return [JSON.stringify(written)]
    })
    .join("\n")
}

/**
 * A sequence of revisions: a generated directory of outlines, edited over and
 * over, with the documents beside it churning and a file breaking and mending.
 *
 * The outline half is `./corpora.testlib.ts`'s, unchanged and drawn in its own
 * order — the same corpora and the same edits the patcher is held to, put
 * through {@link written} as each file is emitted. What is added here is
 * everything the patcher has no reason to know about and the validator does:
 * the `.md` files a `doc` resolves against, an `.html` it may not, and a file
 * whose lines stop parsing and start again.
 */
export const revisionsOf = (
  random: () => number,
  many: number,
): ReadonlyArray<Revision> => {
  const { files: first, used } = corpusOf(random)
  let raw: Corpus = first
  const held = new Map<string, string>()
  // Three of the five to begin with, so the stream has documents to LOSE as
  // well as gain — losing one is the arm where the `doc` rule falls back to the
  // corpus, and a directory that only ever gained files would never reach it.
  const documents = new Map<string, string>(
    DOCUMENTS.slice(0, 3).map((file) => [file, `# ${file}`]),
  )
  let broken: string | null = null
  const stream: Array<Revision> = []
  for (let at = 0; at < many; at++) {
    const before = raw
    raw = at === 0 ? raw : editOf(random, raw, used)
    const claims = claimsIn(raw)
    for (const file of held.keys()) if (!(file in raw)) held.delete(file)
    for (const [file, text] of Object.entries(raw)) {
      // Only what the edit touched is re-emitted: a file whose raw text did not
      // move keeps the very bytes the last revision held, which is what makes
      // its records the same objects one decode later.
      if (before[file] !== text || !held.has(file)) held.set(file, written(text, file, claims))
    }
    const roll = random()
    if (roll < 0.1) {
      // A document ARRIVES. Nothing that was resolving stops resolving, which
      // is the case the narrowing declines to walk the corpus for.
      documents.set(pick(random, DOCUMENTS), `# arrived ${at}`)
    } else if (roll < 0.2) {
      // ...or GOES AWAY, which is the one that has to.
      const there = [...documents.keys()]
      if (there.length > 0) documents.delete(pick(random, there))
    } else if (roll < 0.32) {
      // ...or is REWRITTEN, which moves no membership at all and must not cost
      // a walk: the delta names the path and the set holds the paths it held.
      const there = [...documents.keys()]
      if (there.length > 0) documents.set(pick(random, there), `# rewritten ${at}`)
    }
    if (random() < 0.06) broken = broken === null ? pick(random, FILES) : null
    const revision = new Map<string, string>()
    for (const [file, text] of held) {
      revision.set(file, text + (file === broken ? NOT_JSON : ""))
    }
    for (const [file, text] of documents) revision.set(file, text)
    stream.push(revision)
  }
  return stream
}

/**
 * The same directory, edited — for a vault read off disk, which has no
 * generator behind it.
 *
 * The edits are the ones a person makes: a record retitled in place, a `.md`
 * deleted and written back, a record dropped from the end of a file. Each one
 * is a text change and nothing else, so the delta the replay computes is the
 * delta a probe would have produced — and the vault is a directory that
 * VALIDATES, which is what lets a hundred and twenty revisions of it be a
 * hundred and twenty readings for the next one to follow.
 */
export const edited = (
  vault: Revision,
  random: () => number,
  many: number,
): ReadonlyArray<Revision> => {
  // ASKED OF THE REGISTRY, never of the spelling — `packages/tests/kinds.test.ts`
  // sweeps the tree for a suffix written out anywhere but `./kinds.ts`, and it
  // is the same rule for a harness as for a rule: the day a kind grows a second
  // extension, a `.endsWith` here goes on quietly reading half the vault.
  const outlines = [...vault.keys()].filter((file) => fileKind(file) === "outline")
  const documents = [...vault.keys()].filter((file) => fileKind(file) === "document")
  let held = new Map(vault)
  const stream: Array<Revision> = [held]
  for (let at = 0; at < many; at++) {
    const next = new Map(held)
    const roll = random()
    if (roll < 0.12 && documents.length > 0) {
      // A `.md` leaves and comes back — the one edit here that can refuse the
      // set, since a node in this vault really does attach a document.
      const file = pick(random, documents)
      if (next.has(file)) next.delete(file)
      else next.set(file, vault.get(file) ?? "")
    } else if (outlines.length > 0) {
      const file = pick(random, outlines)
      const lines = (next.get(file) ?? "").split("\n").filter((line) => line !== "")
      if (lines.length > 0) {
        const which = Math.floor(random() * lines.length)
        const record = JSON.parse(lines[which] as string) as Record<string, unknown>
        // A TITLE and nothing else, which is the keystroke — the edit the whole
        // narrowing is for, and the one that must leave the graph alone.
        if (!("mirror" in record)) record["title"] = `edited ${at}`
        lines[which] = JSON.stringify(record)
        next.set(file, lines.join("\n"))
      }
    }
    held = next
    stream.push(held)
  }
  return stream
}
