/**
 * THE DIFFERENTIAL: one op corpus, two wirings, and a room full of tabs.
 *
 * `perf-streams-per-tab` changed WHO PAYS for a standing view and nothing about
 * what one says. The five readings used to be rebuilt once per subscriber per
 * published revision; they are now answered once per QUESTION per revision and
 * shared, and a revision that moved nothing an answer read does not rebuild it
 * at all ({@link ./standing.ts}). That is a claim about cost, so the test worth
 * having is the one that says the answers did not move: replay a corpus of
 * writes against both wirings, with the same subscribers watching, and hold
 * every one of them to the same sequence.
 *
 * WHAT IS KEPT HERE IS THE REBUILD ({@link ./standing.ts}'s `rebuilding`) —
 * the same five answers with none of the sharing in front of them, which is
 * what the wiring did before. It lives in the module under test rather than in
 * a copy over here, for `@olai/format`'s `scope.testlib.ts` reason one layer
 * down: a reference written out beside the harness would be a second opinion
 * about the very thing being compared. What differs between the two arms is
 * exactly the reuse.
 *
 * ## The hazards it is aimed at
 *
 * A shared answer is a REUSED VALUE, which is the family of failure #382 named
 * one layer up and proved catchable: an answer whose identity survives a
 * revision can make a subscriber's own equality check skip an update it needed,
 * and the failure is silent — the server holds the right thing, the wire was
 * told the wrong one, and nobody finds out until a tab is showing yesterday's
 * page. Three ways to get there, and the harness has to see all three:
 *
 *   - **a swallowed delta**: the pre-check says "nothing moved" when something
 *     did, so the previous answer is handed back forever ({@link deaf});
 *   - **a crossed question**: two DIFFERENT requests of one member share an
 *     answer, so the second tab is shown the first tab's page ({@link crossed});
 *   - **a stale revision**: the share is keyed on the question and not on the
 *     revision, so every tab keeps the first answer it ever got
 *     ({@link frozen}).
 *
 * Each is a wiring here, and `./standing.equivalence.test.ts` asserts that the
 * differential catches every one of them. A harness that cannot fail is not
 * evidence.
 *
 * ## The subscriber
 *
 * A tab is not a function that takes an answer. It is `@kolu/surface`'s poll
 * shape: it holds the LAST value it was given, re-reads on every published
 * revision, and sends a frame only when the answer moved by value. So the
 * subscribers here keep two transcripts — what they HELD at each revision, and
 * which revisions they FRAMED — and the differential compares both. The first
 * says the sharing never handed anybody the wrong page; the second says it
 * never swallowed a frame somebody was owed, which is the failure a comparison
 * of final states cannot see.
 *
 * ## The revisions
 *
 * Built the way the STORE builds them and not the way a fixture would, which is
 * load-bearing rather than fussy ({@link corpusOf}): each revision decodes
 * only the files that moved and hands the previous reading to the validator, so
 * the derivation is PATCHED from the one before it and carries forward every
 * value the edit did not touch (`@olai/format`'s `patch.ts`). A harness that
 * re-decoded the whole vault per revision would hand the pre-check a reading
 * with nothing carried in it, and would measure a pre-check that never fires
 * over a corpus where it always should — the honest-looking run that proves
 * nothing. It is also why `@olai/server`'s `published.testlib.ts` corpus is not
 * reused here: that one is about MEMBERSHIP and re-derives per revision, which
 * is exactly right for what it measures and exactly wrong for this.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import {
  addressOf,
  bodiedDocument,
  bodyKind,
  type BrokenFile,
  type Document,
  type MovingRequest,
  type NarrowingRequest,
  type OutlineError,
  type PageRequest,
  parseOutline,
  type Reading,
  stillHolds,
  taping,
  type Verdict,
  verdictOf,
} from "@olai/format"
import { seeded } from "@olai/format/testlib"
import { Result } from "effect"

import { codec } from "./codec.ts"
import { type Asked, rebuilding, sameAnswer, type Standing, standing } from "./standing.ts"

// ── the corpus: a vault, and a vocabulary of revisions ─────────────────

/**
 * ONE RECORD of the generated vault, as a shape rather than as bytes.
 *
 * The corpus is a MODEL that is serialised, not a pile of strings that is
 * patched: a differential about what a revision can move has to be able to move
 * a mark, a date, an edge and a membership independently, and a regex over
 * JSONL is how a corpus quietly stops writing the shape it claims to.
 */
export interface Modelled {
  readonly id: string
  title: string
  /** `null` for a plain bullet — the format's own absence, and the state the
   *  status index has no key for. */
  mark: "todo" | "doing" | "done" | null
  /** A day (`YYYY-MM-DD`), or `null` for a record on no day at all. Whole FILES
   *  are undated in this corpus and that is the point of the field: the
   *  pre-check on the calendar and on what is owed can only ever fire for a
   *  revision that filed no day, so a vault where everything is scheduled would
   *  measure it at zero and call that the answer. */
  date: string | null
  /** A `#tag` in the title, or none. */
  tag: string | null
  /** The sibling this record must come after, or none. */
  after: string | null
  /** The sibling this record STANDS FOR, or none — a placement, kept inside its
   *  own file so that dropping a file can never dangle a mirror somebody else
   *  wrote. */
  mirror: string | null
  readonly parent: string | null
}

