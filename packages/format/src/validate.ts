/**
 * Phase two of the codec: the one whole-set validator.
 *
 * Format rules are checked in exactly one place. `parseOutline` owns the rules
 * a single line answers by itself; everything below needs to know what else
 * exists, and nothing outside these two functions — not the reader, not the
 * store, not the web layer — is allowed to reject an outline.
 *
 * Every rule runs, and every error is collected. Stopping at the first would
 * turn "fix this file" into a loop of load-fix-load, which is the workflow the
 * format exists to remove.
 *
 * A set may arrive with files that did not parse (`set.broken`), and what this
 * function decides about them is the ERROR SCOPE (resolved 2026-08-09):
 *
 *   - if the files that DID parse are clean, the set is accepted with those
 *     failures embedded in it. The broken outline renders its own errors, in
 *     its own place, and every other outline stays live — a typo in one file is
 *     not a reason to blank the other nine;
 *   - if anything else is wrong, or a rule had to withhold a finding because
 *     the missing nodes made it a guess, the set is rejected and the report
 *     carries the parse errors alongside whatever else was found. The store
 *     then keeps its last good snapshot and the browser shows a banner.
 */

import { Result } from "effect"

import { derive, type Derived, drawnFrom } from "./derive.ts"
import { type Outline } from "./document.ts"
import { resolveRelative } from "./documents.ts"
import {
  chainOf,
  compareErrors,
  isGuessWhileUnreadable,
  type OutlineError,
} from "./errors.ts"
import { isMirror, type Located, type Site } from "./node.ts"
import { patch, type SetDelta } from "./patch.ts"
import { byPath } from "./paths.ts"
import { didYouMean } from "./suggest.ts"
import { markdownIn, type OutlineSet, outlinesIn } from "./set.ts"

/**
 * A set, and the view it was JUDGED against.
 *
 * The two travel together for the reason {@link Derived} carries its own nodes
 * ({@link ./derive.ts}): a caller holding one revision's set against another's
 * indexes draws a plausible tree rather than failing, and a live store has two
 * revisions in flight often enough to make that a real possibility rather than
 * a theoretical one.
 *
 * It is what {@link validate} ANSWERS WITH, which is the whole of why it
 * exists: the derivation every rule below was checked against used to be built,
 * read six times and dropped at the door, so the next reader — the store
 * publishing the snapshot, the planner judging the next keystroke — walked the
 * corpus again for a value that had just been in hand. The pair is published,
 * and a reader above reads the view the validator built rather than building a
 * second one that is free to disagree with it.
 *
 * WHAT IT HIDES is where it has now earned its keep. Every reader above — the
 * planner, the query walks, the keystroke resolver, the per-file projection the
 * wire is cut from — names this pair and nothing else, so HOW the view came to
 * exist is behind it: PATCHED from the reading this one follows when a caller
 * offers one and the records line up ({@link Previous}, {@link viewOf}), and
 * built from scratch when either is missing. That landed as slice 3 of
 * `docs/brainstorming/model-indices.md` and it was a change of one function
 * inside this file, with no consumer of this type able to tell — which was the
 * claim this paragraph made while the patcher was still ahead of it.
 */
export interface Reading {
  readonly set: OutlineSet
  readonly derived: Derived
}

/**
 * The reading this one FOLLOWS, and what has moved since — what lets a
 * validation PATCH its view instead of building one ({@link ./patch.ts}).
 *
 * Offered, never required: {@link validate} without it is exactly the function
 * it always was. What it buys is the keystroke case, where the difference
 * between the two views is one record and the difference in cost is the whole
 * corpus.
 *
 * The delta must be about the SET being validated — the same files, the same
 * records — because the answer is a view of that set. Its one caller is the
 * store's codec, which is handed both by a package whose whole job is knowing
 * which files moved ({@link ../../store/src/codec.ts}'s `Since`).
 */
export interface Previous {
  readonly read: Reading
  readonly delta: SetDelta
}

