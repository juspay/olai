/**
 * The three faces of one surface, and what each may reach.
 *
 * olai serves ONE surface to three different callers, and they do not carry the
 * same trust: a browser tab on the websocket, an agent through the MCP adapter,
 * and an HTTP client on `/mcp`. Each takes its own default-deny allowlist, in one shared grammar
 * (`@kolu/surface/expose`), and this module is where all three are written so
 * that "which face gets what" is one decision read in one place rather than
 * three files that have to be compared.
 *
 * A key that names nothing in the spec is a BOOT error rather than a silent
 * no-op, in every one of them, and so is a key that would grant nothing. There
 * is no way to be gated by accident here — which matters more than it sounds,
 * because a gate that matches nothing denies everything and still binds, and
 * that is the one failure mode which looks like success from outside.
 *
 * Until juspay/kolu#2170 only the MCP face had one; the two wire faces served
 * whatever the surface declared. That is why the ops request vocabulary could
 * not be on the surface at all — making it reachable to a bridged agent was
 * inseparably making it reachable to every open tab — and it is what {@link
 * BROWSER} now says out loud.
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
 * upstream, is https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/surface-mcp-viewing.md.
 */

import { surface } from "@olai/surface"
import {
  type ExposeMap,
  exposeRootedFaces,
  type FaceExposure,
} from "@kolu/surface/expose"
import type { SurfaceMap } from "@kolu/surface/server"
import { exposeMapsOf, type PluginWire, surfacesOf } from "@olai/plugin-api"

/**
 * The MCP adapter's allowlist — what an agent may SEE.
 *
 * `outlines` is the item: its key set is the file list, and
 * `surface://collections/outlines/<path>` is one file's `{ rev, nodes, broken }`
 * — the same rows the browser draws, subscribable, so an agent watching one
 * outline is told when that outline moves instead of polling for it. The `rev`
 * rides along, which is the base a write will one day name.
 *
 * `documents` is the bodied half of the same directory — every `.md` and every
 * `.html` — and it is exposable for exactly the reason the rule above gives: it
 * is a COLLECTION, so its key-set resource costs the paths and a body travels
 * only when an agent asks for that one file. It is also declared `keys` + `get`
 * with no `deltas`, so there is not even a batched verb here to reach for by
 * mistake.
 *
 * `errors` is what is wrong across the set right now — and NOT how current the
 * set is, which is a different fact and was this comment's old claim. It said
 * an agent could tell a stale-but-valid tree from a current one through this
 * cell; that was grok's opening position in the 2026-08-25 lowy-electricity
 * sitting, retracted by him in round two and signed retracted in the closing.
 * The cell was EMPTY for the thirty minutes the server spent answering with
 * week-old truth, because nothing was invalid. Validity and currency are two
 * axes, and the second one is the vintage on a read's own answer
 * (`@olai/store`, and `./mcp/tools.ts` for the face an agent reads it on).
 * This resource still says nothing about it. It is a cell and it is eligible
 * because per-file breakage does NOT come through it — that rides
 * `OutlineEntry.broken` on the collection, per entity — leaving this one holding
 * cross-file failures only. It is the lesser instance of the rule above: a
 * corpus that somehow produced thousands of cross-file errors would want the
 * same treatment `manifest` got.
 *
 * It also carries the store's OTHER kind of failure now — a directory that
 * could not be READ, as an `unreadable-directory` error (`@olai/store`'s
 * `Codec.unreadable`) — and that lands here rather than needing a second
 * channel precisely because this is one surface member with two faces on it.
 * The browser draws it as the banner over its last-good tree and an agent
 * reads the identical rows off this resource: the same fact, in the same
 * vocabulary, at the same instant. "MCP and Web ops must be consistent"
 * is a property of the wiring here rather than something two
 * renderers have to be kept in step about — which is the argument for putting
 * it on this cell rather than on the reply of whichever verb noticed.
 *
 * `git` is whether the writes an agent makes are reaching a history — a cell of
 * one status and at most a sentence, so the cost rule is satisfied twice over,
 * and it is the same news the app header draws. An agent gets the reason on its
 * own write's reply (`Applied.why`), which is the channel that matters for the
 * write it just made; this is what lets it ask BEFORE writing, and what lets an
 * HTTP MCP client watching this directory notice that commits have started
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
 * Everything else is omitted, and three of them on purpose rather than by
 * oversight: `chat`, `transcript` and `saying` are the human's session and the
 * human's conversation — the last of them being that conversation's open row
 * as it is still being said. An agent that is not ours has no business watching
 * any of them, and the internal one watching its own state is a feedback loop.
 */
