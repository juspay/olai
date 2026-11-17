/**
 * THE NODE AGENTS OF A SET — every node carrying a property this vault declares
 * a node-agent SESSION, which is the whole of what makes one.
 *
 * A node agent is not a thing olai stores anywhere: it is a NODE, and the
 * property is the association. The node's title is the agent's name, its `desc`
 * is its charter, and its SUBTREE is its memory — a chat session bound to it is
 * cattle, thrown away and recreated, because what the agent knows is written in
 * the outline rather than in a transcript
 * (https://github.com/juspay/oss.olai/blob/main/brainstorming/node-agents.md).
 *
 * So the roster is a QUERY and this module is that query, answered where the
 * set is: `prop:<the declared key>`, in the search grammar's own words
 * (website/docs/search.md), read off the derivation instead of typed into a box. Which
 * is also why there is nothing to store and nothing to keep in step — put the
 * property on a node and the row is there on the frame the store publishes;
 * take it off and the row is gone.
 *
 * ## ONE KEY, AND IT CARRIES BOTH HALVES
 *
 * One value says which ENGINE this node's agent runs on and WHICH CONVERSATION
 * it is talking through:
 *
 *     <the key>: claude                     a node agent with no session yet
 *     <the key>: claude:0f3c8d21-…          ...and one that is bound
 *
 * The engine is required and the session is optional, which is what lets one
 * key do the work two were doing: the value's presence is what makes the node a
 * node agent, and its second half is the pointer. A node agent that has never
 * been given a session is expressible IN THE VAULT rather than by the absence
 * of a row in a file somewhere else.
 *
 * SPLIT ON THE FIRST COLON, and only the first: an engine id is a PLUGIN'S OWN
 * WORD — one row of `olai.yml`, so a lower-case slug with no colon in it — while
 * a session id is somebody else's opaque string and may hold several.
 *
 * ## Why the binding is in the vault at all, and what a second machine sees
 *
 * It was in this machine's state until the human's ruling of 2026-09-02: ALL
 * config lives in `.olai` files or their properties. The old arrangement kept
 * the pointer beside the which-conversation note, on the argument that a
 * session id means nothing to another machine's agent — which is TRUE, and is
 * now a thing the vault says out loud rather than a reason to hide it.
 *
 * So: a vault served from two machines carries ONE pointer, and it is machine-A
 * shaped. Machine B draws the row — the engine half is durable and true
 * everywhere — and pressing it asks B's own agent for a conversation it does
 * not have, which comes back as that agent's own refusal on the roster's line.
 * Binding it on B REWRITES the property, and A's pointer is gone. That is the
 * cost, and it is the cost of the ruling rather than a defect in it: two
 * machines share one board, so they share one pointer, and the last one to bind
 * wins — visibly, in a file, through the ops layer, rather than silently in a
 * state directory neither could see.
 *
 * What is NOT in the vault is anything olai learns per turn: what an agent last
 * said, and whether a session has been taught its contract, stay in this
 * machine's own state (`olai-plugin-chat`'s `sessions.ts`) because they are
 * bookkeeping rather than config — and because a board written to on every turn
 * is a board committed on every turn.
 *
 * ## THE KEY ARRIVES AS DATA, which is what this module stopped owning
 *
 * There was an `AGENT_PROP` here — the literal `"agent-session"` — spelled once
 * and read by four packages, on the argument that a node agent is CORE'S: the
 * panel's own subject rather than an appliance's face, so *put an
 * `agent-session` prop on a node* had to be true of every vault, or the sentence
 * that creates a node agent would need a second sentence about declaring one
 * first.
 *
 * The chat panel is a PLUGIN now, and the premise went with it. A key's
 * SPELLING is not a licence, and this key carries the sharpest one in the tree:
 * a value here decides which node a session is fenced to, which subtree it may
 * write in, and which ancestor a refusal names. A vault that happens to call a
 * column `agent-session` and means something else by it was, until that phase, a
 * vault whose column olai read as a binding. So it is a CONTRIBUTED KIND like
 * every other one ({@link ./typing.ts}, website/docs/live-properties.md): the plugin
 * teaches the word, the registry composes it under that plugin's own name, and a
 * vault row moves it to whatever column a person likes.
 * `olai-plugin-chat`'s `kinds.ts` argues the whole of it and holds both
 * spellings.
 *
 * WHICH LEAVES THIS PACKAGE WITH NO WORD TO SPELL, deliberately. The reading
 * below takes the vault's DECLARATIONS and the kind's WORD from its caller, the
 * way every other plugin-facing reading here does ({@link ./typing.ts}'s
 * `textDeclaredAs`, which is how the key is actually found, and
 * `olai-plugin-kolu`'s `claimantsIn` one property over). A general package
 * holding a constant that spelled a plugin's word would be the name-matching the
 * kind arrangement exists to end, wearing a `const`.
 *
 * WHICH COLUMN A VAULT KEEPS ITS BINDINGS IN IS THE VAULT'S, and it says so the
 * way it says everything else: one row —
 * `{"title":"agent-session","custom":{"type":"chat-agent-session"}}` — puts the
 * kind on whatever key a board likes. olai writes that row for nobody, because a
 * tool that edited somebody's declarations file to keep its own feature working
 * would be that vault's judgement overruled by a release; and an undeclared
 * column is read as no binding at all, which is the same rule from the other
 * side. The validator files nothing about any of it — one used to, and darkened
 * the declarations page it was asking a person to edit.
 */
