/** Permanent management contract; capability schemas are composed separately. */
import { defineSurface } from "@kolu/surface/define"
import { Schema } from "effect"
import { OpFailure } from "@olai/format"
import { PluginRoster, NO_ROSTER, sameRoster } from "./plugins.ts"
import { Who } from "./who.ts"
import { App } from "./app.ts"
export { NO_ROSTER, type BuiltPlugin, type PluginRoster, type PluginState } from "./plugins.ts"
export type { Who } from "./who.ts"
export { surface as hostSurface } from "./core.ts"
/**
 * WHICH FACE SEES WHAT — core's own map, and the rule every row's map is
 * written against.
 *
 * ## One surface, callers that do not carry the same trust
 *
 * olai serves ONE surface to two kinds of caller: a browser tab on the
 * websocket, and an agent on `/mcp`. Each takes its own default-deny allowlist
 * in one shared grammar (`@kolu/surface/expose`), and "which face gets what" is
 * one decision per MEMBER, written beside the member.
 *
 * WHERE THE MAPS ARE: this one is core's, over the members `./core.ts`
 * declares. Every other member's is its ROW's, in that row's own package
 * against that row's own spec — `olai-plugin-outlines`' `surface.ts` and its
 * eight neighbours. The `surface://` RESOURCE map the MCP adapter resolves URIs
 * out of is each row's own `resources` map, which the MCP adapter resolves against that row's spec (juspay/kolu#2234), which is a different
 * question again: which members are published as resources at all, rather than
 * whether a given caller may reach one.
 *
 * They were three hand-written tables in `@olai/bundle`'s `faces.ts`, naming
 * every row's members from a package no row could edit — one permission typed
 * twice, which is #546's finding. That file is gone and this is what replaced
 * the general half of it.
 *
 * A FACE KEY A ROW DOES NOT WRITE IS A FACE IT DECLINES IN FULL. `browser` and
 * `agent` are the two keys; `exposeFaces` denies a sibling that writes no map
 * under one of them, and that absence is the decision rather than a gap. There
 * is no branch anywhere saying "plugins are browser-only" — the day a row
 * decides an agent may read one of its members, it writes the map in its own
 * package and nothing else changes.
 *
 * ## Nothing here can be gated by accident
 *
 * A key that names nothing in the spec is a BOOT error rather than a silent
 * no-op, and so is a key that would grant nothing. Which matters more than it
 * sounds: a gate that matches nothing denies everything and still binds, and
 * that is the one failure mode which looks like success from outside.
 *
 * A DENIAL IS PER REQUEST, not a disappearance. A caller reaching a member its
 * face does not name is refused with `SurfaceMemberNotExposed` naming the tag,
 * and the member stays BOUND and goes on answering whoever may have it — so a
 * denial is distinguishable from a version skew. `@olai/server`'s
 * `faces.test.ts` holds it over a real websocket.
 *
 * Until juspay/kolu#2170 only the MCP projection had an allowlist and the wire
 * faces served whatever the surface declared, which is why the ops request
 * vocabulary could not be on the surface at all: making it reachable to a
 * bridged agent was inseparably making it reachable to every open tab.
 *
 * ## `"resource"` and `"tool"` are the whole vocabulary
 *
 * `"resource"` is the READ face of a primitive: it grants the read verbs a
 * member declares and withholds `set`/`patch`/`upsert`/`delete`. Every cell and
 * collection olai declares is already wire-read-only, so no map is narrower
 * than the surface — but a map says it rather than inheriting it, which is what
 * makes adding a writable cell a decision instead of a leak.
 *
 * `"tool"` is the plain spelling throughout, and the `{ tool: { mutates } }`
 * hint is deliberately not used: a wire face reads MEMBERSHIP only, and
 * `mutates` is how an MCP host should PRESENT a call. That decision is made
 * where it is read — each row's own `tools.ts`, whose `kind` is what
 * `bespokeFrom` turns into `readOnlyHint` — and a second, unread copy of it in
 * a face map would be a second place to keep it right.
 *
 * ## THE RULE THE ELIGIBLE MEMBERS ARE CHOSEN BY IS ABOUT WIRE COST, not only
 * ## about secrecy
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
 * inherently eager. `@olai/server`'s `mcp/face.test.ts` is where that half is
 * fenced, against a real directory with a deliberately fat document in it,
 * because it is a property of the adapter's verb choice and cannot be seen from
 * a map at all.
 *
 * The rule decides ELIGIBILITY; the two maps of a row usually differ for a
 * second reason beside it, which is what the two consumers are. A render-shaped
 * consumer needs paint instructions — a badge, a month of dots, a rollup beside
 * a checkbox, a title as it reads right now — and a request-shaped one needs
 * things it can ACT on, which is nodes. Most of the browser-only members in
 * this tree are the first kind, and each says so where it is declared.
 *
 * WHAT A WRITE IS RECORDED AS is not a member's business and is on no map: a
 * face is served under the writer the composition root bound (`@olai/server`'s
 * `runtime.ts`, `writerAt`), which is where every other fact about a face is
 * decided too.
 *
 * The full argument, including the two deployment shapes and what is still owed
 * upstream, is https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-viewing.md.
 */
export const hostFaces = {
  browser: {
    // WHICH PLUGINS THIS BUILD HAS AND WHICH THIS SERVE RUNS — the preferences
    // panel's read-only rows, and the browser's alone because it is a paint
    // instruction and an agent has no panel.
    //
    // What an agent would ask this is already answered better by the surface
    // itself: a plugin that is off composes no sibling, so its tags are not in
    // the group and its resources are not published. A request-shaped reader
    // learns "kolu is not running" by there being no `surface/kolu/…` to call,
    // which is the same fact without a second place for it to be stale. A
    // render-shaped one cannot draw a row out of an absence, which is exactly
    // the asymmetry the header's last section is about.
    plugins: "resource",
    // ...AND THE SWITCH BESIDE THE READOUT, on this face and no other.
    //
    // A plugin that is off composes nothing, so an agent that could call this
    // could turn off the row that seats it, the row that watches its writes, or
    // the row whose tools it is holding — and then not be able to turn any of
    // them back on, because the face it was calling through went with them.
    // Enablement is the INSTANCE's, and the instance is a person at a panel.
    //
    // `olai-plugin-vault-plugins` draws the same line one narrowing over: an
    // agent may `plugins.stop` a definition the VAULT declares, because that is
    // code it wrote and can retract by deleting the node, and it may not
    // `plugins.approve` anything at all.
    "plugins.set": "tool",
    // WHO IS LOOKING on this connection — the browser's alone, because an agent
    // arrives on HTTP `/mcp` and has no login header on that face. The chip is a
    // paint instruction for a person (`./core.ts` argues the member).
    "who.get": "tool",
    // ...and its twin one fact over, for exactly that reason: what this
    // deployment is CALLED is a paint instruction — the tab's title, the
    // header's wordmark, the install manifest's name. An agent acts on the
    // vault, not on the chrome; a `hostname` tool would be `os.hostname()` with
    // a wire attached, for nobody.
    "app.get": "tool",
  },
  // CORE DECLINES THE AGENT FACE, and the empty map is the statement rather
  // than a stub: every member core declares is a reading of the served
  // INSTANCE, which is a panel's business and not a vault's. An agent's members
  // are the rows' — the writes, the reads and the plugin-authoring verbs — and
  // each row names them in its own `faces.agent`.
  agent: {},
} as const