export const MCP: ExposeMap<typeof surface.spec> = {
  outlines: "resource",
  documents: "resource",
  errors: "resource",
  git: "resource",
  pending: "resource",
}

/**
 * THE BROWSER's face — everything a tab draws, and not one verb more.
 *
 * Written as the complement of one omission, and the omission is the whole
 * point of this map existing: `ops.*` is absent. Every cell, every collection,
 * the chat's ten verbs, `edit.apply`, the two search questions, the id lookup
 * behind the transcript's backticks, the tag completion's vocabulary and the
 * two git verbs are here because a page reads
 * or presses them; the ops request vocabulary is
 * not, because a browser sends INTENTS and the placement is the server's
 * (`@olai/surface`'s `edit.ts`, argued at length and unchanged by any of this).
 *
 * A tab that calls one anyway is refused per request with
 * `SurfaceMemberNotExposed` naming the tag — the member stays BOUND and
 * answers, rather than disappearing from the group, so a denial is
 * distinguishable from a version skew. Pinned in `./faces.test.ts`.
 *
 * `"resource"` is the READ face of a primitive: it grants the read verbs a
 * member declares and withholds `set`/`patch`/`upsert`/`delete`. Every cell and
 * collection olai declares is already wire-read-only, so nothing here is
 * narrower than the surface — but the map says it rather than inheriting it,
 * which is what makes adding a writable cell a decision instead of a leak.
 *
 * Two things are deliberately not narrowed. `chat` and `transcript` ARE the
 * human's session and conversation, and the browser is the human — this is the
 * face they belong to, and the one place they are exposed. `manifest` is here
 * for the same reason it is absent from {@link MCP}, inverted: a render-
 * shaped consumer genuinely needs the "has this directory ever loaded" bit that
 * a request-shaped one gets for free by blocking on the first frame.
 *
 * `pins` is a FOURTH, and the one that is a READING rather than a projection of
 * the files: the sidebar's shelf, answered per revision (`@olai/format`'s
 * `shelfOf`). An agent has no use for it and is not offered it — the shelf is an
 * ordinary outline, `Pins.olai`, and an agent reads it with `read_subtree` and
 * writes it with `add_node` / `move_node` / `trash_node`, which is the whole
 * point of the convention being titles in a file (docs/format.md's Pins). What
 * this member adds for a BROWSER is the resolution — a pin's node named as it
 * is called right now — which is a paint instruction for a column somebody is
 * looking at.
 *
 * `inbox` is that same kind of reading, one integer over: how many rows of
 * the inbox are marked `todo` or `doing`, at any depth (`@olai/format`'s
 * `inboxHeldOf`) — an unmarked row is furniture and a placement is not a
 * node. An
 * agent asking what the inbox holds asks `list_outlines` and is answered with
 * the nodes. A badge is a paint instruction for a door somebody is looking at.
 *
 * `agents` is that same kind of reading again, and since the human's 2026-09-02
 * ruling it is almost ENTIRELY one: the roster is the query
 * `prop:agent-session` over the set — which node, what it is called, which
 * engine and which conversation the property names, how big its subtree is —
 * with one line joined onto it, the last thing olai overheard that conversation
 * say (`./agents.ts`).
 *
 * The vault half an agent already has, and has better: `prop:agent-session` is
 * a query it can type into `search_nodes`, and it is answered with the NODES,
 * which are the thing it can act on. Serving it this member instead would be
 * handing it a pre-joined list it would have to un-join to do anything with.
 *
 * What is left is the overheard line, and that is a paint instruction for a
 * column somebody is looking at — one sentence, truncated to a row's width,
 * beside a state dot. It is also the one fact here that is about a panel rather
 * than about the vault, and an agent offered it would be reading what some
 * other conversation said while a person watched. So: the browser's, like the
 * shelf and the badge beside it.
 *
 * The argument used to rest on the SESSION POINTER being per-machine, and that
 * half is gone: the pointer is in the vault now, an agent can read it with the
 * same query, and it travels. What did not change is the answer — the reasons
 * above are the ones that were always underneath it.
 *
 * It satisfies the cost rule the way `pending` does rather than trivially: the
 * value is O(what somebody PINNED), which is a curated short list — it is
 * exactly the rows the sidebar draws, so a shelf too big for this member is a
 * shelf too big for the column it is drawn in.
 *
 * `heads` is a THIRD of that kind, and the sharpest: it is here and absent from
 * {@link MCP} because it answers a question only a render-shaped consumer asks.
 * A tab keeps a `.html` on screen and has to notice the file moving underneath
 * it without ever wanting what it now says (the frame fetches that over HTTP),
 * which is a subscription no request-shaped reader has an analogue of. An agent
 * reads a body when it wants one and hears about the change on
 * `notifications/resources/updated` for the key it already holds; a second
 * resource carrying the revision it would then read anyway is a URI published
 * for nobody. It costs nothing to add the day something asks.
 *
 * `dated` and `owed` are a FOURTH and FIFTH, and they are the two STREAMS
 * this surface grew for `vault-in-browser`'s PR 4 — the sidebar's month of
 * dots and its count of what is late. Same test as `heads`, same answer: they
 * are questions only a render-shaped consumer asks. A month of dots is a paint
 * instruction for a grid somebody is looking at, and two integers about the
 * reader's own today are a badge. An agent asking what is late asks
 * `search_nodes` with a date clause and is answered with the NODES — which is
 * the thing it can act on, and the thing neither of these carries. They also
 * take an INPUT, which the `surface://` resource vocabulary has no place to
 * put: an agent could not name a month if it wanted one.
 *
 * `page` and `moving` are a SIXTH and SEVENTH of exactly that kind, and they
 * are the design's own last row (PR 10). What `page` answers is a SCREEN: rows
 * carrying the fold keys of the places they are drawn at, a rollup beside a
 * checkbox, the blockers a mark draws, and the titles of the ids those rows
 * point at. An agent asking what an outline holds asks `list_outlines` and
 * `read_subtree` and is answered in NODES — which is what it can act on, and
 * what none of this is. `moving` is a dim and a sentence for a list of rows
 * somebody is arrowing through; an agent moving a node calls `move_node` and is
 * refused by the planner, in the planner's own words.
 *
 * **`outlines` IS ABSENT, and that absence is what this whole arc was for.** It
 * was the first member in this map, and every page in the app was a pure
 * function over the tab's own copy of it — which is the ruling that was
 * reversed: the browser may hold at most the current page's data, never the
 * whole vault. A tab now reads `heads` for the directory and `page` for the
 * page it is drawing, and asks for no record it does not draw. The member is
 * untouched on {@link MCP} below: watching ONE outline's records, keyed, with
 * deltas, is exactly what a request-shaped reader wants, and it was never the
 * problem.
 */