export const validate = (
  set: OutlineSet,
  previous?: Previous,
): Result.Result<Reading, ReadonlyArray<OutlineError>> => {
  const errors: Array<OutlineError> = []
  // One set of indexes, built once and shared by every rule below, so no two
  // of them can disagree about which record an id names or what hangs under it
  // — and so the browser derives the tree from the same code. It LEAVES with
  // the verdict ({@link Reading}) rather than being dropped here: the caller
  // that publishes what this approves has no second corpus to walk.
  const derived = viewOf(set, previous)

  // THE RECORDS ARE THE VIEW'S, which is the same records the set holds one
  // level down. Asking the derivation is what keeps this from being a second
  // flattening beside the one every rule below is run against — and the
  // identity the duplicate-id rule turns on is exactly that these are the set's
  // records rather than copies of them.
  //
  // BOUND ONCE, because a patched view builds this reading when somebody asks
  // ({@link Derived.nodes}) and five rules asking is one question, not five.
  const all = derived.nodes
  reportDuplicateIds(all, derived, errors)
  checkParents(all, derived, errors)
  checkTargets(derived, errors)
  checkAfterAcyclic(all, derived, errors)
  checkMirrorContainment(all, derived, errors)
  checkDocs(all, set, errors)

  const unreadable = set.broken.flatMap((file) => [...file.errors])
  // A file that did not parse contributes no ids, so a reference resolving to
  // nothing may be pointing straight into it. That is a GUESS, and the format's
  // staging rule is that guesses are not reported ({@link ./errors.ts}'s
  // catalogue says which codes are guessable): "`kitchen` is not a known id" is
  // not a finding when the line declaring `kitchen` is the one that failed to
  // parse.
  const found = set.broken.length === 0
    ? errors
    : errors.filter((error) => !isGuessWhileUnreadable(error.code))

  // Any error at all refuses the set, INCLUDING one that was withheld: the
  // withheld ones are unresolved references, and a snapshot whose nodes point
  // at ids nobody can resolve is not a set anything could draw. So the report
  // becomes the parse errors, which is the cause, and the last good snapshot
  // stays on screen underneath it.
  return errors.length > 0
    ? Result.fail([...unreadable, ...found].sort(compareErrors))
    : Result.succeed({ set, derived })
}

/**
 * The view every rule below is run over: patched from the last one where that
 * is possible, built from scratch where it is not.
 *
 * The two are the same value — that is the patcher's contract and its property
 * test — so this is a statement about COST and about nothing else. Which is why
 * it is one branch inside this file rather than a decision any caller makes:
 * `Reading` was written to hide exactly this.
 *
 * THE RECORDS THEMSELVES ARE COMPARED, and identity is the right question
 * rather than a strict one. The rules below read the view against the set: a
 * duplicate id is "the record `byId` kept is not THIS record"
 * ({@link reportDuplicateIds}), and that is an identity test. So a view built
 * from a delta that missed a file — or from records equal to the set's rather
 * than the set's own — is not merely stale, it makes every record look like a
 * duplicate of itself. Nothing about that could be caught by counting, and the
 * two lists are already in hand: one pass of pointer comparisons over a list
 * this function was going to walk six times anyway.
 *
 * It is a DISAGREEMENT check and not a proof of the delta. What stands behind
 * that is the store's own claim that these paths are every path that moved,
 * which is the same claim the wire already spends when it publishes per file;
 * this is what makes a broken claim cost a rebuild rather than a wrong answer.
 */
