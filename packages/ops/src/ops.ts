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
 * A retry that SUCCEEDS is invisible, and deliberately so (docs/brainstorming/
 * acp.md). Everything else is not: a refusal comes back as an `OpFailure` with
 * its structured detail, and a retry that keeps colliding comes back as `busy`
 * rather than as silence.
 */

import {
  BusyFailure,
  type CommitRequest,
  type CommitResult,
  type DatedAnswer,
  type DatedRequest,
  type HomesAnswer,
  type HomesRequest,
  type MovingAnswer,
  type MovingRequest,
  type NamedAnswer,
  type NamedRequest,
  type NarrowingAnswer,
  type NarrowingRequest,
  type OpFailure,
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
  type Writer,
  type WriteRequest as Request,
  type WriteResult as Applied,
} from "@olai/format"
import { type Duration, Effect, Result, SubscriptionRef } from "effect"

import type { Store } from "./deps.ts"
import {
  type Committing,
  type GitState,
  make as makeCommits,
  type Policy,
  type Status,
} from "./pending.ts"
import { type Context, plan } from "./plan.ts"
import * as Query from "./query.ts"
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
   * (docs/brainstorming/filter-rides-the-page.md).
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
   * (`docs/brainstorming/vault-in-browser.md`, PR 4).
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
   * drawing (`@olai/format`'s `page.ts`, and `docs/brainstorming/
   * vault-in-browser.md`'s PR 10).
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

/** How many times a write may be re-derived before it gives up. Each round is
 *  a fresh read and a fresh plan; something that has lost five in a row is not
 *  losing a race, it is contending with a writer that never stops. */
const ROUNDS = 5

export const make = (options: Options): Ops => {
  const context: Context = options.context ?? {
    mint: () => Math.random().toString(36).slice(2, 10),
    // The clock, read through the format's own minting: a mark is stamped with
    // the instant it was made, in the zone the person marking it is standing
    // in, and what that text looks like is the format's business rather than
    // this file's (`@olai/format`'s `stampOf`).
    now: () => stampOf(new Date()),
  }

  const commits = makeCommits({
    store: options.store,
    root: options.root,
    policy: options.policy,
    ...(options.onSettled === undefined ? {} : { onSettled: options.onSettled }),
    ...(options.quiet === undefined ? {} : { quiet: options.quiet }),
  })

  const read: Effect.Effect<Reading, OpFailure> = Effect.gen(function*() {
    const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
    if (snapshot === null) {
      const errors = yield* SubscriptionRef.get(options.store.errors)
      return yield* new ValidationFailure({
        reason: "the served directory has never loaded, so there is nothing to read",
        errors: errors ?? [],
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
      for (let round = 0; round < ROUNDS; round++) {
        const snapshot = yield* SubscriptionRef.get(options.store.snapshot)
        if (snapshot === null) {
          const errors = yield* SubscriptionRef.get(options.store.errors)
          return yield* new ValidationFailure({
            reason:
              "the served directory has never loaded, so there is nothing to write to",
            errors: errors ?? [],
          })
        }

        const planned = plan(snapshot.value, context, request)
        if (Result.isFailure(planned)) return yield* planned.failure
        const { files, documents = [], ...about } = planned.success

        // Outlines go through the format's writer; a document IS its text, so
        // it goes to disk verbatim — there is no serialiser for a writer to
        // disagree with. Both ride the same all-or-none rename.
        const changes = [
          ...files.map((file) => ({
            path: file.file,
            contents: serializeOutline(file.nodes),
          })),
          ...documents.map((doc) => ({ path: doc.file, contents: doc.text })),
        ]
        const outcome = yield* Effect.result(
          options.store.commit({ baseRev: snapshot.rev, changes }),
        )

        if (Result.isFailure(outcome)) {
          // A store that moved is the retry; anything else is a disk that
          // cannot be written, which no re-plan will fix.
          if (outcome.failure._tag === "StaleWrite") continue
          return yield* new ValidationFailure({
            reason: `the write could not be made: ${outcome.failure.message}`,
            errors: [],
          })
        }

        const written = outcome.success
        if (Result.isFailure(written)) {
          return yield* new ValidationFailure({
            reason:
              `\`${about.summary}\` would leave the outlines invalid, so nothing was ` +
              `written`,
            errors: written.failure,
          })
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

  return {
    run: reported,
    read,
    // The four query answers, over the gated read above — one declaration of
    // each envelope ({@link ./tools.ts}'s `asking`), so the answer an agent
    // gets through a surface procedure and the answer a local tool call gets
    // are the same statement rather than two that agree.
    ...asking(read, context.now),
    // The BROWSER's half of the same matcher, over the same gated read — and
    // over the WHOLE reading rather than the derivation alone, for `page`'s
    // reason: what a query selects is asked of one page, and which page an
    // address names is a question about files as well as records.
    narrowing: (request) =>
      Effect.map(read, (at) => Query.narrowing(at, request, context.now())),
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
    dated: (request) => Effect.map(read, (at) => Query.dated(at.derived, request)),
    owed: (request) => Effect.map(read, (at) => Query.owed(at.derived, request)),
    // THE PAGE, over the same gated read — the WHOLE reading rather than the
    // derivation alone, because two of the questions a page asks are about
    // files rather than about records: which paths the directory serves, and
    // which of them is a day's note (`Query.homes`' argument, one door along).
    page: (request) => Effect.map(read, (at) => Query.page(at, request)),
    // The move picker's preview, over the same gated read and over the
    // derivation alone: every rule it previews is about records and where they
    // are drawn.
    moving: (request) => Effect.map(read, (at) => Query.moving(at.derived, request)),
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
    resume: commits.resume,
    git: commits.git,
  }
}
