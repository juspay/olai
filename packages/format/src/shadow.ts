/**
 * BOTH VALIDATORS, EVERY WRITE — and a loud noise when they disagree.
 *
 * `./incremental.ts` reaches a verdict from what an edit touched instead of
 * from the whole directory. This is how it is being proved: the full validator
 * runs exactly as it always did and its verdict is what the product obeys; the
 * narrowed one runs beside it, over the same set and the same view, and its
 * verdict is compared and dropped. Nothing above this file can tell the shadow
 * is here except by its cost — which is real, and named honestly in the PR that
 * shipped it: a write now pays BOTH validators, and the win arrives only at the
 * flip.
 *
 * ## THE FLIP IS NOT THIS PR'S
 *
 * Making the incremental verdict authoritative is one line in `./validate.ts`,
 * and it is a SEPARATE PR whose merge is a HUMAN's. Its gate is machine
 * checkable and has a deadline:
 *
 *   - the divergence log is EMPTY — {@link DIVERGENCE_LOG} under the state
 *     home, and NOT some other file with almost that name: this PR shipped for
 *     one commit with the writer renamed and the sentence stating this gate
 *     left behind, which would have made the soak a green over a path that is
 *     always absent. The name is a value for that reason and every sentence
 *     naming it is swept against it (`packages/tests/divergenceLog.test.ts`);
 *   - the shadow has soaked for at least THREE quiet nights, and
 *   - within SEVEN DAYS of this landing, flip or remove — the default on the
 *     deadline is REMOVE, meaning this file and its call go and the incremental
 *     validator's wiring goes with them. `./incremental.ts`, its property test
 *     and its bench STAY either way: the harness is the durable artifact, and a
 *     narrowing nobody flipped is still a narrowing somebody will.
 *
 * A non-empty divergence log FREEZES the flip. Nobody may flip early because a
 * divergence "looks benign"; a divergence is the shadow doing the one job it
 * has.
 *
 * ## Impossible to miss, impossible to crash on
 *
 * Both halves are structural rather than promised. Every divergence goes to a
 * {@link Witness}, and the one this module installs by default writes to
 * stderr — so a tree that wired nothing still shouts. `@olai/server` replaces
 * it with one that shouts AND appends a line to a file the orchestrator reads
 * (`packages/server/src/divergence.ts` names the path). And the whole of it —
 * the narrowed run, the comparison, the witness call — is inside one `try`, so
 * a bug in the shadow can cost a write nothing but a log line: a validator that
 * threw because its own understudy threw would be a strictly worse product than
 * the one that shipped without an understudy.
 *
 * THE LEDGER IS KEYED BY THE VIEW, in a `WeakMap`, and that is what makes this
 * whole thing bolt on rather than change a signature. A validation that follows
 * another one is handed that one's {@link Reading} ({@link ./validate.ts}'s
 * `Previous`), and the view inside it is the object this table filed the
 * verdict under. Nothing else in the tree learns that verdicts are remembered,
 * no type above the validator grows a field, and a view nobody kept takes its
 * ledger with it when it is collected.
 */

import type { Derived } from "./derive.ts"
import { errorLine, type OutlineError } from "./errors.ts"
import {
  type Decline,
  incrementally,
  type Ledger,
  type Narrowed,
} from "./incremental.ts"
import type { SetDelta } from "./patch.ts"
import { reportOf } from "./rules.ts"
import type { OutlineSet } from "./set.ts"
import type { PropDeclarations } from "./typing.ts"

/**
 * WHAT THE TWO ARMS SAID, when they did not say the same thing.
 *
 * Written to be read by a person at four in the morning and by a script at
 * nine: every field is a string or a number, the two reports are spelled the
 * way an error prints on one line ({@link ./errors.ts}'s `errorLine`), and the
 * two differences are called out separately from the whole so that the common
 * case — one finding missing — does not arrive as two hundred-line lists to
 * diff by eye.
 */