/**
 * The pair, without the rules — a set and the view of it, patched from a
 * previous reading where that is exact and rebuilt where it is not.
 *
 * {@link validate}'s first line and its last, with the six whole-set rules
 * taken out from between them, and it exists for one caller: `@olai/ops`' batch
 * fold, which plans op two against the set op one would leave and then throws
 * that set away. That reading is SPECULATIVE by construction — nothing draws
 * it, nothing is published at it, and the only set that reaches disk is the one
 * the write gate validates, exactly once, as it validates every write. Running
 * the rules over each intermediate would be N whole-corpus checks to reject
 * something the final check either catches or was never true of.
 *
 * IT IS THIS FUNCTION AND NOT `patch`, and that is the whole of why it is here.
 * IT IS THIS FUNCTION AND NOT `patch` for a caller that holds a SET. The
 * patcher is exported — the browser folds its delta frames with it
 * (`model-indices` slice 4) — and that caller is right to reach it: a tab holds
 * a view and the frames that moved it, and has nothing to hold the result
 * against. This one does. It assembles a real {@link OutlineSet} per op and
 * plans the next one against it, which is precisely what {@link viewOf}'s
 * disagreement check is for — the identity test that turns a delta which missed
 * a file into a rebuild rather than into a view where every record looks like a
 * duplicate of itself. So the door a set-holding caller comes through is the
 * patcher AND that guard, together, and nobody has to remember the second half.
 */
export const reading = (set: OutlineSet, previous?: Previous): Reading => ({
  set,
  derived: viewOf(set, previous),
})

/**
 * THE SET FLATTENED, for the rebuild that is handed a list — once per
 * validation and only when there IS a rebuild, which is the cost `./set.ts`
 * names for serving documents rather than a `nodes` collection beside them.
 *
 * It used to run on every validation, patched or not, and the flat list it made
 * was then compared with the one the patch had made: two arrays of every record
 * in the directory, for a question about identity. {@link isSet} asks that
 * question of the grouping instead, so a patched validation reaches this
 * function not at all and spends its one flattening where the rules actually
 * read the records ({@link Derived.nodes}, built when asked).
 *
 * It is here rather than exported because of what would happen if it were:
 * a `nodesOf(set)` on the set's own surface is a node-only list to import, and
 * the whole of PR 2 is that there is none. The derivation is what a reader
 * that wants every record asks — and it carries its own indexes, so what it
 * hands back cannot be paired with another revision's.
 */
const recordsIn = (set: OutlineSet): ReadonlyArray<Located> =>
  outlinesIn(set).flatMap((outline) => outline.nodes)

const viewOf = (set: OutlineSet, previous: Previous | undefined): Derived => {
  // THE PATCHED VIEW ITSELF, once it is known to hold the same records in the
  // same places as the set does. It used to hand back `{...view, nodes}` — the
  // SET's own array swapped in, so a rebuilt reading and a patched one shared
  // one list with the set. Neither array is the set's any more, so that spread
  // would rebuild the view to hold an array equal to the one it already had,
  // and throw away the one identity worth keeping: the patched list is stable
  // across revisions that touched nothing.
  if (previous !== undefined) {
    const view = patch(previous.read.derived, previous.delta)
    if (isSet(view, set)) return view
  }
  return derive(recordsIn(set))
}

/**
 * Whether a view is about THIS set — the check that decides whether a patch is
 * taken or thrown away for a rebuild.
 *
 * ASKED FILE BY FILE, of the view's own grouping, and that is the whole of what
 * changed here: it used to flatten the set and compare the two flat lists, so a
 * write that patched paid for the corpus in one array to check a view that had
 * just paid for it in another — two allocations of every record in the
 * directory, for a question about identity that neither of them added anything
 * to. {@link Derived.byFile} is what a patch already holds and what the set
 * already is, and comparing those spends no allocation at all.
 *
 * It is STRICTLY the stronger question, not the cheaper half of the old one:
 * the flat lists agreeing said the records were the same objects in the same
 * order, and this says that AND that the view files them under the paths the
 * set spells, in the order an assembled set is in. A file holding nothing is
 * absent from `byFile` ({@link Derived.byFile} says so), so the set's empty
 * outlines are stepped over rather than matched — which is itself a rule the
 * flat comparison could not see either way.
 */
