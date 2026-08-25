/**
 * THE DIFFERENTIAL: one verdict, two ways of reaching it, replayed over
 * sequences of edits.
 *
 * `./incremental.ts` narrows the validator to what an edit touched, and the
 * claim it makes is an equivalence — so what holds it is a differential and not
 * a table of expectations. This module replays a SEQUENCE of revisions through
 * the real `validate`, exactly as the store drives it, and collects what the
 * shadow saw. A case asserts an empty divergence list plus enough counting to
 * say the run was not vacuous.
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
 * replay take a generated corpus and take THIS REPOSITORY'S OWN `docs/`, and
 * it is why nothing here builds an `OutlineSet` by hand: a differential judged
 * against a set no load could produce proves something about itself.
 *
 * WHAT IT DOES NOT DO is decide what a verdict should be. That is
 * `./validate.test.ts`'s, against fixtures small enough to write down. This
 * module holds two implementations to one answer and has no opinion about what
 * the answer is.
 *
 * Nothing here has tests of its own — it is a helper module, not a suite, and
 * `bun test` collects only `*.test.ts`.
 */

import { Result } from "effect"

import type { Document } from "./document.ts"
import type { OutlineError } from "./errors.ts"

import { type Corpus, corpusOf, editOf, FILES, pick } from "./corpora.testlib.ts"
import { fileKind } from "./kinds.ts"
import { byPath } from "./paths.ts"
import { decodedVault } from "./scope.testlib.ts"
import { assemble, nodesIn } from "./set.ts"

import type { Divergence, Seen } from "./shadow.ts"
import { witnessing } from "./shadow.ts"
import { type Reading, validate } from "./validate.ts"

/** One revision of the served directory: every path it holds and the bytes at
 *  it. The shape {@link ./scope.testlib.ts}'s `vaultAt` reads a real directory
 *  into, so a generated corpus and a real one are the same value here. */
export type Revision = ReadonlyMap<string, string>

/** What a replay found. An equality to the empty list is the gate; every other
 *  field is a claim that the gate was asked anything at all. */
export interface Report {
  /** The whole point. */
  readonly divergences: ReadonlyArray<Divergence>
  /** Revisions where both arms ran and agreed. */
  readonly narrowed: number
  /** Revisions where only the full arm ran, and WHICH cold each of them was
   *  ({@link ./shadow.ts}'s `Seen.why`). A count on its own is a floor a run
   *  can meet without having reached any particular kind — a suite asserting
   *  `cold > 60` over sixty first-loads would be asserting that a boot boots. */
  readonly cold: number
  readonly declined: Readonly<Record<string, number>>
  /** Narrowed revisions that had to walk the corpus ANYWAY, because the graph
   *  moved or a `.md` went away. The number the flip is worth arguing over, and
   *  a floor AND a ceiling here: all of them means the narrowing narrows
   *  nothing, none of them means the corpora never reparented anything. */
  readonly walked: number
  /** Revisions the full validator accepted, and revisions it refused. Both are
   *  floors: a corpus nothing ever refuses never tests the ledger's own gate,
   *  and one that is never accepted never gives the narrowing a reading to
   *  follow. */
  readonly accepted: number
  readonly refused: number
  /** Revisions whose set held a file that would not parse — the error scope,
   *  where a finding is withheld rather than reported. */
  readonly unreadable: number
  readonly revisions: number
}

/**
 * Replay a sequence of revisions through the real validator, and say what the
 * shadow saw.
 *
 * The witness is installed for the length of the replay and taken off in a
 * `finally`: a suite that left one behind would silence the next file's
 * divergences, and a suite that threw mid-replay would leave the default alarm
 * off for the rest of the process.
 */
export const replay = (revisions: Iterable<Revision>): Report => {
  const seen: Array<Seen> = []
  let accepted = 0
  let refused = 0
  let unreadable = 0
  let many = 0
  witnessing((one) => {
    seen.push(one)
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
    const decoded = new Map<string, Result.Result<Document, ReadonlyArray<OutlineError>>>()
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
      if (Result.isFailure(verdict)) {
        refused++
        continue
      }
      accepted++
      published = verdict.success
      changed.clear()
      removed.clear()
    }
  } finally {
    witnessing(null)
  }
  return {
    divergences: seen.flatMap((one) => (one.divergence === undefined ? [] : [one.divergence])),
    narrowed: seen.filter((one) => one.kind === "narrowed").length,
    cold: seen.filter((one) => one.kind === "cold").length,
    declined: seen.reduce<Record<string, number>>((held, one) => {
      if (one.kind !== "cold") return held
      const why = one.why ?? "unsaid"
      return { ...held, [why]: (held[why] ?? 0) + 1 }
    }, {}),
    walked: seen.filter((one) => one.walked === true).length,
    accepted,
    refused,
    unreadable,
    revisions: many,
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
