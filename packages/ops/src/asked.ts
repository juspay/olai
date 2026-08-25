/**
 * WHAT A PLANNER ASKS OF THE SET — the questions, asked once, as a value.
 *
 * {@link ./plan.ts} decides what an op MEANS. To do that it has to know three
 * things about the directory the op lands in: which outlines it serves, which
 * of its files the set holds no content for, and what sits at a path. Those are
 * questions about the SET and not about the op, and until now every planner
 * asked them for itself — eight call sites, each a `brokenIn` that built a map
 * of the broken files to answer one key, or a `documentAt` over the served
 * list, in the middle of a function whose subject was a mark or a move
 * (roadmap `perf-batch-assemble`, which is where the reason this is a module
 * rather than a habit is argued: the file complected DECIDING, ASKING and
 * SEQUENCING, and the size was the shadow rather than the smell).
 *
 * So the asking is a thing of its own now, and it is a plain value: a planner
 * READS it, the batch's sequencer builds it, and neither has to know how the
 * other spends it. The three moves that follow are what the node asked for —
 * this is the first.
 *
 * **ONE ASKING PER BATCH, and here is exactly what that means.** A batch plans
 * each op against the set the op before it left ({@link ./following.ts}), so a
 * context that were fixed for the whole run would judge op two against op
 * one's world. What is fixed is the WORK: every reading here is held with the
 * set it describes (`@olai/format`'s `outlinePaths`, `outlineNames`,
 * `brokenBy` — built when asked, once, and kept against that set), and a batch
 * moves the set only by the files it writes. So a run of marks, titles and
 * dates asks each question once for the whole batch however long it is; a run
 * that MINTS a file re-asks after that op, because membership really did move
 * and a carried answer would be a lie (#382's lesson). Nothing here caches
 * across revisions, and nothing can go stale: a set is a value, and an answer
 * held against one describes it for as long as anybody holds it.
 *
 * **WHY IT IS NOT A MAP OF PATHS.** The node asked for path lookup to become "a
 * map hit". It is a BINARY SEARCH over the set's own path order, which is what
 * `perf-published-maps` already made it (`@olai/format`'s `documentAt`), and
 * that is where it stays: a map of every served path costs a walk of the
 * directory to BUILD, and a single write asks this question once or twice — so
 * the map would add a walk to every keystroke to save ten comparisons on a
 * thousand-file vault. The linear `.find` the node's finding named had already
 * been retired by that node; what was really being paid twice was the broken
 * map, and that is held.
 */

import {
  brokenBy,
  type Document,
  documentAt,
  type Markdown,
  markdownAt,
  type OutlineError,
  type OutlineSet,
  outlineNames,
  outlinePaths,
} from "@olai/format"

/**
 * The facts, over one set.
 *
 * GETTERS rather than fields, and that is the whole of what keeps this cheap
 * enough to build unconditionally: the answers are held by the floor with the
 * set they are about, so reaching one is a lookup after the first ask and
 * nothing at all before it. A single `set_done` builds one of these, asks
 * `broken` once, and never touches the other two — which is what a context
 * assembled up front could not do without putting a walk of the directory in
 * front of every keystroke.
 */
export interface Asked {
  /** The set every answer here is about. Carried so that a refusal composed
   *  from this value does not need the set handed in beside it. */
  readonly set: OutlineSet
  /** Every outline the directory serves, in path order — what a refusal lists,
   *  and what the inbox and shelf conventions are read off. */
  readonly outlines: ReadonlyArray<string>
  /** The same list as a MEMBERSHIP test, for the callers that ask `has`. */
  readonly serves: ReadonlySet<string>
  /** file → why the set holds no content for it. A file in here is one the set
   *  keeps a PLACE for and nothing else, which is why writing it would erase
   *  what is really on disk. */
  readonly broken: ReadonlyMap<string, ReadonlyArray<OutlineError>>
  /** What is at a path — an outline, a document, a file the set keeps the name
   *  of — or `undefined` for a path this directory does not serve. */
  readonly at: (path: string) => Document | undefined
  /**
   * The same lookup NARROWED to a markdown document, which is a different
   * question and has its own answer on the floor (`@olai/format`'s
   * `markdownAt`): a `.html` is a file this directory serves and holds no text
   * of, so a verb that writes a document may not be handed one.
   *
   * A second door rather than a `kind` test at the caller, for the reason the
   * floor gives for having the function at all: which arm counts is a rule of
   * the format's, and a planner spelling it out is a second place for it to be
   * spelled differently.
   */
  readonly markdown: (path: string) => Markdown | undefined
}

export const askedOf = (set: OutlineSet): Asked => ({
  set,
  get outlines() {
    return outlinePaths(set)
  },
  get serves() {
    return outlineNames(set)
  },
  get broken() {
    return brokenBy(set)
  },
  at: (path) => documentAt(set, path),
  markdown: (path) => markdownAt(set, path),
})

/**
 * The same context over the set a batch has WRITTEN INTO — the carrying that
 * makes "one asking per batch" true rather than aspirational.
 *
 * A batch moves the set once per op ({@link ./following.ts}), and every set is
 * a value with readings of its own — so a context rebuilt per op would ask the
 * directory its three questions per op, which is the cost the node filed. What
 * a write actually moves is narrower than that, and this is the rule spelled
 * out: a file whose CONTENT changed moves nothing about which files there are
 * or which of them are broken, so those two answers are the base's, still
 * (`base` is the batch's own first asking, never a chain — the sequencer carries
 * the accumulated writes and hands them here, so a hundredth op looks through
 * one layer and not through a hundred).
 *
 * IT DECLINES when membership moved, which is the other half of the same rule
 * and the half a carried structure gets wrong (#382's lesson): a file this
 * batch MINTED is a file the directory did not serve, and a file it MENDED is
 * one that has left `broken`. Either way the base's answers are about a
 * directory that no longer exists, so the caller is handed a fresh asking and
 * carries on from there. Both are answered from the base by a lookup — a
 * binary search and a map hit — so declining costs what deciding costs.
 */
export const carried = (
  /** The batch's own first asking — the one every op looks through. */
  base: Asked,
  /** The set the next op is judged against. */
  set: OutlineSet,
  /** Everything the batch has written SO FAR, by path: the layer, accumulated
   *  by the sequencer rather than chained here. */
  written: ReadonlyMap<string, Document>,
): Asked | undefined => {
  for (const path of written.keys()) {
    if (base.at(path) === undefined || base.broken.has(path)) return undefined
  }
  return {
    set,
    get outlines() {
      return base.outlines
    },
    get serves() {
      return base.serves
    },
    get broken() {
      return base.broken
    },
    at: (path) => written.get(path) ?? base.at(path),
    // THE LAYER FIRST here too, and narrowed after it: a document this batch
    // has written is the document the next op writes over.
    markdown: (path) => {
      const found = written.get(path)
      if (found === undefined) return base.markdown(path)
      return found.kind === "document" ? found : undefined
    },
  }
}
