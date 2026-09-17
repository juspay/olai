/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent once.
 *
 * THE SERVER HALF IS THE ONE THAT SPENDS IT: {@link ./server.ts}'s probe hands
 * this value back as the `NotHere` arm of its answer, so the roster publishes
 * a row for a machine that has not got this engine with the sentence attached —
 * the picker draws it greyed, the plugins panel files it under Needs you, and
 * the detection log names it. The browser contributes its mark and its own
 * inspector row; both read the published standing rather than a second sentence.
 *
 * A MODULE OF ITS OWN rather than lines inside `./server.ts`, because that
 * bench must not open the server door: `packages/tests` runs under a process
 * with no browser in it, and a claim about two strings would drag the plugin
 * runtime onto its graph.
 *
 * IT IS A WHOLE SENTENCE and core composes no clause of it. **Core displays a
 * sentence and never composes one** — the reason there is no template with a
 * noun dropped into it: what an engine is and how you get it are facts only its
 * own package knows.
 */

import type { NotHere } from "@olai/acp/engine"

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
