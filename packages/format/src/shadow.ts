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
 *   - the divergence log is EMPTY, and
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
import { incrementally, type Ledger, type Narrowed } from "./incremental.ts"
import type { SetDelta } from "./patch.ts"
import { reportOf } from "./rules.ts"
import type { OutlineSet } from "./set.ts"

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
  /** Whether the full arm accepted the set, and whether the narrowed one did. */
  readonly accepted: { readonly full: boolean; readonly incremental: boolean }
  /** Said by the full arm and not by the narrowed one — the findings a flip
   *  would have LOST. Under `ledger`, the `.md` paths the walk holds and the
   *  carry does not. */
  readonly missing: ReadonlyArray<string>
  /** Said by the narrowed arm and not by the full one — the findings a flip
   *  would have INVENTED. Under `ledger`, the `.md` paths the carry holds and
   *  the walk does not. */
  readonly invented: ReadonlyArray<string>
  /** Both reports whole, in order, for the `order` case where neither list
   *  above has anything in it. */
  readonly full: ReadonlyArray<string>
  readonly incremental: ReadonlyArray<string>
  /** The reason, when `why` is `threw`. */
  readonly threw?: string
}

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
  /** `cold` — nothing to narrow from (a first load, a rebuild, a validation
   *  following a refusal), so only the full arm ran. `narrowed` — both ran and
   *  agreed. `diverged` — both ran and did not. */
  readonly kind: "cold" | "narrowed" | "diverged"
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
      found.missing.map((said) => `  only the full validator said: ${said}\n`).join("") +
      found.invented.map((said) => `  only the incremental one said: ${said}\n`).join("") +
      (found.why === "order"
        ? `  full order:        ${found.full.join(" | ")}\n` +
          `  incremental order: ${found.incremental.join(" | ")}\n`
        : ""),
  )
}

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
): void => {
  const ledger: Ledger = { errors, known }
  try {
    const followed = before === undefined ? undefined : LEDGERS.get(before)
    if (before === undefined || delta === undefined || followed === undefined) {
      witness({ kind: "cold" })
      return
    }
    let narrowed: Narrowed | null
    try {
      narrowed = incrementally(before, followed, delta, derived)
    } catch (cause) {
      raise(set, delta, derived, errors, {
        why: "threw",
        accepted: { full: errors.length === 0, incremental: false },
        threw: cause instanceof Error ? cause.message : String(cause),
      })
      return
    }
    if (narrowed === null) {
      witness({ kind: "cold" })
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

/** What the shadow filed about a view, for the tests that drive
 *  {@link incrementally} directly and need the state a real run would have left
 *  behind. Not product: nothing above this package reads it. */
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
  // THE REPORTS AND NOT THE RAW FINDINGS: the error scope and the presentation
  // order are part of the verdict, so what is compared is what a reader would
  // have been shown ({@link ./rules.ts}'s `reportOf`).
  const full = reportOf(set, errors).map(errorLine)
  const said = reportOf(set, narrowed.errors).map(errorLine)
  const accepted = { full: errors.length === 0, incremental: narrowed.errors.length === 0 }
  // The verdict first and the CARRY second, which is the order they matter in
  // and not the order they happen in: a wrong ledger that has not yet produced
  // a wrong finding is worth an entry, and it must not be the entry that hides
  // one that has.
  const found = differing(full, said, accepted) ?? carried(known, narrowed.known)
  if (found === null) {
    witness({ kind: "narrowed", walked })
    return
  }
  raise(set, delta, derived, errors, { ...found, accepted, full, incremental: said }, walked)
}

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
): Pick<Divergence, "why" | "missing" | "invented"> | null => {
  if (accepted.full !== accepted.incremental) {
    return { why: "verdict", missing: held(full, said), invented: held(said, full) }
  }
  const missing = held(full, said)
  const invented = held(said, full)
  if (missing.length > 0 || invented.length > 0) {
    return { why: "findings", missing, invented }
  }
  return full.some((line, at) => line !== said[at])
    ? { why: "order", missing: [], invented: [] }
    : null
}

/** Whether the `.md` paths the narrowed arm CARRIED are the ones the walk
 *  found — see {@link Divergence.why}'s `ledger` for why an agreement about
 *  this set is not enough on its own. */
const carried = (
  walked: ReadonlySet<string>,
  said: ReadonlySet<string>,
): Pick<Divergence, "why" | "missing" | "invented"> | null => {
  const missing = [...walked].filter((file) => !said.has(file))
  const invented = [...said].filter((file) => !walked.has(file))
  return missing.length === 0 && invented.length === 0
    ? null
    : { why: "ledger", missing, invented }
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

const raise = (
  set: OutlineSet,
  delta: SetDelta,
  derived: Derived,
  errors: ReadonlyArray<OutlineError>,
  found: Pick<Divergence, "why" | "accepted"> & Partial<Divergence>,
  walked?: boolean,
): void => {
  const divergence: Divergence = {
    why: found.why,
    at: new Date().toISOString(),
    touched: [...delta.upserts.map(([file]) => file), ...delta.removes],
    files: derived.byFile.size,
    accepted: found.accepted,
    missing: found.missing ?? [],
    invented: found.invented ?? [],
    full: found.full ?? reportOf(set, errors).map(errorLine),
    incremental: found.incremental ?? [],
    ...(found.threw === undefined ? {} : { threw: found.threw }),
  }
  witness({ kind: "diverged", divergence, ...(walked === undefined ? {} : { walked }) })
}
