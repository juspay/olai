/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent twice.
 *
 * BOTH HALVES NEED IT and they share no graph: the server half registers it as
 * the `missing` on `Agents`, and the browser half draws it on the face the
 * panel shows when this machine has no agent at all. A module with no imports
 * of its own is what a `./server` and a `./browser` can both open without
 * either learning what the other is made of.
 *
 * IT IS A WHOLE SENTENCE and core composes no clause of it. **Core displays a
 * sentence and never composes one** — the reason there is no template with a
 * noun dropped into it: what an engine is and how you get it are facts only its
 * own package knows.
 */

import type { NotHere } from "@olai/plugin-api"

/** WHAT A PERSON READS. The same word as the plugin's id here, which is a fact
 *  about this agent's own name rather than a rule. */
export const NAME = "pi"

/** ...AND WHAT A MACHINE THAT HAS NONE IS TOLD — both halves of this row in one
 *  clause, because a person reading it has one thing to do about it and the
 *  other half is olai's own problem: the adapter comes with olai, and the agent
 *  is theirs to install. */
export const INSTALL: NotHere = {
  name: NAME,
  where: "https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent",
  why: "put `pi` on this server's PATH — the adapter for it comes with olai",
}
