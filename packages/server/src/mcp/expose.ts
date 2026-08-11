/**
 * What an agent may see of the surface — the default-deny allowlist.
 *
 * `@kolu/surface-mcp` reaches nothing that is not named here: an omitted cell,
 * collection or procedure has no URI and no tool, and a key that names nothing
 * in the spec is a BOOT error rather than a silent no-op (`resolveExpose`). So
 * this file is the whole of the read side's authz, and it is deliberately three
 * entries long.
 *
 * **The rule this list is written against is about WIRE COST, not only about
 * secrecy**, and it is the one that decides which cells are eligible at all:
 *
 * > A cell is exposable iff its value is O(1)-ish. Anything O(corpus) must be a
 * > COLLECTION, where the projection reads keys cheaply and bodies one at a
 * > time.
 *
 * That falls straight out of the adapter rather than being a preference of
 * ours. `resolveCall` picks the verb by kind — `keys` for a collection, `get`
 * for a cell — so a collection's `surface://collections/<k>` resource reads the
 * KEY SET and never the contents (there is no verb in the adapter that reads a
 * collection whole), while a cell's resource reads the entire value on every
 * `resources/read`, and every `notifications/resources/updated` invites another
 * one. The collection projection is inherently lazy; the cell projection is
 * inherently eager.
 *
 * **Which is why `manifest` is absent, and stays absent.** It is
 * `NullOr({ documents: Array({ file, text }) })` — nothing but the corpus of
 * `.md` bodies — so `surface://cells/manifest` would hand an agent every
 * document in the served directory as one blob, re-read in full whenever any
 * one of them changed. That is the `snapshot-scale` defect reproduced on the
 * agent wire with none of the browser's mitigations. When that roadmap item
 * lands, documents become a collection of their own and arrive here as one more
 * line; the cell is left holding the never-loaded bit, which an agent does not
 * need — `resources/read` blocks on the first frame either way, so "the store
 * has not loaded yet" is absorbed by the read waiting rather than needing a
 * tri-state. A request-shaped consumer does not need the bit a render-shaped one
 * does.
 *
 * The full argument, including the two deployment shapes and what is still owed
 * upstream, is docs/brainstorming/surface-mcp-viewing.md.
 */

import { surface } from "@olai/surface"
import type { ExposeMap } from "@kolu/surface-mcp"

/**
 * The allowlist.
 *
 * `outlines` is the item: its key set is the file list, and
 * `surface://collections/outlines/<path>` is one file's `{ rev, nodes, broken }`
 * — the same rows the browser draws, subscribable, so an agent watching one
 * outline is told when that outline moves instead of polling for it. The `rev`
 * rides along, which is the base a write will one day name.
 *
 * `errors` is what is wrong across the set right now, so an agent can tell a
 * stale-but-valid tree from a current one. It is a cell and it is eligible
 * because per-file breakage does NOT come through it — that rides
 * `OutlineEntry.broken` on the collection, per entity — leaving this one holding
 * cross-file failures only. It is the lesser instance of the rule above: a
 * corpus that somehow produced thousands of cross-file errors would want the
 * same treatment `manifest` got.
 *
 * Everything else is omitted, and two of them on purpose rather than by
 * oversight: `chat` and `transcript` are the human's session and the human's
 * conversation. An agent that is not ours has no business watching either, and
 * the internal one watching its own state is a feedback loop.
 */
export const EXPOSE: ExposeMap<typeof surface.spec> = {
  outlines: "resource",
  errors: "resource",
}
