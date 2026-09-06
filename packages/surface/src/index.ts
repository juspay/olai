/**
 * WHAT CORE SERVES WITH NO ROW AT ALL, and the protocol vocabulary the rows
 * share — nothing else.
 *
 * A SPEC USED TO BE HERE, and it was the whole application: `outlines`,
 * `documents`, `heads`, `pins`, `search` and every procedure beside them, in a
 * general package that every plugin then imported its own member's schema back
 * out of. Phase 18 moved the MEMBERS into the rows that fill them and this
 * change moved the VOCABULARY after them — `OutlineEntry` to
 * `olai-plugin-outlines/wire`, `DocumentEntry` to `olai-plugin-markdown/wire`,
 * `Head` and `Manifest` to `olai-plugin-vault/wire`, and the page, narrowing
 * and search shapes back to `@olai/format`, which is where they were declared
 * all along and which this package was merely a second door onto.
 *
 * WHY THE DOOR HAD TO GO and not merely the spec: a general package that
 * re-exports a row's vocabulary is the registry arrow pointing backwards, and
 * the argument is already written down one paragraph over — it is the reason
 * `olai-plugin-chat`'s transcript shapes were never re-exported here when chat
 * became a row. A consumer of a row's shapes imports that row's door. A
 * consumer of the floor's shapes imports `@olai/format`. Neither of them goes
 * through here, and `@olai/bundle`'s `fence.test.ts` holds this file's export
 * list to exactly what is below.
 *
 * WHAT IS LEFT is what no row owns:
 *
 *   - `./core.ts` — the four members core serves whether or not a single row
 *     stands: which plugins this build has, the switch that turns one on, who
 *     is looking, and what this deployment is called.
 *   - `./edit.ts` and `./ops.ts`, through `./dispatch.ts` — the two write
 *     ENVELOPES six rows co-own. They are here rather than in one of those
 *     rows because composition refuses dispatch co-owners whose payload,
 *     success and error ASTs differ (`@olai/server`'s `composition.ts`), so
 *     one spelling is a requirement rather than a convenience, and any row
 *     that held it would be a row the other five could not run without.
 *   - `./media.ts`, `./seal.ts`, `./attach.ts`, `./press.ts` — protocol
 *     constants both ends spell and no member declares: a URL, a saved page's
 *     seal, an attachment threshold, what a click meant.
 *   - `./bundle.ts` — where the hashed browser bundle lives, which the build
 *     writes and the serve reads.
 *   - `./projection.ts` — the slicing rule three rows call and none owns.
 */
export { surface } from "./core.ts"



/** What a keyboard may do — one tagged union, and what a write that landed
 *  says. See {@link ./edit.ts}. The union is what makes the server's mapping
 *  onto ops requests total. */
export { type Applied, Anchor, Edit } from "./edit.ts"

/** What a reader meant by a press — one rule, because the app answers a click
 *  in three places and the seal ships a fourth into somebody else's page. See
 *  {@link ./press.ts}. */
export { ours, type Press } from "./press.ts"

/** The one HTTP address both ends spell — see {@link ./media.ts}. `mediaTarget`
 *  is what the ROUTE may answer, and it is the only half either end needs: the
 *  decoder under it (`mediaPath`, which admits files the route refuses) stays
 *  inside this package, where its one caller is, because an export of it is a
 *  way to ask the traversal guard a question and ignore the allowlist. */
export { MEDIA_PREFIX, mediaHref, mediaTarget } from "./media.ts"

/** Who is looking — the HTTP door both ends still spell, and the JSON the
 *  `who.get` procedure carries. See {@link ./who.ts}. */
export { WHO_PATH, Who } from "./who.ts"

/** What this deployment is called, and when this process started — the two
 *  facts `app.get` carries, and the one spelling every face of the app names
 *  itself with. See {@link ./app.ts}. */
export { App, appName } from "./app.ts"

