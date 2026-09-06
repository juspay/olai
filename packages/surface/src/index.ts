/** Shared inert wire vocabulary. Capability descriptors live with their
 * providers; the permanent surface declares process management only. */

import { BrokenFile, Face, Located } from "@olai/format"

import { Effect, Schema } from "effect"
import { PageReading, PageRequest } from "./page.ts"



import { bodyKind } from "@olai/format"



/** Shared page vocabulary narrowed for outline/tree and archive readers.
 * These historical CorePage names are schema compatibility, not host members:
 * the outlines provider declares page, while Markdown owns documentPage. */
export type CorePageRequest = Extract<PageRequest, { readonly kind: "at" | "trash" }>
export const CorePageRequest = PageRequest.check(
  Schema.makeFilter(
    (request: PageRequest) => request.kind === "at" || request.kind === "trash",
    { expected: "a file, node, or trash page request" },
  ),
) as typeof PageRequest & { readonly Type: CorePageRequest }
/** Markdown's metadata capability accepts only a bodied-file address. */
export type DocumentPageRequest = {
  readonly kind: "at"
  readonly address: Extract<NonNullable<Extract<PageRequest, { readonly kind: "at" }>["address"]>, { readonly kind: "document" }>
}
export const DocumentPageRequest = CorePageRequest.check(Schema.makeFilter(request => {
  if (request.kind !== "at" || request.address?.kind !== "document") return false
  return bodyKind(request.address.path) !== null
})) as typeof CorePageRequest & { readonly Type: DocumentPageRequest }


type CoreShown = Exclude<PageReading["shows"], { readonly kind: "day" | "agenda" }>
export type CorePageReading = Omit<PageReading, "shows"> & { readonly shows: CoreShown }
export const CorePageReading = PageReading.check(
  Schema.makeFilter(
    (reading: PageReading) => reading.shows.kind !== "day" && reading.shows.kind !== "agenda",
    { expected: "a file, node, or trash page reading" },
  ),
) as typeof PageReading & { readonly Type: CorePageReading }

/**
 * One outline file's slice of the set, as published at set revision `rev`.
 *
 * Exactly one of `nodes` / `broken` is meaningful: a file that stopped parsing
 * keeps its key and carries its errors, which is the per-entity half of the
 * error scope expressed as DATA rather than by absence. A reader that had only
 * the `errors` cell would have to guess which outline a `file:line` belonged to
 * and hope the two lists agreed.
 *
 * `rev` is the SET's revision at the moment this entry was published, and it
 * travels per entry rather than per frame for one reason and against one
 * expectation. The reason: a phase-4 write names it as the base it edited, and
 * the base a write is derived from is the revision the entry it read was at.
 * The expectation it defeats is that all the entries on screen share it — see
 * the cross-file consistency paragraph in
 * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/outlines-as-collection.md`. Only the files that MOVED in
 * a tick are upserted, so an unchanged neighbour keeps the older number until
 * something changes it.
 *
 * WHICH MAKES IT THE CHANGE TOKEN, and that is a contract rather than an
 * accident of the implementation, because two readers rest on it: this number
 * moves when THIS FILE's records move and at no other time. A write names the
 * revision it edited as its base, and `Head.rev` is how a page WATCHES one file
 * it does not draw — a preview waiting for its `.html` to move — without asking
 * for the body. So an entry rebuilt at a new revision for a file that did not
 * change costs a reader wasted work, and an entry whose records changed
 * published at a revision a reader already holds is a view that is silently
 * stale. `@olai/server`'s `published.ts` is what keeps it (an entry is rebuilt
 * exactly when the store re-decoded its path), and `published.test.ts` is where
 * that is pinned.
 *
 * WITHIN ONE PROCESS, which is the other half of the same promise: these
 * numbers are a counter, so a tab comparing two servers' counters would be
 * comparing nothing. It cannot: the socket echoes the process id it was given
 * and a server that does not recognise itself retires the tab
 * (`packages/tests/features/the_connection.feature` restarts a server under a
 * live tab and asserts exactly that, plus the reload that recovers it). So a
 * reader COMPARING these numbers — a write against the base it read, a page
 * against the revision it last saw — is always comparing within the run that
 * minted them.
 */
