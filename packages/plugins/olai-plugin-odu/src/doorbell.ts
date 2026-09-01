/**
 * THE ODU DOORBELL — which runs a scoped conversation is woken for, and the
 * whole sentence each wake arrives as.
 *
 * `@olai/odu-client`'s watch says a transition happened ({@link RunNotice}):
 * a run first went red, or a run settled. That is the run's fact. Whether
 * anybody in THIS conversation should hear about it is a fact about the VAULT
 * — and joining the two is this module, exactly the judgement-about-odu this
 * package exists to hold ({@link ./index.ts}). It is `olai-plugin-kolu`'s
 * `./doorbell.ts` one appliance over, deliberately the same shape: the filter
 * is one file a person picked per conversation, the claimed set is read off
 * that file's un-done rows, and unclaimed is silence — never a message.
 *
 * ## WHAT A WAKE MEANS HERE, and why there is no meaning table at all
 *
 * Kolu's doorbell derives a MEANING from the claiming step's mark, because it
 * must never wake anybody over a lawfully parked terminal. odu's doorbell
 * owes no such table: the two notices are already the two ruled kinds (the
 * dispatch, 2026-09-01 — first-red, once per run; and settle), and a
 * *claimed* run going red is owed a wake whatever the lane is doing. So the
 * join has one question in it: does this file's claimed set name this run's
 * worktree? Everything else is the sentence.
 *
 * ## THE CLAIMABLE SET IS THE CHIP'S OWN LICENCE
 *
 * The values are the `odu-worktree`s of the file's UN-DONE nodes, mirrors
 * resolving to their targets — the same derivation the chip already licenses
 * ({@link ./worktrees.ts} runs the whole-vault sibling walk for the probe):
 * the DECLARATION is found by kind and never by a key's spelling, so a board
 * whose column is `checkout` is heard where it declared the kind, and a
 * column somebody has been calling `worktree` for years without declaring it
 * is not. What the doorbell does per file that the probe does not: `byFile`
 * to read one file, `follow` to see through a mirror, and `unfinished` to
 * end the claim the day the lane ends — a lane you finish stops ringing
 * without anybody switching anything off.
 *
 * Un-done is asked with `@olai/format`'s own predicate for the reason kolu's
 * header argues at length: `done` AND `cancelled` both end the wait, and a
 * bullet nobody marked is not a task.
 *
 * ## THIS MODULE OWNS NO STANDING SET
 *
 * No cache of claim maps, no watch of its own: every export is a pure
 * function of the revision it is handed, and the store's parsed, revisioned
 * vault IS the maintained in-memory copy. `./server.ts` memoises per FILE for
 * the length of ONE notice, because a person with three seats on one board
 * would otherwise pay three identical walks; that map is minted per notice
 * and dropped with it.
 *
 * ## THE BODY IS (MOSTLY) A FRESH DERIVATION, for coalescing's reason
 *
 * Core replaces an undelivered body with the next one under the same key, so
 * keying is what makes a queued wake honest. The keys are per KIND AND PER
 * RUN (`<kind>:<worktree value>`): two runs settling through one busy turn
 * are two subjects, and collapsing one into the other would lose what the
 * first said — the exact arm of core's `deliver` contract that a fresh
 * derivation never needs. A RED spell and then another on the same run
 * cannot double up by construction: first-red is once per hold, so there is
 * at most one body per (kind, run) in flight at all.
 *
 * What is re-derived at the delivery moment is only what time can
 * legitimately move: the CLAIM (a lane finished while the wake queued is a
 * wake nobody owes — `null` drops the delivery), and, for first-red, the
 * COUNTS: a body that says "so far" must say it of the moment it enters the
 * conversation, so it reads the live row again where the row is still this
 * run's. The settle notice's row is its own final account — the one sentence
 * in this file deliberately frozen at emission, because it IS the last frame.
 *
 * ## Plain text, and no markdown anywhere
 *
 * These bodies are delivered as a message, not rendered: the ids are in
 * backticks because a person reads backticks as "this is a literal" whether
 * or not anything styles them, the lead-ins are a plain `— ` rather than a
 * list marker, and there is not a `**` in the file. The claiming node's id is
 * additionally PRESSABLE — an olai node id the transcript's ordinary lookup
 * turns into a link back to the row the wake was derived from, which is the
 * row a person edits to stop it.
 *
 * Every claim above is held by `./doorbell.test.ts` over whole vaults through
 * the real parser, rather than by this paragraph.
 */

