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
 * sentence and never composes one** — the same rule an absent MCP server's
 * `why` is carried under, and the reason there is no template here with a noun
 * dropped into it: what an engine is and how you get it are facts only its own
 * package knows.
 */

import type { NotHere } from "@olai/plugin-api"

/** WHAT A PERSON READS — in the picker, in the header beside the model, and on
 *  the row below. The plugin's, because "Claude Code" is a name rather than the
 *  word `claude` with a capital letter, and a core table mapping one to the
 *  other is exactly what this phase deleted. */
export const NAME = "Claude Code"

/**
 * ...AND WHAT A MACHINE THAT HAS NONE IS TOLD.
 *
 * Not `null`, even though this engine ships with olai: the face this feeds is
 * drawn exactly when NOTHING answered, and the most useful thing it can say
 * about the engine that is supposed to come baked in is that it is supposed to
 * come baked in. `where` is the page, because that is where this one is got.
 */
export const INSTALL: NotHere = {
  name: NAME,
  where: "https://claude.com/claude-code",
  why: "comes with olai — every documented way of starting it bakes the adapter in",
}
