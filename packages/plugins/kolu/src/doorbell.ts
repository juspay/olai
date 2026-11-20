import {
  countedChildren,
  declaresKind,
  type Derived,
  follow,
  insideSubtree,
  type LocatedRegular,
  type PropDeclarations,
  type Settled,
  settles,
  type Status,
  textDeclaredAs,
} from "@olai/format"
import { heldStateOf } from "olai-plugin-kolu/appliance"
import {
  type FleetTerminal,
  type KoluEvent,
  reminderAccount,
  resolveTerminal,
  whoOf,
} from "olai-plugin-kolu/appliance/wire"
import { nodeRef } from "@olai/plugin-kit/ref"

import { TERMINAL_TYPE } from "./kinds.ts"
import { listed, type Trace } from "./trace.ts"

export type Meaning = "wake" | "digest"

type Unfinished = Exclude<Status, Settled>

const settled = (mark: Status | undefined): mark is Settled => mark !== undefined && settles(mark)

const claimedOn = (
  declarations: PropDeclarations,
  at: LocatedRegular,
): string | undefined => {
  const said = textDeclaredAs(declarations, at.node, TERMINAL_TYPE)
  return said !== undefined && said.trim() !== "" ? said : undefined
}

export interface Claim {
  readonly value: string
  readonly step: string
  readonly mark: Unfinished
  readonly node: string
}

export interface Standing {
  readonly terminal: string
  readonly who: string
  readonly state: string
  readonly step: string
  readonly mark: Unfinished
  readonly node: string
  readonly label: string
}


export type Why =
  | "settled"
  | "unmarked-leaf"
  | "not-live"

export interface Excluded {
  readonly value: string
  readonly node: string
  readonly why: Why
}

export interface Walked {
  readonly claimed: ReadonlyArray<Claim>
  readonly excluded: ReadonlyArray<Excluded>
}

const NOTHING_WALKED: Walked = { claimed: [], excluded: [] }
export const walkedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): Walked => {
  if (!declaresKind(declarations, TERMINAL_TYPE)) return NOTHING_WALKED
  const inside = derived.byFile.get(file)
  if (inside === undefined) return NOTHING_WALKED
  const claims: Array<Ranked> = []
  const excluded: Array<Excluded> = []
  const reached = new Set<string>()
  for (const located of inside) {
    const found = follow(derived, located)
    if (found.kind !== "found") continue
    if (reached.has(found.shows.node.id)) continue
    claiming(declarations, derived, found.shows, reached, claims, excluded, undefined)
  }
  return {
    claimed: claims.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...claim }) => claim),
    // The exclusions are NOT re-ordered.
    excluded,
  }
}

export const claimedIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
): ReadonlyArray<Claim> => walkedIn(declarations, derived, file).claimed

interface Ranked extends Claim {
  readonly rank: number
}

interface Under {
  readonly deepest: LocatedRegular | undefined
  readonly live: boolean
}

const NOTHING_UNDER: Under = { deepest: undefined, live: false }

const claiming = (
  declarations: PropDeclarations,
  derived: Derived,
  at: LocatedRegular,
  reached: Set<string>,
  claims: Array<Ranked>,
  excluded: Array<Excluded>,
  mine: string | undefined,
): Under => {
  const own = derived.status.get(at.node.id)
  const claimed = claimedOn(declarations, at)
  if (settled(own)) {
    if (claimed !== undefined) excluded.push({ value: claimed, node: at.node.id, why: "settled" })
    return NOTHING_UNDER
  }
  const rank = reached.size
  reached.add(at.node.id)
  const owner = claimed ?? mine
  let deepest: LocatedRegular | undefined
  let live = own !== undefined
  let leaf = true
  for (const child of countedChildren(derived, at.node.id)) {
    leaf = false
    if (reached.has(child.node.id)) continue
    const under = claiming(declarations, derived, child, reached, claims, excluded, owner)
    if (under.deepest !== undefined) deepest = under.deepest
    if (under.live) live = true
  }
  if (claimed !== undefined && live) {
    claims.push({
      rank,
      value: claimed,
      node: at.node.id,
      ...owning(at, deepest, leaf ? own : undefined),
    })
  } else if (claimed !== undefined) {
    excluded.push({
      value: claimed,
      node: at.node.id,
      why: leaf && own === undefined ? "unmarked-leaf" : "not-live",
    })
  }
  return {
    live,
    deepest: claimed !== undefined && claimed !== mine
      ? undefined
      : deepest ?? (own === "doing" ? at : undefined),
  }
}

