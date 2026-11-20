import type { Claims } from "./kinds.ts"
import { conventionCalled, TRASH, INBOX, PINS } from "./node.ts"
import { type Derived, drawnFrom } from "./derive.ts"
import {
  chainOf,
  compareErrors,
  isGuessWhileUnreadable,
  type OutlineError,
  type Related,
} from "./errors.ts"
import {
  isMirror,
  isRegular,
  type Located,
  type LocatedRegular,
  mintedInto,
  PROPERTIES,
  propertiesIn,
  type Site,
} from "./node.ts"
import { byPath } from "./paths.ts"
import { markdownIn, type OutlineSet } from "./set.ts"
import { didYouMeanDeclared } from "./suggest.ts"
import {
  type ContributedKind,
  declaredFor,
  heldCustoms,
  keyOf,
  type KindVocabulary,
  resolvesId,
  type Typed,
  wrongDeclaration,
  wrongValue,
} from "./typing.ts"

export const reportOf = (
  set: OutlineSet,
  errors: ReadonlyArray<OutlineError>,
): ReadonlyArray<OutlineError> => {
  const unreadable = set.broken.flatMap((file) => [...file.errors])
  const found = set.broken.length === 0
    ? errors
    : errors.filter((error) => !isGuessWhileUnreadable(error))
  return [...unreadable, ...found].sort(compareErrors)
}

export const markdownPaths = (set: OutlineSet): ReadonlySet<string> =>
  new Set(markdownIn(set).map((document) => document.path))

export const reportDuplicateIds = (
  records: Iterable<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of records) {
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

export const reportParents = (
  records: Iterable<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const located of records) {
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
        related: [{ ...siteOf(parent), note: "the parent lives here", broken: false }],
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
}

export const reportParentCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  reportCycles(
    findCycles(all, derived, (node) => (node.parent === undefined ? [] : [node.parent])),
    "parent-cycle",
    "`parent` pointers close a loop, so this node is its own ancestor",
    errors,
  )
}

export const danglingIn = (derived: Derived): ReadonlyArray<string> => {
  const dangling: Array<string> = []
  for (const id of derived.namedBy.keys()) if (!derived.byId.has(id)) dangling.push(id)
  return dangling
}

export const reportUnknownTargets = (
  dangling: Iterable<string>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  for (const id of dangling) {
    const said = suggest(id, derived)
    for (const naming of derived.namedBy.get(id) ?? []) {
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

export const reportAfterCycles = (
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

export const reportMirrorCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  errors: Array<OutlineError>,
): void => {
  const cycles = findCycles(all, derived, (node) => drawnFrom(derived, node))

  reportCycles(
    cycles.filter((cycle) => cycle.some((located) => isMirror(located.node))),
    "mirror-cycle",
    "this mirror is placed inside the subtree it shows, so expanding it never ends",
    errors,
  )
}

export const reportDeclarations = (
  derived: Derived,
  kinds: KindVocabulary,
  errors: Array<OutlineError>,
): void => {
  const file = propertiesIn(derived.claims, derived.byFile.keys())
  if (file === undefined) return
  const declared = new Set<string>()
  for (const located of derived.byFile.get(file) ?? []) {
    const wrong = wrongDeclaration(derived, located, declared, kinds)
    if (wrong === undefined) {
      if (isRegular(located) && located.node.parent === undefined) {
        const key = keyOf(located.node.title)
        if (key !== undefined) declared.add(key)
      }
      continue
    }
    errors.push({
      code: "bad-prop",
      ...siteOf(located),
      message: wrong.said,
      ...(wrong.across ? { across: true } : {}),
    })
  }
}

export const reportPropValues = (
  records: Iterable<Located>,
  typed: Typed,
  errors: Array<OutlineError>,
): void => {
  if (typed.declarations.size === 0) return
  for (const { located, key, value } of heldCustoms(records)) {
    const wrong = wrongValue(typed, located.file, key, value)
    if (wrong === undefined) continue
    errors.push({
      code: "bad-prop",
      ...siteOf(located),
      message: wrong,
      related: judgedFrom(typed, key),
      ...(resolvesId(typed.declarations, key) ? { across: true } : {}),
    })
  }
}

const judgedFrom = (typed: Typed, key: string): ReadonlyArray<Related> => {
  const declared = declaredFor(typed.declarations, key)
  const declaring = declared === undefined ? undefined : typed.derived.byId.get(declared.at)
  return declaring === undefined
    ? []
    : [{ ...siteOf(declaring), note: "declared here", broken: false }]
}

const findCycles = (
  all: ReadonlyArray<Located>,
  derived: Derived,
  edges: (node: Located["node"]) => ReadonlyArray<string>,
): ReadonlyArray<ReadonlyArray<Located>> => {
  const cycles: Array<ReadonlyArray<Located>> = []
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
    if (byPath(step.file, best.file) < 0 || (step.file === best.file && step.line < best.line)) {
      at = index
    }
  })
  return [...cycle.slice(at), ...cycle.slice(0, at)]
}

const siteOf = ({ file, line }: Located): Site => ({ file, line })

const suggest = (id: string, derived: Derived): string =>
  didYouMeanDeclared(id, derived.byId)

export const reportConventions = (claims: Claims, set: OutlineSet): ReadonlyArray<OutlineError> => {
  const errors: OutlineError[] = []
  for (const stem of [TRASH, INBOX, PINS, PROPERTIES]) {
    const files = set.documents.map(document => document.path).filter(file => conventionCalled(claims, file, stem))
    if (files.length < 2) continue
    for (const file of files) errors.push({
      file, line: 0, code: "ambiguous-convention",
      message: `${stem} is ambiguous: ${files.join(", ")}. Keep only one convention file.`,
      related: files.filter(other => other !== file).map(file => ({ file, line: 0, note: "competing convention file" })),
    })
  }
  return errors
}