/** One outline file, as its records in line order. */
export type Filed = Array<Modelled>

/** The whole directory: outlines by path, and the `.md` bodies beside them. */
export interface Vault {
  readonly outlines: Map<string, Filed>
  readonly documents: Map<string, string>
  /** Files whose bytes are deliberately unparseable this revision — a broken
   *  file keeps its place in the set and its errors go to `broken`, which is
   *  one of the two things a page reading is a function of. */
  readonly torn: Set<string>
}

const DAYS: ReadonlyArray<string> = Array.from({ length: 3 * 28 }, (_, at) => {
  const month = Math.floor(at / 28)
  const printed = (value: number): string => String(value).padStart(2, "0")
  return `2026-${printed(month + 1)}-${printed((at % 28) + 1)}`
})

/**
 * A vault with all five readings' subjects in it: trees, marks, days, tags,
 * ordering edges, placements, documents — and, deliberately, whole files with
 * NO days in them at all.
 *
 * Its own generator rather than `@olai/format/testlib`'s `vaultOf`, and the
 * reason is the paragraph on {@link Modelled}: that corpus is a BENCH vault
 * whose one edit is a retitle, and what this harness needs is a vocabulary of
 * revisions — a mark flipped, a day moved, an edge added, a file born — each
 * reachable on its own. It is also kept VALID by construction: every reference
 * it writes is to a sibling in the same file, so no revision here can dangle
 * one and no step has to think about it.
 */
export const vaultFor = (
  { files, records, seed = 20260825 }: {
    readonly files: number
    readonly records: number
    readonly seed?: number
  },
): Vault => {
  const outlines = new Map<string, Filed>()
  const documents = new Map<string, string>()
  for (let at = 0; at < files; at++) {
    const path = at % 5 === 0 ? `area${at % 3}/note${at}.olai` : `note${at}.olai`
    // A THIRD OF THE FILES HOLD NO DAY, which is what makes the calendar's and
    // the agenda's pre-check reachable at all.
    const dated = at % 3 !== 0
    const own: Filed = [{
      id: `f${at}r`,
      title: `file ${at}`,
      mark: null,
      date: null,
      tag: null,
      after: null,
      mirror: null,
      parent: null,
    }]
    for (let which = 0; which < records; which++) {
      own.push({
        id: `f${at}n${which}`,
        title: `record ${which} of file ${at}`,
        mark: which % 3 === 0 ? "todo" : which % 7 === 0 ? "done" : null,
        date: dated && which % 4 === 0 ? (DAYS[(at * 5 + which) % DAYS.length] as string) : null,
        tag: which % 5 === 0 ? `#topic${at % 7}` : null,
        after: which % 6 === 0 && which > 0 ? `f${at}n0` : null,
        mirror: which % 11 === 0 && which > 1 ? `f${at}n1` : null,
        parent: which % 2 === 0 ? `f${at}r` : `f${at}n${which - 1}`,
      })
    }
    outlines.set(path, own)
    if (at % 4 === 0) {
      documents.set(
        at % 8 === 0 ? `area${at % 3}/doc${at}.md` : `doc${at}.md`,
        `# document ${at}\n\nWritten once.\n`,
      )
    }
  }
  return { outlines, documents, torn: new Set() }
}

/** One record as the line the format writes for it — every field the model
 *  carries, and none it does not. A mirror has no title of its own, which is
 *  the format's rule and the reason this is a branch rather than a spread. */
const lineOf = (record: Modelled): string =>
  JSON.stringify({
    id: record.id,
    ...(record.parent === null ? {} : { parent: record.parent }),
    ord: record.id,
    ...(record.mirror === null
      ? {
        title: record.tag === null ? record.title : `${record.title} ${record.tag}`,
        ...(record.mark === null ? {} : { [record.mark]: true }),
        ...(record.date === null ? {} : { date: record.date }),
      }
      : { mirror: record.mirror }),
    ...(record.after === null ? {} : { after: [record.after] }),
  })

const textOf = (vault: Vault, path: string): string =>
  vault.torn.has(path)
    ? `{"id":"torn`
    : (vault.outlines.get(path) ?? []).map(lineOf).join("\n")

// ── the revisions ──────────────────────────────────────────────────────

/** What one revision DID, so a failing corpus reads as a sentence rather than
 *  as a diff — and the reading the store would have published for it. */
export interface Revision {
  readonly says: string
  readonly reading: Reading
}

type Decoded = Map<string, Result.Result<Document, Verdict>>

const decodeOne = (
  file: string,
  text: string,
): Result.Result<Document, Verdict> =>
  bodyKind(file) === null
    ? Result.mapError(parseOutline(file, text), verdictOf)
    : Result.succeed<Document>(bodiedDocument(file, text))

