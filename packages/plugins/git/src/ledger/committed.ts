/**
 * HEAD's side of the dirty outlines — read once per commit, not once per
 * keystroke.
 *
 * This is `perf-git-per-write`. Every published revision surveys git, and for
 * every dirty outline the node-level diff needs the copy HEAD has: that used to
 * be a `git show HEAD:<file>` subprocess plus a full parse of what came back,
 * PER DIRTY FILE, PER REVISION. Under `--commit=manual` the dirty list only
 * grows during a session, so a keystroke in one outline paid for every other
 * outline anybody had touched since the last commit — typing got slower the
 * longer a commit was deferred, which is the one shape of cost a person feels
 * directly.
 *
 * The observation the whole module rests on is one sentence: **a commit's copy
 * of a file cannot change.** Not "does not usually", not "unless somebody
 * amends" — a commit is an immutable object, and `<sha>:<path>` names a blob
 * that is what it is forever. So the answer is remembered under the sha it was
 * asked about.
 *
 * ## Why staleness is impossible here, rather than merely unlikely
 *
 * A cache is only as good as the thing that invalidates it, and an invalidation
 * somebody has to remember to call is a bug waiting for the second seam. There
 * is no such call in here, and there is nowhere to put one:
 *
 *   - **the key is the whole question.** An entry is keyed by the pair
 *     `(commit sha, repo-relative path)` and the ASK is that same pair —
 *     {@link Asking.show} is handed the sha, so what git answers is a function
 *     of the key and of nothing else. There is no window between reading a name
 *     and reading what it points at, because the name IS what is asked about.
 *     `HEAD:<path>` would have that window: read HEAD, somebody commits, read
 *     the file, and what is filed under the old sha is the new sha's bytes.
 *   - **the working side is never in here.** What a file says on DISK is the
 *     store's own last-good parse, taken fresh per revision by the caller
 *     (`./pending.ts`'s `detail`). A keystroke, an edit made in vim, a `git
 *     checkout` that rewrites the working tree — none of them can be served a
 *     remembered answer, because none of them is a question this module
 *     answers.
 *   - **HEAD moving is not an invalidation, it is a different key.** A commit,
 *     an amend, a checkout, a pull, a rebase, a reset: every one of them ends
 *     with `rev-parse` answering a different sha, and a different sha is a
 *     generation this module has never seen. The entries under the old one are
 *     not wrong — they are still exactly what that commit holds — they are
 *     simply not what anybody is asking about any more, so they are dropped.
 *
 * ONE MORE RULE, and it is about freshness rather than staleness: only an
 * answer GIT GAVE is filed. A `show` that timed out or overran its buffer is a
 * statement about that attempt, not about the commit — the per-file loop this
 * replaces healed such an accident by re-reading on the next revision, and
 * filing it would have made one bad second last a whole generation. See
 * {@link taken}.
 *
 * The one thing still asked every round is WHICH commit, and that is deliberate:
 * one `rev-parse` per revision, whatever the dirty list holds, is what makes
 * everything else safe to remember. A keystroke with fifty dirty outlines costs
 * that one subprocess and no `show` at all; a file that has just BECOME dirty
 * costs one more. O(what changed this revision), never O(what is waiting).
 *
 * ## What it holds
 *
 * ONE GENERATION, replaced whole when the sha moves. Within it, an entry for
 * every path that has been asked about since HEAD last moved — which is bounded
 * by what has been dirty in that window, and which a commit or a checkout
 * empties. Entries are not pruned when a file goes clean: the horizon is the
 * generation, and a file reverted and re-edited under one HEAD is a file whose
 * committed copy has not moved either.
 *
 * ## What it is not
 *
 * It has no opinion about what the two sides MEAN. Which name a copy is filed
 * under in the comparison, whether a copy that will not parse is a fault worth
 * reporting, what happens to a file the working set no longer lists — all of
 * that is `./pending.ts`'s, where it was, and none of it moved down here. This
 * module reads bytes out of a named commit and parses them.
 */

import { type Node, parseOutline } from "@olai/format"
import type { Shown } from "../git/git.ts"
import { Effect, Result } from "effect"

