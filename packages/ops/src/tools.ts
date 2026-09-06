/**
 * THE GRAMMAR A TOOL IS BUILT IN — the four kinds, what each of them CARRIES,
 * and the doors they reach. Not the list: that left.
 *
 * This file used to hold a closed `TOOLS` table as well, twenty-eight entries
 * naming every verb an agent had. Two things were wrong with that and both were
 * one thing: a GENERAL package spelled every row's vocabulary, and a row
 * switched off left its verbs advertised — an engine is handed the table, so a
 * serve without the search row still offered `search_nodes`, and one without a
 * ledger still offered `git_commit`. The tables are the ROWS' now
 * (juspay/olai#546): `olai-plugin-outlines`' `tools.ts` holds the node verbs,
 * `olai-plugin-markdown`' the document ones, and so on for trash, files,
 * search, capture and git. A tool leaves with the row that owns it, so
 * switching a row off takes its verbs along.
 *
 * WHAT DID NOT LEAVE IS THE ARGUMENT THE TABLES ARE WRITTEN AGAINST, because it
 * is a fact about this layer rather than about any row. What an agent may name
 * is a UNIT, and there are four of them: a NODE, a whole DOCUMENT (since
 * `md-editing`), a whole TRASH (since `empty-trash`), and a whole FILE. There is
 * no shell, no grep, no listing of the DIRECTORY, and no read or write that
 * names a byte — no offset, no range, nothing for a caller to splice at either
 * end. A listing is that closure said out loud: what an agent may read is what
 * the served set holds, so the listing IS the namespace and there is no
 * directory walk under it. A row that grows a fifth unit is making a decision
 * this comment is the record of.
 *
 * Two consequences follow from the whole-text rule, and both were paid for:
 *
 *   - a malformed outline is unrepresentable through this path. Every write
 *     goes through {@link ./plan.ts} to whole records and the format's own
 *     writer, so the glued-line file of 2026-08-09 — two records on one line,
 *     produced by an agent editing text — is not a thing these tools can
 *     express;
 *   - a refusal is structured. A `validation` refusal comes back with the
 *     validator's own rows as data, which is what lets the agent fix the one
 *     line that is wrong and the chat panel draw the report.
 *
 * WHAT A ROW GETS FROM HERE is {@link Tool} and the four constructors that
 * build one — {@link read}, {@link write}, {@link act}, {@link plan} — plus the
 * three doors an entry may reach ({@link Asking}, {@link Acting},
 * {@link Planning}) and the envelope {@link asking} builds the read half in.
 * Each entry carries its request schema, and the JSON Schema an agent sees is
 * DERIVED from it rather than written beside it. A READ carries its reader too,
 * in the same entry — so a tool a table declares and nothing answers is a type
 * error rather than a runtime throw, which is what the dispatch switch this
 * replaced could only discover when somebody called it.
 *
 * And WHAT EACH ENTRY SAYS ABOUT ITS SCHEMA is checked against that schema, in
 * all four arms: a read's asker and an act's are handed the request the entry
 * names, a write's fixed field is a field of it, and a write's schema is an arm
 * of the vocabulary its own writer takes. None of that is written out at a call
 * site — it is inferred from the one schema the entry already carries, so there
 * is nothing beside it to spell differently. That relation is pinned in
 * `./tools.test.ts`, which builds the five calls the constructors must refuse;
 * that the reads really answer what they declare is pinned by the walk this
 * package publishes as a harness ({@link ./tools.testlib.ts}) and every row
 * with a read runs over its own table.
 */

import { Effect, Result, Schema } from "effect"