/**
 * A CORPUS OF REVISIONS, drawn from the vocabulary a directory actually has —
 * the edit made and the reading published, in one pass.
 *
 * ONE PASS AND NOT TWO, which is not a shortcut: the vault is a model that the
 * edits MUTATE, so a list of steps drawn first and replayed afterwards would
 * serialise every revision from the state the last step left. The step and the
 * publish happen together or the corpus is one directory repeated.
 *
 * Every arm is a shape one of the five answers depends on differently, which is
 * the whole design of it. A retitle moves what a page draws and not what is
 * owed; a mark moves what is owed and not what the calendar shows; a day moves
 * both of those and no page two files away; a file born moves the front page
 * and every listing. A corpus of retitles would prove the pre-check correct
 * about one kind of revision and silent about the rest.
 *
 * AND ONE ARM MOVES NOTHING: a file re-written with the bytes it already had,
 * which is a revision the store really does publish (a probe reports what it
 * re-decoded, not what differs) and the one where every pre-check in the
 * building should fire. Without it the harness would never exercise the arm the
 * whole change is about.
 *
 * ## What it copies from the store, and must
 *
 *   - only the files a step NAMED are decoded again, so every other file's
 *     records are the objects they already were. That is what makes the
 *     validator's patch take at all (`@olai/format`'s `validate.ts` compares the
 *     patched view against the set BY IDENTITY), and a patch that does not take
 *     is a derivation with nothing carried in it — over which the pre-check
 *     could never fire and this harness would measure a feature that was not
 *     running. It is also why `@olai/server`'s `published.testlib.ts` corpus is
 *     not reused here: that one is about MEMBERSHIP and re-derives per
 *     revision, which is right for what it measures and wrong for this;
 *   - the previous READING is handed over with the paths that moved, which is
 *     `@olai/store`'s `Since` exactly and what `./codec.ts` turns into a delta;
 *   - a set the validator REFUSES publishes nothing: the last good reading
 *     stands and the paths already re-decoded are still owed to the next
 *     revision that validates (`@olai/store`'s `absorb`). That is what makes the
 *     torn-file arm a real shape rather than a crash.
 *
 * SEEDED, so a divergence is a corpus a reader can re-run rather than a
 * lottery.
 */
