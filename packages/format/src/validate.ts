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
import { type Document, resolveRelative } from "./documents.ts"
import {
  chainOf,
  compareErrors,
  isGuessWhileUnreadable,
  type OutlineError,
} from "./errors.ts"
import { fileKind } from "./kinds.ts"
import { isMirror, type Located, type Site, targetsOf } from "./node.ts"
import { didYouMean } from "./suggest.ts"
import type { OutlineSet } from "./set.ts"

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
 * WHAT IT HIDES is where this earns its keep next. Every reader above — the
 * planner, the query walks, the keystroke resolver, the per-file projection the
 * wire is cut from — now names this pair and nothing else, so HOW the view came
 * to exist is behind it: rebuilt from scratch today, patched from the previous
 * revision when the patcher lands (`docs/brainstorming/model-indices.md`, slice
 * 3). That is a change of one function inside this file, with no consumer of
 * this type able to tell.
 */
export interface Reading {
  readonly set: OutlineSet
  readonly derived: Derived
}

export const validate = (
  set: OutlineSet,
): Result.Result<Reading, ReadonlyArray<OutlineError>> => {
  const errors: Array<OutlineError> = []
  // One set of indexes, built once and shared by every rule below, so no two
  // of them can disagree about which record an id names or what hangs under it
  // — and so the browser derives the tree from the same code. It LEAVES with
  // the verdict ({@link Reading}) rather than being dropped here: the caller
  // that publishes what this approves has no second corpus to walk.
  const derived = derive(set.nodes)

  reportDuplicateIds(set.nodes, derived, errors)
  checkParents(set.nodes, derived, errors)
  checkTargets(set.nodes, derived, errors)
  checkAfterAcyclic(set.nodes, derived, errors)
  checkMirrorContainment(set.nodes, derived, errors)
  checkDocs(set.nodes, set.documents, errors)

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

const checkTargets = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of all) {
    // `targetsOf` is the format's own ({@link ./node.ts}), because the ops
    // layer asks the same question backwards before it retires a record —
    // "does anything still name this?" — and a second list of edge fields is a
    // relation one of them would stop seeing.
    for (const [field, id] of targetsOf(located.node)) {
      if (derived.byId.has(id)) continue
      errors.push({
        code: "unknown-target",
        ...siteOf(located),
        message: `\`${field}\` names \`${id}\`, which no node declares${suggest(id, derived)}`,
      })
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
 *  markdown pipeline; neither is a sealed frame). So the kind is asked here,
 *  where the rule about `doc` lives, and the message below stays true. */
const checkDocs = (
  all: ReadonlyArray<Located>,
  documents: ReadonlyArray<Document>,
  errors: Array<OutlineError>,
): void => {
  const known = new Set(
    documents
      .filter((document) => fileKind(document.file) === "document")
      .map((document) => document.file),
  )
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
    if (step.file < best.file || (step.file === best.file && step.line < best.line)) {
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