export const OutlineEntry = Schema.Struct({
  rev: Schema.Int,
  /** This file's nodes only, in file order. Empty for a file that did not
   *  parse, and empty for one that holds nothing — the difference is `broken`. */
  nodes: Schema.Array(Located),
  broken: Schema.NullOr(BrokenFile),
  /** What this file IS, apart from what it holds: its title, the addresses it
   *  points at, the tags its records write (`@olai/format`'s `Face`).
   *
   *  It rides here rather than being derived on arrival, and that is a cost
   *  decision rather than a doctrinal one: a browser CAN build an outline's
   *  face — it holds the records and the format's own constructor — but doing
   *  so is a walk of every title and every note of the corpus per revision,
   *  where the server built this once when the file's bytes changed. The
   *  face is small; the walk is not. */
  face: Face,
})
export type OutlineEntry = typeof OutlineEntry.Type

/**
 * One bodied file's slice of the set, as published at set revision `rev`.
 *
 * The entry carries the BODY, and it is the only thing on the wire that does:
 * one collection, keyed by path, read one key at a time. What it replaced was
 * a `documents` array on {@link Manifest} — every served document's full text
 * in the FIRST frame of every subscription, ~124 KB of a ~212 KB snapshot for
 * this project's own `docs/`, and O(corpus) for a directory of thousands.
 * What changed then was when a body travels — when someone opens it — and
 * nothing about the SET: it went on holding every body it had read.
 *
 * It does not any more, and that is the second half of the same idea: a `.html`
 * is served from a read of its own and its bytes are kept by nobody
 * (`@olai/format`'s `kinds.ts` decides which kinds, `@olai/server`'s
 * `bodies.ts` does the reading), so this entry's `text` can be `null` — see
 * below. What is unchanged, and load-bearing, is that the server still holds
 * every served PATH and validates every `doc` against it (`docs/format.md`).
 *
 * `rev` is the set's revision at the moment this entry was published, for the
 * reason {@link OutlineEntry}'s is: a body now arrives on its own frame, so
 * "which moment of the directory am I reading" is a question a reader can
 * actually ask, and the answer is a number rather than an assumption. An
 * unchanged document keeps the entry it was published with, so the number does
 * not move under a reader who is not looking at a changed file.
 *
 * There is no `file` field: the KEY is the path. A second copy of it here is a
 * second spelling of one fact, and the two could disagree.
 *
 * THREE STATES, and they are not two plus a boolean. `text` a string is the
 * body. `text: null` and {@link DocumentEntry.refused} false is the body not
 * here — a `.html` the set keeps only the path of, or a key announced before
 * its bytes have been read. `refused` true is a READ that was attempted and
 * the file would not open: the key is here, the bytes are not, and that is a
 * fact about THIS file rather than a reason to fail the whole probe. Exactly
 * one of a body and a refusal is the news; a reader that folded `refused`
 * into `text ?? ""` would draw a blank page for a file that had something to
 * say.
 */