export const corpusOf = (
  vault: Vault,
  { steps, seed = 20260825 }: { readonly steps: number; readonly seed?: number },
): ReadonlyArray<Revision> => {
  const random = seeded(seed)
  const { publish, refusals, revisions } = publishing(vault)

  const pick = <T>(of: ReadonlyArray<T>): T | undefined =>
    of.length === 0 ? undefined : of[Math.floor(random() * of.length)]
  /** A record of `path` that is safe to move — never one something points at,
   *  which is what keeps every revision here a set that validates. */
  const someRecord = (own: Filed): Modelled | undefined =>
    pick(own.filter((one) =>
      one.parent !== null && one.mirror === null &&
      own.every((other) =>
        other.parent !== one.id && other.after !== one.id && other.mirror !== one.id
      )
    ))
  let born = 0

  for (let at = 0; at < steps; at++) {
    const roll = random()
    const path = pick([...vault.outlines.keys()])
    if (path === undefined) break
    const own = vault.outlines.get(path) as Filed
    const record = someRecord(own)
    const first = own[0] as Modelled

    if (roll < 0.22 && record !== undefined) {
      record.title = `${record.title.split(" [")[0] as string} [${at}]`
      publish(`retitle in ${path}`, [path], [])
    } else if (roll < 0.34 && record !== undefined) {
      record.mark = record.mark === "done" ? "todo" : record.mark === "todo" ? "done" : "todo"
      publish(`mark in ${path}`, [path], [])
    } else if (roll < 0.44 && record !== undefined) {
      record.date = record.date === null ? (DAYS[at % DAYS.length] as string) : null
      publish(`day in ${path}`, [path], [])
    } else if (roll < 0.50 && record !== undefined) {
      record.tag = record.tag === null ? `#topic${at % 7}` : null
      publish(`tag in ${path}`, [path], [])
    } else if (roll < 0.56 && record !== undefined) {
      // ALWAYS AT THE FILE'S FIRST CHILD, and never at the record itself: a
      // star pointing at one node that has no edge of its own cannot close a
      // loop, and every other shape can. The first spelling of this arm let a
      // record point at itself, which is an `after-cycle` — a set the validator
      // refuses, so the corpus published its last good reading again and went
      // on doing so for the rest of the run. Ninety-four revisions of two
      // hundred were one directory replayed, and the differential passed every
      // one of them by comparing an answer with itself.
      const anchor = own[1] as Modelled | undefined
      record.after = record.after !== null || anchor === undefined || anchor.id === record.id
        ? null
        : anchor.id
      publish(`edge in ${path}`, [path], [])
    } else if (roll < 0.64) {
      own.push({
        id: `${first.id}b${at}`,
        title: `born at ${at}`,
        mark: "todo",
        date: at % 2 === 0 ? (DAYS[at % DAYS.length] as string) : null,
        tag: null,
        after: null,
        mirror: null,
        parent: first.id,
      })
      publish(`record born in ${path}`, [path], [])
    } else if (roll < 0.70 && own.length > 3 && record !== undefined) {
      vault.outlines.set(path, own.filter((one) => one !== record))
      publish(`record gone from ${path}`, [path], [])
    } else if (roll < 0.76) {
      // A FILE BORN, with a record on a day, so membership and the day index
      // move in one revision.
      born++
      const fresh = `born${born}.olai`
      vault.outlines.set(fresh, [
        {
          id: `b${born}r`,
          title: `born ${born}`,
          mark: null,
          date: null,
          tag: null,
          after: null,
          mirror: null,
          parent: null,
        },
        {
          id: `b${born}n0`,
          title: `first of born ${born}`,
          mark: "todo",
          date: DAYS[born % DAYS.length] as string,
          tag: "#born",
          after: null,
          mirror: null,
          parent: `b${born}r`,
        },
      ])
      publish(`file born ${fresh}`, [fresh], [])
    } else if (roll < 0.81 && vault.outlines.size > 3) {
      vault.outlines.delete(path)
      publish(`file gone ${path}`, [], [path])
    } else if (roll < 0.87) {
      // BROKEN, and mended in the step after it — both halves, so no run leaves
      // the corpus with a file nothing ever fixed.
      vault.torn.add(path)
      publish(`torn ${path}`, [path], [])
      vault.torn.delete(path)
      publish(`mended ${path}`, [path], [])
    } else if (roll < 0.92) {
      const document = pick([...vault.documents.keys()])
      if (document === undefined) publish("nothing moved", [], [])
      else {
        vault.documents.set(document, `# rewritten ${at}\n\nBody as of step ${at}.\n`)
        publish(`document ${document}`, [document], [])
      }
    } else if (roll < 0.96) {
      born++
      const fresh = `born${born}.md`
      vault.documents.set(fresh, `# born ${born}\n`)
      publish(`document born ${fresh}`, [fresh], [])
    } else {
      // A REVISION THAT MOVED NOTHING — the file is re-decoded and says exactly
      // what it said. Every pre-check in the building fires here, or the
      // feature is not working.
      publish(`re-read ${path}`, [path], [])
    }
  }
  // EVERY STEP HERE IS MEANT TO PUBLISH, so one that did not is a generator
  // that wrote a set the validator refuses — and a refusal publishes nothing,
  // which means the corpus would go on replaying its last good reading and
  // every comparison after it would be an answer held against itself. It is
  // thrown rather than reported: the run that follows would look magnificent.
  //
  // A TORN FILE IS NOT ONE OF THESE. A file that will not parse keeps its place
  // in the set and its errors go to `broken` (`@olai/format`'s `assemble`), so
  // it is a revision like any other — and it is the revision `set.broken` was
  // put in this corpus for.
  if (refusals.length > 0) {
    throw new Error(
      `the corpus wrote ${refusals.length} set(s) the validator refuses, ` +
        `so those steps published nothing: ${refusals.slice(0, 3).join("; ")}`,
    )
  }
  return revisions
}

/**
 * A DIRECTORY THAT PUBLISHES — the store's publishing loop with the disk taken
 * out, and the one place a revision is minted in this file.
 *
 * {@link corpusOf} draws its steps through it, and so does any test that wants
 * ONE named revision rather than a corpus of them: the pre-check's negative
 * space is proved over the corpus, and its individual claims — a mark moved,
 * so what is owed must be re-read — are proved by making exactly that edit and
 * asking. Both need the same publishing rules, and there is one of them.
 */
