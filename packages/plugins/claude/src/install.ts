/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent twice.
 *
 * BOTH HALVES NEED IT and they share no graph: the server half registers it as
 * the `missing` on `Agents` (so a log line and a future reader of the registry
 * have it), and the browser half draws it on the face the panel shows when this
 * machine has no agent at all. A module with no imports of its own is what a
 * `./server` and a `./browser` can both open without either learning what the
 * other is made of.
 *
 * IT IS A WHOLE SENTENCE and core composes no clause of it. **Core displays a
 * sentence and never composes one** — the same rule an absent MCP server's
 * `why` is carried under, and the reason there is no template here with a noun
 * dropped into it: what an engine is and how you get it are facts only its own
 * package knows.
 */

import type { NotHere } from "@olai/acp/engine"

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