export const DocumentEntry = Schema.Struct({
  rev: Schema.Int,
  /**
   * Verbatim, exactly as on disk — markdown or markup, interpreted at view
   * time by whichever face this kind of file is drawn with.
   *
   * `null` is a STATE and not an absence, the way {@link Manifest}'s is: this
   * file is served and its body is not here. It is what a server holding only
   * the PATH of a `.html` says about one to itself — the set does not keep a
   * saved page's bytes for the life of the process (`@olai/format`'s
   * `kinds.ts`) — and it is admitted by this schema because that projection is
   * typed by it.
   *
   * A reader ASKING FOR ONE is not shown it. A per-key `get` for a body the
   * server does not hold answers nothing until the file has been read, which is
   * the framework's own held-open-on-absent path: a browser waits one read
   * rather than being told the body is missing, and a one-shot reader (an
   * agent's `resources/read`, which takes the first frame and leaves) is handed
   * the file rather than a `null`. The other way every entry could travel — the
   * batched `deltas` verb — is exactly what this collection does not have.
   *
   * ONE frame can still carry it, and it is worth being exact about which: the
   * upsert that ANNOUNCES a key, for a file that has just appeared in the
   * directory. That frame is how a collection says its membership changed, and
   * it reaches anyone already subscribed to that key — which can only be a
   * reader who asked for a file before it existed. It says what it says: the
   * file is here, its body is not yet. A reader folds it the way it folds an
   * entry that has not arrived, and hears the body on a later frame or on its
   * next read.
   *
   * A READ THAT WAS REFUSED is the other `null`, and it is not this one. See
   * {@link DocumentEntry.refused}.
   */
  text: Schema.NullOr(Schema.String),
  /**
   * Whether a READ of this body was attempted and the file would not open.
   *
   * `false` for every file whose body is here, and for every file whose body
   * is not here yet — the projection of a `.html` the set keeps only the path
   * of. `true` is the third state this entry can be in: the file is served, a
   * reader asked for its bytes, and the disk said no. It is not a parse
   * failure ({@link Head.broken} / {@link OutlineEntry.broken} — those are
   * decode failures, and a file that cannot be opened never reaches them) and
   * it is not an absence (the key is here). The blast radius is this file:
   * what it replaced was a probe that failed the WHOLE directory over one
   * unreadable saved page.
   *
   * Produced where the read happens (`@olai/server`'s `bodies.ts` for a body
   * the set does not keep; the probe, for a kept `.md` that will not open)
   * and answered the same way on the HTTP face (`@olai/server`'s `media.ts`)
   * so the two tell one story. The sentence both faces draw is
   * {@link BODY_REFUSED}.
   *
   * A one-shot reader (an agent's `resources/read`) is handed this frame
   * rather than being held open until a body that will never come. That is
   * the held-open-on-absent path closed for a read that failed, rather than
   * only for a read that succeeded.
   *
   * OPTIONAL on the wire, default `false`, so the two mismatched ends are
   * both legal: an old client drops a field it does not know (and degrades
   * to the blank body it always drew), and a new client reading a frame
   * that never carried one treats it as not refused. In-repo the two ends
   * ship from one commit; this is the public wire's answer for a raw
   * client that does not.
   */
  refused: Schema.Boolean.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(false)),
  ),
})
export type DocumentEntry = typeof DocumentEntry.Type

/**
 * One SERVED FILE's HEAD: which revision of the directory it is at, what it is
 * called, and whether it could be read at all. Everything about a file except
 * its content.
 *
 * It exists because "the file on disk MOVED" and "here is what it says" are
 * two different questions, and until this member there was one way to ask
 * both. A `.html`'s page draws from a frame that fetches the file over HTTP
 * (`./seal.ts`), so the only thing it wants from the wire is the first
 * question — and asking it through {@link DocumentEntry} sent a saved page's
 * megabytes to a tab that drew none of them, on every open and on every edit,
 * ahead of the fetch that actually drew it. That was PR #206's standing
 * deferral, and this is the member it named.
 *
 * EVERY served file since PR 10 of `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`,
 * where it was every BODIED one. That is the design's §3 Sidebar row arriving:
 * the file tree is paths and faces, which is key-set-sized, and it was the only
 * thing a browser still read the whole `outlines` collection for. An outline's
 * head is exactly what a document's always was — a revision and a face, no
 * content — so this is one member widened rather than a second one built beside
 * it, and the browser now learns the DIRECTORY here and each PAGE from its own
 * reading (`./page.ts`).
 *
 * `rev` is {@link OutlineEntry}'s and {@link DocumentEntry}'s, unchanged and on
 * purpose: it MOVES when the file does and stays put when it does not, so a
 * reader watching it is watching this one file rather than the directory's
 * clock. A page rewritten with the bytes it already had does not move it —
 * nothing re-decoded it — and a megabyte string never has to be compared to
 * find that out.
 *
 * There is no `file` field, for {@link DocumentEntry}'s reason: the KEY is the
 * path. And there is no second fact in here waiting to be useful — a head that
 * grew a size, a modified time or a hash would be a second answer to a question
 * `rev` already answers, kept in step by hand.
 */