export const publishing = (vault: Vault): {
  /** The revisions so far, growing as {@link publish} is called. */
  readonly revisions: Array<Revision>
  /** The steps that produced no revision, with the validator's own word for
   *  why — see {@link publish}. A corpus that meant to move a directory and
   *  quietly stopped is the one failure a differential cannot see for itself. */
  readonly refusals: ReadonlyArray<string>
  /** One revision: the paths that moved and the paths that went. A set the
   *  validator REFUSES publishes nothing at all — no snapshot moves, so no
   *  pulse is sent and no subscriber re-reads — and the last good reading is
   *  handed back with those paths still owed to the next set that validates. */
  readonly publish: (
    says: string,
    changed: ReadonlyArray<string>,
    gone: ReadonlyArray<string>,
  ) => Reading
} => {
  const refusals: Array<string> = []
  const decoded: Decoded = new Map()
  const write = (path: string): void => {
    if (vault.outlines.has(path) || vault.torn.has(path)) {
      decoded.set(path, decodeOne(path, textOf(vault, path)))
    } else if (vault.documents.has(path)) {
      decoded.set(path, decodeOne(path, vault.documents.get(path) as string))
    } else decoded.delete(path)
  }
  for (const path of [...vault.outlines.keys(), ...vault.documents.keys()]) write(path)

  // The first revision names every file, which is what did move for a consumer
  // holding nothing.
  const first = published(decoded, undefined, [], [])
  if (Result.isFailure(first)) {
    throw new Error(
      `the harness's own vault does not validate: ${JSON.stringify(first.failure.findings.slice(0, 2))}`,
    )
  }
  let previous: Reading = first.success
  const revisions: Array<Revision> = [{
    says: "the directory as it stands",
    reading: previous,
  }]
  /** What is owed to the next revision that VALIDATES — a probe that refused
   *  still re-decoded those files. */
  let owed = { changed: new Set<string>(), removed: new Set<string>() }

  const publish = (
    says: string,
    changed: ReadonlyArray<string>,
    gone: ReadonlyArray<string>,
  ): Reading => {
    for (const path of changed) {
      owed.changed.add(path)
      owed.removed.delete(path)
      write(path)
    }
    for (const path of gone) {
      owed.removed.add(path)
      owed.changed.delete(path)
      decoded.delete(path)
    }
    const next = published(decoded, previous as Reading, [...owed.changed], [...owed.removed])
    if (Result.isFailure(next)) {
      // A REFUSED SET PUBLISHES NOTHING AT ALL, which is the store's own
      // behaviour and is why this is not a revision: no snapshot moves, so no
      // pulse is sent and no subscriber re-reads. The paths already re-decoded
      // stay owed to the next set that validates (`@olai/store`'s `absorb`),
      // which the `owed` pair above is.
      //
      // IT IS RECORDED ANYWAY, because a corpus that quietly stopped
      // validating would replay one directory for the rest of its run and
      // every comparison in the differential would be an answer against
      // itself. {@link refusalsIn} is what a suite asks, and the validator's
      // own word for it rides the sentence.
      refusals.push(`${says}: ${next.failure.findings[0]?.code ?? "?"}`)
      return previous as Reading
    }
    owed = { changed: new Set(), removed: new Set() }
    previous = next.success
    revisions.push({ says, reading: next.success })
    return next.success
  }
  return { revisions, refusals, publish }
}

/** The codec's own validation, with the store's `Since` — a FAILURE is the
 *  store holding its last good revision, and it carries the validator's own
 *  words so a corpus can say why. */
const published = (
  decoded: Decoded,
  previous: Reading | undefined,
  changed: ReadonlyArray<string>,
  removed: ReadonlyArray<string>,
): Result.Result<Reading, Verdict> =>
  codec.validate(
    decoded,
    previous === undefined ? undefined : { value: previous, changed, removed },
  )

// ── the subscribers ────────────────────────────────────────────────────

/** ONE QUESTION a tab holds open — the member, and the request. */
export type Question =
  | { readonly which: "dated"; readonly request: { readonly month: string } }
  | { readonly which: "owed"; readonly request: { readonly today: string } }
  | { readonly which: "page"; readonly request: PageRequest }
  | { readonly which: "narrowing"; readonly request: NarrowingRequest }
  | { readonly which: "moving"; readonly request: MovingRequest }

/** A TAB: the questions it has open, and a name so a divergence says which one
 *  it was. */
export interface Tab {
  readonly says: string
  readonly holds: ReadonlyArray<Question>
}

/** What one tab was handed, revision by revision — the value it HELD, and
 *  whether that revision sent it a frame. */
export interface Watched {
  readonly held: ReadonlyArray<unknown>
  readonly framed: ReadonlyArray<boolean>
}

/** One ask, through whichever wiring is being driven — the five members'
 *  signatures collapsed to one, so the replay below is written once. Exported
 *  because `./standing.bench.ts` drives the same five the same way, and a bench
 *  with a switch of its own would be a second answer to which member a question
 *  names. */
export const asking = (views: Standing, at: Reading, question: Question): unknown => {
  switch (question.which) {
    case "dated":
      return views.dated(at, question.request)
    case "owed":
      return views.owed(at, question.request)
    case "page":
      return views.page(at, question.request)
    case "narrowing":
      return views.narrowing(at, question.request)
    case "moving":
      return views.moving(at, question.request)
  }
}

/**
 * ONE WIRING, DRIVEN — every tab re-reads every question it holds on every
 * revision, in tab order, exactly as the framework's poll loops would.
 *
 * THE ORDER MATTERS AND IS THE SAME ON BOTH SIDES, which is what makes the
 * comparison meaningful: whichever tab asks a question first is the one whose
 * read pays for it, and the answers the others are handed are that one's. A
 * harness that drove the two arms in different orders would be comparing two
 * corpora.
 *
 * A tab frames a revision when the answer it was handed differs BY VALUE from
 * the one it was holding — the framework's own rule, asked with the same schema
 * equivalence the wire is given.
 *
 * IT COUNTS THE REUSE AS IT GOES, by IDENTITY and from outside. An ask handed
 * the very object another ask at this revision was already given is a SHARE;
 * one handed the object the same question was given at the revision before is a
 * CARRY. Nothing in {@link ./standing.ts} reports either — they are read off
 * the answers, which is what makes them a measurement of the wiring rather than
 * a claim it makes about itself, and what lets a test say the run was not
 * vacuous. A wiring that shared nothing would satisfy every equality below by
 * doing all the work twice.
 */
