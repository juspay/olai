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
 * **Which is why `manifest` is absent, and stays absent.** It used to be
 * `NullOr({ documents: Array({ file, text }) })` — nothing but the corpus of
 * `.md` bodies — so `surface://cells/manifest` would have handed an agent every
 * document in the served directory as one blob, re-read in full whenever any
 * one of them changed. `snapshot-scale` has since cut the documents out of it
 * into a collection of their own, which is the line above; what is left is
 * `NullOr(Struct({}))`, a fact with no fields whose whole job is the
 * never-loaded bit. An agent does not need that bit — `resources/read` blocks
 * on the first frame either way, so "the store has not loaded yet" is absorbed
 * by the read waiting rather than needing a tri-state. A request-shaped consumer
 * does not need what a render-shaped one does. So the cell was never exposed and
 * now has nothing to expose: no URI was published and withdrawn.
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
 * `documents` is the `.md` half of the same directory, and it is exposable for
 * exactly the reason the rule above gives: it is a COLLECTION, so its key-set
 * resource costs the paths and a body travels only when an agent asks for that
 * one document. It is also declared `keys` + `get` with no `deltas`, so there
 * is not even a batched verb here to reach for by mistake.
 *
 * `errors` is what is wrong across the set right now, so an agent can tell a
 * stale-but-valid tree from a current one. It is a cell and it is eligible
 * because per-file breakage does NOT come through it — that rides
 * `OutlineEntry.broken` on the collection, per entity — leaving this one holding
 * cross-file failures only. It is the lesser instance of the rule above: a
 * corpus that somehow produced thousands of cross-file errors would want the
 * same treatment `manifest` got.
 *
 * `git` is whether the writes an agent makes are reaching a history — a cell of
 * one status and at most a sentence, so the cost rule is satisfied twice over,
 * and it is the same news the app header draws. An agent gets the reason on its
 * own write's reply (`Applied.why`), which is the channel that matters for the
 * write it just made; this is what lets it ask BEFORE writing, and what lets an
 * `olai mcp` client watching this directory notice that commits have started
 * failing without making one.
 *
 * `pending` is what is WAITING to be committed, and it is the other half of the
 * `commit` tool: the tool is how an agent records its work, and this is how it
 * knows there is work to record and what the record will say. Without it an
 * agent under the default `--commit=manual` is writing into a state it cannot
 * observe — it would have to commit blind, or shell out to `git status`, which
 * is the file access this whole surface exists not to have. It also carries
 * `last`, so an agent can tell "nothing is waiting because I just committed"
 * from "nothing is waiting because olai has never recorded anything here" —
 * two facts an empty change list cannot separate, which is the same `null` the
 * pill is built around.
 *
 * **It satisfies the cost rule, but not trivially, so here is the bound.** A
 * cell is read whole on every `resources/read`. `Pending` is O(what is DIRTY),
 * not O(corpus): a clean directory is a handful of scalars, and the ordinary
 * case under manual mode is the few nodes an agent has just touched. The worst
 * case is real — a `git pull` that rewrites every outline makes every node in
 * the set a change — and it is bounded by two things rather than hoped away.
 * Committing empties it, which is the one action this resource exists to
 * prompt; and the body list a message carries is capped (`BODY_LINES` in
 * `@olai/ops`' `message.ts`) even when the change list is not. If that worst
 * case ever stops being rare, the answer is the one `manifest` got: a
 * collection keyed by file, read one at a time. It is NOT the answer today,
 * because "what is waiting" is a question about the whole directory and a
 * per-file projection of it would make an agent ask N times to learn whether to
 * commit once.
 *
 * Everything else is omitted, and two of them on purpose rather than by
 * oversight: `chat` and `transcript` are the human's session and the human's
 * conversation. An agent that is not ours has no business watching either, and
 * the internal one watching its own state is a feedback loop.
 */
export const EXPOSE: ExposeMap<typeof surface.spec> = {
  outlines: "resource",
  documents: "resource",
  errors: "resource",
  git: "resource",
  pending: "resource",
}