/** Which plugins this build has and which this serve runs — the `plugins` cell
 *  whole, its seed, and one row of it. See {@link ./plugins.ts}: the server
 *  MINTS this out of the flag and the registry, and the preferences panel is
 *  the only thing that reads it.
 *
 *  `watchable` is the one reading of a row's `wake.kinds`, and it is exported
 *  because the two ends that ask it — the browser's picker and the serve's
 *  per-revision fault — must agree and cannot see each other. `pluginState` is
 *  the same arrangement one field over: the composition root writes the word
 *  and the panel narrows it, and a narrowing spelled twice is a panel that can
 *  disagree with the serve about which of five mornings a row is having. */
export {
  BuiltPlugin,
  NO_ROSTER,
  PLUGIN_BROWSER_NODE,
  PLUGIN_CHUNK_PREFIX,
  PLUGIN_SERVER_NODE,
  type PluginState,
  pluginState,
  PluginRoster,
  watchable,
} from "./plugins.ts"

/** Where the hashed browser bundle lives, and what the bundler names a split
 *  chunk in it — see {@link ./bundle.ts}. One spelling, both halves of the
 *  serve, and the two suites that hold a chunk up. */
export { ASSET_PREFIX, chunkFile, chunkUrl } from "./bundle.ts"

/** What a served `.html` is answered with, how tall it says it is, and which
 *  page of this vault it says a reader clicked — the other contract between the
 *  server that writes it and the browser that reads it, for {@link ./media.ts}'s
 *  reason. See {@link ./seal.ts}. */
export {
  BODY_REFUSED,
  heard,
  REFUSED_MARKUP,
  ROUNDING,
  type Said,
  SEAL,
  sealPolicy,
  spellsHost,
} from "./seal.ts"

/** THE AGENTS ROSTER IS NOT HERE, AND NEITHER IS ANY OTHER ROW'S READ
 *  VOCABULARY.
 *
 *  Chat was the first: `surface/chat/agents/get`, `surface/chat/chat/get`,
 *  `surface/chat/transcript/deltas` and the fourteen verbs beside them are
 *  `olai-plugin-chat`'s, under its own sibling key, and nothing has ever
 *  re-exported their shapes through this door. The reason was that a spec
 *  re-exporting a row's vocabulary is the registry arrow pointing backwards —
 *  the same cycle `@olai/plugin-api` names no plugin to avoid.
 *
 *  EVERY OTHER ROW IS NOW ON THE SAME TERMS, which is what this change did.
 *  `NamedAnswer`, `HomesAnswer`, `Shelf`, `InboxHeld`, `TagsAnswer`,
 *  `PageReading`, `NarrowingAnswer`, `SearchAnswer` and the requests beside
 *  them all used to leave here, as `@olai/format` declarations re-exported
 *  "because this package is a spec and the read vocabulary is the floor's".
 *  That sentence stopped being true when the spec left: a door onto the floor,
 *  in the one package every browser bundles, is a second import path for shapes
 *  that were never this package's — and it is what let a row declare its own
 *  member by reaching up into a general package. A consumer of the floor's
 *  shapes imports `@olai/format`; a consumer of a row's imports that row's
 *  door (`olai-plugin-outlines/wire`, `olai-plugin-markdown/wire`,
 *  `olai-plugin-vault/wire`). */

/** What an attachment may BE — the policy the browser gates on before encoding
 *  and the server gates on before writing. One module, for the same reason the
 *  media URL is one: two copies of a threshold are two thresholds. How it is
 *  cut UP is not here and is not re-exported: that is
 *  `@kolu/surface/frame-chunking`, which both ends import directly. See
 *  {@link ./attach.ts}. */
export {
  ATTACHMENT_EXTENSIONS,
  attachmentRejection,
  DOCUMENT_EXTENSIONS,
  isAttachable,
  MAX_ATTACHMENT_BYTES,
} from "./attach.ts"