export const watching = (
  views: Standing,
  revisions: ReadonlyArray<Revision>,
  tabs: ReadonlyArray<Tab>,
): Driven => {
  const held: Array<Array<unknown>> = tabs.map((tab) => tab.holds.map(() => undefined))
  const seen: Array<Array<Array<unknown>>> = tabs.map((tab) => tab.holds.map(() => []))
  const framed: Array<Array<Array<boolean>>> = tabs.map((tab) => tab.holds.map(() => []))
  /** The answer each question was handed LAST revision, for the carry count. */
  const carriedFrom = new Map<string, unknown>()
  let shared = 0
  let carried = 0
  let asks = 0
  for (const revision of revisions) {
    /** …and this revision's, which is also what says a second asker shared. */
    const answering = new Map<string, unknown>()
    for (const [which, tab] of tabs.entries()) {
      for (const [at, question] of tab.holds.entries()) {
        const key = `${question.which} ${JSON.stringify(question.request)}`
        const answer = asking(views, revision.reading, question)
        asks++
        if (answering.has(key)) {
          if (answering.get(key) === answer) shared++
        } else {
          answering.set(key, answer)
          if (carriedFrom.get(key) === answer) carried++
        }
        const before = (held[which] as Array<unknown>)[at]
        const moved = before === undefined ||
          !sameAnswer(question.which, before, answer)
        ;(held[which] as Array<unknown>)[at] = answer
        ;((seen[which] as Array<Array<unknown>>)[at] as Array<unknown>).push(answer)
        ;((framed[which] as Array<Array<boolean>>)[at] as Array<boolean>).push(moved)
      }
    }
    for (const [key, answer] of answering) carriedFrom.set(key, answer)
  }
  return {
    tabs: tabs.map((tab, which) =>
      tab.holds.map((_, at) => ({
        held: (seen[which] as Array<Array<unknown>>)[at] as ReadonlyArray<unknown>,
        framed: (framed[which] as Array<Array<boolean>>)[at] as ReadonlyArray<boolean>,
      }))
    ),
    asks,
    shared,
    carried,
  }
}

/** One wiring, driven: what each tab saw, and how much of it was reuse. */
export interface Driven {
  readonly tabs: ReadonlyArray<ReadonlyArray<Watched>>
  readonly asks: number
  /** Asks answered with the object another ask at that revision had already
   *  been given — the SHARE, counted from outside. */
  readonly shared: number
  /** Asks answered with the object the same question held at the revision
   *  before — the pre-check and the compare-once together, which are one thing
   *  from a subscriber's side: the value did not move. */
  readonly carried: number
}

// ── the differential ───────────────────────────────────────────────────

/** What the replay found — the counts a reader checks the run itself against,
 *  and the divergences, which is the answer. */
export interface Report {
  readonly revisions: number
  readonly asks: number
  /** A tab was handed an answer that differed from the one the rebuilding arm
   *  would have given it. Each line names the tab, the question and the
   *  revision. */
  readonly divergences: ReadonlyArray<string>
  /** …and the frames: a revision one arm framed and the other did not. */
  readonly frames: ReadonlyArray<string>
  /** What each arm actually did, counted from outside ({@link watching}) — the
   *  floor a run is checked against, so a wiring that shared nothing cannot
   *  pass by doing the work twice. The rebuilding arm's two are zero by
   *  construction and are reported so a reader can see that they are. */
  readonly reuse: {
    readonly rebuilt: Pick<Driven, "shared" | "carried">
    readonly shared: Pick<Driven, "shared" | "carried">
  }
}

/**
 * THE REPLAY — one corpus, both wirings, every tab held to the same sequence.
 *
 * Two comparisons and they say different things. WHAT WAS HELD says the sharing
 * never handed a tab the wrong answer. WHAT WAS FRAMED says it never swallowed
 * one somebody was owed — the failure a comparison of final states cannot see,
 * and the one a reused value actually makes.
 */
export const differential = (
  revisions: ReadonlyArray<Revision>,
  tabs: ReadonlyArray<Tab>,
  { shared = standing, now = () => FIXED }: {
    readonly shared?: (now: () => string) => Standing
    readonly now?: () => string
  } = {},
): Report => {
  const rebuilt = watching(rebuilding(now), revisions, tabs)
  const answered = watching(shared(now), revisions, tabs)
  const divergences: Array<string> = []
  const frames: Array<string> = []
  let asks = 0
  for (const [which, tab] of tabs.entries()) {
    for (const [at, question] of tab.holds.entries()) {
      const one = (rebuilt.tabs[which] as ReadonlyArray<Watched>)[at] as Watched
      const other = (answered.tabs[which] as ReadonlyArray<Watched>)[at] as Watched
      for (const [revision, value] of one.held.entries()) {
        asks++
        const said = other.held[revision]
        if (!sameAnswer(question.which, value, said)) {
          divergences.push(
            `${tab.says} / ${question.which} @ rev ${revision} (${
              revisions[revision]?.says ?? "?"
            })`,
          )
        }
        if (one.framed[revision] !== other.framed[revision]) {
          frames.push(
            `${tab.says} / ${question.which} @ rev ${revision} (${
              revisions[revision]?.says ?? "?"
            }): rebuilt ${one.framed[revision] === true ? "sent" : "held"}, shared ${
              other.framed[revision] === true ? "sent" : "held"
            }`,
          )
        }
      }
    }
  }
  return {
    revisions: revisions.length,
    asks,
    divergences,
    frames,
    reuse: {
      rebuilt: { shared: rebuilt.shared, carried: rebuilt.carried },
      shared: { shared: answered.shared, carried: answered.carried },
    },
  }
}

