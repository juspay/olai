/**
 * WHO THIS ENGINE IS, AND HOW A PERSON GETS IT — spelled once, spent once.
 *
 * THE SERVER HALF IS THE ONE THAT SPENDS IT: {@link ./server.ts}'s probe hands
 * this value back as the `NotHere` arm of its answer, so the roster publishes
 * a row for a machine that has not got this engine with the sentence attached.
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

export const NAME = "Codex"

export const INSTALL: NotHere = {
  name: NAME,
  where: "https://developers.openai.com/codex",
  why: "not found — olai was started without the wrapper that carries the pinned adapter",
}