export const Head = Schema.Struct({
  rev: Schema.Int,
  /** What the file IS, apart from what it says: its path, its title, the
   *  addresses it points at, the tags it writes (`@olai/format`'s `Face`).
   *
   *  IT CARRIES ITS OWN PATH, and the paragraph above forbids exactly that of
   *  the entry — so the difference is worth naming. A `file` FIELD beside the
   *  key would be one fact spelled twice by two hands; a face is one VALUE the
   *  format made, whose identity is its path, cut from the same document in the
   *  same function as the key it arrives under (`@olai/server`'s
   *  `published.ts`). What the browser then holds is a list of faces
   *  (`@olai/web`'s `page.ts`), where a key is not in hand — taking the path
   *  off here would mean re-attaching it on arrival, which is the second hand.
   *
   *  THE ONE FACT THAT MAY JOIN `rev` HERE, and it is worth saying why, since
   *  the paragraph above forbids a second answer to a question `rev` already
   *  has. A size, a modified time or a hash would each be one of those. A face
   *  is not: it is what the file SAYS, which is the question this member could
   *  not be asked before — and a browser cannot derive it the way it can an
   *  outline's, because the body it would read is the one thing this collection
   *  exists to keep off the wire. Without it a document is a PATH to every tab
   *  in the app, which is the position the whole first-class-documents arc is
   *  about. It moves when `rev` moves and by the same act, since both are cut
   *  from one document in one function (`@olai/server`'s `published.ts`). */
  face: Face,
  /**
   * Why this file could not be READ — `null` for every file that parsed, and
   * for every file that has no parsing to do.
   *
   * The one field here that is not about a file's identity, and it is here for
   * the reason the face is: it is what a browser cannot derive without the
   * content. A `.olai` that stopped parsing keeps its key and carries its
   * errors — the per-entity half of the error scope expressed as DATA rather
   * than by absence, which is the same sentence {@link OutlineEntry.broken}
   * makes and the same value, cut from the same set. The sidebar marks such a
   * file and its own page draws the errors instead of a tree; a reader holding
   * only the `errors` cell would have to guess which outline a `file:line`
   * belonged to and hope the two lists agreed.
   *
   * It rides on the HEAD rather than on the page's reading because the sidebar
   * marks every broken file in the directory, not the one somebody is looking
   * at — and it is a boolean's worth of weight per file, which is what the rest
   * of this entry already costs.
   */
  broken: Schema.NullOr(BrokenFile),
})
export type Head = typeof Head.Type

/**
 * Whether there is a set at all, and nothing else.
 *
 * `null` is a state, not an absence, and it is the one thing the collections
 * cannot say. Three things a reader must tell apart — "the server has not
 * answered yet" (no frame at all), "the server has never had a valid set to
 * show" (`null`), "here is your directory" (a value) — and an empty collection
 * snapshot is the SECOND and THIRD at once unless something else carries the
 * bit. This is that something, and being that is its whole job.
 *
 * So the value carries NOTHING. It used to carry the documents, which is what
 * {@link DocumentEntry} was cut out of it to stop; what is left is a fact with
 * no fields, because every fact about this directory now belongs to a file and
 * travels on that file's entry. A set revision here would be the obvious thing
 * to reach for and is deliberately absent twice over: nothing reads it, and it
 * moves on every revision, so it would wake every open tab's derivation — the
 * cell that is quiet is the point of {@link sameSet}.
 */