const owning = (
  at: LocatedRegular,
  deepest: LocatedRegular | undefined,
  step: Unfinished | undefined,
): { readonly step: string; readonly mark: Unfinished } =>
  deepest !== undefined
    ? { step: deepest.node.title, mark: "doing" }
    : { step: at.node.title, mark: step ?? "todo" }

export const claimingIn = (
  claims: ReadonlyArray<Claim>,
  fleet: Iterable<string>,
): ReadonlyMap<string, Claim> => {
  const ids = [...fleet]
  const claiming = new Map<string, Claim>()
  for (const claim of claims) {
    const found = resolveTerminal(claim.value, ids)
    if (found.kind !== "one") continue
    if (claiming.has(found.id)) continue
    claiming.set(found.id, claim)
  }
  return claiming
}

export const classify = (
  event: KoluEvent,
  claiming: ReadonlyMap<string, Claim>,
): Meaning | null => {
  if (event.row === null) return null
  const claim = claiming.get(event.row.terminal)
  if (claim === undefined) return null
  return meaningOf(claim)
}

const meaningOf = (claim: Claim): Meaning => claim.mark === "doing" ? "wake" : "digest"

export const standingIn = (
  claiming: ReadonlyMap<string, Claim>,
  rows: ReadonlyMap<string, FleetTerminal>,
  meaning: Meaning,
): ReadonlyArray<Standing> => {
  const standing: Array<Standing> = []
  for (const [terminal, claim] of claiming) {
    if (meaningOf(claim) !== meaning) continue
    const row = rows.get(terminal)
    if (row === undefined) continue
    const held = heldStateOf(row)
    if (held === null) continue
    standing.push({
      terminal,
      who: whoOf(row.repo, row.label),
      state: held.bucket,
      step: claim.step,
      mark: claim.mark,
      node: claim.node,
      label: row.label,
    })
  }
  return standing
}

const stampOf = (now: string): string => {
  const at = new Date(now)
  if (Number.isNaN(at.getTime())) return now
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

const lineOf = (one: Standing): string => {
  const who = one.who === "" ? "" : ` (${one.who})`
  const step = one.mark === "doing"
    ? one.step.trim() === ""
      ? "the node that claims it is `doing`"
      : `its step "${one.step.trim()}" is \`doing\``
    : one.step.trim() === ""
    ? "nothing under the node that claims it is being worked"
    : `nothing under "${one.step.trim()}" is being worked`
  return `— \`${one.terminal}\`${who} is held at \`${one.state}\`; ${step}, on ${nodeRef(one.node)}.`
}

export const bodyFor = (
  meaning: Meaning,
  standing: ReadonlyArray<Standing>,
  file: string,
  now: string,
  event?: KoluEvent,
): string => {
  const many = standing.length !== 1
  const subject = many ? `${standing.length} terminals` : "One terminal"
  const claimed = many ? "are" : "is"
  const opening = meaning === "wake"
    ? `${subject} claimed by ${file} ${claimed} waiting on a person, and the step that claims ${
      many ? "each" : "it"
    } is doing — a report or a block is owed:`
    : `${subject} claimed by ${file} ${claimed} waiting on a person, and no step of ${
      many ? "any of them" : "it"
    } is doing — ${
      many ? "they are" : "it is"
    } lawfully parked, so this is a note and not a call:`
  const reminder = reminderOf(event)
  return [
    essenceOf(meaning, standing),
    "",
    `Written by olai's kolu watcher at ${stampOf(now)}, not by a person.`,
    ...(reminder === null ? [] : ["", reminder]),
    "",
    opening,
    "",
    ...standing.map(lineOf),
    "",
    `These are read off the un-done nodes of ${file}, mirrors followed to their targets. It is the whole standing set and not only the terminal that moved just now; clearing the file on this conversation's wake control stops it.`,
  ].join("\n")
}

const reminderOf = (event: KoluEvent | undefined): string | null => {
  const account = reminderAccount(event?.kind === "nag" ? event.nag : undefined)
  if (account === null || event?.row === null || event === undefined) return null
  const id = event.row.terminal
  if (account.total === null) {
    return `This is reminder ${account.index} of an uncapped nag for \`${id}\` — it repeats on this interval while the state holds (a cap is spelled \`nag: 30m/3\` in _olai/Settings.olai).`
  }
  if (account.last) {
    return `This is reminder ${account.index} of ${account.index} for \`${id}\`, the last — this doorbell goes quiet about that terminal until its state changes.`
  }
  return `This is reminder ${account.index} of ${account.total} for \`${id}\`.`
}

const essenceOf = (meaning: Meaning, standing: ReadonlyArray<Standing>): string => {
  const one = standing.length === 1 ? standing[0] : undefined
  if (meaning === "wake") {
    return one === undefined
      ? `${standing.length} terminals are idle: they have finished, or they need you.`
      : `The ${namingOf(one)} is idle on ${nodeRef(one.node)}: it has finished, or it needs you.`
  }
  return one === undefined
    ? `${standing.length} terminals went quiet, and nothing under them is being worked. A note, not a call.`
    : `The ${namingOf(one)} went quiet on ${nodeRef(one.node)}, and nothing under it is being worked. A note, not a call.`
}

const ROLE_WORDS = 3

const namingOf = (one: Standing): string => {
  const label = one.label.trim()
  const step = one.step.trim()
  const role = step !== "" && step.split(/\s+/).length <= ROLE_WORDS ? step : ""
  if (label === "") return role === "" ? `\`${one.terminal}\` terminal` : role
  return role === "" ? `${label} terminal` : `${label} ${role}`
}


export const ringingIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
  fleet: ReadonlyArray<string>,
  trace: Trace,
): Ringing => {
  const { claimed, excluded } = walkedIn(declarations, derived, file)
  const claiming = claimingIn(claimed, fleet)
  const matched = new Set(claiming.values())
  const unmatched = claimed.filter((claim) => !matched.has(claim))
  trace("derived", {
    file,
    claims: claimed.length,
    ringing: listed([...claiming].map(([id, claim]) => `${id}@${claim.node}`)),
    unmatched: listed(unmatched.map((claim) => `${claim.value}@${claim.node}`)),
    excluded: listed(excluded.map((one) => `${one.value}@${one.node}:${one.why}`)),
    fleet: fleet.length,
  })
  return { claiming, unmatched, excluded }
}