export const BROWSER: ExposeMap<typeof surface.spec> = {
  documents: "resource",
  dated: "resource",
  owed: "resource",
  page: "resource",
  narrowing: "resource",
  moving: "resource",
  heads: "resource",
  pins: "resource",
  inbox: "resource",
  errors: "resource",
  manifest: "resource",
  git: "resource",
  pending: "resource",
  // WHICH PLUGINS THIS BUILD HAS AND WHICH THIS SERVE RUNS — the preferences
  // panel's read-only rows, and the browser's alone for the reason `manifest`
  // is: it is a paint instruction, and an agent has no panel.
  //
  // What an agent would ask this is already answered better by the surface
  // itself: a plugin that is off composes no sibling, so its tags are not in
  // the group and its resources are not published. A request-shaped reader
  // learns "kolu is not running" by there being no `surface/kolu/…` to call,
  // which is the same fact without a second place for it to be stale. A
  // render-shaped one cannot draw a row out of an absence, which is exactly
  // the asymmetry the `heads`, `pins` and `inbox` paragraphs above are about.
  plugins: "resource",
  // A PLUGIN'S MEMBERS ARE NOT IN THIS MAP, and the eight that were are the
  // whole reason this file stopped being where the decision lived for them.
  // A daemon link, a fleet, a watcher pulse, a mute list, an events ring, a
  // live pane, a screen read and a set of CI runs sat here as rows in a
  // general package's allowlist — which meant that adding a member to an
  // appliance required editing a file two packages away, and forgetting to
  // was a member no face served, reaching a person as a chip that never fills
  // with nothing red anywhere.
  //
  // Each plugin writes its OWN map now, against its own spec, in its own
  // package, and the reasons travelled with them unchanged: every one of those
  // members is a reading of somebody else's daemon, and an agent that wants
  // that daemon has that daemon's own MCP face. What composes the per-plugin
  // maps onto this one is {@link facesOf} below.
  "edit.apply": "tool",
  "search.nodes": "tool",
  "nodes.named": "tool",
  "nodes.homes": "tool",
  "vocabulary.tags": "tool",
  "git.commit": "tool",
  "git.push": "tool",
  "git.resume": "tool",
  "who.get": "tool",
  // `app.get` is on this face and no other for exactly `who.get`'s reason:
  // what this deployment is CALLED is a paint instruction for a person — the
  // tab's title, the header's wordmark, the install manifest's name. An
  // agent acts on the vault, not on the chrome; a `hostname` tool would be
  // `os.hostname()` with a wire attached, for nobody.
  "app.get": "tool",
}