import {
  CommitRequest,
  type CommitResult,
  isOpFailure,
  DocumentAnswer,
  DocumentBody,
  DocumentRequest,
  NodeAnswer,
  NodeRequest,
  type OpFailure,
  OutlineAnswer,
  type PathsAnswer,
  type PushResult,
  type Reading,
  SearchAnswer,
  SearchRequest,
  SubtreeAnswer,
  SubtreeRequest,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import type { KindVocabulary } from "@olai/format"
import type { Search } from "./ops.ts"

import * as Query from "./query.ts"

// `Reading` — the set a reader sees, paired with the derivation every answer
// here is computed from — was declared in this file and is `@olai/format`'s
// now: `validate` ANSWERS with the pair, so the floor is where it is made. It
// is imported above like any other shape of the format's, and NOT re-exported,
// which is this package's own rule two files over ({@link ./query.ts}: "a
// consumer imports a shape from the floor it is declared on"). The one thing
// this package does re-export from there is the write vocabulary, and the
// reason is the exception that proves it — those carry names that are this
// layer's (`Request`, `Applied`) rather than the format's.

/**
 * WHAT A TOOL'S ARGUMENTS ARE: named fields, and one declaration of that.
 *
 * A call arrives as a JSON object, so a tool's arguments are named fields or
 * they are nothing — which is why this is the bound and not `Schema.Top`. It is
 * a name rather than the type written out at each of the four places that mean
 * it (the field below, and the three constructors' `S`), because those four are
 * one decision and moving it should be one edit.
 *
 * IT ASKS FOR EXACTLY THE TWO THINGS THIS FILE READS off a tool's schema, and
 * that is why it is spelled this way rather than as `Schema.Struct`. Effect
 * publishes `Constraint` for precisely this kind of API — "accepts schema
 * values but only reads their data and type-level views" — and nothing here
 * calls `annotate`, `check`, `rebuild` or `make` on one. What it reads is
 * `Type` (the constructors infer each asker's arguments from it) and `fields`
 * (`@olai/server`'s `argsOf` takes a write's schema apart by them, to drop the
 * `op` the tool's NAME already decides). Asking for those two says what is
 * true; `Schema.Struct<Schema.Struct.Fields>` says it by re-checking the whole
 * struct protocol structurally against each of the twenty-eight request
 * schemas, which is the same claim at a price — MEASURED, on review, at 97,450
 * type instantiations for this package against 79,609 for this spelling, the
 * second of which is under the 82,194 the inference-defeating union it replaced
 * used to cost.
 *
 * The bound itself is pinned in `./tools.test.ts`, because it is the one part
 * of this that every real schema satisfies: the table cannot tell a bound that
 * holds from a bound that is not there, so a `Schema.String` is refused there
 * on purpose.
 */
type Arguments = Schema.Constraint & { readonly fields: Schema.Struct.Fields }

interface Described {
  readonly name: string
  readonly title: string
  readonly description: string
  /**
   * The schema the arguments are decoded against.
   *
   * NAMED FIELDS rather than any schema at all, and that is a claim about what
   * a tool is: a call arrives as a JSON object, so a tool's arguments are named
   * fields or they are nothing. Two things follow, and both were paid for by a
   * cast somewhere before this said so. `@olai/server`'s `argsOf` takes a
   * write's schema APART by `.fields` — to drop the `op` the tool's name
   * already decides — which a bare `Schema.Top` has no way to offer; and the
   * constructors below infer each asker's argument type from this same
   * declaration. {@link Arguments} is where both are asked for.
   */
  readonly schema: Arguments
}

/**
 * The READ half of the ops layer, as the six questions the query tools ask —
 * not as a snapshot for each of them to walk.
 *
 * It is {@link Acting} for reads, and it exists for the reason that one does,
 * one door further along: a tool has to be answerable by something that is not
 * a local `Ops`. Since `mcp-bridge` the table is projected onto a SURFACE
 * CLIENT — in-process over a direct dispatch, or over the wire into an
 * `olai web` that already holds the store — and neither of those can be handed
 * a {@link Reading}, which is the whole set plus its derivations and exists
 * only where the store is.
 *
 * So the envelope each read answers in — `{ outlines }`, `{ documents }`,
 * `?? { missing: id }`, and the one refusal a read raises — is declared ONCE,
 * here in {@link asking}, and the table's entries are the one-line calls onto
 * it that the act arm's already are. What a reader would otherwise have is two
 * spellings of the same envelope, one for the local answer and one for the
 * wire's.
 *
 * The WALKS do not move and are not here: which nodes match, which mirrors
 * resolve, how far a subtree descends stay in {@link ./query.ts}, pure over a
 * `Reading`, exactly as `@olai/format` holds the shapes and this package holds
 * the walks.
 */
export interface Asking {
  /** Every outline under the served directory — `outlines_index`. */
  readonly outlines: Effect.Effect<OutlineAnswer, OpFailure>
  /**
   * The outline PATHS of that same directory, and no tool at all: this is the
   * reading a PLAN arm needs ({@link Planning}), which is why it is here beside
   * the six an agent asks rather than in the table.
   *
   * It is here and not derived from {@link Asking.outlines} because deriving it
   * is exactly what cost too much: a capture would have the whole corpus
   * materialised to keep the file names off the answer, twice when the race
   * makes it resolve again (`./query.ts`'s `paths`, roadmap
   * `perf-capture-paths`). Every face can answer it — the ops layer off its own
   * gated read, a surface client off one procedure — which is the property the
   * plan arm was built around.
   */
  readonly paths: Effect.Effect<PathsAnswer, OpFailure>
  /** One node in full, or the id nothing here declares — `outlines_read`. */
  readonly node: (request: NodeRequest) => Effect.Effect<NodeAnswer, OpFailure>
  /** A node and what hangs under it, nested — or a whole outline, every
   *  top-level node in it. `outlines_subtree`, and the second of the two reads here
   *  that can refuse from the walk itself: a `file` is a path, and a path that
   *  is not one is answered with the near miss. */
  readonly subtree: (
    request: SubtreeRequest,
  ) => Effect.Effect<SubtreeAnswer, OpFailure>
  /** The one question two faces ask — `search_nodes` and the ⌘K palette. */
  readonly search: (
    request: SearchRequest,
  ) => Effect.Effect<SearchAnswer, OpFailure>
  /** Every document under the served directory — `markdown_index`. The other
   *  kind of file, listed the way the outlines are. */
  readonly documents: Effect.Effect<DocumentAnswer, OpFailure>
  /** One document, whole — `markdown_read`. The only read here that REFUSES a
   *  miss instead of answering it: a path is not an id, and the useful answer
   *  to a typo is the near miss ({@link ./query.ts}). */
  readonly document: (
    request: DocumentRequest,
  ) => Effect.Effect<DocumentBody, OpFailure>
}

/** The six envelopes, over whatever answers "the set as a reader sees it".
 *  ONE declaration: `{@link ./ops.ts}`'s `make` builds an {@link Asking} over
 *  its own gated read, and a test builds one over a fixture — and the second is
 *  then genuinely testing what an agent calls rather than what `Query` returns.
 *
 *  The read is taken as an EFFECT rather than a value because that is what the
 *  ops layer has: "the served directory has never loaded" is one refusal,
 *  raised in one place, and every question inherits it.
 *
 *  THE CLOCK comes in beside it, because one of the six questions is not a
 *  function of the snapshot alone: `date:yesterday` counts from the day the
 *  query is asked on. It is the layer's own — `{@link ./ops.ts}`'s `make`
 *  passes the same `now` a `done` mark is stamped with — and it is that one
 *  function rather than the whole planner {@link Context}, which also carries
 *  an id minter a read has no business calling. Read PER CALL rather than
 *  captured, so a server left running overnight answers `date:today` with
 *  today. */
export const asking = (
  read: Effect.Effect<Reading, OpFailure>,
  now: () => string,
  /** WHAT A PLUGIN TAUGHT THIS VAULT, for the one question here whose GRAMMAR
   *  reads a declaration: `prop:` decides between a span and an equality by what
   *  a key is declared as, and a declaration is two layers now — a vault's rows
   *  over an enabled plugin's claimed keys.
   *
   *  REQUIRED, and before the matcher for that reason: defaulted, this site
   *  forgot it for a round, and the two doors onto one query parted.
   *
   *  IT IS HANDED THROUGH rather than read by the matcher, because the door is
   *  a row's and the vocabulary is this serve's — a row that read the kinds for
   *  itself would be a second answer to what a vault declares. */
  kinds: KindVocabulary,
  /** THE MATCHER, or nobody ({@link ./ops.ts}'s `Search` and `NO_SEARCH`). It
   *  is here for the clock's reason exactly: the door is a fact about one served
   *  directory, and the layer that owns a directory's long-lived things is the
   *  one that builds this envelope. Absent is a search that refuses in words —
   *  which is what a serve minus the `search` row answers with, at every door
   *  onto it at once. */
  search: Search,
): Asking => ({
  outlines: Effect.map(read, (at) => ({
    outlines: Query.outlines(at.set, at.derived),
  })),
  paths: Effect.map(read, (at) => Query.paths(at.set)),
  // THE SECOND READ THAT CAN REFUSE FROM THE WALK ITSELF — it grew the arm
  // when it grew `fields`: an id that is not there is still the ANSWER
  // (`{ missing }`), and a field nobody may name is a refusal naming the
  // legal ones. The failure channel here also carries the one refusal every
  // read raises — the served directory having never loaded (see the note on
  // `document` below).
  node: (request) =>
    Effect.map(
      Effect.flatMap(read, (at) =>
        Effect.fromResult(Query.detail(at.derived, request.id, request.fields))),
      (found) => found ?? { missing: request.id },
    ),
  // ONE OF THE TWO READS THAT CAN REFUSE FROM THE WALK ITSELF — see the note
  // on `document` below, which is the third. It grew the arm when it grew the
  // `file` way in: an id that is not there is an ANSWER (`{ missing }`), and a
  // path that is not an outline is a refusal carrying the closest one that is.
  subtree: (request) =>
    Effect.flatMap(read, (at) => Effect.fromResult(Query.subtree(at, request))),
  // THE ONE READ THIS LAYER DOES NOT ANSWER ITSELF. The walk is a row's
  // (`olai-plugin-search`); what is core's is the gated read it is asked over,
  // the clock it is asked at, and the vocabulary its grammar reads. So the
  // reading is taken here and handed through, which is what makes the answer
  // and the candidates behind it one snapshot.
  search: (request) =>
    Effect.flatMap(read, (at) => search.nodes({ at, query: request, now: now(), kinds })),
  documents: Effect.map(read, (at) => ({ documents: Query.documents(at.set) })),
  // THE OTHER READ THAT CAN REFUSE FROM THE WALK ITSELF. Four of the six answer
  // from the snapshot alone, so their envelope is a `map` and the failure
  // channel carries only "the served directory has never loaded". This one
  // decides between three outcomes rather than computing one — the body, a
  // path that is not a document, a file the set could not read — and a
  // `Result` is what a pure function says that with ({@link ./plan.ts} refuses
  // everything that way). `fromResult` is Effect's own lift, so the seam
  // between this package's pure half and its effectful one is a library call
  // rather than a spelling of one.
  document: (request) =>
    Effect.flatMap(read, (at) => Effect.fromResult(Query.document(at.set, request.file))),
})

/**
 * The WRITE half, the same way: one verb, and the only thing every one of the
 * write tools does. Named as an argument for {@link Acting}'s reason —
 * and, since `mcp-bridge`, satisfied by a surface client as readily as by a
 * local `Ops`.
 *
 * NO WRITER, unlike `Ops.run` which this is otherwise the shape of. Who is
 * writing is not a tool's business — a tool that could name a writer could name
 * the wrong one — so it is bound where the DOOR is built, one layer out, and
 * every table entry below is one call with nothing to remember.
 */
export interface Running {
  readonly run: (request: Request) => Effect.Effect<Applied, OpFailure>
}

/** The half of the ops layer a self-answering tool reaches. Named as an
 *  argument rather than imported as the whole `Ops`, so a row's table stays a
 *  declaration of tools rather than a consumer of the writer. */
export interface Acting {
  readonly commit: (request: CommitRequest) => Effect.Effect<CommitResult>
  /** No arguments at all: the current branch to the upstream it already has. */
  readonly push: Effect.Effect<PushResult>
}

/**
 * What a PLAN arm resolves its request against — the third of these, and named
 * for {@link Acting}'s reason: a tool reaches an interface rather than importing
 * a world, so the table stays a declaration.
 *
 * THREE FACTS, and each is one a resolver genuinely cannot compute. `paths` is
 * the directory's outline PATHS, which is what the inbox convention is read off
 * (`@olai/format`'s `captureInto`) — the paths and not a `Reading`, so a face
 * with no store of its own can supply them, and since `perf-capture-paths` it
 * supplies them from the question that answers exactly this
 * ({@link Asking.paths} / `ops.paths`) rather than from the listing with the
 * counts dropped off it. `login` is
 * who the DOOR knows and may be nobody, because an attribution a caller could
 * send would not be one. `now` is the clock, read PER CALL rather than
 * captured, so a server left running overnight still dates a capture today —
 * the same rule {@link asking} keeps for `date:yesterday`.
 */
export interface Planning {
  readonly paths: ReadonlyArray<string>
  readonly login: string | null
  readonly now: () => string
}

/**
 * A tool, as this package declares it.
 *
 * Three arms, and each CARRIES what answers it rather than leaving the
 * dispatcher to know: a READ answers from a snapshot and says how; an ACT
 * answers from the ops layer and says how; a WRITE names the part of the
 * request its own NAME already decides (`outlines_done` is `op: "done"`), so that
 * field never appears in the schema an agent fills in — and it is the one arm
 * carrying a value rather than a call, because every write is the same call.
 *
 * That is the rule the read arm was built on and the reason it is worth
 * keeping: a tool the table declares and nothing answers is a type error rather
 * than something a caller discovers. A tag the dispatcher had to branch on
 * would put the next verb's answer in a switch in another file.
 */
export type Tool =
  | (Described & {
    readonly kind: "read"
    /**
     * The shape this read answers with — `@olai/format`'s declaration, beside
     * the request schema and for the same reason.
     *
     * The read arm is the one that can say this, because it is the one whose
     * answer is a VALUE rather than an effect, and saying it is what makes the
     * arm's own rule reach the answer as well as the reader: a read that
     * answers something other than what it declares does not build, and a read
     * added without declaring one does not build either. Without it the reader
     * comes back as `unknown` and its literal — the `outlines` envelope, the
     * `{ missing }` — is checked against nothing at all.
     *
     * READ AT RUNTIME by the walk this package publishes as a harness
     * ({@link ./tools.testlib.ts}), which every row holding a read runs over its
     * OWN table: it calls every reader over one maximal set — the same fixture
     * in each package, because two copies of a maximal set is two things to keep
     * maximal — and decodes each answer against this. That is
     * deliberately a test rather than an encode at the MCP seam: what is being
     * checked is that the declaration agrees with the producer, which is a
     * fact about the build, and an encode there would either drop a drifted
     * field silently (Effect's default) or turn one into a failed tool call
     * for a live agent.
     */
    readonly answers: Schema.Top
    /** How this read is ANSWERED — one call onto {@link Asking}, exactly as the
     *  act arm below is one call onto {@link Acting}. It used to be a pure
     *  function of a {@link Reading}, which is a thing only a process holding
     *  the store has; the door it reaches through is now the same one whether
     *  the store is in this process or in an `olai web` next door. */
    readonly ask: (
      asking: Asking,
      args: never,
    ) => Effect.Effect<unknown, OpFailure>
  })
  | (Described & {
    readonly kind: "write"
    /** The part of the request this tool's NAME decides, put back by the
     *  dispatcher after the schema advertised without it. Bare here because
     *  that is all a dispatcher can use it as; what it has to agree with is
     *  {@link write}'s. */
    readonly fixed: Readonly<Record<string, unknown>>
  })
  | (Described & {
    readonly kind: "act"
    readonly act: (ops: Acting, args: never) => Effect.Effect<unknown, never>
  })
  | (Described & {
    readonly kind: "plan"
    /**
     * A write whose TARGET is a convention rather than an argument — so the
     * request cannot be fixed by the name the way {@link write}'s is, and has to
     * be resolved against the directory as it stands right now.
     *
     * PURE, and taking the outline PATHS rather than a store: which file a
     * capture lands in is `@olai/format`'s question (`captureInto`), the paths
     * are the whole of what answers it, and a listing is something every face
     * can get — including one on the far end of a socket with no store of its
     * own. That is what keeps this arm a DECLARATION like the other three: the
     * table says what the request IS, and the dispatcher owns the reading, the
     * running, and the one retry the race needs.
     *
     * It answers a `Result`, because resolving is the one moment a write can
     * be refused BEFORE anything is read or written: a caller who tries to send
     * `captured-by` is turned away here, in the same shape and with the same
     * word the ops layer refuses everything else in.
     */
    readonly plan: (
      at: Planning,
      args: never,
    ) => Result.Result<Request, OpFailure>
  })
  | (Described & {
    /**
     * THE ARM THAT REACHES A ROW'S OWN SURFACE, and the one that names no door
     * of this package at all.
     *
     * The four above it each take one of the ops-layer doors — {@link Asking},
     * {@link Running}, {@link Acting}, {@link Planning} — which is what made
     * them expressible in a general package: every one of them is a question or
     * a write about the SET, and the set is what `@olai/ops` is. A row whose
     * verbs are about its own procedures has none of those. `olai-plugin-vault-plugins`
     * is the case that forced it: `vault-plugins_inspect` reads the live registry,
     * `vault-plugins_run` and `vault-plugins_stop` move a definition, and there is no arm
     * above that can say any of it.
     *
     * They lived as three hand-written `BespokeTool`s inside `olai-plugin-mcp`
     * until #546, with a name-to-member map beside them in a `catalog.ts` that
     * decided when to advertise them. That was one row's vocabulary held by
     * another row — the same duplication `TOOLS` was in a general package — and
     * this arm is what let it go home.
     *
     * `client` IS THE CALLER'S, opaque here. A row narrows it to a
     * `SurfaceClient` over its OWN spec, where the members are compiler-checked;
     * this package cannot name that type without naming every row. It is the
     * same erasure `Sibling.faces` and `Sibling.deps` take, for the same reason
     * and at the same wall.
     *
     * `mutates` is SPELLED rather than derived. The other four arms answer it
     * from their kind — a read does not, everything else does — and this arm
     * cannot: `vault-plugins_inspect` is a read of the registry and `vault-plugins_run` is
     * not, and both are the same kind here. It is what an MCP host draws as
     * `readOnlyHint`, so guessing would mislabel one of them for a live agent.
     */
    readonly kind: "surface"
    readonly mutates: boolean
    readonly call: (client: never, args: never) => Effect.Effect<unknown, OpFailure>
  })

/**
 * A SURFACE CALL, NARROWED BACK TO THE FAILURES A TOOL MAY DECLARE — the rule
 * every arm of {@link Tool} answers under, and the reason it lives beside the
 * union rather than in the adapter that used to own it.
 *
 * It was private to `olai-plugin-mcp`'s `tools.ts` until the `surface` arm
 * existed. That arm hands a ROW its own client and asks for
 * `Effect<unknown, OpFailure>` back, so a row now has to apply this rule too —
 * and a row spelling it again would be a second copy of a claim about a channel
 * this package declares. `olai-plugin-vault-plugins`' three verbs are the first
 * caller; the adapter is the second, unchanged.
 *
 * A member call, narrowed back to the failures the ops layer declares.
 *
 * Every call over a surface carries the framework's transport failure channel
 * on top of the member's own — the socket died, the protocol could not decode —
 * and the ops-layer interfaces do not have an arm for that, correctly: a
 * transport death is not a refusal. It is a DEFECT here for the same reason
 * `olai-plugin-mcp`'s `answer` catches nothing but `OpFailure`: dressing one up as a refusal
 * would tell an agent to try something else about a condition that is not its
 * fault, and the one thing an agent could do about a dead socket — dial again —
 * the adapter already does for it before this is ever reached.
 */
export const landed = <A>(call: Effect.Effect<A, unknown>): Effect.Effect<A, OpFailure> =>
  Effect.catch(
    call,
    (failure) => isOpFailure(failure) ? Effect.fail(failure) : Effect.die(failure),
  )
// ── asking nothing ─────────────────────────────────────────────────────

/** A read asks NOTHING that is not on the floor either — the request schemas a
 *  row's table names are `@olai/format`'s, for the reason its `./reading.ts`
 *  argues: a question the agent's face asks and a question a wire spec would
 *  carry are one question, and two spellings of it are two spellings free to
 *  drift. The two LISTINGS ask nothing at all — a directory is not a question
 *  with parameters — and an empty struct is not a shape the floor would publish
 *  for either of them, so the one they share is declared here. `git_push` reads it
 *  too, for the same reason with the same nothing to ask.
 *
 *  EXPORTED because the three that read it are now in three different rows —
 *  `outlines_index` in outlines, `markdown_index` in markdown, `git_push` in git —
 *  and three rows each spelling `Schema.Struct({})` is three empty structs free
 *  to stop being the same one. It is grammar rather than vocabulary, so it stays
 *  here with the constructors. */
export const NoArgs = Schema.Struct({})

// ── the four constructors ──────────────────────────────────────────────

/**
 * Both schemas, then the question between them.
 *
 * BOTH SIDES ARE INFERRED, and neither one is written at a call site. `R` comes
 * from `answers`, so a read that does not say what it answers does not compile
 * rather than quietly getting `unknown` and being checked against nothing; and
 * the asker's `args` come from `schema` as `S["Type"]` — the same property the
 * floor reads to publish each request as a type (`export type NodeRequest =
 * typeof NodeRequest.Type`), so what an asker is handed and what a caller of
 * the ops layer writes are one declaration read twice.
 *
 * THE SCHEMA IS TAKEN AS ITSELF — `S` is the struct that was passed, and the
 * asker reads its `Type` off it — rather than as "something that decodes to
 * `A`". The older spelling was a union —
 * `Schema.Codec<A, never, never, never> | Schema.Top` — and a union is what a
 * parameter cannot be inferred through: the second arm matches every schema, so
 * `A` was never fixed and every read hand-wrote its request shape on the asker
 * instead. That annotation is what this removes. It was a SECOND declaration of
 * a fact `@olai/format` already states, free to name a different request from
 * the one the tool advertises to an agent.
 *
 * A read whose asker names the wrong request now fails to COMPILE, which is the
 * one thing a walk over a row's table cannot check — a `Tool` erases every entry
 * to `(asking, args: never)`. It is pinned in `./tools.test.ts` instead, against
 * the constructors themselves, which is one of the two reasons they are
 * exported; the other is that the rows build their tables with them.
 *
 * NOTHING IS ASSERTED HERE ANY MORE. Widening the asker onto the `Tool` arm's
 * `(asking, args: never)` used to need an `as`; tied to the schema it is a
 * relation the compiler checks for itself, including that the answer really is
 * the `R` the declaration promised.
 */
export const read = <S extends Arguments, R>(
  name: string,
  title: string,
  description: string,
  schema: S,
  answers: Schema.Codec<R, R, never, never>,
  ask: (asking: Asking, args: S["Type"]) => Effect.Effect<R, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "read",
  answers,
  ask,
})