export interface Ringing {
  readonly claiming: ReadonlyMap<string, Claim>
  readonly unmatched: ReadonlyArray<Claim>
  readonly excluded: ReadonlyArray<Excluded>
}

export const whyOut = (
  terminal: string,
  ringing: Ringing,
): Why | "unmatched" | "unclaimed" => {
  for (const claim of ringing.unmatched) {
    if (terminal.startsWith(claim.value)) return "unmatched"
  }
  for (const one of ringing.excluded) {
    if (terminal.startsWith(one.value)) return one.why
  }
  return "unclaimed"
}

export const terminalsIn = (
  declarations: PropDeclarations,
  derived: Derived,
  file: string,
  under?: string,
): number => {
  const said = new Set(
    claimedIn(declarations, derived, file)
      .filter((claim) => under === undefined || insideSubtree(derived, claim.node, under))
      .map((claim) => claim.value),
  )
  let held = 0
  for (const value of said) {
    let folded = false
    for (const other of said) {
      if (other !== value && other.startsWith(value)) {
        folded = true
        break
      }
    }
    if (!folded) held++
  }
  return held
}

export interface Conversation {
  readonly agent: string
  readonly session: string
}

export interface Scoped extends Conversation {
  readonly current: () => boolean
  readonly file: string
  readonly under?: string
}

export interface Vitals {
  readonly file: string
  readonly terminals: number
  readonly lastEvent: string | null
  readonly since: string
  readonly everyMs: number
  readonly now: string
}

export const heartbeatBody = (vitals: Vitals): string => {
  const window = spanOf(vitals.everyMs)
  const claims = vitals.terminals === 1
    ? `the one terminal ${vitals.file} claims`
    : `the ${vitals.terminals} terminals ${vitals.file} claims`
  const head = vitals.terminals === 0
    ? `The kolu watcher is alive: ${window} with nothing to say, and ${vitals.file} claims no terminals at all right now.`
    : `The kolu watcher is alive: ${window} with nothing to say about ${claims}.`
  return [
    head,
    "",
    `Written by olai's kolu watcher at ${stampOf(vitals.now)}, not by a person.`,
    "",
    `No wake and no digest has gone into this conversation for ${window}, which is the whole watch window — so this is the watcher proving it is running, and not a report about anything that happened. These four readings are what tell a live watcher from a wedged one, and every one of them was taken at the moment this message went in:`,
    "",
    `— the filter file: ${vitals.file}.`,
    `— terminals it claims right now: ${vitals.terminals}.`,
    `— last watcher event: ${eventLine(vitals)}`,
    `— watching since ${stampOf(vitals.since)}${suffixed(vitals.since, vitals.now, "so far")}.`,
    "",
    `Quiet is quiet: any wake or digest delivered here resets the window, so a busy one is silent. This is never a fault report — a scope this watcher cannot read says so in its own words — and clearing the file on this conversation's wake control stops it.`,
  ].join("\n")
}