import { Schema } from "effect"

import { type Derived, under } from "./derive.ts"
import { isMarkdown } from "./document.ts"
import { type Claims, nameOf, textKind } from "./kinds.ts"
import { isPutAway, isRegular } from "./node.ts"
import { documentAt, markdownIn, type OutlineSet } from "./set.ts"
import { declaresKind, type PropDeclarations, textDeclaredAs } from "./typing.ts"

/**
 * ONE BINDING VALUE, read — or `null` for a value that is not one.
 *
 * TOTAL over any string, because a `custom` value is somebody's prose: an empty
 * value, and one whose engine half is empty (`:sess-1`), name no engine and so
 * name no node agent. A trailing colon with nothing after it (`claude:`) is an
 * engine with no session, which is the same thing `claude` says and is read as
 * it — a person mid-edit is not a person making a mistake.
 *
 * THE FIRST COLON and only the first, so a session id carrying its own colons
 * survives the round trip.
 *
 * IT IS ALSO THE KIND'S OWN ADMISSION RULE, spent rather than spelled twice:
 * `olai-plugin-chat`'s `kinds.ts` admits exactly the values this answers about,
 * because a value the kind took and this reading refused would be two answers
 * about one string.
 */
export const sessionIn = (
  value: string,
): { readonly engine: string; readonly session: string | null } | null => {
  const at = value.indexOf(":")
  const engine = at === -1 ? value : value.slice(0, at)
  if (engine === "") return null
  const session = at === -1 ? "" : value.slice(at + 1)
  return { engine, session: session === "" ? null : session }
}

/** ...and the value a WRITER composes, which is the same rule read backwards —
 *  spelled here so the gesture that binds a node and the reading that draws it
 *  cannot come to disagree about a colon (`olai-plugin-chat`'s
 *  `server/binding.ts`). */
export const sessionValue = (engine: string, session: string | null): string =>
  session === null ? engine : `${engine}:${session}`

/**
 * WHAT A CONVERSATION CAN BE ABOUT — a node, or a note.
 *
 * Two things in a served directory carry a chat, and they carry it the same
 * way: a NODE keeps the binding on its row and its memory in the rows under
 * it; a NOTE — a `.md` — keeps the binding in its front matter and IS its own
 * memory. Nothing else has one. A picture, a `.csv`, a saved page, a whole
 * outline and a plugin's page are things olai shows, with nowhere to write a
 * binding and nothing to be the memory of a conversation.
 *
 * A SUM rather than `{ id?, path? }`, for `./address.ts`'s reason one module
 * over: the optional-halves shape makes the illegal combinations
 * representable and pushes "which fields may co-occur" into every reader.
 */