export interface Divergence {
  /**
   * WHICH WAY they differed, in one word:
   *
   *   - `verdict` — one arm passed the set and the other refused it. The worst
   *     one there is: after the flip this is a write accepted or rejected
   *     differently, which is the product's behaviour and not its wording;
   *   - `findings` — both refused, but not with the same findings;
   *   - `order` — the same findings, in a different order. Real, because the
   *     order is what a reader reads down and what two loads of one directory
   *     promise each other;
   *   - `ledger` — the two arms agreed about this set, and the narrowed one is
   *     carrying a `.md` list that the walk does not agree with. It has not
   *     produced a wrong finding YET and it will: caught here rather than three
   *     revisions later, where the log entry would name a `missing-doc` and
   *     nothing about where the wrong answer came from;
   *   - `threw` — the narrowed arm raised. Its verdict is unknown and the full
   *     one stands.
   */
  readonly why: "verdict" | "findings" | "order" | "ledger" | "threw"
  /** ISO instant, so a log line can be put beside a commit. */
  readonly at: string
  /** The files the delta named — where to start looking. */
  readonly touched: ReadonlyArray<string>
  /** How big the corpus was, so a reproduction can be sized. */
  readonly files: number
  /** Whether the full arm accepted the set, and whether the narrowed one did.
   *  Under `threw` the narrowed arm reached no verdict at all and this reads
   *  `false` — `why` is what says which of the two it is. */
  readonly accepted: { readonly full: boolean; readonly incremental: boolean }
  /** How many findings each arm reported. The SIZE of the two reports, which is
   *  what the lists below no longer carry. */
  readonly counts: { readonly full: number; readonly incremental: number }
  /** Said by the full arm and not by the narrowed one — the findings a flip
   *  would have LOST. Under `ledger`, the `.md` paths the walk holds and the
   *  carry does not. Capped at {@link SAID}. */
  readonly missing: ReadonlyArray<string>
  /** Said by the narrowed arm and not by the full one — the findings a flip
   *  would have INVENTED. Under `ledger`, the `.md` paths the carry holds and
   *  the walk does not. Capped at {@link SAID}. */
  readonly invented: ReadonlyArray<string>
  /** How many lines the three lists above dropped to stay under their caps. A
   *  number rather than a truncation nobody can see: an entry that says
   *  "twenty findings, and here are the first ten" is one a reader can act on,
   *  and one silently holding ten of twenty is one they cannot. */
  readonly elided: number
  /** WHERE the two reports part company, for the `order` case — the first index
   *  at which they differ and the line each arm has there. That case has
   *  nothing in `missing` or `invented` by definition (the findings are the
   *  same findings), and it used to be answered by carrying BOTH reports whole,
   *  which on a badly broken directory is a log line the size of the report. */
  readonly parted?: {
    readonly at: number
    readonly full: string
    readonly incremental: string
  }
  /** The reason, when `why` is `threw`. */
  readonly threw?: string
}

/**
 * How many lines of any one list an entry carries.
 *
 * A divergence is supposed to be impossible, so an entry is written to be READ
 * rather than to be complete: the first few findings and a count is what
 * somebody acts on, and both reports whole is what makes one line of the log
 * the size of a broken directory's whole report. What is never capped is the
 * COUNT — {@link Divergence.counts} and {@link Divergence.elided} say how much
 * was left out, so the entry cannot read as smaller than it was.
 */
const SAID = 12

/**
 * EVERY validation the shadow looked at, agreed or not — one word plus the
 * divergence when there is one.
 *
 * The agreements are here as well as the disagreements because a shadow that
 * declined every write would report no divergences and prove nothing, which is
 * exactly the vacuous green `./patch.ts`'s decline counter exists to stop. The
 * property test asserts floors on both counters; the server's witness ignores
 * everything but a divergence.
 */
