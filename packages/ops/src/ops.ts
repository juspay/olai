/**
 * The ops layer: the one way anything writes an outline.
 *
 * `@olai/format` says what a record is, `@olai/store` says how bytes become
 * durable, {@link ./plan.ts} says what an edit MEANS. This file is the loop
 * that joins them, and the loop is short because the hard parts are elsewhere:
 *
 *   read the snapshot → PLAN against it → commit at that revision →
 *   if the store moved, read again and plan AGAIN.
 *
 * Re-planning rather than re-sending is the whole point of optimistic
 * concurrency here. "Mark `order` done" means the same thing against a newer
 * snapshot, so a retry lands cleanly — a `git pull`, another tab and the agent
 * can all be writing and none of them loses an update. Only edits that
 * genuinely collide survive the retry, and then it is the op's own refusal that
 * speaks: the node is gone, or somebody else already marked it.
 *
 * A retry that SUCCEEDS is invisible, and deliberately so
 * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/acp.md). Everything else is not: a refusal comes back as an `OpFailure` with
 * its structured detail, and a retry that keeps colliding comes back as `busy`
 * rather than as silence.
 */

import {
  admits,
  blamed,
  BusyFailure,
  byPath,
  implicatedBy,
  type CommitRequest,
  type CommitResult,
  type DatedAnswer,
  type DatedRequest,
  type HomesAnswer,
  type HomesRequest,
  type KindVocabulary,
  NO_KINDS,
  type MovingAnswer,
  type MovingRequest,
  type NamedAnswer,
  type NamedRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  NOTHING_WRONG,
  type OpFailure,
  type OutlineError,
  type Owed,
  type OwedRequest,
  type PageReading,
  type PageRequest,
  type Pending,
  type PushResult,
  type Reading,
  serializeOutline,
  stampOf,
  type TagsAnswer,
  type TagsRequest,
  ValidationFailure,
  type Verdict,
  type Writer,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import { open as openIndex } from "@olai/index"
import { type Duration, Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import {
  type Committing,
  type GitState,
  make as makeCommits,
  type Policy,
  type Status,
} from "./pending.ts"
import { type Context, plan, scoping } from "./plan.ts"
import * as Query from "./query.ts"
import { standing } from "./standing.ts"
import { sortOfWrite } from "./sorted.ts"
import { asking, type Asking } from "./tools.ts"

export interface Options {
  readonly store: Store
  /** Absolute path of the served directory — where git runs. */
  readonly root: string
  /**
   * How writes reach git in this directory, and who decided — the live policy
   * ({@link ./pending.ts}'s `Policy`).
   *
   * `now()` is what this server DOES: `manual` is the point of the whole thing
   * (a write lands on disk and WAITS, and something asks for a commit — the
   * button, or the agent's `commit` tool), `auto` is the quiet-window loop, and
   * `off` is `--no-commit`, for a directory whose history is somebody else's
   * job.
   *
   * `pin` travels FURTHER than that: a flag that was given freezes the two git
   * rows in every browser's preferences, read-only and naming the flag
   * (`vault-level-settings`). That is why both halves arrive — "nobody said" is
   * a thing a browser has to be told, and it cannot be recovered from a mode
   * with the default already filled in.
   *
   * It is spelled `policy` at every layer it crosses — `@olai/server`'s
   * `gitPolicy.ts` composes it, `ServeOptions` takes it, this layer passes it
   * down and `./pending.ts` reads it — because one value with three names is
   * one grep that finds a third of its call sites.
   */
  readonly policy: Policy
  /** Overridable so tests are deterministic: the id a new node gets and the
   *  instant a mark is stamped with are the only two things about an op that
   *  are not a function of the snapshot. */
  readonly context?: Context
  /**
   * WHICH PROPERTY KINDS A PLUGIN TAUGHT THIS VAULT, and which of them this
   * serve is answering for — `@olai/format`'s `KindVocabulary`, handed down
   * as data.
   *
   * It is an OPTION rather than an import for the reason every plugin fact in
   * this layer is: `@olai/ops` names no plugin, the registry that knows them
   * is above, and what crosses is a table. Both halves of it are spent here —
   * the BUILT one refuses a declaration naming no word this binary knows, and
   * the ENABLED one holds a value to a kind somebody is actually answering for
   * ({@link @olai/format}'s `typing.ts`).
   *
   * Absent is `NO_KINDS`, which is not a fallback but the serve `--plugins=`
   * composes and the state every test in this package is in.
   */
  readonly kinds?: KindVocabulary
  /**
   * Told about every write this layer REFUSED.
   *
   * It hangs here rather than on any one caller because "a refusal is never
   * silently ignored" is a property of WRITES, not of whichever transport
   * asked for one: an observer on the MCP server would leave a second writer —
   * the web UI's own ops procedures, when they arrive — reporting nothing.
   * The agent gets the same detail in its tool result; this is what puts it in
   * front of the person watching.
   */
  readonly onRefusal?: (request: Request, failure: OpFailure) => Effect.Effect<void>
  /** Told whenever anything about git settled — a commit by whichever door, a
   *  push, a refusal of either, or the loop stopping — see
   *  {@link ./pending.ts}'s `Options`. */
  readonly onSettled?: () => void
  /** The quiet window, for a test that cannot wait fifteen seconds — see
   *  {@link ./pending.ts}'s `Options`. */
  readonly quiet?: Duration.Input
}

/**
 * Everything this layer can be asked.
 *
 * It SATISFIES `./tools.ts`'s read door outright ({@link Asking}, which asks no
 * questions about who is asking) and it is one partial application away from
 * the other two: `Running` and `Acting` are the same verbs with the writer
 * already bound, because a tool has no business naming one. That is what makes
 * the tool table answerable by something which is not this layer at all — since
 * `mcp-bridge`, a surface client with no store behind it — and it is why those
 * two are interfaces rather than methods this file happens to have.
 */
export interface Ops extends Asking {
  /**
   * WHICH NODES OF ONE PAGE a query selects — ids and why ({@link
   * ./query.ts}'s `narrowing`).
   *
   * HERE RATHER THAN ON {@link Asking}, and the line is worth arguing because
   * everything else about search is on that one. `Asking` is what a TOOL may
   * ask, which is why something that is not this layer at all can satisfy it —
   * `mcp-bridge`'s door, a surface client with no store behind it. This is not
   * a tool and never will be: it answers with a set of ids to look up, useful
   * only to a caller already looking at the rows those ids name, which is the
   * browser narrowing a page in front of somebody. An agent asking which nodes
   * match asks `search_nodes` and is answered with the nodes.
   *
   * So it hangs off the layer the SERVER holds (`@olai/server`'s `runtime.ts`
   * binds it to the `narrowing` stream, exposed on the browser face alone) and
   * the agent's bridge is not obliged to implement a member no agent face
   * exposes.
   *
   * A STREAM's read rather than a procedure's, which is the whole of
   * `filter-ask-carries-revision`: a filter is a STANDING view of a page, so
   * asking it as a call meant re-asking it once per published revision — a
   * whole-vault walk per frame of a bulk gesture. Read on the same pulse
   * {@link page} is and sent when it moved by value, it costs a page and, for a
   * gesture that changes no match, costs the wire nothing at all
   * (https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/filter-rides-the-page.md).
   */
  readonly narrowing: (
    request: NarrowingRequest,
  ) => Effect.Effect<NarrowingAnswer, OpFailure>
  /**
   * WHICH of these ids the set declares, and what each one names ({@link
   * ./query.ts}'s `named`).
   *
   * HERE FOR {@link narrowing}'s REASON, one door over: an agent that wants to
   * know whether an id is real reads it (`read_node` answers the node or the id
   * it does not hold), and is told everything about it. This answers a dozen
   * ids with nothing but the node each names, which is useful only to a caller
   * already looking at the words those ids are written in — the chat panel,
   * deciding which of an agent's backticks are pressable.
   */
  readonly named: (
    request: NamedRequest,
  ) => Effect.Effect<NamedAnswer, OpFailure>
  /**
   * WHERE these ids now live, and which of these FILES the set has anything
   * from ({@link ./query.ts}'s `homes`).
   *
   * HERE FOR {@link named}'s REASON, one door further along: what comes back is
   * a file per id and a list of paths, which is useful only to a caller holding
   * a memory of records it saw earlier and deciding what is still worth
   * remembering — the browser's fold memory, which kept a whole id→file map of
   * its own to answer this. An agent that wants to know where a node is reads
   * it and is told, beside everything else about it.
   */
  readonly homes: (
    request: HomesRequest,
  ) => Effect.Effect<HomesAnswer, OpFailure>
  /**
   * THE CALENDAR'S DOTS and WHAT IS OWED — the two date readings the sidebar
   * used to take off the browser's own copy of the set
   * (`https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`, PR 4).
   *
   * HERE RATHER THAN ON {@link Asking}, beside {@link narrowing} and for its
   * argument word for word: `Asking` is what a TOOL may ask, and neither of
   * these is a tool. A month of dots is a paint instruction for a grid somebody
   * is looking at, and two integers about today are a badge — an agent asking
   * what is late asks `search_nodes` with a date clause and is answered with
   * the nodes. So they hang off the layer the SERVER holds, are exposed on the
   * browser face alone (`@olai/server`'s `faces.ts`), and `mcp-bridge`'s door
   * is not obliged to implement members no agent face offers.
   *
   * TWO members and not one, though one sidebar draws both. They are answers to
   * two different questions with two different arguments — a month somebody
   * paged to, and the day somebody is standing on — and folding them into one
   * would make paging the calendar a question about what is late.
   */
  readonly dated: (
    request: DatedRequest,
  ) => Effect.Effect<DatedAnswer, OpFailure>
  readonly owed: (request: OwedRequest) => Effect.Effect<Owed, OpFailure>
  /**
   * WHAT ONE PAGE SHOWS — the reading a browser draws, for the address it is
   * drawing (`@olai/format`'s `page.ts`, and
   * `https://github.com/juspay/oss.olai/blob/main/projects/olai/brainstorming/vault-in-browser.md`'s PR 10).
   *
   * HERE RATHER THAN ON {@link Asking} for {@link dated}'s reason, and it is
   * the sharpest instance of it: what comes back is a SCREEN — rows carrying
   * their own fold keys, a rollup beside a checkbox, the blockers a mark draws.
   * An agent asking what an outline holds asks `list_outlines` and
   * `read_subtree` and is answered in nodes, which is the thing it can act on.
   *
   * ONE MEMBER for seven routes, because they are one question asked with
   * different words: which page does this address name, and what does it put on
   * the screen. Splitting it per route would be seven doors onto one walk, each
   * free to answer a different revision.
   */
  readonly page: (
    request: PageRequest,
  ) => Effect.Effect<PageReading, OpFailure>
  /**
   * WHETHER A ROW CAN GO WHERE SOMEBODY IS POINTING — the move picker's preview
   * of this layer's own planner, for the destinations a search just offered
   * (`@olai/format`'s `moving.ts`).
   *
   * HERE for the reason above, and NOT beside the write it previews: the write
   * is `move_node`, which refuses in its own words on the way through
   * {@link ./plan.ts}. This is what a person reads a moment earlier, over the
   * same set, and it may never refuse something the planner would allow.
   */
  readonly moving: (
    request: MovingRequest,
  ) => Effect.Effect<MovingAnswer, OpFailure>
  /**
   * WHICH TAGS the set already uses, for one sigil and one prefix — the row
   * editor's completion popup, answered ({@link ./query.ts}'s `tags`).
   *
   * HERE RATHER THAN ON {@link Asking}, for {@link narrowing}'s reason one turn
   * on: it is not a tool and is not meant to become one. What it answers is a
   * capped shortlist shaped by the popup that draws it — eight rows, ranked by
   * how much this set uses each word — which is useful to somebody watching a
   * caret and to nobody else. An agent writing `#home` writes the word.
   *
   * It hangs off the layer the SERVER holds (`@olai/server`'s `runtime.ts` binds
   * it to `vocabulary.tags`, exposed on the browser face alone), and the agent's
   * bridge is not obliged to implement a member no agent face exposes.
   */
  readonly tags: (
    request: TagsRequest,
  ) => Effect.Effect<TagsAnswer, OpFailure>
  /** Perform one op. Fails only with an {@link OpFailure} — every internal
   *  failure mode (a stale base, a file system error) is either retried or
   *  translated, because a caller of this interface is a tool call or a
   *  procedure and both need an answer they can render.
   *
   *  ONE refusal repairs itself before it is answered: a write REFUSED by a
   *  set the disk has moved past (stale-set reads, refusing writes —
   *  `stale-set-reads-clean-writes-refuse`), wherever the refusal showed —
   *  the gate's verdict, or the planner's answer against a set withholding a
   *  file it judged from bytes. The repair is asked and bounded where the
   *  refusal sits below; what is said HERE is the caller's half: a repair
   *  that works is invisible (the write lands on the current set), and one
   *  that does not changes nothing the caller can observe — the answer is
   *  the refusal reached against the resynced set.
   *
   *  The half of that bug where NOTHING refuses — a replacement the set
   *  still validates, which this loop would plan against and then land
   *  straight over — is not here at all: the write gate compares its own
   *  paths by bytes on the way in and answers `StaleWrite`, so it arrives as
   *  an ordinary re-derivation ({@link @olai/store}'s `commit`). Nothing
   *  above the store has to know it happened.
   *
   *  `writer` is INTENT, not identity: git records the repository's own name
   *  and email whoever asked, so this is the only thing that can tell an
   *  agent's edits from a person's. It is required rather than defaulted —
   *  a transport that forgot to say would be a transport whose writes are
   *  attributed to somebody else. */
  readonly run: (
    request: Request,
    writer: Writer,
  ) => Effect.Effect<Applied, OpFailure>
  /**
   * No {@link run} is in flight.
   *
   * Completes the moment the last `run` returns, fails or is interrupted —
   * planning included, not only the store gate. `POST /olai/resync` waits
   * here before it probes, because a look at the disk while a write is
   * still staging is a look at `.olai-*.tmp` (the shared-scratch After's
   * leftover) rather than at the tree the next reader will be served.
   */
  readonly idle: Effect.Effect<void>
  /**
   * BOTH chrome answers, from one look at the repository.
   *
   * What a publisher takes. Asking `pending` and `git` separately meant two
   * surveys — two reads of the git directory and two `symbolic-ref` spawns per
   * republish, for one question — with a window between them where the two
   * controls could disagree about the directory they are both describing. That
   * window is what the arrangement exists to close, so it is closed by taking
   * them together rather than by asking carefully.
   */
  readonly status: Effect.Effect<Status>
  /** What is waiting, alone — {@link status}' first half, for a caller that
   *  wants only it. Derived from git every time it is asked, so nothing above
   *  this layer holds a copy that could be wrong. */
  readonly pending: Effect.Effect<Pending>
  /** Commit what is waiting — everything, or exactly the paths that were
   *  picked. Both doors — the button's procedure and the MCP tool — are callers
   *  of this one thing. */
  readonly commit: (
    request: CommitRequest,
    writer: Writer,
  ) => Effect.Effect<CommitResult>
  /**
   * Send the current branch to its upstream.
   *
   * One verb and no arguments, which is the whole of the decision: an audit
   * trail that lives on one machine is worth very little, and everything else
   * about a remote — which one, which refspec, what to do about a divergence —
   * is a conversation in a terminal. Both doors again, and a refusal comes back
   * as a value with git's own words on it, exactly as a refused commit does.
   */
  readonly push: Effect.Effect<PushResult>
  /** The quiet-window loop and the two things around it, straight off
   *  {@link ./pending.ts} — the effect a composition root forks, the reading
   *  that re-arms the window, and the one way a stopped loop starts again. */
  readonly observe: Committing["observe"]
  readonly loop: Committing["loop"]
  readonly catchUp: Committing["catchUp"]
  readonly resume: Committing["resume"]
  /**
   * The set as a reader sees it, or the one refusal for a directory that has
   * never loaded.
   *
   * Here rather than at each reader so there is ONE answer to "there is
   * nothing to read yet" — the writer's and the query tools' used to be two
   * different shapes for the same condition — and so nothing above this layer
   * has to reach into the store to find out.
   */
  readonly read: Effect.Effect<Reading, OpFailure>
  /**
   * What git is doing for this directory, as of now (`git-invisible`, #108) —
   * read by the header's git indicator beside what is waiting, and by an agent
   * in a terminal as a resource.
   *
   * A PROJECTION of the same survey {@link pending} runs rather than a probe of
   * its own ({@link ./pending.ts}'s `gitOf`), because the two values are drawn
   * together and two probes would be two answers: a page reading "no git here"
   * beside a panel offering to commit four changes. HACKING.md's consistency
   * rule, one control over.
   */
  readonly git: Effect.Effect<GitState>
}

/** How many LOST RACES one write survives before it gives up. Each is a fresh
 *  read and a fresh plan overtaken by another writer; something that has lost
 *  five in a row is not losing a race, it is contending with a writer that
 *  never stops.
 *
 *  IT COUNTS LOST RACES AND NOTHING ELSE, which is what makes the sentence
 *  above true of the code rather than of a comment: the counter moves at the
 *  ONE site that observes a race ({@link Store.commit}'s `StaleWrite`), so a
 *  round a repair begins again costs it nothing and there is no refund to
 *  remember at either of {@link REPAIRS}' doors. The loop is bounded by
 *  `ROUNDS + REPAIRS` iterations: every `continue` in it either counts a race
 *  here or spends the repair budget, which no round can give back. */
const ROUNDS = 5

/** How many TIMES one write may heal the set a REFUSAL was reached against
 *  ({@link run}'s two repair arms say why the number and why it is this
 *  small): one. */
const REPAIRS = 1

/**
 * WHICH FILE STOPS THIS WRITE — the sentence `run` says when the store
 * handed back a verdict.
 *
 * Three ways to be here, one function: the verdict implicates a file this
 * write touched; it does not, and this write caused invalidity in files
 * it did not write (the directory was loading); or the write is standing
 * on a base the disk has moved past while the set would not load, and
 * there is no file of ours to name.
 *
 * ASKED THROUGH THE STEP EVERY READER OF A VERDICT MAKES: it becomes per-file
 * ENTRIES (`blamed`), and both questions are asked of those — `admits` for the
 * files this write put down, and the first entry for the second arm, since
 * `blamed` files in path order and that first entry is what `implicatedIn` used
 * to answer. One partition, read twice, rather than two orderings of one axis.
 */
const blockerOf = (
  verdict: Verdict,
  paths: ReadonlyArray<string>,
  alreadyBroken: boolean,
): string | undefined => {
  const entries = blamed(verdict.findings)
  const admission = admits(entries, paths)
  if (admission._tag === "implicated") return admission.file
  // `blamed` has already filed the judges out (`Related.broken`) — the first
  // entry is a BROKEN file, never one the finding merely looked at.
  return alreadyBroken ? undefined : entries[0]?.file
}

/**
 * Every file these findings were judged FROM — the ABOUT axis the drift ask
 * rides ({@link @olai/format}'s `implicatedBy`, deduplicated and path-ordered
 * so one refusal always asks the same question the same way).
 *
 * `implicatedBy` AND NEVER `blamedOn`, which is a live hazard rather than a
 * pedantic one since the two planes became two functions sitting beside each
 * other in `@olai/format`'s `errors.ts`. They differ by exactly the sites a
 * finding NAMES without blaming — a `bad-prop`'s judging declaration, a
 * `foreign-parent`'s parent — and the judge is precisely what stale reaches
 * through: the whole shape this arm exists for is a declaration whose bytes
 * moved on disk while the value it condemned did not. Swapping the axis here
 * would drop that file out of the ask and leave the refusal unhealable, and it
 * would do it silently, because every other file in the ask is unchanged.
 * `ops.test.ts` pins the asked SET for both arms for this reason.
 */
const aboutFiles = (findings: ReadonlyArray<OutlineError>): ReadonlyArray<string> =>
  [
    ...new Set(
      findings.flatMap((finding) => implicatedBy(finding)),
    ),
  ].sort(byPath)

export const make = (options: Options): Ops => {
  const kinds = options.kinds ?? NO_KINDS
  const context: Context = options.context ?? {
    mint: () => Math.random().toString(36).slice(2, 10),
    // The clock, read through the format's own minting: a mark is stamped with
    // the instant it was made, in the zone the person marking it is standing
    // in, and what that text looks like is the format's business rather than
    // this file's (`@olai/format`'s `stampOf`).
    now: () => stampOf(new Date()),
  }

  /**
   * ONE SEARCH INDEX FOR THIS DIRECTORY, opened where the store is named.
   *
   * Here rather than a layer up because a table is a fact about a served
   * directory, exactly as the write gate and the commit loop below are, and
   * because the one door that spends it is inside this package. A server
   * serving two directories builds two of these and never has to say so; a
   * test that builds an `Ops` gets one for free, which is deliberate — the
   * indexed path is then what this package's own suite exercises, rather than
   * a path only production takes.
   *
   * IT THROWS IF IT CANNOT BE OPENED, which is that package's own decision
   * (`@olai/index`'s `open`) and is why nothing here has a fallback in it: a
   * runtime whose SQLite cannot make the table would otherwise serve a
   * quietly slower vault and tell nobody, and the corpus walk is still exactly
   * what `Query.search` does for every query the table declines.
   *
   * NOTHING CLOSES IT, and that is the truth rather than an omission. An `Ops`
   * has no teardown — the store's scope owns the directory's lifetime — and
   * what this holds is an in-memory table that goes when the process does.
   */
  const index = openIndex()

  /**
   * THE FIVE STANDING VIEWS, sharing per revision ({@link ./standing.ts}).
   *
   * Here for the search index's reason one line up: what it holds is a fact
   * about THIS served directory — the answers its open subscriptions are
   * looking at — so it is built where the store is named, a server serving two
   * directories builds two without saying so, and a test that builds an `Ops`
   * gets the shared path rather than a path only production takes.
   */
  const views = standing(context.now, kinds)

  const commits = makeCommits({
    store: options.store,
    root: options.root,
    policy: options.policy,
    ...(options.onSettled === undefined ? {} : { onSettled: options.onSettled }),
    ...(options.quiet === undefined ? {} : { quiet: options.quiet }),
  })

  const read: Effect.Effect<Reading, OpFailure> = Effect.gen(function*() {
    const { snapshot } = yield* options.store.read("cheap")
    if (snapshot === null) {
      const errors = yield* SubscriptionRef.get(options.store.errors)
      return yield* new ValidationFailure({
        reason: "the served directory has never loaded, so there is nothing to read",
        verdict: errors ?? NOTHING_WRONG,
      })
    }
    // The snapshot IS the reading: the validator paired the set with the view
    // it judged, and the store published the pair. Nothing is derived here.
    return snapshot.value
  })

  const run = (
    request: Request,
    writer: Writer,
  ): Effect.Effect<Applied, OpFailure> =>
    Effect.gen(function*() {
      let repairs = REPAIRS
      /**
       * THE ONE ALTERNATIVE EXPLANATION, ruled out before either refusal arm
       * below answers: THE SET WAS STALE WHERE THE REFUSAL LOOKS.
       *
       * `stale-set-reads-clean-writes-refuse` (roadmap bugs.olai) is the
       * shape this repairs: a git operation replaced a file in a way the
       * watcher's stamps cannot see, so reads went on serving the old set
       * with no error and every write refused — the stale copy of that file
       * no longer satisfies the declarations the SAME operation landed. The
       * check asks about FILES, because a name is all a byte comparison
       * needs: every file the refusal could be looking AT, re-read from disk
       * and answered from BYTES rather than stamps ({@link @olai/store}'s
       * `drifted`). One drifted file is proof the judgement was reached
       * against a tree that is no longer there, so the write is not refused
       * after all — the resync door a person would knock on is opened FOR
       * them (`refresh("verified")`, the look the store reserves for
       * "something outside this process rewrote the tree") and the round
       * begins again, planned off the set the disk actually holds.
       *
       * THE FILES THIS WRITE ITSELF PUTS DOWN are not asked here, and not
       * because they do not matter: the gate compares them by bytes on its
       * own way in and answers `StaleWrite`, so drift under this write never
       * reaches a refusal to repair. What is left for this door is the drift
       * a refusal REACHED THROUGH — a stale judge, a withheld file — which
       * only a reader of `E` can name, and the store cannot read `E`.
       *
       * ONCE, per write ({@link REPAIRS}) — one budget behind BOTH doors,
       * so the two arms cannot spend it apart, and the only thing that
       * bounds the loop a healed round begins again ({@link ROUNDS} counts
       * lost races, and a repair is not one). A retry that HEALS and still
       * refuses answers the refusal it was just handed — the fresh one,
       * reached against the resynced set — rather than paying for another
       * look. The failure of the LOOK says the same thing: a disk that
       * cannot be re-read, or one that agrees with the set after all, is
       * not a write problem, and the refusal already in hand is the honest
       * sentence for both.
       *
       * THE CHECK BEFORE THE DOOR is the ordering the costs argue: a resync
       * on every refusal would re-read the directory for every typo an agent
       * talks to itself, so the cheap per-file byte check is what stands in
       * front of it. Detection is where the refusal shows; the resync is
       * whole-tree, which is what the one look verb offers, and one re-read
       * of a served directory costs less than keeping a second look verb
       * honest — the narrow, per-file heal is the GATE's, over the paths it
       * is itself about to write.
       */
      const repair = (files: ReadonlyArray<string>): Effect.Effect<boolean> =>
        Effect.gen(function*() {
          if (repairs === 0 || files.length === 0) return false
          const drift = yield* Effect.result(options.store.drifted(files))
          if (!Result.isSuccess(drift) || drift.success.length === 0) return false
          // Drift is proof, so the budget is spent before the look is taken:
          // the LOOK failing answers the refusal with the repair accounted
          // for, and no second resync is owed however the round goes on.
          repairs -= 1
          const resynced = yield* Effect.result(options.store.refresh("verified"))
          return Result.isSuccess(resynced)
        })
      for (let races = 0; races < ROUNDS;) {
        // The CHEAP class, and the write gate is why it is enough: a plan is
        // derived from this revision and then judged against `baseRev` inside
        // the gate, which probes on its way in. A tree that moved under the
        // plan comes back `StaleWrite` and the round runs again — the drift
        // this read cannot see is the drift the gate is there to catch.
        const { snapshot } = yield* options.store.read("cheap")
        if (snapshot === null) {
          const errors = yield* SubscriptionRef.get(options.store.errors)
          return yield* new ValidationFailure({
            reason:
              "the served directory has never loaded, so there is nothing to write to",
            verdict: errors ?? NOTHING_WRONG,
          })
        }

        const planned = plan(scoping(snapshot.value, context, kinds), request)
        if (Result.isFailure(planned)) {
          /**
           * THE SAME REFUSAL, ONE DOOR EARLIER. Since brokenness is per
           * file (the 2026-08-29 ruling), a file judged FROM STALE BYTES
           * is withheld from the very set the planner reads — so the plan
           * refuses before the gate is ever asked: the node it was shown
           * names no records because its file's stale copy failed a
           * declaration the disk has already moved past. The planner's
           * sentence names an ID and no files, but the SET carries the
           * names: its `broken` list is the files it withheld, each
           * holding the rows it was judged by, and those rows name every
           * file they were judged FROM. One of them reading differently
           * on disk is the proof the refusal stands on a judgement that
           * is no longer there.
           *
           * TWO REFUSAL SHAPES ONLY can be this symptom: `NotFoundFailure`
           * (the id is gone because its file withheld its records) and
           * `ValidationFailure` ({@link ./plan.ts}'s `writable` — the file
           * answered, and the answer was rows from the broken list). Every
           * other refusal the planner makes is a `UsageFailure` about the
           * REQUEST — a typo, a misuse, a fence the write ran into — and
           * those are words about what was ASKED, never about bytes the
           * set holds: a stale copy cannot invent a usage fault, so the
           * hottest refusal path pays no byte check for it.
           *
           * And a plan refusal off a set that holds NOTHING broken keeps
           * this door shut either way: there is no judgement in reach for
           * staleness to have spoken through, so an unknown id stays
           * unknown — the ruled trigger never fires where no refusal
           * names files.
           */
          const held = snapshot.value.set.broken
          const tag = planned.failure._tag
          if (
            (tag === "NotFoundFailure" || tag === "ValidationFailure") &&
            held.length > 0 &&
            (yield* repair(aboutFiles(held.flatMap((entry) => entry.errors))))
          ) {
            continue
          }
          return yield* planned.failure
        }
        const { files, documents = [], removed = [], ...about } = planned.success

        // Outlines go through the format's writer; a document IS its text, so
        // it goes to disk verbatim — there is no serialiser for a writer to
        // disagree with. Both ride the same all-or-none rename. A REMOVAL is
        // the third shape and needs no bytes at all: `null` for "this path
        // goes" ({@link @olai/store}'s `Change`), judged against the codec
        // EXACTLY as a rewrite is — validated and published or not at all.
        const changes = [
          ...files.map((file) => ({
            path: file.file,
            contents: serializeOutline(file.nodes),
          })),
          ...documents.map((doc) => ({ path: doc.file, contents: doc.text })),
          ...removed.map((path) => ({ path, contents: null })),
        ]
        const outcome = yield* Effect.result(
          options.store.commit({ baseRev: snapshot.rev, changes }),
        )

        if (Result.isFailure(outcome)) {
          // A store that moved is the retry; anything else is a disk that
          // cannot be written, which no re-plan will fix.
          //
          // THE ONE SITE THAT COUNTS ({@link ROUNDS}): this is what a lost
          // race IS — another writer reached the gate first — and every
          // other way round this loop is a repair, which is not one.
          if (outcome.failure._tag === "StaleWrite") {
            races++
            continue
          }
          return yield* new ValidationFailure({
            reason: `the write could not be made: ${outcome.failure.message}`,
            verdict: NOTHING_WRONG,
          })
        }

        const written = outcome.success
        if (Result.isFailure(written)) {
          /**
           * THE GATE'S REFUSAL, and its subject is the VERDICT: every file
           * this refusal was judged FROM ({@link aboutFiles} — the judge's
           * site included, since a stale declaration is exactly the shape
           * this ask exists to reach). One question at one door.
           *
           * The write's OWN files are not a separate ask here: the gate
           * compares them by bytes on its way in and answers `StaleWrite`
           * rather than a verdict when they have moved ({@link
           * @olai/store}'s `commit`), so a refusal reaching this line was
           * reached over the bytes that are really under this write. What
           * the verdict names, it names — this write's own file included,
           * whenever the finding is about it.
           */
          if (yield* repair(aboutFiles(written.failure.findings))) continue
          const paths = changes.map((change) => change.path)
          /**
           * THE REFUSAL NAMES ITS BLOCKER, which the sentence this replaces
           * could not: "`x` would leave the outlines invalid" read as an
           * indictment of the write, and the write was usually innocent — the
           * directory had been invalid before it was asked for, and the gate
           * had no way to say which file made it so
           * (`broken-file-blocks-healthy-writes`).
           *
           * {@link blockerOf} is the three ways, asked of the verdict and of
           * whether the directory was already not loading. The paths are the
           * ones this commit carried — a second reading of "which files is
           * this write about" is how the gate and the sentence come to
           * disagree about one write.
           */
          const alreadyBroken =
            (yield* SubscriptionRef.get(options.store.errors)) !== null
          const blocker = blockerOf(written.failure, paths, alreadyBroken)
          return yield* new ValidationFailure({
            reason: blocker !== undefined
              ? `\`${about.summary}\` would leave \`${blocker}\` invalid, so ` +
                `nothing was written`
              : `\`${about.summary}\` was not written: ${
                paths.map((path) => `\`${path}\``).join(", ")
              } changed while the served outlines were not loading, so this edit ` +
                `would be made from an older copy of them`,
            verdict: written.failure,
          })
        }

        /**
         * A DOCUMENT WRITE'S YES IS EARNED, NOT REPORTED. (2026-09-01: a
         * `create_document` answered a revision over a body and the file was
         * 0 bytes — the origin never reproduced, so this is the class closed
         * rather than the cause.) The gate's own re-probe takes the promised
         * bytes only where the disk reads back as them, and a `.md` that
         * reads back EMPTY still VALIDATES — so a loss that lands inside the
         * write's own window is published and answered the same as a
         * landing, whichever arm took it away. `documents` is the whole of
         * what this asks: both verbs that carry bytes verbatim, and the one
         * shape of write this layer answers for that the gate cannot refuse
         * on content alone.
         *
         * The read-back is {@link @olai/store}'s `body`: live bytes, one
         * file, kept by nobody — the door made for exactly this question. The
         * cost is the write's own size once more, paid by document writes
         * only: every other verb's answer is about RECORDS the gate
         * validated, and their bytes are the serializer's, not the caller's.
         */
        for (const document of documents) {
          const held = yield* Effect.result(options.store.body(document.file))
          if (!Result.isSuccess(held) || held.success !== document.text) {
            return yield* new ValidationFailure({
              reason:
                `\`${about.summary}\` was not kept by the disk: \`${document.file}\` reads back ` +
                `${
                  Result.isSuccess(held) && held.success !== null
                    ? `${held.success.length} characters`
                    : "unreadable or missing"
                } where ${document.text.length} were written — read it again and ` +
                `rewrite from what it says.`,
              verdict: NOTHING_WRONG,
            })
          }
        }

        // Recorded AFTER the write landed. Every write that lands is waiting
        // now — nothing commits one on its own any more — so the counter
        // answers "how many ops the next commit will sweep", and what clears it
        // is that sweep.
        commits.wrote(writer)
        /** WHY this write is not in the history — always a sentence, because
         *  there is always a reason (`./pending.ts`'s `whyOf`). It rides the
         *  reply, so what happened is where the person who asked for the write
         *  is looking rather than in the server's log. Under either waiting
         *  mode that sentence is "waiting", which is the feature working and
         *  must never render as the git-error state. */
        const why = yield* commits.whyWaiting(writer)
        // What the write CHANGED, classified the way a pending row is — off
        // the two readings this write is made of, which are both still in
        // hand. A reader that DRAWS a write rather than logging one needs a
        // word it can switch on, and the summary above is a commit subject.
        // The reading `plan` was just judged against, handed on rather than
        // reached for a second time — the set and the derivation together, as
        // the snapshot carries them.
        const { set, derived } = snapshot.value
        const sort = sortOfWrite(set, derived, planned.success)
        return {
          ...about,
          rev: written.success,
          why,
          ...(sort === undefined ? {} : { sort }),
        }
      }

      return yield* new BusyFailure({
        reason:
          `the outlines kept changing under this write — ${ROUNDS} attempts, each from a ` +
          `fresh read, all overtaken. Something else is writing continuously.`,
      })
    })

  const reported = (
    request: Request,
    writer: Writer,
  ): Effect.Effect<Applied, OpFailure> =>
    options.onRefusal === undefined
      ? run(request, writer)
      : Effect.tapError(
        run(request, writer),
        (failure) => options.onRefusal!(request, failure),
      )

  // Counted from the start of `run`, not from the store gate: planning a
  // write has not taken the permit yet, and restoring a shared scratch in
  // that window is how After left a staged `.tmp` on the tree.
  let inflight = 0
  const waiters: Array<() => void> = []
  const beginWrite = (): void => {
    inflight++
  }
  const endWrite = (): void => {
    inflight--
    if (inflight === 0) {
      const pending = waiters.splice(0)
      for (const wake of pending) wake()
    }
  }
  const idle: Effect.Effect<void> = Effect.callback<void>((resume) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resume(Effect.void)
    }
    if (inflight === 0) {
      finish()
      return
    }
    waiters.push(finish)
  })
  const tracked = (
    request: Request,
    writer: Writer,
  ): Effect.Effect<Applied, OpFailure> =>
    Effect.suspend(() => {
      beginWrite()
      return Effect.ensuring(reported(request, writer), Effect.sync(endWrite))
    })

  return {
    run: tracked,
    idle,
    read,
    // The four query answers, over the gated read above — one declaration of
    // each envelope ({@link ./tools.ts}'s `asking`), so the answer an agent
    // gets through a surface procedure and the answer a local tool call gets
    // are the same statement rather than two that agree.
    ...asking(read, context.now, kinds, index),
    // The BROWSER's half of the same matcher, over the same gated read — and
    // over the WHOLE reading rather than the derivation alone, for `page`'s
    // reason: what a query selects is asked of one page, and which page an
    // address names is a question about files as well as records.
    //
    // …and through {@link ./standing.ts}, like the four other STANDING views
    // below it: this is not asked once and answered, it is held open by every
    // tab that has the filter box in front of somebody, and the framework gives
    // each of them a poll loop of its own. What that module adds is that one
    // question at one revision is answered ONCE however many are watching, and
    // that a revision which moved nothing this answer read does not rebuild it
    // at all. The read is still the gated one and the answer is still
    // {@link ./query.ts}'s — nothing is decided there and nothing new is
    // decided here.
    //
    // THE CLOCK GOES IN rather than being read at the call, which is the one
    // visible difference: the narrowing's relative words count from the instant
    // its answer was COMPUTED, which is once per question per revision instead
    // of once per subscriber per read.
    narrowing: (request) => Effect.map(read, (at) => views.narrowing(at, request)),
    // The transcript's backticks, over the same gated read and with no clock in
    // it: an id names what it names whatever day it is asked on.
    named: (request) => Effect.map(read, (at) => Query.named(at.derived, request)),
    // The fold memory's two facts, over the same gated read and with no clock
    // in it either: where a record is and whether a file was read is true
    // whatever day it is asked on. The WHOLE reading rather than the derivation
    // alone — `Query.homes` argues it, and it is the near miss this member
    // exists to avoid.
    homes: (request) => Effect.map(read, (at) => Query.homes(at, request)),
    // The SIDEBAR's two date readings, over the same gated read and over the
    // derivation alone: a dot and a count are both about records, and the other
    // half of the set is prose. The day they are counted against is the
    // REQUEST's, never `context.now()` — the reader's clock is the only one
    // that can say what is late for them (`./query.ts`'s `owed`).
    dated: (request) => Effect.map(read, (at) => views.dated(at, request)),
    owed: (request) => Effect.map(read, (at) => views.owed(at, request)),
    // THE PAGE, over the same gated read — the WHOLE reading rather than the
    // derivation alone, because two of the questions a page asks are about
    // files rather than about records: which paths the directory serves, and
    // which of them is a day's note (`Query.homes`' argument, one door along).
    page: (request) => Effect.map(read, (at) => views.page(at, request)),
    // The move picker's preview, over the same gated read and over the
    // derivation alone: every rule it previews is about records and where they
    // are drawn.
    moving: (request) => Effect.map(read, (at) => views.moving(at, request)),
    // The COMPLETION's door, over the same gated read: the vocabulary the set
    // has already written down, ranked and capped for a popup. Also the
    // browser's alone, and also nothing decided here — what counts as a tag,
    // and what the trash does to a count, is `@olai/format`'s `vocabulary.ts`.
    tags: (request) =>
      Effect.map(read, (at) => Query.tags(at.derived, request)),
    status: commits.status,
    pending: commits.pending,
    commit: commits.commit,
    push: commits.push,
    observe: commits.observe,
    loop: commits.loop,
    catchUp: commits.catchUp,
    resume: commits.resume,
    git: commits.git,
  }
}