export const AgentItem = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("node"), id: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("note"), path: Schema.String }),
])
export type AgentItem = typeof AgentItem.Type

/**
 * THE ROSTER KEY OF AN ITEM — a node's id, or `/` and a note's root-relative
 * path.
 *
 * ONE STRING, because every verb that was about a node is now about an item
 * and a wire is a poor place for a sum that half its callers would spell by
 * hand. The two namespaces cannot collide: an id olai writes is
 * `[A-Za-z0-9_-]+` ({@link ./node.ts}'s `ID_SHAPE`), so none of them opens
 * with a slash, and a served path is always relative so every note's key does.
 */
export const itemKey = (item: AgentItem): string => item.kind === "node" ? item.id : `/${item.path}`

/** ...and the same rule read backwards, so a key that crossed the wire names
 *  the item it was made of. */
export const itemOf = (key: string): AgentItem =>
  key.startsWith("/") ? { kind: "note", path: key.slice(1) } : { kind: "node", id: key }

/** Whether a path names a NOTE — a file of the kind a note is written in, as
 *  the DIRECTORY's claim table says it: a kept text body that is not a half
 *  somebody's plugin is made of. The same three tests {@link isMarkdown}
 *  makes of a document, asked of a path, because no suffix is this package's
 *  to spell — the row that claims one owns it. Whether the set is actually
 *  SERVING a note there is {@link seatableNote}'s question, and it holds the
 *  set to answer it with. */
export const isNotePath = (claims: Claims, path: string): boolean => {
  const kind = textKind(claims, path)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  return claim !== undefined && claim.kept && claim.opaque !== true
}

/**
 * ONE CHAT'S ITEM, as the set knows it.
 *
 * A reading of the RECORD and nothing else: which kind of item it is, where it
 * is, what it is called, which engine and which conversation the binding names,
 * how big its memory is, and whether it opens beside the page. Everything a
 * person actually WATCHES — is it working, what did it last say — is about what
 * that conversation is doing, which is not a fact about a vault at all.
 *
 * ONE SHAPE FOR BOTH KINDS, rather than a roster of nodes and a roster of
 * notes: every face that draws a chat draws the same row, and the two facts
 * that differ — which kind it is, and whether it opens beside — are fields
 * rather than a second collection a face could forget to read.
 */
export const NodeAgent = Schema.Struct({
  /** WHICH KIND OF ITEM carries this chat: an outline row, or a `.md`. */
  kind: Schema.Literals(["node", "note"]),
  /** The item's own key — a node's id, or `/` and a note's path
   *  ({@link itemKey}): what a door presses, what a binding names, and what
   *  the panel's header jumps to. */
  id: Schema.String,
  /** Where it is, root-relative: the outline a node is written in, or the
   *  note's own path. */
  file: Schema.String,
  /** What it is called, live: a node's title, or a note's name
   *  ({@link ./kinds.ts}'s `nameOf` — `plan` for `notes/plan.md`). Rename
   *  either and the roster says the new name on the frame the store
   *  publishes, because there is no second copy of it anywhere to go stale. */
  title: Schema.String,
  /**
   * WHICH ENGINE this node's agent runs on — the first half of the property's
   * value, and one of the ENABLED ENGINE PLUGINS' ids where the vault names one
   * this machine has.
   *
   * NOT resolved to an installed agent here, and that is the honest half: the
   * property is a fact about the BOARD and travels between machines, while
   * which agents are installed is a fact about a laptop. A vault naming an
   * engine nobody here has is a node agent whose roster row says so rather than
   * one that disappears — what it is CALLED is the browser's lookup in that
   * same table, which falls back to the id it was given.
   */
  engine: Schema.String,
  /**
   * ...and WHICH CONVERSATION it is talking through — the second half, `null`
   * for a node agent nobody has started a session for yet.
   *
   * IN THE VAULT since the human's 2026-09-02 ruling, with the honest
   * consequence the header spells: a session id is machine-local content in a
   * board-durable place, so a second machine serving this vault draws the row
   * and is refused when it presses it.
   */
  session: Schema.NullOr(Schema.String),
  /**
   * HOW BIG ITS MEMORY IS: the records under this node, at any depth.
   *
   * The subtree IS the memory, so this is the one number that says how much
   * the agent knows — and the one a person reads to decide whether a fresh
   * session would come back knowing anything. Descendants only: a node counts
   * its subtree, not itself, the way `Move to Trash` already names one
   * (`./derive.ts`'s `under`).
   *
   * A NOTE'S MEMORY IS `0`, and that is not a gap: a note IS its memory — the
   * agent reads the file every time rather than carrying rows it has written
   * somewhere else — so there is nothing under it to count, and nothing to
   * tidy.
   */
  memory: Schema.Int,
  /**
   * WHETHER THIS CHAT OPENS BESIDE the page rather than alone — a note's
   * `chat-opens` switch, read here so every face asks the roster rather than
   * the front matter.
   *
   * ALWAYS `false` FOR A NODE, which is the honest shape rather than an
   * optional field: the switch is written in a note's own front matter, and a
   * row has nowhere to write one.
   */
  beside: Schema.Boolean,
})
export type NodeAgent = typeof NodeAgent.Type