/**
 * The write arm, whose second declaration is `fixed` rather than an asker —
 * and which is also the arm that has to say WHICH VOCABULARY it is writing in.
 *
 * `fixed` first. It is the same hand-spelling {@link read}'s just lost, in the
 * one arm carrying a value instead of a function: `{ op: "create" }` is a field
 * of the request this call already names, written out beside it. Typed as a
 * `Partial<S["Type"]>` the two have to agree, so `{ op: "creat" }` under
 * `CreateRequest` is a compile error rather than a tool that advertises
 * `files_create` and asks the planner for a verb nothing has heard of.
 * PARTIAL, and not narrower, because which fields a name decides is the tool's
 * own business — every write here fixes exactly its `op`, and one that fixed a
 * second field would be saying something true about itself.
 *
 * WHAT THAT DOES NOT REACH is a schema whose `op` is more than one literal:
 * `MarkRequest`'s is the format's whole `Status`, so this type is satisfied by
 * any of the four and cannot tell `outlines_done` from `outlines_todo`. Nothing here can
 * — the fact lives in the NAME — which is why the four are built by keying both
 * off one `mark` (`olai-plugin-outlines`' `tools.ts`, `MARK_TOOLS`) rather than
 * written out; that is a construction holding them together, and this type is
 * not a second one.
 *
 * THE SCHEMA ITSELF is bounded by `Request`, the write vocabulary the planner
 * switches on. Every write is the same call — `Running.run` — so a table entry
 * naming a schema that is not one of its arms is a tool this package advertises
 * and its own writer cannot take: refused at a decode, for a live agent, as
 * late as a refusal can arrive. It is the read arm's rule reaching the last arm
 * that did not have it — a tool the table declares and nothing answers should
 * be a type error, and the write arm is twenty of the twenty-eight.
 */