export interface Seen {
  /** `cold` — nothing to narrow from, so only the full arm ran. `narrowed` —
   *  both ran and agreed. `diverged` — both ran and did not. */
  readonly kind: "cold" | "narrowed" | "diverged"
  /**
   * WHICH cold, present on exactly that kind — because one word for four
   * different things is a floor a test can meet without having reached any of
   * them.
   *
   *   - `first` — no reading to follow at all: the boot, or a caller that
   *     offered none;
   *   - `rebuilt` — the view was BUILT rather than patched, so it carries no
   *     relation to the one this validation follows (`patched` declined, or
   *     the identity check refused the delta);
   *   - `unledgered` — a previous view this table has no verdict for, which is
   *     a reading minted somewhere other than a validation;
   *   - and the three the narrowing itself turns back at
   *     ({@link ./incremental.ts}'s `Decline`).
   */
  readonly why?: "first" | "rebuilt" | "unledgered" | Decline
  /** Whether the narrowed arm had to walk the corpus anyway — see
   *  {@link ./incremental.ts}'s `Narrowed`. Absent on a cold run, where there
   *  was no narrowed arm to ask. */
  readonly walked?: boolean
  readonly divergence?: Divergence
}

export type Witness = (seen: Seen) => void

/** The floor: a divergence reaches stderr whatever else is or is not wired up.
 *  `console.error` rather than a logger, for the reason `@olai/format` has no
 *  logger to reach — it is the bottom of the layering and it is bundled into a
 *  browser (`docs/architecture.md`). The server's witness says the same thing
 *  through the real one. */
const SHOUT: Witness = (seen) => {
  const found = seen.divergence
  if (found === undefined) return
  console.error(
    `olai: THE INCREMENTAL VALIDATOR DIVERGED (${found.why}) at ${found.at}\n` +
      `  touched: ${found.touched.join(", ") || "(nothing)"}\n` +
      `  accepted: full=${found.accepted.full} incremental=${found.accepted.incremental}\n` +
      (found.threw === undefined ? "" : `  threw: ${found.threw}\n`) +
      `  found: full=${found.counts.full} incremental=${found.counts.incremental}\n` +
      found.missing.map((said) => `  only the full validator said: ${said}\n`).join("") +
      found.invented.map((said) => `  only the incremental one said: ${said}\n`).join("") +
      (found.parted === undefined ? "" : `  they part at ${found.parted.at}:\n` +
        `    full:        ${found.parted.full}\n` +
        `    incremental: ${found.parted.incremental}\n`) +
      (found.elided === 0
        ? ""
        : `  (${found.elided} more lines not shown — the entry is capped)\n`),
  )
}

/**
 * WHAT THE LOG IS CALLED — one spelling, exported, and the reason it lives in
 * this package rather than beside the code that opens the file.
 *
 * The flip's gate is "that log is empty", and a gate naming a file nothing
 * writes is a green nobody earned: this PR shipped with the writer renamed and
 * the gate left saying the old name, which is the same incomplete rename
 * `packages/tests/extension.test.ts` exists to catch and which its own grants
 * hid. So the name is a VALUE now. `@olai/server` joins it onto the state home
 * ({@link ../../server/src/divergence.ts}), every sentence in the tree that
 * names the gate is swept against it (`packages/tests/divergenceLog.test.ts`),
 * and there is no second place to forget.
 *
 * Here and not in the server because the artifact is the SHADOW's: this package
 * owns what the comparison is and what it produces, and the layer with a disk
 * owns where a file goes. The extension is `.ndjson` and not the other spelling
 * of newline-delimited JSON, which is the one olai's own outlines used to carry
 * and which this repository sweeps out of its tree.
 */
export const DIVERGENCE_LOG = "validate-shadow.ndjson"

let witness: Witness = SHOUT

/**
 * Install the witness — `null` puts the shouting default back.
 *
 * One seam and not two: the server's witness both shouts and writes the log
 * file, and a test's witness records what it was told. There is deliberately no
 * way to install a witness that leaves the default in place underneath, because
 * "two things are listening" is how a test suite ends up printing a divergence
 * it is asserting on and how a log ends up with two entries for one event.
 */
export const witnessing = (installed: Witness | null): void => {
  witness = installed ?? SHOUT
}

/** The verdict one validation reached about the view it built — read back by
 *  the next validation that follows this one. */
const LEDGERS = new WeakMap<Derived, Ledger>()

