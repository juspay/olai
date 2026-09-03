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
 *  about this agent's own name rather than a rule: the two exist apart because
 *  "Claude Code" is not `claude`, and an engine whose name IS its word simply
 *  says so twice. */
export const NAME = "opencode"

/** ...AND WHAT A MACHINE THAT HAS NONE IS TOLD. Two clauses and both are this
 *  plugin's to word: where it comes from, and the one thing a person has to do
 *  about it. "On this server's PATH" rather than "on your PATH" because olai's
 *  PATH is not your shell's when it runs as a service, which is the trap this
 *  sentence exists to stay ahead of. */
export const INSTALL: NotHere = {
  name: NAME,
  where: "https://opencode.ai",
  why: "put `opencode` on this server's PATH",
}
