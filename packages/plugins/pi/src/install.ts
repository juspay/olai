/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent once,
 * and this is the row where "once" needs a second sentence.
 *
 * THE SERVER HALF IS THE ONE THAT SPENDS IT: {@link ./server.ts}'s probe hands
 * one of the two values below back as the `NotHere` arm of its answer, so the
 * roster publishes a row for a machine that has not got this engine with the
 * sentence attached — the picker draws it greyed, the plugins panel files it
 * under Needs you, and the detection log names it. The browser contributes its
 * mark and its scope-held inspector row, both consuming the published reading.
 *
 * ## TWO ABSENCES, NOT ONE
 *
 * Starting needs BOTH halves: the pinned adapter (`OLAI_ACP_PI`, olai's to ship)
 * and a `pi` on the agent search path (the person's to install). Either missing
 * leaves an unavailable row, whose sentence names the missing prerequisite.
 * A single `INSTALL` would tell somebody whose adapter was unset to go
 * and put `pi` on a PATH that would change nothing. So there are two, one per
 * probe, and the server half picks the one that failed.
 *
 * A MODULE OF ITS OWN rather than lines inside `./server.ts`, because that
 * bench must not open the server door: `packages/tests` runs under a process
 * with no browser in it, and a claim about strings would drag the plugin
 * runtime onto its graph.
 *
 * IT IS A WHOLE SENTENCE and core composes no clause of it. **Core displays a
 * sentence and never composes one** — the reason there is no template with a
 * noun dropped into it: what an engine is and how you get it are facts only its
 * own package knows.
 */

import type { NotHere } from "@olai/acp/engine"

/** WHAT A PERSON READS. The same word as the plugin's id here, which is a fact
 *  about this agent's own name rather than a rule. */
export const NAME = "pi"

/** ...AND WHAT A MACHINE WITHOUT THE ADAPTER IS TOLD. `where` is `null`
 *  because there is no place a person gets this from: the pin is olai's, it
 *  ships on every documented start, and a machine without it is a start that
 *  went round all of them — the sentence says the cause rather than pointing
 *  at a page that would not help. */
export const ADAPTER_GONE: NotHere = {
  name: NAME,
  where: null,
  why: "OLAI_ACP_PI is unset or empty — start olai with the wrapper that carries the pinned pi adapter",
}

/** ...AND WHAT A MACHINE WITHOUT THE AGENT IS TOLD — both halves of this row in
 *  one clause, because a person reading it has one thing to do about it and the
 *  other half is olai's own problem: the adapter comes with olai, and the agent
 *  is theirs to install. */
export const INSTALL: NotHere = {
  name: NAME,
  where: "https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent",
  why: "put `pi` on this server's PATH — the adapter for it comes with olai",
}
