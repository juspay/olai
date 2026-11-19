/**
 * HOW A PERSON GETS THIS ENGINE — spelled once, spent once. Its name is
 * `@kolu/acp-claude`'s `NAME`, the one both products show.
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
 * sentence and never composes one** — the same rule an absent MCP server's
 * `why` is carried under, and the reason there is no template here with a noun
 * dropped into it: what an engine is and how you get it are facts only its own
 * package knows.
 */

import { NAME } from "@kolu/acp-claude"
import type { NotHere } from "@kolu/acp/engine"

/**
 * ...AND WHAT A MACHINE THAT HAS NONE IS TOLD.
 *
 * IT SAYS THE CAUSE rather than the ordinary case, and the difference matters
 * because of WHEN it is read. This engine does ship with olai — the adapter is
 * baked into the wrapper on every documented way of starting it — so the only
 * way anybody reaches this sentence is a start that went round all of them. A
 * row that said "comes with olai" would be telling a person the thing that is
 * true everywhere except where they are standing, which is the shape of an
 * error message that reads as correct and helps nobody.
 *
 * `where` is null: installing the product does not restore olai's missing
 * wrapper. The adapter is olai's to provide, not the user's to download.
 */
export const INSTALL: NotHere = {
  name: NAME,
  where: null,
  why: "not found — olai was started without the wrapper that carries the pinned adapter",
}