/**
 * HOW BIG A NODE AGENT'S MEMORY IS, in words — `14 rows`, `1 row`.
 *
 * BESIDE THE FIELD rather than at either reader, and that is the whole reason
 * it is here: three surfaces say this number out loud — the roster row and the
 * door in the browser, and the standing instruction an agent is taught
 * (`olai-plugin-chat`'s `teaching.ts`) — and they were two spellings of one plural,
 * in two packages, agreeing by hand. A count with two spellings is a count that
 * will one day be `1 rows` in exactly one of them.
 *
 * OVER THE FIELD and not over the whole row, so the one caller that has a
 * number rather than a node agent can still ask.
 */
export const memoryOf = (agent: Pick<NodeAgent, "memory">): string =>
  agent.memory === 1 ? "1 row" : `${agent.memory} rows`

/** Every node agent of a set, in corpus order. */
export const NodeAgents = Schema.Array(NodeAgent)
export type NodeAgents = typeof NodeAgents.Type

/**
 * EVERY OTHER NODE AGENT OF A SET, as the `stop` set the memory walks take and
 * the exclusions a tidying pass's fence carries.
 *
 * BESIDE THE ROSTER for `memoryOf`'s reason: one fact with four readers in two
 * packages, which agreed by hand until one of them was forgotten.
 */
export const othersOf = (roster: NodeAgents, id: string): ReadonlySet<string> =>
  new Set(roster.filter((one) => one.id !== id).map((one) => one.id))

/** A directory with no node agent in it, and a server that has never loaded —
 *  one value, because both draw nothing. */
export const NO_AGENTS: NodeAgents = []

/**
 * Whether two readings say the same thing — what keeps a revision that moved no
 * node agent from sending a frame to every open tab.
 *
 * `./shelf.ts`'s `sameShelf` word for word, including why it is DERIVED from
 * the schema rather than written out: a hand-rolled comparison is these fields
 * spelled a second time, and the next one added would simply not be compared —
 * a frame that is never sent, carrying a title the directory has moved past,
 * with nothing anywhere raising an error.
 */
export const sameAgents: (a: NodeAgents, b: NodeAgents) => boolean = Schema
  .toEquivalence(NodeAgents)

