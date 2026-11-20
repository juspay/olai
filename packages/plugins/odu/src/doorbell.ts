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
import { type RunNotice } from "olai-plugin-odu/appliance"
import { type CiRun, identityOf, type RunTally, tallyOf, verdictOf } from "olai-plugin-odu/appliance/wire"
import { nodeRef } from "@olai/plugin-kit/ref"

import { RUN_TYPE } from "./kinds.ts"
import { name } from "./wire.ts"

export interface Claim {
  readonly value: string
  readonly title: string
  readonly node: string
  readonly file: string
}

export const claimedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): ReadonlyArray<Claim> => {
  if (!declaresKind(declarations, RUN_TYPE)) return []
  const inside = derived.byFile.get(file)
  if (inside === undefined) return []
  const claims: Array<Claim> = []
  const reached = new Set<string>()
  const seen = new Set<string>()
  const descend = (at: LocatedRegular): void => {
    if (reached.has(at.node.id)) return
    reached.add(at.node.id)
    const said = textDeclaredAs(declarations, at.node, RUN_TYPE)
    if (said !== undefined && said.trim() !== "" && !seen.has(said) && unfinished(derived.status.get(at.node.id))) {
      seen.add(said)
      claims.push({ value: said, node: at.node.id, title: at.node.title, file: at.file })
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

export const claimingIn = (claims: ReadonlyArray<Claim>): ReadonlyMap<string, Claim> => {
  const claiming = new Map<string, Claim>()
  for (const claim of claims) {
    if (!claiming.has(claim.value)) claiming.set(claim.value, claim)
  }
  return claiming
}

const stampOf = (now: string): string => {
  const at = new Date(now)
  if (Number.isNaN(at.getTime())) return now
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

const laneOf = (claim: Claim): string => {
  const title = claim.title.trim()
  if (title !== "") return title
  const node = claim.node.trim()
  return node === "" ? "the lane" : `lane \`${node}\``
}

const countsOf = (counts: RunTally, soFar: boolean): string => {
  if (counts.total === 0) return ""
  const red = counts.red === 0 ? "" : `, ${counts.red} red`
  return ` — ${counts.ok}/${counts.total} ok${soFar ? " so far" : ""}${red}`
}

const essenceOf = (
  notice: RunNotice,
  claim: Claim,
  counts: RunTally,
): string => {
  const on = `on ${nodeRef(claim.node)}`
  if (notice.kind === "first-red") {
    return `${cap(laneOf(claim))}'s CI went red ${on}: \`${notice.cell.id}\` is the first red node of this run${
      countsOf(counts, true)
    }.`
  }
  const tally = tallyOf(notice.run.cells)
  const verdict = verdictOf(notice.run)
  const tail = countsOf(tally, false)
  if (notice.run.state === "owner_lost") {
    return `${cap(laneOf(claim))}'s CI owner lost ${on}${tail}.`
  }
  if (verdict === "passed") return `${cap(laneOf(claim))}'s CI came out passed ${on}${tail}.`
  if (verdict === "failed") return `${cap(laneOf(claim))}'s CI came out failed ${on}${tail}.`
  if (verdict === "incomplete") return `${cap(laneOf(claim))}'s CI came out incomplete ${on}${tail}.`
  return `${cap(laneOf(claim))}'s CI came out incomplete ${on}${tail}.`
}

const cap = (sentence: string): string => sentence.slice(0, 1).toUpperCase() + sentence.slice(1)

const failedLines = (run: CiRun): ReadonlyArray<string> =>
  run.cells.filter((cell) => cell.red).map((cell) => {
    const log = cell.logKey === ""
      ? `odu logs --run ${run.id} ${cell.id}`
      : `log \`${cell.logKey}\`; odu logs --run ${run.id} ${cell.id}`
    return `— \`${cell.id}\`: ${cell.status} — ${log}.`
  })

const reranLines = (notice: Extract<RunNotice, { kind: "settled" }>): ReadonlyArray<string> =>
  notice.reddened.flatMap((id) => {
    const cell = notice.run.cells.find((one) => one.id === id)
    if (cell === undefined || cell.status !== "ok") return []
    return [`— \`${cell.id}\` went red earlier in this run and went green on a rerun — it is counted as ok above, which is worth knowing when a gate reads this verdict.`]
  })

export function bodyFor(
  notice: Extract<RunNotice, { kind: "first-red" }>,
  claim: Claim,
  stamp: string,
  counts: RunTally,
): string
export function bodyFor(
  notice: Extract<RunNotice, { kind: "settled" }>,
  claim: Claim,
  stamp: string,
): string
export function bodyFor(
  notice: RunNotice,
  claim: Claim,
  stamp: string,
  counts?: RunTally,
): string {
  const run = notice.run
  const which = identityOf(run)
  const printed = notice.kind === "first-red" ? counts ?? tallyOf(run.cells) : tallyOf(run.cells)
  const lines = [essenceOf(notice, claim, printed), "", `Written by olai's odu watcher at ${stampOf(stamp)}, not by a person.`]
  if (notice.kind === "first-red") {
    lines.push(
      "",
      `The run is \`${which}\` (\`${run.id}\`), live in ${run.repoRoot === "" ? "an unknown checkout" : run.repoRoot}. ${cap(laneOf(claim))} claims it — the un-done row ${nodeRef(claim.node)} of ${claim.file} names this run — and \`${notice.cell.id}\` (${notice.cell.name} on ${notice.cell.platform}) is the first of its nodes to go red.`,
      "",
      `This lands once per hold. Each settlement of the run — a lingering rerun's included — follows with its own account: the verdict, the final counts, and each failed recipe with its log key. A run first seen already settled rings nothing. Clearing the file on this conversation's wake control stops both.`,
    )
    return lines.join("\n")
  }
  lines.push(
    "",
    `The run is \`${which}\` (\`${run.id}\`), settled in ${run.repoRoot === "" ? "an unknown checkout" : run.repoRoot}.${claimLine(claim)}`,
  )
  if (printed.red > 0) lines.push("", ...failedLines(run))
  const reran = reranLines(notice)
  if (reran.length > 0) lines.push("", ...reran)
  lines.push(
    "",
    "These land once per settlement observed by this subscription. A lingering rerun settles again and rings again. A run first seen already settled rings nothing — what a restart misses as a wake is on the chip. The lane's next run rings again when it first goes red and when it settles. Clearing the file on this conversation's wake control stops both.",
  )
  return lines.join("\n")
}

const claimLine = (claim: Claim): string =>
  ` ${cap(laneOf(claim))} claims it — the un-done row ${nodeRef(claim.node)} of ${claim.file} names this run.`

export const coalesceOf = (notice: RunNotice): string =>
  `${name}:${notice.kind}:${notice.run.id}`

export const countsFor = (
  rows: ReadonlyArray<CiRun>,
  notice: Extract<RunNotice, { kind: "first-red" }>,
): RunTally => {
  const now = rows.find((row) => row.id === notice.run.id)
  return tallyOf((now ?? notice.run).cells)
}

