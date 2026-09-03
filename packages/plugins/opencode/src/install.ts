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
