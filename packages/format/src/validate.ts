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

import { distance } from "fastest-levenshtein"
import { Result } from "effect"

import { countedChildren, derive, type Derived, storedMarker } from "./derive.ts"
import { compareErrors, type OutlineError } from "./errors.ts"
import { EDGE_FIELDS, isMirror, type Located } from "./node.ts"
import type { OutlineSet } from "./set.ts"

export const validate = (
  set: OutlineSet,
): Result.Result<OutlineSet, ReadonlyArray<OutlineError>> => {
  const errors: Array<OutlineError> = []
  // One set of indexes, built once and shared by every rule below, so no two
  // of them can disagree about which record an id names or what a node's
  // status is — and so the browser derives the tree from the same code.
  const derived = derive(set.nodes)

  reportDuplicateIds(set.nodes, derived, errors)
  checkParents(set.nodes, derived, errors)
  checkTargets(set.nodes, derived, errors)
  checkAfterAcyclic(set.nodes, derived, errors)
  checkMirrorContainment(set.nodes, derived, errors)
  checkDocs(set.nodes, set.documents, errors)
  checkDerivedState(set.nodes, derived, errors)

  const unreadable = set.broken.flatMap((file) => [...file.errors])
  // A file that did not parse contributes no ids, so a reference resolving to
  // nothing may be pointing straight into it. That is a GUESS, and the format's
  // staging rule is that guesses are not reported: "`kitchen` is not a known
  // id" is not a finding when the line declaring `kitchen` is the one that
  // failed to parse. Withholding one is also what makes the whole set
  // unpublishable — the nodes are there and their targets are not — so the
  // report becomes the parse errors, which is the cause, and the last good
  // snapshot stays on screen.
  const withheld = set.broken.length > 0 &&
    errors.some((error) => RESOLVES_ACROSS_FILES.has(error.code))
  const found = withheld
    ? errors.filter((error) => !RESOLVES_ACROSS_FILES.has(error.code))
    : errors

  return found.length > 0 || withheld
    ? Result.fail([...unreadable, ...found].sort(compareErrors))
    : Result.succeed(set)
}

/** The codes a missing file can INVENT, rather than merely hide.
 *
 *  `mirror`, `after`, `blocks` and `see` name a bare id and may cross files, so
 *  an unparsed file makes them dangle. Nothing else can be conjured this way:
 *  `parent` is same-file by rule, so a parent that does not resolve is an error
 *  whichever file the id was going to be in (unknown or foreign, both refused);
 *  a duplicate, a cycle and a stored marker need the records that would be
 *  missing, so a missing file can only ever hide one. */
const RESOLVES_ACROSS_FILES: ReadonlySet<OutlineError["code"]> = new Set([
  "unknown-target",
])

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
        message: `\`parent\` is \`${node.parent}\`, which lives in another file; every \`.jsonl\` is an independent tree, so cross-file placement is a \`mirror\``,
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
    for (const [field, id] of targetsOf(located)) {
      if (derived.byId.has(id)) continue
      errors.push({
        code: "unknown-target",
        ...siteOf(located),
        message: `\`${field}\` names \`${id}\`, which no node declares${suggest(id, derived)}`,
      })
    }
  }
}

/** Every id this record points at, and the field it pointed with — reported in
 *  declaration order so two loads read the same. */
const targetsOf = (
  { node }: Located,
): ReadonlyArray<readonly [field: string, id: string]> => {
  if (isMirror(node)) return [["mirror", node.mirror]]
  return EDGE_FIELDS.flatMap((field) =>
    (node[field] ?? []).map((id) => [field, id] as const)
  )
}

/** `blocks` is sugar — `a blocks b` means `b after a` — and this is the only
 *  place it is normalised, so the acyclicity rule sees one graph rather than
 *  two that could disagree. */