/** The clock both arms are driven with. FIXED, because the differential is
 *  about the reuse and a moving clock is a second variable: the narrowing's
 *  relative words would answer differently on the two arms for a reason that
 *  has nothing to do with sharing. What a MOVING clock does to the narrowing is
 *  its own case in `./standing.test.ts`. */
export const FIXED = "2026-02-14T09:00:00-05:00"

// ── the pre-check, held to its own claim ───────────────────────────────

/**
 * THE NEGATIVE SPACE: every revision, every question, the pre-check asked AND
 * the answer rebuilt anyway.
 *
 * The differential above proves the WIRING; this proves the one claim the
 * wiring rests on, and it is the sharper instrument because it does not depend
 * on the sharing being wired up at all. For every question at every revision:
 * tape a rebuild, ask the next revision whether the tape still holds, and
 * rebuild again regardless. A tape that said "nothing moved" over an answer
 * that did is the wrong page this whole mechanism could produce, and it is
 * reported by name.
 *
 * IT ALSO COUNTS THE OTHER DIRECTION, which is not a failure and is worth
 * seeing: a tape that said "go and look" over an answer that had not moved is
 * the pre-check being conservative, which is what it is allowed to be and what
 * every revision cost before there was one. The count is what a reader judges
 * the feature by rather than what a test asserts.
 */
export interface Negative {
  readonly asked: number
  /** The pre-check said the answer could not have moved. */
  readonly held: number
  /** …and it was right, every time, or these say where it was not. */
  readonly wrong: ReadonlyArray<string>
  /** The pre-check said "go and look" and the answer had not moved — the
   *  conservative direction, counted rather than asserted. */
  readonly cautious: number
}

export const negativeSpace = (
  revisions: ReadonlyArray<Revision>,
  questions: ReadonlyArray<Question>,
  now: () => string = () => FIXED,
): Negative => {
  const rebuild = rebuilding(now)
  const wrong: Array<string> = []
  let asked_ = 0
  let held = 0
  let cautious = 0
  for (const question of questions) {
    let last: { reading: Reading; answer: unknown; tape: ReturnType<typeof taping>["tape"] } | null =
      null
    for (const revision of revisions) {
      const taped = taping(revision.reading)
      const fresh = asking(rebuild, taped.reading, question)
      if (last !== null) {
        asked_++
        const said = stillHolds(last.tape, last.reading, revision.reading)
        const moved = !sameAnswer(question.which, last.answer, fresh)
        if (said) {
          held++
          if (moved) {
            wrong.push(
              `${question.which} ${JSON.stringify(question.request)} @ ${revision.says}`,
            )
          }
        } else if (!moved) cautious++
      }
      last = { reading: revision.reading, answer: fresh, tape: taped.tape }
    }
  }
  return { asked: asked_, held, wrong, cautious }
}

// ── the mutants ────────────────────────────────────────────────────────

/**
 * A WIRING WHOSE PRE-CHECK NEVER FIRES A REBUILD — it says "nothing moved" at
 * every revision, so the first answer stands forever.
 *
 * This is the swallowed delta in its purest form, and the reason it is here is
 * that a harness which cannot see it is not evidence for the one that can.
 */
export const deaf = (now: () => string): Standing => reusing(now, () => true)

/**
 * A WIRING THAT CROSSES QUESTIONS — every request of one member shares one
 * answer, so the second tab is shown the first tab's page.
 *
 * The failure a differential with only ONE question open would never see, which
 * is why the tabs below hold several and why some of them differ only in their
 * request.
 */
export const crossed = (now: () => string): Standing => keyed(now, (which) => which)

/**
 * A WIRING THAT NEVER ROLLS — the share is keyed on the question and not on the
 * revision, so every tab keeps the first answer it was ever given.
 *
 * Distinct from {@link deaf}: that one re-validates and lies about the answer;
 * this one never asks. Both produce a stale page and they fail differently, so
 * both are here.
 */
export const frozen = (now: () => string): Standing => reusing(now, () => true, true)

/** The shape the three mutants are, so each of them is one line: the real
 *  answers, with the decision to reuse replaced. */
