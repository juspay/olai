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

import type { TerminalAttention } from "@kolu/padi-client/attention"
import { activePr } from "@kolu/padi-client/surface"
import {
  annotationLine,
  bindStatePip,
  identityColor,
  paintDockRow,
  rowSubline,
} from "@kolu/solid-dockrow/rowValues"
import type { PadiTerminal } from "@kolu/padi-client/surface"
import {
  type FleetOwner,
  type FleetTerminal,
  resolveTerminal,
  TERMINAL_KEY,
  UNOWNED,
} from "@olai/surface"


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
export const claimsIn = (
  nodes: Iterable<Claimant>,
  ids: Iterable<string>,
): ReadonlyMap<string, FleetOwner> => {
  // The id set once, because every claim resolves against all of it.
  const fleet = [...ids]
  const claims = new Map<string, FleetOwner>()
  for (const node of nodes) {
    const terminal = node.terminal
    if (terminal === undefined || terminal === "") continue
    // RESOLVED, not used as a key. The board writes eight-character prefixes
    // far more often than whole uuids, so keying this map by the value gave
    // every one of those rows `unowned` — the fleet is keyed by the uuid and
    // the two never met.
    const found = resolveTerminal(terminal, fleet)
    // AN AMBIGUOUS CLAIM OWNS NOTHING, which is the only honest answer: a
    // value that names three terminals has not claimed one of them, and
    // picking whichever sorted first would put a lane's name on a row it
    // never named. The CHIP says so in words; the row stays unowned.
    if (found.kind !== "one") continue
    if (claims.has(found.id)) continue
    claims.set(found.id, { kind: "node", id: node.id, title: node.title, file: node.file })
  }
  return claims
}

/** padi's git half, narrowed — `null` on a terminal that is not in a
 *  repository, which is most shells. */
const gitOf = (record: PadiTerminal) =>
  record.state === "active" || record.state === "sleeping" ? record.git : null

/**
 * One row — the JOIN of three clocks.
 *
 * padi's RECORD says what the terminal is; padi's ATTENTION PARTITION says
 * whether anything is being asked of you in it; olai's OWNER overlay says
 * whether anything in this vault claims it. All three are handed in rather
 * than looked up, so this stays a function of its arguments and each walk
 * happens once at the caller (`./mirror.ts`).
 *
 * EVERY FIELD IS A PROP OF KOLU'S ROW, AND EVERY ONE IS KOLU'S OWN FOLD.
 * Nothing here decides what a state means, what colour it paints, or which
 * words go on line two — that was olai's `face.ts`, and the fifth Löwy sitting
 * deleted it. The row package's README carries a provenance table naming the
 * producer of every prop, and this function is that table applied: `label` and
 * `labelColor` in particular look like something you would just write, and both
 * hide a rule (an intent line REPLACES the branch rather than stacking with it;
 * a hue is hashed from the key ALONE, never from the set on screen, which is
 * what makes one repo one colour across the Dock, a palette and this).
 *
 * ## `parked` is a word two unrelated facts share, and neither is padi's arm
 *
 * `paintDockRow`'s third argument is NOT `record.state === "parked"`. It is the
 * ACTIVITY-WINDOW staleness overlay — kolu's dock hides a row whose last
 * activity has fallen outside the window the user is looking through, and a
 * *fresh* sleeping tile keeps its own face until it does. olai has no activity
 * window: an outline shows the terminal a node names whenever it exists, and
 * nothing here compresses a fleet by recency. So the argument is OMITTED, which
 * is the overload that narrows the answer to the buckets a caller without a
 * window can actually reach (`UnparkedPaintBucket`) — a type fence rather than
 * a promise, which is why omitting it is right rather than merely harmless.
 */
export const rowOf = (
  id: string,
  record: PadiTerminal,
  owner: FleetOwner = UNOWNED,
  attention: TerminalAttention = { klass: "idle", live: false },
): FleetTerminal => {
  const git = gitOf(record)
  const branch = git?.branch ?? ""
  const intent = record.state === "parked" ? undefined : record.intent
  return {
    id,
    // THE PIP IS BOUND ONCE, HERE, and travels as the ten facts it produced.
    // `unread` is kolu's own app-local obligation badge — a terminal whose
    // output you have not looked at in ITS window manager — and olai has no
    // such notion, so it is `false` rather than invented. It is an optional
    // prop precisely so a consumer can decline it.
    pip: bindStatePip({ meta: record, attention, unread: false }),
    // The ORDER bucket, which is a different fold from the pip's paint: kolu
    // spends a page on why those two must not be derived from each other.
    bucket: paintDockRow(record, attention.klass),
    // VERBATIM, and a plain string on the wire by ratification: the browser
    // narrows it through the row package's own guard, so an agent state this
    // build has never heard of arrives as itself.
    agentState: record.state === "active" ? record.agent?.state ?? null : null,
    label: annotationLine(intent, branch),
    labelColor: identityColor(branch),
    subline: rowSubline(record),
    pr: activePr(record),
    recencyAt: record.lastActivityAt,
    repo: git?.repoName ?? null,
    owner,
  }
}