const checkAfterAcyclic = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  const after = new Map<string, Array<string>>()
  const edge = (from: string, to: string): void => {
    const existing = after.get(from)
    if (existing === undefined) after.set(from, [to])
    else existing.push(to)
  }

  for (const { node } of all) {
    if (isMirror(node)) continue
    for (const target of node.after ?? []) edge(node.id, target)
    for (const target of node.blocks ?? []) edge(target, node.id)
  }

  reportCycles(
    findCycles(all, derived, (node) => after.get(node.id) ?? []),
    "after-cycle",
    "`after` (with `blocks` normalised into it) closes a loop, so nothing in it can start first",
    errors,
  )
}

/** A mirror shows a subtree somewhere else. Placing one inside the subtree it
 *  shows means expanding it never terminates, so the graph a renderer actually
 *  walks has to be acyclic.
 *
 *  That graph is "drawing X leads to drawing Y", and it runs DOWNWARD: a node
 *  leads to its children, a mirror leads to its target. Note this is the
 *  opposite direction from the parent check above, which walks child-to-parent
 *  — either direction finds a pure parent loop, but only the downward one
 *  finds the mirror case, because a mirror's edge to its target is downward by
 *  nature. Mixing the two directions in one walk finds neither reliably. */
const checkMirrorContainment = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  const cycles = findCycles(all, derived, (node) => [
    ...(derived.children.get(node.id) ?? []).map((child) => child.node.id),
    ...(isMirror(node) ? [node.mirror] : []),
  ])

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
 *  means — so it is resolved against the outline's own directory and matched
 *  against the `.md` files actually found. */
const checkDocs = (
  all: ReadonlyArray<Located>,
  documents: ReadonlyArray<string>,
  errors: Array<OutlineError>,
): void => {
  const known = new Set(documents)
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

/** Join `to` onto the directory of `from`, collapsing `.` and `..`, with no
 *  filesystem access: both sides are already paths relative to the served
 *  directory, and a validator that touched the disk would be a second reader. */
export const resolveRelative = (from: string, to: string): string => {
  const segments = from.split("/").slice(0, -1)
  for (const segment of to.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

// ── derived state ──────────────────────────────────────────────────────

/** A parent's status is computed from its children, so a parent may not store
 *  one. This is the rule the whole format leans on: if `done` could be both
 *  stored and derived, a git merge could make the two disagree and nothing
 *  would notice. Mirrors do not count as children — a mirror is a second view
 *  of a node, not a second obligation. */
const checkDerivedState = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of all) {
    const { node } = located
    if (isMirror(node)) continue
    const stored = storedMarker(node)
    if (stored === null) continue

    const own = countedChildren(derived, node.id)
    if (own.length === 0) continue

    const unfinished = own.filter(
      (child) => derived.status.get(child.node.id) !== "done",
    )
    errors.push({
      code: "stored-derived-state",
      ...siteOf(located),
      message: unfinished.length === 0
        ? `\`${stored}\` is computed from this node's ${own.length} children and must not be stored`
        : `\`${stored}\` is stored above ${unfinished.length} of ${own.length} children that ${unfinished.length === 1 ? "is" : "are"} not done; a parent's status is computed, never written`,
      // Omitted rather than empty when there is nothing to link — the same
      // rule the format applies to its own absent fields.
      ...(unfinished.length === 0 ? {} : {
        related: unfinished.map((child) => ({
          ...siteOf(child),
          note: `\`${child.node.id}\` is ${derived.status.get(child.node.id) ?? "open"}`,
        })),
      }),
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
      message: `${message}: ${ordered.map((step) => `\`${step.node.id}\``).join(" → ")} → \`${anchor.node.id}\``,
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

const siteOf = ({ file, line }: Located): { file: string; line: number } => ({
  file,
  line,
})

/** "did you mean" — the closest declared id, when one is close enough to be a
 *  typo rather than a different word. An unknown reference is nearly always a
 *  misspelling, and naming the candidate turns a search into a keystroke. */
const suggest = (id: string, derived: Derived): string => {
  const budget = Math.max(2, Math.floor(id.length / 3))
  let best: string | null = null
  let bestDistance = budget + 1
  for (const candidate of derived.byId.keys()) {
    const gap = distance(id, candidate)
    if (gap < bestDistance) {
      best = candidate
      bestDistance = gap
    }
  }
  return best === null ? "" : ` — did you mean \`${best}\`?`
}