import {
  countedChildren,
  declaresKind,
  type Derived,
  follow,
  type LocatedRegular,
  type PropDeclarations,
  textDeclaredAs,
  unfinished,
} from "@olai/format"
import { durableLogPath, type RunNotice } from "@olai/odu-client"
import { type CiRun, identityOf, type RunTally, tallyOf, verdictOf } from "@olai/odu-client/wire"

import { WORKTREE_TYPE } from "./kinds.ts"

/**
 * ONE CLAIM a filter file makes on a run, as the vault wrote it.
 *
 * `value` is VERBATIM — the `worktree` string exactly as written, which is
 * the very id a run's row is keyed by (`@olai/odu-client`'s `CiRun.id`): the
 * join the doorbell runs is value to value, and unlike a terminal prefix
 * there is nothing left to resolve against a live roster.
 */
export interface Claim {
  /** The `odu-worktree` value, verbatim. */
  readonly value: string
  /** The OWNING NODE's title — the word a person calls the lane by. Blank
   *  where the node has none, which the sentence draws around. */
  readonly title: string
  /** The node that CARRIES the claim, by its own id — the one that is
   *  pressable in the sentence: the row somebody would edit to make this
   *  wake stop. */
  readonly node: string
}

/**
 * EVERY CLAIM ONE FILTER FILE MAKES — the `odu-worktree` values reachable
 * from its un-done records.
 *
 * Mirrors resolve to their targets with `follow`, and the walk descends from
 * there: a lane mirrored onto the board is usually placed under its own root
 * somewhere else, and — as with the terminals of a split lane — a value can
 * sit on the target or on anything under it. `reached` bounds the whole
 * thing to one pass: `byFile` lists every record in the file, so a descent
 * from each un-done row would otherwise walk one subtree once per un-done
 * ancestor above it, and two mirrors of one target would each pay it again.
 *
 * The carrying node must itself be un-done, asked with the same predicate
 * asked of the row: a folded review step still carrying its checkout claims
 * nothing, exactly as a folded lane does (kolu's own bench found that one on
 * a live board).
 */
export const claimedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): ReadonlyArray<Claim> => {
  if (!declaresKind(declarations, WORKTREE_TYPE)) return []
  const inside = derived.byFile.get(file)
  if (inside === undefined) return []
  const claims: Array<Claim> = []
  const reached = new Set<string>()
  /** A worktree value written TWICE claims once — two rows on one checkout
   *  is one run, and the second claim is the mistake the watcher's own
   *  first-writer-wins rule already names. */
  const seen = new Set<string>()
  const descend = (at: LocatedRegular): void => {
    if (reached.has(at.node.id)) return
    reached.add(at.node.id)
    const said = textDeclaredAs(declarations, at.node, WORKTREE_TYPE)
    if (said !== undefined && said.trim() !== "" && !seen.has(said) && unfinished(derived.status.get(at.node.id))) {
      seen.add(said)
      claims.push({ value: said, node: at.node.id, title: at.node.title })
    }
    for (const child of countedChildren(derived, at.node.id)) descend(child)
  }
  for (const located of inside) {
    if (!unfinished(derived.status.get(located.node.id))) continue
    const found = follow(derived, located)
    if (found.kind !== "found") continue
    descend(found.shows)
  }
  return claims
}

/**
 * THE CLAIMS, KEYED FOR THE JOIN — by the value itself, first writer wins in
 * the file's own line order. Two records naming one checkout is somebody
 * copying a property, not an error, and a sentence has room for one lane per
 * line.
 */
