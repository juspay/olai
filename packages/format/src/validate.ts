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
 */

import { Result } from "effect"

import { childIndex, countedChildren, statusIndex } from "./derive.ts"
import { compareErrors, type OutlineError } from "./errors.ts"
import { EDGE_FIELDS, type Located } from "./node.ts"
import type { Document, OutlineSet } from "./set.ts"

export const validate = (
  set: OutlineSet,
): Result.Result<OutlineSet, ReadonlyArray<OutlineError>> => {
  const errors: Array<OutlineError> = []
  const all = set.outlines.flatMap((outline) => outline.nodes)

  const byId = index(all, errors)
  checkParents(all, byId, errors)
  checkTargets(all, byId, errors)
  checkAfterAcyclic(all, byId, errors)
  checkMirrorContainment(all, byId, errors)
  checkDocs(all, set.documents, errors)
  checkDerivedState(all, errors)

  return errors.length > 0
    ? Result.fail([...errors].sort(compareErrors))
    : Result.succeed(set)
}

// ── ids ────────────────────────────────────────────────────────────────

/** id → the record that owns it. A duplicate is reported once, on the second
 *  record, pointing back at the first: the first one is not the mistake. The
 *  first claim stays in the index so the reference rules below still resolve —
 *  reporting a hundred dangling edges because an id was declared twice would
 *  bury the one error worth reading. */
const index = (
  all: ReadonlyArray<Located>,
  errors: Array<OutlineError>,
): ReadonlyMap<string, Located> => {
  const byId = new Map<string, Located>()
  for (const located of all) {
    const first = byId.get(located.node.id)
    if (first === undefined) {
      byId.set(located.node.id, located)
      continue
    }
    errors.push({
      code: "duplicate-id",
      file: located.file,
      line: located.line,
      message: `\`${located.node.id}\` is already the id of another node; ids are unique across every file in the served directory`,
      related: [
        { file: first.file, line: first.line, note: "first declared here" },
      ],
    })
  }
  return byId
}

// ── references ─────────────────────────────────────────────────────────

const checkParents = (
  all: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
  errors: Array<OutlineError>,
): void => {
  for (const { file, line, node } of all) {
    if (node.parent === undefined) continue

    const parent = byId.get(node.parent)
    if (parent === undefined) {
      errors.push({
        code: "unknown-parent",
        file,
        line,
        message: `\`parent\` is \`${node.parent}\`, which no node declares${suggest(node.parent, byId)}`,
      })
      continue
    }
    if (parent.file !== file) {
      errors.push({
        code: "foreign-parent",
        file,
        line,
        message: `\`parent\` is \`${node.parent}\`, which lives in another file; every \`.jsonl\` is an independent tree, so cross-file placement is a \`mirror\``,
        related: [{ ...siteOf(parent), note: "the parent lives here" }],
      })
      continue
    }
    if (parent.node.mirror !== undefined) {
      errors.push({
        code: "parent-not-a-node",
        file,
        line,
        message: `\`parent\` is \`${node.parent}\`, which is a mirror; children hang off the node a mirror points at, never off the mirror`,
        related: [{ ...siteOf(parent), note: "the mirror is here" }],
      })
    }
  }

  reportCycles(
    findCycles(all, byId, (node) => (node.parent === undefined ? [] : [node.parent])),
    "parent-cycle",
    "`parent` pointers close a loop, so this node is its own ancestor",
    errors,
  )
}

const checkTargets = (
  all: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
  errors: Array<OutlineError>,
): void => {
  for (const { file, line, node } of all) {
    const targets: Array<readonly [field: string, id: string]> =
      node.mirror === undefined ? [] : [["mirror", node.mirror]]
    for (const field of EDGE_FIELDS) {
      for (const id of node[field] ?? []) targets.push([field, id])
    }

    for (const [field, id] of targets) {
      if (byId.has(id)) continue
      errors.push({
        code: "unknown-target",
        file,
        line,
        message: `\`${field}\` names \`${id}\`, which no node declares${suggest(id, byId)}`,
      })
    }
  }
}

/** `blocks` is sugar — `a blocks b` means `b after a` — and this is the only
 *  place it is normalised, so the acyclicity rule sees one graph rather than
 *  two that could disagree. */