/**
 * THE AGENT's face — what `/mcp` may reach.
 *
 * DERIVED from {@link MCP} rather than written beside it, and that is the
 * load-bearing line in this module. `/mcp` exists to serve one client: an
 * agent talking to this store. What that client is served is `MCP`'s
 * resources plus `@olai/ops`' tool table — so what it must be able to CALL
 * is exactly `MCP` plus the members those tools land through. Spelled as a
 * second literal, the day somebody exposed a sixth resource would be the
 * day an agent could read it on one path and not the other.
 *
 * The procedures added on top are the tool table's three arms, and nothing
 * else: `ops.*` (the nineteen writes and the five reads that had no procedure),
 * plus `search.nodes`, `git.commit` and `git.push` — the three members BOTH
 * doors call, because none of them has an agent-specific version.
 *
 * `nodes.named` and `nodes.homes` are the two members of shared groups that are
 * NOT here, and each is a fact about what an agent would do with them rather
 * than a restriction. The first answers a dozen ids with the node each one
 * names, for a panel deciding which of an agent's own backticks are pressable:
 * an agent asking whether an id is real asks `read_node` and is told everything
 * about it. The second answers a file per id and a list of paths, for a browser
 * reconciling a memory of what it had collapsed: an agent that wants to know
 * where a node lives reads it, and is told beside everything else about it.
 *
 * The `narrowing` stream is absent for that kind of reason and is a RESOURCE
 * rather than a procedure, so it never reached this map at all: it answers with
 * a set of ids and why, which is only useful to a caller already looking at the
 * rows those ids name. An agent asking which nodes match asks `search_nodes`
 * and is answered with the nodes.
 *
 * `vocabulary.tags` is absent for the same kind of reason and is a whole GROUP
 * rather than one member of one: it answers a POPUP — as many rows as the
 * widget that asked has room for, ranked by how much this set uses each word —
 * and an agent writing `#home` writes the word.
 *
 * `who.get` is absent because who is looking is a fact about THIS TAB, stamped
 * on the websocket upgrade: an agent arrives on HTTP `/mcp` and has no login
 * header on that face. The chip is a paint instruction for a person.
 *
 * What a commit is RECORDED AS does differ, and it is not a member's business:
 * this face is served under the writer the composition root bound
 * (`./runtime.ts`'s `writerAt`), which is where every other fact about a face
 * is decided too.
 *
 * `"tool"` is the plain spelling throughout, and the `{ tool: { mutates } }`
 * hint is deliberately not used: a wire face reads MEMBERSHIP only, and
 * `mutates` is how an MCP host should PRESENT a call. That decision is made for
 * this surface where it is read — `@olai/ops`' table, whose `kind` is what
 * `bespokeFrom` turns into `readOnlyHint` — and a second, unread copy of it
 * here would be a second place to keep it right.
 *
 * WHAT IS ABSENT is the same list as `MCP`'s, for the same reasons, plus
 * `edit.apply`: that one is the KEYBOARD's, deliberately narrower than the ops
 * request vocabulary, and an agent reaching it would be an agent sending
 * intents about a screen it cannot see.
 */
export const AGENT: ExposeMap<typeof surface.spec> = {
  ...MCP,
  "ops.run": "tool",
  "git.commit": "tool",
  "ops.outlines": "tool",
  // The reading the `capture` TOOL resolves against, and the one member here
  // that is not itself a tool: which outlines there are, which is what the
  // inbox convention is read off (`@olai/ops`' `Planning`). It is exposed for
  // the same reason `ops.run` is — a tool this face advertises lands through it
  // — and it is `"tool"` like its neighbours because this map reads MEMBERSHIP
  // and nothing else (see below).
  "ops.paths": "tool",
  "ops.node": "tool",
  "ops.subtree": "tool",
  "ops.documents": "tool",
  "ops.document": "tool",
  "search.nodes": "tool",
  "git.push": "tool",
}

/** The name each face is known by in a plugin's own `faces` record — the key
 *  `exposeMapsOf` asks each plugin for. Two words, spelled once here, because
 *  a face's composition is what names the maps it wants: a plugin that writes
 *  no map under one of them is DENIED that face in full, which is what
 *  `exposeFaces` does with an absent map and is what declining a face means. */
const BROWSER_KEY = "browser"
const AGENT_KEY = "agent"