export const claimingIn = (claims: ReadonlyArray<Claim>): ReadonlyMap<string, Claim> => {
  const claiming = new Map<string, Claim>()
  for (const claim of claims) {
    if (!claiming.has(claim.value)) claiming.set(claim.value, claim)
  }
  return claiming
}

// ── The sentence ──────────────────────────────────────────────────────────

/** ONE STAMP a person reads, off the caller's clock. The server's clock is
 *  what stamped it, and pretending otherwise would be inventing a timezone;
 *  a value this runtime cannot parse passes through verbatim — a time in
 *  somebody else's spelling beats a wrong one in ours. */
const stampOf = (now: string): string => {
  const at = new Date(now)
  if (Number.isNaN(at.getTime())) return now
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** What to call the lane in a plain sentence — its own title VERBATIM where
 *  it has one (the title already names the lane; wrapping it would spell
 *  "the the e2e lane lane"), and the honest pointer where it has none. */
const laneOf = (claim: Claim): string => {
  const title = claim.title.trim()
  if (title !== "") return title
  const node = claim.node.trim()
  return node === "" ? "the lane" : `lane \`${node}\``
}

/** The run's own name for itself — odu's `<name> <sha7>#<seq>+dirty`, the
 *  fold both this sentence and the chip's hover now run (`wire`'s
 *  {@link identityOf}), so the two never spell one run two ways. */
const whichOf = identityOf

/** The count in the chip's own spelling, with the red numeral the event is
 *  about joined to it — `8/10 ok so far, 1 red`. The `so far` clause is the
 *  first-red notice's own: the sentence claims nothing final. */
const countsOf = (counts: RunTally, soFar: boolean): string => {
  if (counts.total === 0) return ""
  const red = counts.red === 0 ? "" : `, ${counts.red} red`
  return ` — ${counts.ok}/${counts.total} ok${soFar ? " so far" : ""}${red}`
}

/**
 * THE HEAD — one plain sentence, in words a reader who was not there
 * understands, with the claiming node's id carried in backticks so the row
 * is one press away.
 */
const essenceOf = (
  notice: RunNotice,
  claim: Claim,
  counts: RunTally,
): string => {
  if (notice.kind === "first-red") {
    return `${cap(laneOf(claim))}'s CI went red: \`${notice.cell.id}\` is the first red node of this run${
      countsOf(counts, true)
    }.`
  }
  const tally = tallyOf(notice.run.cells)
  const verdict = verdictOf(tally)
  const tail = countsOf(tally, false)
  if (verdict === "ok") return `${cap(laneOf(claim))}'s CI came out green${tail}.`
  if (verdict === "red") return `${cap(laneOf(claim))}'s CI came out red${tail}.`
  return `${cap(laneOf(claim))}'s CI ended without deciding${tail}.`
}

const cap = (sentence: string): string => sentence.slice(0, 1).toUpperCase() + sentence.slice(1)

/**
 * THE FAILED RECIPES, one line each with where each one's log lives — the
 * settle kind's payload for a red verdict: the recipes are the cells still
 * red on the last frame, with odu's own status word kept beside them, and
 * the path is {@link durableLogPath}'s — a sentence never names a file that
 * could not exist, so a cell with no honest path omits it rather than
 * inventing one.
 */
const failedLines = (run: CiRun): ReadonlyArray<string> =>
  run.cells.filter((cell) => cell.red).map((cell) => {
    const path = durableLogPath(run, cell)
    return path === null
      ? `— \`${cell.id}\`: ${cell.status}.`
      : `— \`${cell.id}\`: ${cell.status} — the log is at ${path}.`
  })

/**
 * THE RERUN NOTE — the record-truth arm: any node THIS WATCH ever saw red
 * whose last frame is green is named as what it was, because "went red
 * earlier and went green on a rerun" is a fact the hold observed and the
 * final count alone would hide. It is written conservatively — the hold saw
 * the red frames itself; the only way a node leaves the red column in odu's
 * own machine is a rerun — and says nothing about WHY, which is phase 4's
 * question and not this sentence's.
 */
const reranLines = (notice: Extract<RunNotice, { kind: "settled" }>): ReadonlyArray<string> =>
  notice.reddened.flatMap((id) => {
    const cell = notice.run.cells.find((one) => one.id === id)
    if (cell === undefined || cell.status !== "ok") return []
    return [`— \`${cell.id}\` went red earlier in this run and went green on a rerun — it is counted as ok above, which is worth knowing when a gate reads this verdict.`]
  })

/**
 * THE WHOLE SENTENCE — the plugin's words, every one of them, and core
 * composes none.
 *
 * Its shape is kolu's wake's, on purpose: the first line is the durable
 * account a glance can read, the attribution is a line of its own because a
 * conversation resumed from the agent's own store rebuilds its rows out of
 * message chunks and the mark never survives the round trip, and the closing
 * line names where the claims came from and how to stop it — a machine-sent
 * message that cannot be switched off from inside its own text is a message
 * a person resents.
 *
 * `counts` is the fresh reading a first-red body wants (see the header), and
 * the caller's `null` discipline is the drop rule: claim gone, subject gone,
 * no sentence.
 */
export const bodyFor = (
  notice: RunNotice,
  claim: Claim,
  file: string,
  stamp: string,
  counts: RunTally,
): string => {
  const run = notice.run
  const which = whichOf(run)
  const lines = [essenceOf(notice, claim, counts), "", `Written by olai's odu watcher at ${stampOf(stamp)}, not by a person.`]
  if (notice.kind === "first-red") {
    lines.push(
      "",
      `The run is \`${which}\`, live in ${run.at}. ${cap(laneOf(claim))} claims it — the un-done row \`${claim.node}\` of ${file} names its checkout — and \`${notice.cell.id}\` (${notice.cell.name} on ${notice.cell.platform}) is the first of its nodes to go red.`,
      "",
      `This lands once per run. When the run settles, one more account follows: the verdict, the final counts, and the log path of every failed recipe. Clearing the file on this conversation's wake control stops both.`,
    )
    return lines.join("\n")
  }
  const tally = tallyOf(run.cells)
  lines.push(
    "",
    `The run is \`${which}\`, settled in ${run.at}.${claimLine(claim, file)}`,
  )
  if (tally.red > 0) lines.push("", ...failedLines(run))
  const reran = reranLines(notice)
  if (reran.length > 0) lines.push("", ...reran)
  lines.push(
    "",
    "These land once per run: again on the lane's next run, when it first goes red and when it settles. Clearing the file on this conversation's wake control stops both.",
  )
  return lines.join("\n")
}

/** The provenance clause of a settle account — the same clause the first-red
 *  body carries inside its own second paragraph, broken out so both say it
 *  once. */
const claimLine = (claim: Claim, file: string): string =>
  ` ${cap(laneOf(claim))} claims it — the un-done row \`${claim.node}\` of ${file} names its checkout.`

/** What a delivery-time re-derivation asks of the row list, and nothing
 *  else — kept as its own tiny type so `server.ts`'s thunk reads as what it
 *  is. Deprecatable the day `CiRun` grows an epoch of its own. */
export const sameRun = (a: CiRun, b: CiRun): boolean =>
  a.name === b.name && a.sha7 === b.sha7 && a.seq === b.seq

/** The counts a first-red body should say NOW: the live row's own where the
 *  row is still this run's, else the notice's snapshot — an account of the
 *  frame that fired, never of the next run's start. */
export const countsFor = (
  rows: ReadonlyArray<CiRun>,
  notice: Extract<RunNotice, { kind: "first-red" }>,
): RunTally => {
  const now = rows.find((row) => row.id === notice.run.id)
  return tallyOf(now !== undefined && sameRun(now, notice.run) ? now.cells : notice.run.cells)
}