/**
 * Run the narrowed validator beside the full one, compare, and file the ledger
 * for whoever follows.
 *
 * The full arm's findings are what is filed, always and whatever the shadow
 * decided: the ledger is the authoritative record of what was true of this set,
 * and a narrowed verdict that was wrong must not be able to make the NEXT one
 * wrong too. That is also what keeps a divergence a single event rather than a
 * cascade the log has to be read backwards to understand.
 *
 * It returns nothing and it cannot throw. See the header.
 */
export const shadowed = (
  set: OutlineSet,
  before: Derived | undefined,
  delta: SetDelta | undefined,
  derived: Derived,
  errors: ReadonlyArray<OutlineError>,
  known: ReadonlySet<string>,
  /** What the full arm read the vault's property vocabulary as — carried for
   *  the next validation to compare against, exactly as `known` is
   *  ({@link ./incremental.ts}'s `Ledger`). */
  typing: PropDeclarations,
): void => {
  const ledger: Ledger = { errors, known, typing }
  try {
    const followed = before === undefined ? undefined : LEDGERS.get(before)
    if (before === undefined) {
      witness({ kind: "cold", why: "first" })
      return
    }
    if (delta === undefined) {
      witness({ kind: "cold", why: "rebuilt" })
      return
    }
    if (followed === undefined) {
      witness({ kind: "cold", why: "unledgered" })
      return
    }
    let narrowed: Narrowed | Decline
    try {
      narrowed = incrementally(set, before, followed, delta, derived)
    } catch (cause) {
      raise(delta, derived, {
        why: "threw",
        // The narrowed arm reached NO verdict, which `why` says and this
        // cannot: the pair is two booleans, so the honest reading of
        // `incremental: false` here is "there is none", never "it refused".
        accepted: { full: errors.length === 0, incremental: false },
        counts: { full: errors.length, incremental: 0 },
        missing: [],
        invented: [],
        threw: cause instanceof Error ? cause.message : String(cause),
      })
      return
    }
    if (typeof narrowed === "string") {
      witness({ kind: "cold", why: narrowed })
      return
    }
    compare(set, delta, derived, errors, narrowed.ledger, known, narrowed.walked)
  } catch (cause) {
    // The comparison itself, or the witness, or a view so broken that even
    // describing the divergence threw. Nothing above may notice, and the one
    // thing that must not happen quietly is this.
    try {
      console.error(`olai: THE VALIDATOR SHADOW FAILED: ${String(cause)}`)
    } catch {
      // A stderr that will not take a line is not this file's problem either.
    }
  } finally {
    LEDGERS.set(derived, ledger)
  }
}

/** The verdict this table holds about a view — the shadow's own state, read
 *  back. Nothing above this package reads it and nothing in the product does;
 *  it is here so that "the ledger is filed from the FULL arm, even when the
 *  narrowed one threw" is a checked claim rather than a paragraph. */
export const ledgerOf = (derived: Derived): Ledger | undefined => LEDGERS.get(derived)

const compare = (
  set: OutlineSet,
  delta: SetDelta,
  derived: Derived,
  errors: ReadonlyArray<OutlineError>,
  narrowed: Ledger,
  known: ReadonlySet<string>,
  walked: boolean,
): void => {
  // BOTH ARMS FOUND NOTHING, which is nearly every write, and there is no
  // report to build: `reportOf` over an empty list is the set's own parse
  // errors sorted, which is the SAME value on both sides because it is a
  // reading of the same set. So the common path costs two length reads where it
  // used to cost two sorts and a corpus of strings — the shadow already makes a
  // write pay two validators, and it must not also make it pay a third sort of
  // whatever the first one found.
  const agreed = errors.length === 0 && narrowed.errors.length === 0
  const found = agreed
    ? carried(known, narrowed.known)
    : verdicts(set, errors, narrowed.errors, known, narrowed.known)
  if (found === null) {
    witness({ kind: "narrowed", walked })
    return
  }
  raise(delta, derived, found, walked)
}

/** The two arms compared as REPORTS — what a reader would have been shown,
 *  error scope and presentation order and all ({@link ./rules.ts}'s
 *  `reportOf`) — for the writes where at least one arm found something. */