/**
 * THE TWO WIRE FACES, over olai's surface AND every plugin sibling composed
 * beside it.
 *
 * ## Why this is a function where it was two constants
 *
 * `restrictHandlers` compares an exposure's UNIVERSE with the tags the group
 * actually serves, as a set EQUALITY in both directions, and refuses at boot
 * naming every tag it cannot account for. That check is the reason a
 * default-deny gate can be trusted at all — a map built against a different
 * surface grants nothing and still binds, which is the one failure mode that
 * looks like success from outside — and it is also why a face cannot be a
 * module constant any more: which plugins a runtime composed is a fact about
 * THAT runtime (`./runtime.ts`'s `Wiring.plugins`), and a face minted before
 * anybody asked would describe a surface no particular process serves.
 *
 * So the faces are built from the same list the runtime composed from, at the
 * same moment, and `bind` returns them beside the group they describe. Two
 * readings of "which plugins are on" would be exactly the boot crash the
 * equality exists to raise — which is the right failure, and the reason nothing
 * here tries to be clever about a half that is missing.
 *
 * ## What each half is
 *
 * ONE CONSTRUCTOR takes both. `exposeRootedFaces` is the third member of the
 * family — `exposeFace` for a standalone surface, `exposeFaces` for a sibling
 * bundle, this one for a ROOT beside siblings — and it is what olai's shape has
 * always been: core keeps its unprefixed tags and the plugins compose around
 * them. The root's map is olai's own, unchanged and unchangeable by any plugin;
 * the per-plugin decision lives in each plugin's own map, written in its own
 * package against its own spec, so its keys are compiler-checked and `"a.b"`
 * cannot mean two things depending on whether `a` is a namespace or a sibling.
 *
 * This used to be two exposures unioned by hand, and the seam was cut wrong in
 * a way nothing downstream could catch: a set union of two `FaceExposure`s
 * carries an unwritten precondition — that the two groups are DISJOINT — and
 * when they are not, the union silently keeps one copy of the shared tag, the
 * universe still set-equals a group merged just as carelessly, `restrictHandlers`
 * sees nothing wrong, and the face serves one member under the other's policy.
 * The constructor establishes the disjointness instead (the SAME counted merge
 * the serve path runs) and refuses a root that is not standalone. Both were
 * true here by construction; neither was proved.
 *
 * ## The AGENT face gets no plugin maps, and that is DATA
 *
 * Neither tenant writes an `agent` map, so `exposeMapsOf` returns an empty
 * record for that key and `exposeFaces` denies every sibling in full — the
 * universe still names their tags, so the face binds and the members answer
 * `SurfaceMemberNotExposed` to whoever asks. There is no branch here that says
 * so, and there must not be: the day a plugin decides an agent may read one of
 * its members, it writes the map in its own package and this function composes
 * it without changing. A hardcoded "plugins are browser-only" would be core
 * holding a decision that belongs to the plugin.
 *
 * The MCP adapter takes the {@link MCP} MAP itself and not one of these: it
 * needs the member KIND to resolve a `surface://` URI or a tool name, which a
 * tag set has thrown away. It is core-only for that reason too — a `surface://`
 * URI has no sibling segment.
 */
export const facesOf = (
  plugins: ReadonlyArray<PluginWire>,
): { readonly browser: FaceExposure; readonly agent: FaceExposure } => {
  // The same cast `./runtime.ts` makes at `implementSurfaces` and for the same
  // reason: the framework's map type pins each value's own spec, which is exact
  // for a literal and is not what a record walked off a registry is. What it
  // costs is nothing a plugin's own map could get wrong — those are checked
  // where they are written — and `exposeFaces` re-derives the composition it
  // gates from the surfaces themselves, so the tags it names and the tags the
  // runtime serves come from one walk.
  const siblings = surfacesOf(plugins) as unknown as SurfaceMap
  // ...and the same erasure on the maps, for the same reason one line up: a
  // plugin's map is written against that plugin's OWN spec, where its keys are
  // compiler-checked and a stray one is a type error in the plugin's package.
  // What arrives here is a record keyed by a name read off a registry, so the
  // key check has already happened where it could; `exposeFaces` still refuses
  // at boot a map naming a member the sibling does not declare, and a map keyed
  // by a sibling this bundle does not have.
  const mapsFor = (face: string) =>
    exposeMapsOf(plugins, face) as unknown as Record<string, ExposeMap<never>>
  return {
    browser: exposeRootedFaces(surface, BROWSER, siblings, mapsFor(BROWSER_KEY)),
    agent: exposeRootedFaces(surface, AGENT, siblings, mapsFor(AGENT_KEY)),
  }
}