/**
 * THE ROSTER: every node of the set carrying a property this vault declares the
 * given kind, in corpus order.
 *
 * ## What the two extra arguments are, and why they are not one key
 *
 * `declarations` is the vault's own vocabulary with the enabled plugins' claims
 * already folded into it ({@link ./typing.ts}'s `declarationsOf`, a memo on the
 * derivation, and `withClaims`, which is the one place precedence lives).
 * `word` is the kind's COMPOSED word — `<plugin>-<kind>` — which the caller
 * knows and this package may not spell.
 *
 * TWO ARGUMENTS RATHER THAN A RESOLVED KEY, and the difference is what a vault
 * mid-migration looks like. A key is not one string there: a board can declare
 * the kind on the bare `agent-session` it has been using while the key the kind
 * CLAIMS is declared too, and a record may have written either spelling.
 * Handing one key down would make this reading pick a winner the caller could
 * not see; {@link textDeclaredAs} asks each RECORD which of its own keys is
 * declared this kind, folding the case exactly as `prop:` and the write gate do.
 *
 * THE LICENCE IS ASKED BEFORE THE LOOP ({@link declaresKind}), so a vault that
 * declares no such key — every vault on a serve running no chat, and every vault
 * that has declared the key something else — pays one walk of its declarations
 * rather than one per record, and allocates nothing. That is
 * `olai-plugin-kolu`'s `claimantsIn` and `olai-plugin-odu`'s `boardedIn`
 * arrangement, one property over and deliberately the same shape.
 *
 * A WHOLE-SET WALK, deliberately and measured against the alternative: there is
 * no index over custom keys and building one would be a map maintained per
 * write for a question asked once per revision, over a filter that is one field
 * test per record. What keeps it off the wire is the cell's `equals`
 * (`@olai/surface`), the way it keeps the shelf off it.
 *
 * WHAT IS LEFT OUT, and each for a rule this package already keeps everywhere:
 *
 *   - a MIRROR, which carries no fields of its own — a placement cannot hold a
 *     property, so there is nothing here to find. The narrowing is
 *     `./node.ts`'s guard rather than a field test spelled again.
 *   - WHAT WAS PUT AWAY, asked by the one predicate every live reading here
 *     asks (`./node.ts`'s `isPutAway`): an agent on a node somebody trashed or
 *     archived is not somebody you talk to, and a roster that listed one would
 *     offer a door into a record that is gone.
 *   - an EMPTY value, and a value that is a LIST. `custom` takes a list
 *     (`./custom.ts`), and "which engine" has no answer that is three of them —
 *     so a list-valued binding is a property this reading has nothing to say
 *     about rather than one it picks the first of. It is {@link textDeclaredAs}
 *     that steps over the list, at the same door every other single-value
 *     reader of a declared kind does.
 *   - a value NAMING NO ENGINE, which is {@link sessionIn}'s own refusal
 *     (`:sess-1`): the engine half is what makes the node a node agent, and a
 *     pointer with nobody to point it at names nothing to talk to.
 *
 * WHAT IS NOT LEFT OUT is a node that is DONE. The roster is the query and the
 * query is `prop:<the declared key>`; a finished lane whose row is still on the
 * roster is a property somebody has not taken off, which is a thing they can
 * see and fix, where a roster that quietly dropped it would be this reading
 * deciding something the query did not say.
 *
 * That rule used to cost something, and the key is what stopped it: it was
 * `agent`, which the orchestrator's own board puts on every dispatched roadmap
 * item, so this reading listed a hundred finished lanes and pushed the file tree
 * off the sidebar (photographed on #461). A DECLARED kind ends that collision at
 * its root twice over — the claimed word carries a plugin's name, and a board
 * that wants the column called something else writes one row — rather than it
 * being narrowed away by a rule about which rows to hide.
 */
export const agentsIn = (
  derived: Derived,
  declarations: PropDeclarations,
  word: string,
): NodeAgents => {
  if (!declaresKind(declarations, word)) return NO_AGENTS
  return derived.nodes.flatMap((located) => {
    if (isPutAway(derived.claims, located.file)) return []
    if (!isRegular(located)) return []
    const held = textDeclaredAs(declarations, located.node, word)
    const said = held === undefined ? null : sessionIn(held)
    if (said === null) return []
    return [{
      kind: "node",
      id: located.node.id,
      file: located.file,
      title: located.node.title,
      engine: said.engine,
      session: said.session,
      memory: under(derived, located.node.id),
      beside: false,
    }]
  })
}