const eventLine = (vitals: Vitals): string =>
  vitals.lastEvent === null
    ? "none at all since it started watching."
    : `${stampOf(vitals.lastEvent)}${suffixed(vitals.lastEvent, vitals.now, "ago")}.`

const SECOND = 1_000
const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`

const pairOf = (
  big: number,
  bigWord: string,
  small: number,
  smallWord: string,
): string => small === 0 ? plural(big, bigWord) : `${plural(big, bigWord)} ${plural(small, smallWord)}`

const spanOf = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < SECOND) return "less than a second"
  if (ms < MINUTE) return plural(Math.floor(ms / SECOND), "second")
  if (ms < HOUR) return plural(Math.floor(ms / MINUTE), "minute")
  if (ms < DAY) return pairOf(Math.floor(ms / HOUR), "hour", Math.floor(ms % HOUR / MINUTE), "minute")
  return pairOf(Math.floor(ms / DAY), "day", Math.floor(ms % DAY / HOUR), "hour")
}

const suffixed = (from: string, to: string, word: string): string => {
  const at = new Date(from).getTime()
  const now = new Date(to).getTime()
  if (Number.isNaN(at) || Number.isNaN(now)) return ""
  return `, ${spanOf(now - at)} ${word}`
}

/**
 * This module has no gone-detection of its own and must never grow one: if
 * `scopes()` lists it, it is watched.
 */
export interface Heartbeat {
  /** A BEAT IS NOT AN EVENT and must never be stamped here. */
  readonly saw: (at: string) => void
  readonly delivered: (to: Conversation) => void
  readonly beat: (everyMs: number) => void
}

export const makeHeartbeat = (deps: {
  readonly scopes: () => ReadonlyArray<Scoped>
  readonly deliver: (
    to: Scoped,
    say: () => string | null,
    options?: { readonly coalesce?: string },
  ) => void
  readonly terminals: (scope: Scoped) => number | null
  readonly now: () => string
  readonly coalesce: string
  readonly trace: Trace
}): Heartbeat => {
  const since = deps.now()
  const trace = deps.trace
  let lastEvent: string | null = null
  const spoken = new Set<string>()
  let armedAt: number | null = null
  /** `\0` as an ESCAPE and never as the byte: a literal NUL
   *  makes this file read as BINARY to grep and to review tooling, which is how
   *  a reviewer stops being able to see it at all. */
  const keyOf = (to: Conversation): string => `${to.agent}\0${to.session}`
  return {
    saw: (at) => {
      lastEvent = at
    },
    delivered: (to) => {
      spoken.add(keyOf(to))
    },
    beat: (everyMs) => {
      const nowMs = Date.parse(deps.now())
      if (armedAt === null) {
        armedAt = nowMs
        trace("beat-armed", { every: everyMs })
        return
      }
      if (nowMs - armedAt < everyMs) {
        trace("beat-collapsed", { every: everyMs })
        return
      }
      armedAt = nowMs
      const scopes = deps.scopes()
      trace("beat", {
        every: everyMs,
        scopes: scopes.length,
        spoken: spoken.size,
        lastEvent,
      })
      for (const scope of scopes) {
        if (spoken.has(keyOf(scope))) {
          trace("beat-passed", { file: scope.file, agent: scope.agent, why: "spoke-this-window" })
          continue
        }
        if (deps.terminals(scope) === null) {
          trace("beat-passed", { file: scope.file, agent: scope.agent, why: "no-revision" })
          continue
        }
        const to = scope
        trace("beating", { file: scope.file, agent: scope.agent, session: scope.session })
        deps.deliver(
          to,
          () => {
            const now = deps.scopes().find((one) => keyOf(one) === keyOf(scope))
            if (now === undefined) {
              trace("beat-dropped", { agent: scope.agent, why: "unscoped-since" })
              return null
            }
            const terminals = deps.terminals(now)
            if (terminals === null) {
              trace("beat-dropped", { file: now.file, agent: scope.agent, why: "no-revision" })
              return null
            }
            trace("beat-said", { file: now.file, agent: scope.agent, terminals })
            return heartbeatBody({
              file: now.file,
              terminals,
              lastEvent,
              since,
              everyMs,
              now: deps.now(),
            })
          },
          { coalesce: deps.coalesce },
        )
      }
      spoken.clear()
    },
  }
}
