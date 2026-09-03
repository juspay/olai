/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent once.
 *
 * THE BROWSER HALF IS THE ONE THAT SPENDS IT: {@link ./browser.tsx} hangs this
 * value in the `chat.agent.install` slot, and `@olai/web` draws the row on the
 * face the panel shows when this machine has no agent at all. **The server half
 * does not touch it** — {@link ./server.ts} opens this module for {@link NAME}
 * and nothing else.
 *
 * IT WAS SPENT TWICE for one revision: `Registering.missing`, on the `Agents`
 * registration, beside the browser's copy. No serve, log line or cell ever read
 * that field, so what the second spending bought was a second authored source
 * for one sentence. `./server.test.ts` asserts these words off THIS constant,
 * which is the thing with a reader.
 *
 * A MODULE OF ITS OWN rather than lines inside `./browser.tsx`, because that
 * bench must not open the browser door: `packages/tests` runs under a process
 * with no browser in it, and a claim about two strings would drag SolidJS onto
 * its graph.
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
