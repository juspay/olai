import {
  changesOf,
  customText,
  type Derived,
  frontmatterIn,
  idsUnder,
  isMirror,
  isNotePath,
  markdownAt,
  type Node,
  nodesOf,
  type OutlineSet,
  type Writer,
} from "@olai/format"

import type { Plan } from "./plan.ts"

export type ReservedKey = string | { readonly says: string; readonly file: string }

export interface Confinement {
  readonly under: string
  readonly says: string
  readonly stop?: ReadonlySet<string>
}

export type SessionRule =
  | { readonly _tag: "closed" }
  | {
    readonly _tag: "open"
    readonly forbidden: ReadonlyMap<string, ReservedKey>
    readonly confined?: Confinement | null
  }

export interface Caller {
  readonly writer: Writer
  readonly rule?: SessionRule
}

export type Barred =
  | { readonly why: "closed" }
  | {
    readonly why: "key"
    readonly id: string
    readonly title: string
    readonly key: string
    readonly says: string
  }
  | {
    readonly why: "outside"
    readonly id: string
    readonly title: string
    readonly says: string
  }
  | { readonly why: "trash"; readonly says: string }
  | {
    readonly why: "document"
    readonly file: string
    readonly key: string
    readonly says: string
  }

export const doorRefusal = (reached: Barred): string => {
  if (reached.why === "closed") {
    return "this conversation has been reaped, so the door it was handed is closed and nothing may be written through it."
  }
  if (reached.why === "outside") {
    return `“${reached.title}” (\`${reached.id}\`) is outside the subtree this door is confined to — ${reached.says}.`
  }
  if (reached.why === "trash") {
    return `nothing may be trashed or deleted through this door right now — ${reached.says}.`
  }
  if (reached.why === "document") {
    return `\`${reached.key}\` is a property this door may not write — ${reached.says}, in \`${reached.file}\`'s front matter as anywhere else.`
  }
  return `\`${reached.key}\` is a property this door may not write — ${reached.says}, on “${reached.title}” (\`${reached.id}\`) as anywhere else.`
}



export const barred = (
  forbidden: ReadonlyMap<string, ReservedKey>,
  derived: Derived,
  plan: Plan,
  set: OutlineSet,
  confined: Confinement | null = null,
): Barred | null => {
  // THE FENCE FIRST, because it is about WHERE rather than about WHICH KEY, and
  // a plan that lands outside is refused whatever it writes.
  if (confined !== null) {
    const inside = new Set<string>([confined.under, ...idsUnder(derived, confined.under, confined.stop)])
    const before = new Map(plan.files.map((one) => [one.file, nodesOf(derived, one.file).map((at) => at.node)]))
    const after = new Map(plan.files.map((one) => [one.file, one.nodes]))
    const landed = (id: string): Node | undefined => {
      for (const nodes of after.values()) {
        const found = nodes.find((node) => node.id === id)
        if (found !== undefined) return found
      }
      return undefined
    }
    for (const change of changesOf(derived.claims, before, after)) {
      if (change.id === confined.under) continue
      const known = derived.byId.get(change.id) !== undefined
      const parent = landed(change.id)?.parent
      const here = known ? inside.has(change.id) : parent !== undefined && inside.has(parent)
      const lands = parent === undefined || inside.has(parent)
      if (here && lands) continue
      return { why: "outside", id: change.id, title: change.title, says: confined.says }
    }
  }
  if (forbidden.size === 0) return null

  for (const [file, text] of [
    ...(plan.documents ?? []).map((one) => [one.file, one.text] as const),
    ...(plan.removed ?? []).map((file) => [file, ""] as const),
  ]) {
    if (!isNotePath(derived.claims, file)) continue
    const was = frontmatterIn(markdownAt(set, file)?.body ?? "")
    const now = frontmatterIn(text)
    for (const [key, says] of forbidden) {
      if (typeof says !== "string") continue
      if (JSON.stringify(was[key] ?? null) === JSON.stringify(now[key] ?? null)) continue
      return { why: "document", file, key, says }
    }
  }

  const paths = set.documents.map((one) => one.path)
  for (const [key, reservation] of forbidden) {
    if (typeof reservation === "string") continue
    const before = new Map<string, ReadonlyArray<Node>>(paths.map((file) => [file, nodesOf(derived, file).map((one) => one.node)]))
    const after = new Map(before)
    for (const one of plan.documents ?? []) after.set(one.file, [])
    for (const one of plan.files) after.set(one.file, one.nodes)
    for (const file of plan.removed ?? []) after.delete(file)
    const claims = (files: ReadonlyMap<string, ReadonlyArray<Node>>) => {
      const file = [...files.keys()].filter((file) => file.split("/").pop()?.toLowerCase() === reservation.file.toLowerCase())
        .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0]
      if (file === undefined) return []
      const nodes = files.get(file) ?? []
      const protectedTitles = new Set(nodes.flatMap(node => !isMirror(node) && node.parent === undefined && keyed(node, key) !== undefined ? [node.title] : []))
      return nodes.flatMap(node => {
        const value = keyed(node, key)
        const shadow = !isMirror(node) && node.parent === undefined && protectedTitles.has(node.title)
        return value === undefined && !shadow ? [] : [{ id: node.id, title: isMirror(node) ? "" : node.title, parent: node.parent, ord: node.ord, value }]
      }).sort((a, b) => a.id.localeCompare(b.id))
    }
    const was = claims(before)
    const now = claims(after)
    if (JSON.stringify(was) !== JSON.stringify(now)) {
      const one = now.find((one) => !was.some((old) => JSON.stringify(old) === JSON.stringify(one))) ?? was[0]!
      return { why: "key", id: one.id, title: one.title, key, says: reservation.says }
    }
  }

  const was = new Map(
    plan.files.map((one) => [one.file, nodesOf(derived, one.file).map((at) => at.node)]),
  )
  const now = new Map(plan.files.map((one) => [one.file, one.nodes]))
  const planned = new Map<string, Node>()
  for (const nodes of now.values()) {
    for (const node of nodes) planned.set(node.id, node)
  }

  for (const change of changesOf(derived.claims, was, now)) {
    const before = derived.byId.get(change.id)
    const after = planned.get(change.id)
    for (const [key, says] of forbidden) {
      if (typeof says !== "string") continue
      if (keyed(before?.node, key) !== keyed(after, key)) {
        return { why: "key", id: change.id, title: change.title, key, says }
      }
    }
  }
  return null
}

const keyed = (node: Node | undefined, key: string): string | undefined =>
  node === undefined || isMirror(node) ? undefined : customText(node, key)
