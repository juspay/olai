/**
 * PADI'S AGENT STATE → THE DOT'S FACE.
 *
 * The one fold, and the only module in olai that has ever seen an agent state
 * literal. What it produces is `@olai/surface`'s {@link DotFace}, which both
 * ends of the wire read — so a browser never re-derives this, and a kolu re-pin
 * that adds an agent state is a change in this file and nowhere else.
 *
 * That is the whole reason the fold is on the SERVER rather than in the
 * browser: two switches over one closed set is the class of defect kolu's own
 * `agentProjection.ts` header spends a page on, and putting the second one
 * across a wire would make it invisible as well as duplicated.
 *
 * ## `waiting` folds into `parked`, deliberately
 *
 * padi's `agentBucket` has a fourth bucket this fold does not keep: `waiting`,
 * the agent whose turn just ended. kolu paints it its own dimmed `linger` and
 * ALSO ranks it idle (`agentUrgency`) — paint and rank disagree there on
 * purpose, and the door's dot is the RANK reading: it answers "does this lane
 * want me", and a finished turn does not.
 *
 * When the `/orchestrator` page lands and wants the linger cue, it takes it
 * from the same `agentBucket` this fold reads — it does not add a fifth face,
 * because a chip in an outline has room for a colour and not for a gradation.
 */

import { agentBucket } from "@kolu/terminal-vocab/agentProjection"
import type { PadiTerminal } from "@kolu/padi-client/surface"
import type { DotFace } from "@olai/surface"

/**
 * The face of a mirrored record — or `gone`, for the id the fleet does not
 * hold.
 *
 * `undefined` is the caller's ordinary case rather than an error: a chip looks
 * its terminal up in the fleet by id and hands over whatever came back, so the
 * "no such terminal" answer is decided here with the rest of them instead of at
 * every lookup site.
 */
export const faceOf = (record: PadiTerminal | undefined): DotFace => {
  if (record === undefined) return "gone"
  // Only the ACTIVE arm can carry a running agent — `sleeping` and `parked`
  // have released their PTY, so there is nothing to ask.
  if (record.state !== "active") return "parked"
  const agent = record.agent
  // A plain shell — a terminal with no agent in it at all. A real and common
  // state (the human's own working terminals), and `parked` rather than `gone`:
  // the terminal is there, nothing agentic is happening.
  if (agent === null) return "parked"
  switch (agentBucket(agent.state)) {
    case "working":
      return "working"
    case "awaiting":
      return "awaiting"
    // See the header: the turn is over (`waiting`), or the state is one this
    // build's vocabulary does not know (`other`). Neither is asking for you.
    case "waiting":
    case "other":
      return "parked"
  }
}