const checkAfterAcyclic = (
  all: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
  errors: Array<OutlineError>,
): void => {
  const after = new Map<string, Array<string>>()
  const edge = (from: string, to: string): void => {
    const existing = after.get(from)
    if (existing === undefined) after.set(from, [to])
    else existing.push(to)
  }

  for (const { node } of all) {
    for (const target of node.after ?? []) edge(node.id, target)
    for (const target of node.blocks ?? []) edge(target, node.id)
  }

  reportCycles(
    findCycles(all, byId, (node) => after.get(node.id) ?? []),
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
 *  leads to its children, and a mirror leads to its target. Note this is the
 *  opposite direction from the parent check above, which walks child-to-parent
 *  — either direction finds a pure parent loop, but only the downward one
 *  finds the mirror case, because a mirror's edge to its target is downward by
 *  nature. Mixing the two directions in one walk finds neither reliably. */
const checkMirrorContainment = (
  all: ReadonlyArray<Located>,
  byId: ReadonlyMap<string, Located>,
  errors: Array<OutlineError>,
): void => {
  const childIds = new Map<string, Array<string>>()
  for (const { node } of all) {
    if (node.parent === undefined) continue
    const siblings = childIds.get(node.parent)
    if (siblings === undefined) childIds.set(node.parent, [node.id])
    else siblings.push(node.id)
  }

  const cycles = findCycles(all, byId, (node) => [
    ...(childIds.get(node.id) ?? []),
    ...(node.mirror === undefined ? [] : [node.mirror]),
  ])

  reportCycles(
    // A cycle with no mirror in it is a parent cycle, already reported by
    // `checkParents` — saying it twice in two vocabularies helps nobody.
    cycles.filter((cycle) =>
      cycle.some((located) => located.node.mirror !== undefined)
    ),
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
  documents: ReadonlyArray<Document>,
  errors: Array<OutlineError>,
): void => {
  const known = new Set(documents.map((document) => document.file))
  for (const { file, line, node } of all) {
    if (node.doc === undefined) continue
    const resolved = resolveRelative(file, node.doc)
    if (known.has(resolved)) continue
    errors.push({
      code: "missing-doc",
      file,
      line,
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
  errors: Array<OutlineError>,
): void => {
  const children = childIndex(all)
  const status = statusIndex(all, children)

  for (const { file, line, node } of all) {
    const stored = node.done !== undefined ? "done" : node.doing !== undefined ? "doing" : null
    if (stored === null) continue

    const own = countedChildren(children, node.id)
    if (own.length === 0) continue

    const unfinished = own.filter((child) => status.get(child.node.id) !== "done")
    errors.push({
      code: "stored-derived-state",
      file,
      line,
      message: unfinished.length === 0
        ? `\`${stored}\` is computed from this node's ${own.length} children and must not be stored`
        : `\`${stored}\` is stored above ${unfinished.length} of ${own.length} children that ${unfinished.length === 1 ? "is" : "are"} not done; a parent's status is computed, never written`,
      // Omitted rather than empty when there is nothing to link — the same
      // rule the format applies to its own absent fields.
      ...(unfinished.length === 0 ? {} : {
        related: unfinished.map((child) => ({
          ...siteOf(child),
          note: `\`${child.node.id}\` is ${status.get(child.node.id) ?? "open"}`,
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
  byId: ReadonlyMap<string, Located>,
  edges: (node: Located["node"]) => ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<Located>> => {
  const cycles: Array<ReadonlyArray<Located>> = []
  const settled = new Set<string>()
  const seen = new Set<string>()

  const walk = (located: Located, path: Array<Located>): void => {
    const id = located.node.id
    if (settled.has(id)) return

    const at = path.findIndex((step) => step.node.id === id)
    if (at !== -1) {
      cycles.push(path.slice(at))
      return
    }
    if (seen.has(id)) return
    seen.add(id)

    path.push(located)
    for (const target of edges(located.node)) {
      const next = byId.get(target)
      if (next !== undefined) walk(next, path)
    }
    path.pop()
    settled.add(id)
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
const suggest = (id: string, byId: ReadonlyMap<string, Located>): string => {
  const budget = Math.max(2, Math.floor(id.length / 3))
  let best: string | null = null
  let bestDistance = budget + 1
  for (const candidate of byId.keys()) {
    const distance = editDistance(id, candidate, bestDistance)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best === null ? "" : ` — did you mean \`${best}\`?`
}

/** Levenshtein distance, abandoned once every cell of a row exceeds `budget`:
 *  the suggestion only cares about near misses, and the ids it walks are every
 *  id in the set. */
const editDistance = (a: string, b: string, budget: number): number => {
  if (Math.abs(a.length - b.length) >= budget) return budget
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const row = [i, ...new Array<number>(b.length).fill(0)]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const substitute = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      const insert = (row[j - 1] ?? 0) + 1
      const remove = (previous[j] ?? 0) + 1
      const cell = Math.min(substitute, insert, remove)
      row[j] = cell
      best = Math.min(best, cell)
    }
    if (best >= budget) return budget
    previous = row
  }
  return previous[b.length] ?? budget
}