const isSet = (view: Derived, set: OutlineSet): boolean => {
  const outlines = outlinesIn(set)
  let which = 0
  const held = (): Outline | undefined => {
    while (outlines[which]?.nodes.length === 0) which++
    return outlines[which]
  }
  for (const [file, records] of view.byFile) {
    const outline = held()
    which++
    if (outline === undefined || outline.path !== file) return false
    if (outline.nodes.length !== records.length) return false
    for (let at = 0; at < records.length; at++) {
      if (records[at] !== outline.nodes[at]) return false
    }
  }
  return held() === undefined
}

// ── ids ────────────────────────────────────────────────────────────────

/** A duplicate is reported once, on the second record, pointing back at the
 *  first: the first one is not the mistake. `derive` keeps that first claim,
 *  so the reference rules below still resolve — reporting a hundred dangling
 *  edges because an id was declared twice would bury the one error worth
 *  reading. */
const reportDuplicateIds = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of all) {
    const first = derived.byId.get(located.node.id)
    if (first === undefined || first === located) continue
    errors.push({
      code: "duplicate-id",
      ...siteOf(located),
      message: `\`${located.node.id}\` is already the id of another node; ids are unique across every file in the served directory`,
      related: [{ ...siteOf(first), note: "first declared here" }],
    })
  }
}

// ── references ─────────────────────────────────────────────────────────

const checkParents = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of all) {
    const { file, node } = located
    if (node.parent === undefined) continue

    const parent = derived.byId.get(node.parent)
    if (parent === undefined) {
      errors.push({
        code: "unknown-parent",
        ...siteOf(located),
        message: `\`parent\` is \`${node.parent}\`, which no node declares${suggest(node.parent, derived)}`,
      })
      continue
    }
    if (parent.file !== file) {
      errors.push({
        code: "foreign-parent",
        ...siteOf(located),
        message: `\`parent\` is \`${node.parent}\`, which lives in another file; every \`.olai\` is an independent tree, so cross-file placement is a \`mirror\``,
        related: [{ ...siteOf(parent), note: "the parent lives here" }],
      })
      continue
    }
    if (isMirror(parent.node)) {
      errors.push({
        code: "parent-not-a-node",
        ...siteOf(located),
        message: `\`parent\` is \`${node.parent}\`, which is a mirror; children hang off the node a mirror points at, never off the mirror`,
        related: [{ ...siteOf(parent), note: "the mirror is here" }],
      })
    }
  }

  reportCycles(
    findCycles(all, derived, (node) => (node.parent === undefined ? [] : [node.parent])),
    "parent-cycle",
    "`parent` pointers close a loop, so this node is its own ancestor",
    errors,
  )
}

/**
 * Asked ONCE PER NAMED ID, of the index that is `targetsOf` read backwards
 * ({@link Derived.namedBy}), rather than once per record of the corpus.
 *
 * `targetsOf` is still the format's own list of what a record points at — this
 * rule reads the index derive built by asking it, so there is still exactly one
 * list of edge fields, and the day a fourth relation arrives this rule sees it
 * without being told. What changes is the direction: the question "does
 * everything this names exist?" is the same question as "is this named id
 * declared?", and the second one has as many answers as there are ids named,
 * not as there are records.
 *
 * ERROR ORDER, which is the whole reason this waited for its own change
 * (`check-targets-index`, deferred from #205). The report is SORTED before
 * anyone sees it — by file, then line, then code ({@link ./errors.ts}'s
 * `compareErrors`) — so the only findings this can reorder are two at the SAME
 * site with the same code: one record naming two ids that nothing declares.
 * Those used to come out in the order the record writes its fields; they now
 * come out in the order the CORPUS first names those ids, which for a record
 * naming ids nobody else names is the same order, and differs only when an
 * earlier record named one of them first. Both are arbitrary and both are
 * deterministic; what is preserved is what a reader spends — one finding per
 * field per record, at that record's own site, naming the field it was written
 * with.
 *
 * ONE thing is deliberately not preserved: a record naming the same unknown id
 * TWICE IN ONE FIELD (`"after":["x","x"]`, which only a hand-edited file can
 * hold — no op writes a repeat) used to be two identical findings and is now
 * one. The index folds a record's fields, and two copies of one sentence at one
 * site tell a reader nothing the first did not.
 */