const reusing = (
  now: () => string,
  holds: () => boolean,
  never = false,
): Standing => {
  const rebuild = rebuilding(now)
  const answers = new Map<string, unknown>()
  const ask = (which: Asked, at: Reading, request: unknown, run: () => unknown): unknown => {
    const key = `${which} ${JSON.stringify(request)}`
    const before = answers.get(key)
    if (before !== undefined && (never || holds())) return before
    const fresh = run()
    answers.set(key, fresh)
    return fresh
  }
  return {
    dated: (at, request) => ask("dated", at, request, () => rebuild.dated(at, request)) as never,
    owed: (at, request) => ask("owed", at, request, () => rebuild.owed(at, request)) as never,
    page: (at, request) => ask("page", at, request, () => rebuild.page(at, request)) as never,
    narrowing: (at, request) =>
      ask("narrowing", at, request, () => rebuild.narrowing(at, request)) as never,
    moving: (at, request) => ask("moving", at, request, () => rebuild.moving(at, request)) as never,
  }
}

/** {@link crossed}'s shape: the real wiring with the question's KEY narrowed to
 *  its member, so two requests collide. */
const keyed = (now: () => string, key: (which: Asked) => string): Standing => {
  const rebuild = rebuilding(now)
  const answers = new Map<string, { reading: Reading; answer: unknown }>()
  const ask = (which: Asked, at: Reading, run: () => unknown): unknown => {
    const held = answers.get(key(which))
    if (held !== undefined && held.reading === at) return held.answer
    const fresh = run()
    answers.set(key(which), { reading: at, answer: fresh })
    return fresh
  }
  return {
    dated: (at, request) => ask("dated", at, () => rebuild.dated(at, request)) as never,
    owed: (at, request) => ask("owed", at, () => rebuild.owed(at, request)) as never,
    page: (at, request) => ask("page", at, () => rebuild.page(at, request)) as never,
    narrowing: (at, request) => ask("narrowing", at, () => rebuild.narrowing(at, request)) as never,
    moving: (at, request) => ask("moving", at, () => rebuild.moving(at, request)) as never,
  }
}

// ── the questions and the tabs a run is driven with ────────────────────

/**
 * A ROOM OF TABS over one directory, and the shape of it is the point: some
 * hold the SAME question (which is what the share is for), some hold questions
 * that differ only in their request (which is what {@link crossed} breaks), and
 * one holds nothing anybody else does.
 */
export const tabsOver = (at: Reading): ReadonlyArray<Tab> => {
  const files = at.set.documents.map((one) => one.path).filter((path) =>
    bodyKind(path) === null
  )
  const first = files[0] as string
  const second = files[1] as string
  const node = at.derived.nodes.find((one) => one.node.id.includes("n1"))?.node.id as string
  const day = [...at.derived.byDay.keys()][0] as string
  /** A page request naming one served file — through the format's own address
   *  grammar, so the harness cannot ask a question no browser could
 ask. */
  const pageAt = (path: string): PageRequest => ({ kind: "at", address: addressOf(path, null) })
  const one: Question = { which: "page", request: pageAt(first) }
  const two: Question = { which: "page", request: pageAt(second) }
  const dated: Question = { which: "dated", request: { month: day.slice(0, 7) } }
  const owed: Question = { which: "owed", request: { today: day } }
  return [
    { says: "tab one (the first outline)", holds: [one, dated, owed] },
    { says: "tab two (the same outline)", holds: [one, dated, owed] },
    {
      says: "tab three (another outline, filtered)",
      holds: [
        two,
        dated,
        owed,
        { which: "narrowing", request: { page: pageAt(second), text: "record" } },
      ],
    },
    {
      says: "tab four (a day, the agenda, the trash and a move)",
      holds: [
        { which: "page", request: { kind: "day", date: day } },
        { which: "page", request: { kind: "agenda", today: day } },
        { which: "page", request: { kind: "trash" } },
        { which: "page", request: { kind: "at", address: addressOf(null, node) } },
        { which: "moving", request: { record: node, to: [first, "nowhere"] } },
        { which: "narrowing", request: { page: pageAt(first), text: "is:todo" } },
      ],
    },
  ]
}

/** Every question any tab holds, once — what {@link negativeSpace} is driven
 *  with, so the pre-check is judged over the same questions the wiring is. */
export const questionsOf = (tabs: ReadonlyArray<Tab>): ReadonlyArray<Question> => {
  const seen = new Map<string, Question>()
  for (const tab of tabs) {
    for (const question of tab.holds) {
      seen.set(`${question.which} ${JSON.stringify(question.request)}`, question)
    }
  }
  return [...seen.values()]
}

/** The `broken` half of a reading, for a test that wants to say a corpus really
 *  did tear a file — the harness's own floor, like the sweep guards next door:
 *  a corpus whose torn arm never fired would prove the pre-check right about a
 *  shape it never saw. */
export const tornIn = (revisions: ReadonlyArray<Revision>): ReadonlyArray<BrokenFile> =>
  revisions.flatMap((revision) => revision.reading.set.broken)