/**
 * COULD A NODE AGENT BE SEATED HERE — the same three tests {@link agentsIn}
 * applies, minus the one about the property.
 *
 * ONE CALLER and one gesture: *start an agent session*, which names the node it
 * is for and is the gesture that WRITES the property. Asked of the roster —
 * which is the query OVER that property — a bare node answers `null`, and that
 * answer used to be read as "this is not a node", routing the new conversation
 * to the unscoped panel to be moved into the node's scope afterwards. Moving a
 * conversation between scopes is `session/load`, and no engine has written a
 * session it has only just minted and nobody has spoken into.
 *
 * So the question a scope needs answering is not *is this already an agent* but
 * *is this a record an agent could sit at*, and the two had been the same
 * function. Put-away and mirrors are out on the same grounds they are out of the
 * roster: a placement has no subtree of its own to be the memory of, and a
 * trashed record is not somewhere to seat a process.
 */
export const seatableIn = (derived: Derived, node: string): boolean => {
  const located = derived.byId.get(node)
  if (located === undefined) return false
  return !isPutAway(derived.claims, located.file) && isRegular(located)
}

/**
 * THE NOTES OF A SET THAT CARRY A CHAT — the same query as {@link agentsIn},
 * asked of front matter instead of records, in path order.
 *
 * A NOTE'S BINDING IS A PROPERTY TOO, written where a note keeps its
 * properties: the `---` block at the top ({@link ./frontmatter.ts}, read onto
 * the document's own `props`). So this is the node reading with one thing
 * swapped — the records become the `.md` documents and `node.custom` becomes
 * `document.props` — and every rule around it is the same one: the kind is
 * asked of the vault's DECLARATIONS rather than of a key this package spells
 * ({@link textDeclaredAs}, which steps over a list-valued property), a value
 * naming no engine names no chat, and what has been put away is not on the
 * roster.
 *
 * TWO WORDS AND NOT ONE, because a note carries two declared kinds: the
 * binding, and the switch that says whether its chat opens BESIDE the page.
 * The switch is read here rather than at a face for the roster's own reason —
 * a row of the roster is everything the set says about one chat, so a face
 * draws the row instead of going back to the file.
 *
 * NO MEMORY COUNT and nothing to tidy: the note is the memory, so `memory` is
 * `0` for every row this answers with ({@link NodeAgent}'s own field says
 * why).
 */
export const notesIn = (
  set: OutlineSet,
  claims: Claims,
  declarations: PropDeclarations,
  sessionWord: string,
  opensWord: string,
): NodeAgents => {
  // THE LICENCE BEFORE THE WALK, exactly as the node reading asks it: a vault
  // that declares no such kind pays one walk of its declarations rather than
  // one per document.
  if (!declaresKind(declarations, sessionWord)) return NO_AGENTS
  return markdownIn(set).flatMap((note) => {
    if (isPutAway(claims, note.path)) return []
    const held = textDeclaredAs(declarations, { custom: note.props }, sessionWord)
    const said = held === undefined ? null : sessionIn(held)
    if (said === null) return []
    const opens = textDeclaredAs(declarations, { custom: note.props }, opensWord)
    return [{
      kind: "note" as const,
      id: itemKey({ kind: "note", path: note.path }),
      file: note.path,
      title: nameOf(claims, note.path),
      engine: said.engine,
      session: said.session,
      memory: 0,
      beside: opens === BESIDE,
    }]
  })
}

/** The one value of the opens switch that means anything: every other
 *  spelling, and the absence of the key, is a chat that opens alone. One
 *  word, so the reading and the writer cannot come to disagree about it. */
const BESIDE = "beside"

/**
 * COULD A CHAT BE SEATED ON THIS NOTE — {@link seatableIn}'s question for the
 * other kind of item, and the same two tests {@link notesIn} applies minus the
 * one about the property.
 *
 * HELD, which is what distinguishes a note from a path somebody typed: the set
 * has to be serving a `.md` at it. A picture, a `.csv`, a saved page and a
 * plugin's half are files olai only shows — there is no front matter to write
 * a binding into — and a trashed or archived note is not somewhere to seat a
 * conversation, for the roster's own reason.
 */
export const seatableNote = (set: OutlineSet, claims: Claims, path: string): boolean => {
  const document = documentAt(set, path)
  return document !== undefined && isMarkdown(document) && !isPutAway(claims, path)
}