const checkTargets = (
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const [id, namings] of derived.namedBy) {
    if (derived.byId.has(id)) continue
    // Once per unknown id rather than once per record naming it: the sentence
    // is the same for every one of them, and the suggestion behind it walks
    // every declared id in the set.
    const said = suggest(id, derived)
    for (const naming of namings) {
      for (const field of naming.fields) {
        errors.push({
          code: "unknown-target",
          ...siteOf(naming.at),
          message: `\`${field}\` names \`${id}\`, which no node declares${said}`,
        })
      }
    }
  }
}

/** The ordering graph is `derive`'s (`blocks` normalised into `after`, in the
 *  one place that happens), so this rule and the blockedness the view draws
 *  are reading the same edges rather than two normalisations that could
 *  disagree. That graph is in terms of NODES — an edge naming a mirror is an
 *  edge to the node standing there — which is what makes a deadlock closing
 *  through a placement one loop this walk can find, rather than two dead ends
 *  the view drew as blocked and nothing ever refused.
 *
 *  This is where the two part company: blockedness exempts what has been put
 *  away and what nobody marked, because it is about what is on a plate. A
 *  cycle exempts NOTHING — it is a claim about the file, and an `after` loop is
 *  one whether or not it is archived, and whether or not anyone marked it. */
const checkAfterAcyclic = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  reportCycles(
    findCycles(all, derived, (node) => derived.after.get(node.id) ?? []),
    "after-cycle",
    "`after` (with `blocks` normalised into it) closes a loop, so nothing in it can start first",
    errors,
  )
}

/** A mirror shows a subtree somewhere else. Placing one inside the subtree it
 *  shows means expanding it never terminates, so the graph a renderer actually
 *  walks has to be acyclic.
 *
 *  That graph is {@link drawnFrom}, and it runs DOWNWARD. Note this is the
 *  opposite direction from the parent check above, which walks child-to-parent
 *  — either direction finds a pure parent loop, but only the downward one
 *  finds the mirror case, because a mirror's edge to its target is downward by
 *  nature. Mixing the two directions in one walk finds neither reliably. The
 *  ops layer walks the same graph to refuse the placement BEFORE the write,
 *  which is why it is a derivation rather than a lambda here. */
const checkMirrorContainment = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  const cycles = findCycles(all, derived, (node) => drawnFrom(derived, node))

  reportCycles(
    // A cycle with no mirror in it is a parent cycle, already reported by
    // `checkParents` — saying it twice in two vocabularies helps nobody.
    cycles.filter((cycle) => cycle.some((located) => isMirror(located.node))),
    "mirror-cycle",
    "this mirror is placed inside the subtree it shows, so expanding it never ends",
    errors,
  )
}

// ── documents ──────────────────────────────────────────────────────────

/** `doc` is relative to the outline that names it — that is what "attached"
 *  means — so it is resolved against the outline's own directory ({@link
 *  ./documents.ts}, the one place that arithmetic lives) and matched against
 *  the `.md` files actually found.
 *
 *  DOCUMENTS, not every bodied file. The set's `documents` list carries each
 *  `.html` too since they are read the same way, and a membership test alone
 *  would therefore have quietly widened what `doc` may point at — to a file the
 *  surfaces that draw an attachment cannot draw (a reference under a row is one
 *  line of markdown, and a zoomed node draws the whole document through the
 *  markdown pipeline; neither is a sealed frame). So the kind is asked —
 *  through `markdownIn`, the one narrowing that answers it for the validator,
 *  the planner and both document reads alike — and the message below stays
 *  true. */
