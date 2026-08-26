/**
 * PADI'S RECORD → OLAI'S ROW — the projection, and the ownership overlay on it.
 *
 * Two things happen here and they are two different kinds of thing, which is
 * why they are one module: what a terminal IS is padi's to say and this only
 * narrows it, and who OWNS it is olai's to say and padi has never heard of it.
 * A fleet row is the join.
 *
 * ## Why anything is dropped at all
 *
 * padi's `PadiTerminal` is a three-armed union over the whole live record —
 * ports, foreground process, chrome state, the persisted restore target, the
 * agent's session id. A chip needs a dot; a fleet row needs about eight fields.
 * Everything not projected here is a field olai would be re-publishing without
 * a reader, and every one of them is a shape that can change under a re-pin.
 * So the cut is deliberate and the rule is: a field crosses when something
 * DRAWS it.
 *
 * ## The overlay is by PROPERTY, not by a table olai keeps
 *
 * `owner` answers "does anything in this vault claim this terminal", and it is
 * derived from the same reading every page draws: a node carrying
 * `terminal: <id>` in its custom properties. There is no registry, nothing
 * persisted, and nothing to keep in step — write the property and the fleet row
 * says so on the next revision; delete it and the row goes back to `unowned`.
 *
 * That is the same arrangement the door itself has (`docs/brainstorming/
 * orchestrator.md`: policy lives on nodes, code interprets), and it is what
 * makes phase 1a's payoff visible without a route: the property IS the claim.
 *
 * KEYED ON THE PROP KEY, `terminal` — not on a declared type, which is what
 * this would key on the day typed properties land. That migration is a rename
 * and is deliberately not a dependency of this PR (the roadmap item says so).
 * The key is named ONCE, here, so that rename is one constant.
 */

import { agentShortName } from "@kolu/terminal-vocab/agentProjection"
import type { PadiTerminal } from "@kolu/padi-client/surface"
import { type FleetOwner, type FleetTerminal, TERMINAL_KEY, UNOWNED } from "@olai/surface"

import { faceOf } from "./face.ts"

/**
 * ONE CLAIM ON A TERMINAL, as PLAIN DATA — an id, a title, a file, and the
 * terminal the node named.
 *
 * FOUR STRINGS AND NOT A `Located`, and that is the package boundary drawn at
 * the type level rather than argued in a comment. A signature here naming the
 * vault's record would put `@olai/format` in this package's manifest, and then
 * "how olai reaches kolu" would also know what an outline node is — two
 * subjects in one package, and a dependency that has nothing to do with padi.
 *
 * So the WALK belongs to whoever holds the vault (`@olai/server`'s
 * `claimants.ts`, which reads the `terminal` property off each record) and what
 * crosses is this. The overlay is olai's, the fleet is padi's, and this is the
 * only shape at which they meet.
 */
export interface Claimant {
  readonly id: string
  readonly title: string
  readonly file: string
  readonly terminal: string | undefined
}

/**
 * WHO CLAIMS EACH TERMINAL — one pass over the vault's nodes, as a map.
 *
 * Built once per revision rather than asked per terminal, because the question
 * is asked once per fleet row and the set is the whole vault: N rows × M nodes
 * is a walk nobody needs when one walk answers all of them.
 *
 * TWO NODES CLAIMING ONE TERMINAL is possible and is not an error — somebody
 * copied a property, or a lane and its step both carry it. The FIRST in
 * document order wins, deterministically, so two tabs drawing the same fleet
 * agree; it is not worth a refusal, because both nodes are true statements
 * about where the work happened and the row only has room for one link.
 */
export const claimsIn = (nodes: Iterable<Claimant>): ReadonlyMap<string, FleetOwner> => {
  const claims = new Map<string, FleetOwner>()
  for (const node of nodes) {
    const terminal = node.terminal
    if (terminal === undefined || terminal === "") continue
    if (claims.has(terminal)) continue
    claims.set(terminal, { kind: "node", id: node.id, title: node.title, file: node.file })
  }
  return claims
}

/** padi's git half, narrowed — `null` on a terminal that is not in a
 *  repository, which is most shells. */
const gitOf = (record: PadiTerminal) =>
  record.state === "active" || record.state === "sleeping" ? record.git : null

/**
 * One row.
 *
 * `owner` is handed in rather than looked up, so this stays a function of its
 * arguments and the vault walk happens once at the caller ({@link claimsIn}).
 */
export const rowOf = (
  id: string,
  record: PadiTerminal,
  owner: FleetOwner = UNOWNED,
): FleetTerminal => {
  const face = faceOf(record)
  const git = gitOf(record)
  const agent = record.state === "active" ? record.agent : null
  return {
    id,
    // `faceOf` can answer `gone`, and a row can never wear it — a row that
    // exists is a terminal the fleet holds. The narrowing is spelled rather
    // than cast so the day a fifth face arrives this is a type error here
    // rather than a `gone` string on the wire.
    face: face === "gone" ? "parked" : face,
    state: record.state,
    agent: agent === null ? null : agentShortName(agent.kind),
    cwd: record.state === "parked" ? null : record.cwd,
    repo: git?.repoName ?? null,
    branch: git?.branch ?? null,
    worktree: git?.worktreePath ?? null,
    // `optionalKey` upstream, so absent and empty are both "no intent" — folded
    // to `null` here, because a wire that carried both would make every reader
    // ask the same question twice.
    intent: record.intent ?? null,
    lastActivityAt: record.lastActivityAt,
    owner,
  }
}