export const write = <S extends Arguments & { readonly Type: Request }>(
  name: string,
  title: string,
  description: string,
  schema: S,
  fixed: Partial<S["Type"]>,
): Tool => ({ name, title, description, schema, kind: "write", fixed })

/** The act arm's constructor, inferring its `args` the way {@link read} does
 *  and for the same reason: what `git_commit` takes is `@olai/format`'s to say, and
 *  saying it again here is a second spelling free to drift from the schema this
 *  same call advertises. */
export const act = <S extends Arguments>(
  name: string,
  title: string,
  description: string,
  schema: S,
  answer: (ops: Acting, args: S["Type"]) => Effect.Effect<unknown, never>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "act",
  act: answer,
})

/**
 * The surface arm's constructor, inferring its `args` the way {@link read} does
 * and for the same reason.
 *
 * `C` is the ROW's client type and is inferred from the callback, so the row
 * writes `calls("vault-plugins_run", …, schema, true, (client: Client, args) => …)`
 * and gets its own members checked where it wrote them. Nothing about `C`
 * survives into {@link Tool}, which is the point: a general package that could
 * name one row's client could name them all.
 */
export const calls = <S extends Arguments, C>(
  name: string,
  title: string,
  description: string,
  schema: S,
  mutates: boolean,
  answer: (client: C, args: S["Type"]) => Effect.Effect<unknown, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "surface",
  mutates,
  call: answer as (client: never, args: never) => Effect.Effect<unknown, OpFailure>,
})

/** The plan arm's constructor, inferring its `args` the way {@link read} does
 *  and for the same reason: what a capture takes is `@olai/format`'s to say
 *  (`CaptureRequest`), and saying it again here is a second spelling free to
 *  drift from the schema this same call advertises.
 *
 *  The request it answers with is bounded by `Request` exactly as {@link
 *  write}'s schema is, and for the same reason: every write is the same call,
 *  so a resolver naming something outside that vocabulary is a tool this
 *  package advertises and its own writer cannot take. */
export const plan = <S extends Arguments>(
  name: string,
  title: string,
  description: string,
  schema: S,
  resolve: (at: Planning, args: S["Type"]) => Result.Result<Request, OpFailure>,
): Tool => ({
  name,
  title,
  description,
  schema,
  kind: "plan",
  plan: resolve,
})