/**
 * What one commit holds for one path, in the three shapes the comparison has to
 * tell apart.
 *
 * `Unparsed` is not folded into `Absent`, and the difference is a screen of
 * alarming rows: a committed copy that does not parse is a file nothing can be
 * said about, while one the commit genuinely does not have is a file that is
 * NEW — every node in it created, which is exactly right for an untracked
 * outline and exactly wrong for a broken one.
 *
 * A copy git COULD NOT ANSWER FOR is not a fourth shape: it reads as `Absent`,
 * exactly as the per-file loop this replaces read it, and is the one answer
 * this module refuses to REMEMBER. See {@link taken}.
 */
export type Copy =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Unparsed" }
  | { readonly _tag: "Nodes"; readonly nodes: ReadonlyArray<Node> }

const ABSENT: Copy = { _tag: "Absent" }
const UNPARSED: Copy = { _tag: "Unparsed" }

/** No dirty outlines, so nothing to ask and nothing to answer. Spelled once so
 *  the empty answer is one value rather than an allocation per revision. */
const NOTHING: ReadonlyMap<string, Copy> = new Map()

/**
 * The half of a repository this module asks — `@olai/git`'s {@link Repo}
 * satisfies it, and a test's counting wrapper does too.
 *
 * TWO VERBS, and the pairing is the invariant: the sha comes from `head` and
 * goes straight back into `show`, so nothing between them can name a commit
 * this module has not been told about.
 */
export interface Asking {
  /** Which commit HEAD names, `null` where it names none. */
  readonly head: Effect.Effect<string | null>
  /** One file as that commit has it — `@olai/git`'s three arms, because
   *  whether git ANSWERED is the difference between a copy this module may
   *  remember and one it may not ({@link taken}). */
  readonly show: (commit: string, path: string) => Effect.Effect<Shown>
}

/**
 * What the committed side of a survey is asked for.
 *
 * ONE VERB, taking every path at once rather than one at a time, because what
 * makes this cheap is the round: the sha is read once for the whole ask, and
 * the paths that are misses are fetched together under the bound below.
 */
