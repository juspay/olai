import type { Claims } from "./kinds.ts"
import type { Derived } from "./derive.ts"
import { isMarkdown } from "./document.ts"
import type { OutlineError } from "./errors.ts"
import { fileKind } from "./kinds.ts"
import { isMirror, type Located, targetsOf } from "./node.ts"
import { claimsAreUnique, recordsIn, type SetDelta, touchedBy } from "./patch.ts"
import {
  reportCycleWalks,
  reportDeclarations,
  reportParents,
  reportPropValues,
  reportUnknownTargets,
} from "./rules.ts"
import type { OutlineSet } from "./set.ts"
import {
  declarationsOf,
  type KindVocabulary,
  type PropDeclarations,
  sameTyping,
  type Typed,
} from "./typing.ts"

export interface Ledger {
  readonly errors: ReadonlyArray<OutlineError>
  readonly known: ReadonlySet<string>
  readonly typing: PropDeclarations
}

export interface Narrowed {
  readonly ledger: Ledger
  readonly walked: boolean
}

export type Decline = "refused" | "duplicates" | "documents"

export const incrementally = (
  set: OutlineSet,
  before: Derived,
  ledger: Ledger,
  delta: SetDelta,
  derived: Derived,
  kinds: KindVocabulary,
): Narrowed | Decline => {
  if (ledger.errors.length > 0) return "refused"
  if (!claimsAreUnique(derived)) return "duplicates"

  const touched = touchedBy(delta)
  const gone = recordsIn(before.byFile, touched)
  const fresh = recordsIn(derived.byFile, touched)

  const moved = new Set<string>()
  for (const at of gone) moved.add(at.node.id)
  for (const at of fresh) moved.add(at.node.id)

  const errors: Array<OutlineError> = []

  const asking = new Set<Located>(fresh)
  for (const id of moved) {
    for (const child of derived.children.get(id) ?? []) asking.add(child)
  }
  reportParents(asking, derived, errors)

  const moving = structural(gone, fresh)
  if (moving) reportCycleWalks(derived.nodes, derived, errors)

  const named = new Set<string>(moved)
  for (const at of gone) for (const [, id] of targetsOf(at.node)) named.add(id)
  for (const at of fresh) for (const [, id] of targetsOf(at.node)) named.add(id)
  const dangling: Array<string> = []
  for (const id of named) {
    if (derived.namedBy.has(id) && !derived.byId.has(id)) dangling.push(id)
  }
  reportUnknownTargets(dangling, derived, errors)

  const known = new Set(ledger.known)
  const lost: Array<string> = []
  for (const file of delta.removes) if (known.delete(file)) lost.push(file)
  for (const [file] of delta.upserts) if (markdownPath(derived.claims, file)) known.add(file)
  if (!carriedDocuments(known, set)) return "documents"
  const walking = lost.some((file) => !known.has(file))

  reportDeclarations(derived, kinds, errors)
  const typing = declarationsOf(derived, kinds)
  const walkingProps = !sameTyping(ledger.typing, typing) || walking || shrank(gone, derived)
  const typed: Typed = { declarations: typing, derived, documents: known, kinds }
  reportPropValues(walkingProps ? derived.nodes : fresh, typed, errors)

  return { ledger: { errors, known, typing }, walked: moving || walking || walkingProps }
}

const shrank = (gone: ReadonlyArray<Located>, derived: Derived): boolean =>
  gone.some((at) => {
    const now = derived.byId.get(at.node.id)
    return now === undefined ||
      isMirror(now.node) !== isMirror(at.node) ||
      now.node.parent !== at.node.parent
  })

const structural = (
  gone: ReadonlyArray<Located>,
  fresh: ReadonlyArray<Located>,
): boolean => {
  if (gone.length !== fresh.length) return true
  const held = new Map<string, number>()
  const tally = (at: Located, by: number): void => {
    const shape = shapeOf(at)
    held.set(shape, (held.get(shape) ?? 0) + by)
  }
  for (const at of gone) tally(at, 1)
  for (const at of fresh) tally(at, -1)
  for (const count of held.values()) if (count !== 0) return true
  return false
}

const shapeOf = (at: Located): string =>
  JSON.stringify([
    at.file,
    at.line,
    at.node.id,
    at.node.parent ?? null,
    isMirror(at.node) ? at.node.mirror : null,
    isMirror(at.node) ? null : at.node.after ?? null,
    isMirror(at.node) ? null : at.node.blocks ?? null,
  ])

const markdownPath = (claims: Claims, file: string): boolean => {
  const kind = fileKind(claims, file)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  return claim?.holds === "text" && claim.kept && claim.opaque !== true
}

const carriedDocuments = (known: ReadonlySet<string>, set: OutlineSet): boolean => {
  let held = 0
  for (const document of set.documents) {
    if (!isMarkdown(document)) continue
    held++
    if (!known.has(document.path)) return false
  }
  return held === known.size
}