const checkDocs = (
  all: ReadonlyArray<Located>,
  set: OutlineSet,
  errors: Array<OutlineError>,
): void => {
  const known = new Set<string>(markdownIn(set).map((document) => document.path))
  for (const located of all) {
    const { file, node } = located
    if (isMirror(node) || node.doc === undefined) continue
    const resolved = resolveRelative(file, node.doc)
    if (known.has(resolved)) continue
    errors.push({
      code: "missing-doc",
      ...siteOf(located),
      message: `\`doc\` is \`${node.doc}\`, which resolves to \`${resolved}\` — no such \`.md\` file is served`,
    })
  }
}

// ── cycles ─────────────────────────────────────────────────────────────

/** Every simple cycle reachable through `edges`, each returned once. Unknown
 *  targets are skipped: a dangling reference is already its own error, and a
 *  graph walk that invented a node for it would report a second. */
const findCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  edges: (node: Located["node"]) => ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<Located>> => {
  const cycles: Array<ReadonlyArray<Located>> = []
  // One memo, not two: a node is only marked seen after its walk has left the
  // path, so `seen` already implies "not on the path" and a second settled set
  // could not disagree with it.
  const seen = new Set<string>()

  const walk = (located: Located, path: Array<Located>): void => {
    const id = located.node.id
    const at = path.findIndex((step) => step.node.id === id)
    if (at !== -1) {
      cycles.push(path.slice(at))
      return
    }
    if (seen.has(id)) return
    seen.add(id)

    path.push(located)
    for (const target of edges(located.node)) {
      const next = derived.byId.get(target)
      if (next !== undefined) walk(next, path)
    }
    path.pop()
  }

  for (const located of all) walk(located, [])
  return cycles
}

/** One error per cycle, anchored at its earliest record so the report is
 *  stable, with the rest of the loop as related sites in walk order. */
const reportCycles = (
  cycles: ReadonlyArray<ReadonlyArray<Located>>,
  code: OutlineError["code"],
  message: string,
  errors: Array<OutlineError>,
): void => {
  for (const cycle of cycles) {
    const ordered = rotateToEarliest(cycle)
    const [anchor, ...rest] = ordered
    if (anchor === undefined) continue
    errors.push({
      code,
      ...siteOf(anchor),
      // Closed by repeating the anchor, which is what makes it read as a loop
      // rather than as a list — the ops layer names one it is about to close
      // the same way ({@link ./errors.ts}'s `chainOf`).
      message: `${message}: ${
        chainOf([...ordered.map((step) => step.node.id), anchor.node.id])
      }`,
      related: rest.map((step) => ({ ...siteOf(step), note: "also in the loop" })),
    })
  }
}

const rotateToEarliest = (
  cycle: ReadonlyArray<Located>,
): ReadonlyArray<Located> => {
  let at = 0
  cycle.forEach((step, index) => {
    const best = cycle[at]
    if (best === undefined) return
    // CORPUS ORDER, which is the set's own path order and not a string compare
    // ({@link ./paths.ts}): the earliest step of a loop is the one a reader
    // meets first walking the directory.
    if (byPath(step.file, best.file) < 0 || (step.file === best.file && step.line < best.line)) {
      at = index
    }
  })
  return [...cycle.slice(at), ...cycle.slice(0, at)]
}

// ── shared ─────────────────────────────────────────────────────────────

/** The place a located record is at, without the record. Annotated with
 *  {@link Site} rather than with the pair written out again: this is the
 *  function every finding in this file gets its `file:line` from, so an
 *  inline `{file: string; line: number}` here would be the one spelling that
 *  goes on compiling after the others have been made to agree. */
const siteOf = ({ file, line }: Located): Site => ({ file, line })

/** "did you mean", over the ids the set declares. The rule itself is
 *  {@link ./suggest.ts}'s, because the ops layer refuses the same unknown
 *  target one moment earlier — at the plan, before the write — and two copies
 *  of the budget would be two answers to one question. */
const suggest = (id: string, derived: Derived): string =>
  didYouMean(id, derived.byId.keys())