export interface Committed {
  readonly at: (
    git: Asking,
    /** Repo-root-relative, which is what {@link Asking.show} takes. Duplicates
     *  are one ask; the answer is keyed by path, so a caller with two rows
     *  naming one file reads the same entry twice. */
    paths: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyMap<string, Copy>>
}

/** How many `show` subprocesses run at once. A `git pull` can make a hundred
 *  outlines dirty in one revision and a hundred simultaneous processes is its
 *  own problem; `show` does not take the index, so the bound is the only thing
 *  serialising them. The number the per-file loop always used. */
const AT_ONCE = 8

/**
 * The remembering one — what the server runs.
 *
 * The generation is a plain pair rather than a keyed map of every sha ever
 * seen: an entry filed under a commit nobody is on is memory held for a
 * question nobody will ask again, and holding one generation makes the bound on
 * this thing a sentence rather than an eviction policy.
 */
export const remembering = (): Committed => {
  /** The sha every entry below was read out of, `null` before the first ask. */
  let generation: string | null = null
  let copies = new Map<string, Copy>()

  return {
    at: (git, paths) =>
      Effect.gen(function*() {
        if (paths.length === 0) return NOTHING
        const commit = yield* git.head
        // NO COMMIT, NO COPIES. A branch with no commits yet holds nothing, so
        // every path is `Absent` and every node in every dirty outline reports
        // as created — which is precisely right for a directory whose first
        // commit has not been made, and precisely what the per-file `show` used
        // to answer for it. A git that could not be asked at all lands here too
        // and gets the same answer it always got: on that path `status` has
        // already failed, and a survey that could not be taken never reaches
        // this module.
        if (commit === null) return answer(paths, () => ABSENT)
        if (commit !== generation) {
          generation = commit
          copies = new Map()
        }
        // THIS generation's map, held by the fiber rather than read back off
        // the field: a survey that overlaps this one may replace the field
        // while the reads below are in flight, and an answer assembled out of
        // two generations would be a comparison against two different commits.
        // A generation change always makes a NEW map, so holding the object is
        // holding the generation.
        const mine = copies

        const wanted = new Set(paths)
        const missing = [...wanted].filter((path) => !mine.has(path))
        const read = yield* Effect.all(
          missing.map((path) =>
            Effect.map(git.show(commit, path), (shown) => [path, taken(path, shown)] as const)
          ),
          { concurrency: AT_ONCE },
        )
        // FILED ONLY IF GIT ANSWERED, and only if the generation is still the
        // one that was asked.
        //
        // THE FIRST HALF is {@link taken}'s ruling: a copy nobody could read is
        // not an answer about a commit at all, so there is nothing here to
        // remember. It is answered for THIS revision — as the loop this
        // replaces answered it — and asked again on the next.
        //
        // THE SECOND is concurrency: two surveys can overlap — the sweep and a
        // keystroke — and the second may have replaced the map while these
        // reads were in flight. The VALUES are still true (they were asked
        // about a named commit, not about HEAD); what would be wrong is filing
        // them under somebody else's generation.
        if (generation === commit) {
          for (const [path, one] of read) if (one.keep) mine.set(path, one.copy)
        }

        const found = new Map(read.map(([path, one]) => [path, one.copy] as const))
        return answer(paths, (path) => mine.get(path) ?? found.get(path) ?? ABSENT)
      }),
  }
}

/** Exactly the paths that were asked about, and nothing else — a caller reads
 *  its own list back rather than the generation's, so what this answers cannot
 *  depend on what some earlier revision happened to ask. */
const answer = (
  paths: ReadonlyArray<string>,
  of: (path: string) => Copy,
): ReadonlyMap<string, Copy> => {
  const map = new Map<string, Copy>()
  for (const path of paths) if (!map.has(path)) map.set(path, of(path))
  return map
}

/** One reading, and whether it is an answer ABOUT A COMMIT — which is the only
 *  kind this module may file. See {@link taken}. */
export interface Taken {
  readonly copy: Copy
  readonly keep: boolean
}

/**
 * What git said, read as an outline — and whether it is worth remembering.
 *
 * THREE ANSWERS AND TWO OF THEM KEEP, which is the whole of what a memory owes
 * a caller that used to re-read. `Text` and `Absent` are statements about A
 * COMMIT, and a commit does not change its mind: both are filed, and stay true
 * for as long as that sha is what anybody is asking about. `Unusable` is a
 * statement about THIS ATTEMPT — a bitten ten-second budget, a stream past the
 * buffer, a git that could not run — and the next attempt may well succeed, so
 * it is answered and DROPPED.
 *
 * That distinction is new with the memory and only matters because of it. The
 * per-file loop this replaces re-asked every revision, so a bitten budget cost
 * ONE bad revision and healed itself on the next; filed, the same accident
 * would report every node of that file as created until HEAD next moved.
 * Declining to file is what puts the old self-healing back.
 *
 * WHAT IT READS AS while it stands is `Absent` — the same value the old fold
 * produced for every non-zero exit, deliberately. It is the less informative of
 * the two answers available (`Unparsed` would put the file in the panel's
 * unreadable list instead, which is arguably the more honest sentence for "git
 * could not be asked") and it is the right one HERE, because the arms of the
 * differential have to be the same function of what git said: the reference
 * implementation folds every refusal to the same `Absent`, including the
 * `invalid object name 'HEAD'` a repository with no commits yet answers with,
 * and a memory that reported a different value would be a comparison of two
 * things rather than of one thing remembered and not.
 *
 * The NAME is only what a parse failure would be reported under, and nothing
 * here reports one: a `Node` carries no file — it is `Located` that does, and
 * this keeps the records rather than their locations — so what comes back is
 * the same array whatever this file is called. That is what lets the entry be
 * keyed by the path git was asked for even where the comparison files it under
 * another name (`./pending.ts`'s `Was`, which is the rename case).
 */
export const taken = (path: string, shown: Shown): Taken => {
  if (shown._tag === "Absent") return { copy: ABSENT, keep: true }
  if (shown._tag === "Unusable") return { copy: ABSENT, keep: false }
  const parsed = parseOutline(path, shown.text)
  return {
    copy: Result.isFailure(parsed)
      ? UNPARSED
      : { _tag: "Nodes", nodes: parsed.success.nodes.map((located) => located.node) },
    keep: true,
  }
}