const verdicts = (
  set: OutlineSet,
  errors: ReadonlyArray<OutlineError>,
  narrowed: ReadonlyArray<OutlineError>,
  known: ReadonlySet<string>,
  carrying: ReadonlySet<string>,
): Told | null => {
  const full = reportOf(set, errors).map(errorLine)
  const said = reportOf(set, narrowed).map(errorLine)
  const accepted = { full: errors.length === 0, incremental: narrowed.length === 0 }
  // The verdict first and the CARRY second, which is the order they matter in
  // and not the order they happen in: a wrong ledger that has not yet produced
  // a wrong finding is worth an entry, and it must not be the entry that hides
  // one that has.
  const found = differing(full, said, accepted)
  if (found !== null) {
    return {
      ...found,
      accepted,
      counts: { full: full.length, incremental: said.length },
    }
  }
  const ledger = carried(known, carrying)
  return ledger === null ? null : {
    ...ledger,
    accepted,
    counts: { full: full.length, incremental: said.length },
  }
}

/** What a comparison decided, before {@link raise} stamps the time and the
 *  place on it — everything an entry says about the two ARMS, and nothing about
 *  the revision they ran over. */
type Told = Pick<
  Divergence,
  "why" | "missing" | "invented" | "accepted" | "counts" | "parted"
>

/**
 * HOW TWO REPORTS DIFFER, or `null` when they do not — the whole of the
 * comparison, as a function of two lists of lines.
 *
 * Its own function because it is the one thing here that has to be tested
 * directly rather than through a corpus (`./shadow.test.ts`): a differential
 * whose comparator cannot see a difference is a green suite that means nothing,
 * and reaching each of these three answers by writing a validator that is wrong
 * in exactly one way is a lot of machinery to prove something about eight
 * lines.
 */
export const differing = (
  full: ReadonlyArray<string>,
  said: ReadonlyArray<string>,
  accepted: Divergence["accepted"],
): Pick<Divergence, "why" | "missing" | "invented" | "parted"> | null => {
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

/** Whether the `.md` paths the narrowed arm CARRIED are the ones the walk
 *  found — see {@link Divergence.why}'s `ledger` for why an agreement about
 *  this set is not enough on its own. */
const carried = (
  walked: ReadonlySet<string>,
  said: ReadonlySet<string>,
): Told | null => {
  const missing = [...walked].filter((file) => !said.has(file))
  const invented = [...said].filter((file) => !walked.has(file))
  return missing.length === 0 && invented.length === 0 ? null : {
    why: "ledger",
    missing,
    invented,
    // The two arms AGREED about this set — that is what makes `ledger` its own
    // kind — so what a verdict count would say here is "both said the same
    // thing", and the paths above are the whole of the finding.
    accepted: { full: true, incremental: true },
    counts: { full: 0, incremental: 0 },
  }
}

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
 * The entry, stamped with the time and the revision and CUT TO SIZE.
 *
 * Every list an entry carries is capped here rather than at each of the places
 * one is built, and what was dropped is counted rather than quietly missing
 * ({@link SAID} argues both). `touched` is capped for the same reason the
 * findings are: a `git pull` that rewrote a directory names every file in it,
 * and the entry a person reads at nine in the morning should say "these, and
 * four hundred more" rather than four hundred paths.
 */
const raise = (
  delta: SetDelta,
  derived: Derived,
  found: Told & Partial<Pick<Divergence, "threw">>,
  walked?: boolean,
): void => {
  const touched = [...delta.upserts.map(([file]) => file), ...delta.removes]
  const missing = found.missing.slice(0, SAID)
  const invented = found.invented.slice(0, SAID)
  const divergence: Divergence = {
    why: found.why,
    at: new Date().toISOString(),
    touched: touched.slice(0, SAID),
    files: derived.byFile.size,
    accepted: found.accepted,
    counts: found.counts,
    missing,
    invented,
    elided: (touched.length - touched.slice(0, SAID).length) +
      (found.missing.length - missing.length) +
      (found.invented.length - invented.length),
    ...(found.parted === undefined ? {} : { parted: found.parted }),
    ...(found.threw === undefined ? {} : { threw: found.threw }),
  }
  witness({ kind: "diverged", divergence, ...(walked === undefined ? {} : { walked }) })
}