export const Manifest = Schema.NullOr(Schema.Struct({}))
export type Manifest = typeof Manifest.Type

/** A directory that has loaded, as the one value there is of it. */
export const LOADED: Manifest = {}

/** When two answers are the same answer, so the cell can stay quiet. There is
 *  exactly one thing this value can say, so there is exactly one thing that can
 *  change about it: whether there is a set. */

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

/** WHICH IDS THE SET DECLARES, and what each names — the transcript's batch
 *  lookup. `@olai/format`'s own shapes, re-exported rather than re-declared,
 *  exactly as the search shapes below are and for the same reason: this package
 *  is a spec, and the read vocabulary is the floor's. */
export { NamedAnswer, NamedRequest } from "@olai/format"

/** WHERE THE IDS A READER REMEMBERS NOW LIVE, and which of the files they were
 *  filed under this directory has actually read — the fold memory's batch,
 *  whose shapes are the floor's for the reason above. */
export { HomesAnswer, HomesRequest } from "@olai/format"

/** THE PINNED SHELF as the `pins` cell carries it — the floor's shapes again,
 *  re-exported for the same reason, so the sidebar draws the rows the reading
 *  produced rather than a second description of them. `sameShelf` does NOT come
 *  through this door: a cell declares its `equals` in the spec above, which is
 *  the only place that answer is spent. */
export { NO_PINS, Shelf } from "@olai/format"
export type { Pinned } from "@olai/format"

/** THE AGENTS ROSTER IS NOT HERE ANY MORE, and neither is the conversation.
 *
 *  Both were members of this spec and both are `olai-plugin-chat`'s, under its
 *  own sibling key: `surface/chat/agents/get`, `surface/chat/chat/get`,
 *  `surface/chat/transcript/deltas`, `surface/chat/saying/deltas`, and the
 *  fourteen verbs beside them. Nothing re-exports their shapes through this
 *  door, because a spec that re-exported a plugin's vocabulary would be the
 *  registry arrow pointing backwards — the same cycle `@olai/plugin-api` names
 *  no plugin to avoid. A consumer of chat's shapes imports
 *  `olai-plugin-chat/wire`, which is where they are declared. */

/** HOW FULL THE INBOX IS as the `inbox` cell carries it — the floor's
 *  shape, re-exported for the shelf's reason. `sameInboxHeld` does NOT
 *  come through this door: a cell declares its `equals` in the spec. */
export { InboxHeld, NO_INBOX } from "@olai/format"

/** What a PAGE asks and answers, and what the move picker does — see
 *  {@link ./page.ts}. */
export { MovingAnswer, MovingRequest, PageReading, PageRequest } from "./page.ts"

/** What a PAGE'S FILTER asks and answers — see {@link ./narrowing.ts}. */
export { NarrowingAnswer, NarrowingRequest } from "./narrowing.ts"

/** What a search asks and answers on the wire — see {@link ./search.ts}. */
export {
  DocumentHit,
  isNodeHit,
  MatchedNode,
  NodeHit,
  Refusal,
  SearchAnswer,
  SearchHit,
  SearchRequest,
} from "./search.ts"

/** What a tag COMPLETION asks and answers — `@olai/format`'s declarations,
 *  carried rather than re-spelled, for {@link ./search.ts}'s reason. The
 *  browser sends a sigil, a prefix and the number of rows its popup has; the
 *  answer is the words this set already uses, most-used first. The reading
 *  behind it is that package's `vocabulary.ts`, which is where it moved when
 *  the browser stopped holding a vault to enumerate. */
export { TagCompletion, TagsAnswer, TagsRequest } from "@olai/format"

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
