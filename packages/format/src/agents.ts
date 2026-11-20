import { Schema } from "effect"

import { linkedTitle } from "./address.ts"
import { type Derived, under } from "./derive.ts"
import { isMarkdown } from "./document.ts"
import { type Claim, type Claims, nameOf, textKind } from "./kinds.ts"
import { isPutAway, isRegular } from "./node.ts"
import { documentAt, markdownIn, type OutlineSet } from "./set.ts"
import { declaresKind, type PropDeclarations, textDeclaredAs } from "./typing.ts"

export const sessionIn = (
  value: string,
): { readonly engine: string; readonly session: string | null } | null => {
  const at = value.indexOf(":")
  const engine = at === -1 ? value : value.slice(0, at)
  if (engine === "") return null
  const session = at === -1 ? "" : value.slice(at + 1)
  return { engine, session: session === "" ? null : session }
}

export const sessionValue = (engine: string, session: string | null): string =>
  session === null ? engine : `${engine}:${session}`

export const AgentItem = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("node"), id: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("note"), path: Schema.String }),
])
export type AgentItem = typeof AgentItem.Type

export const itemKey = (item: AgentItem): string => item.kind === "node" ? item.id : `/${item.path}`

export const itemOf = (key: string): AgentItem =>
  key.startsWith("/") ? { kind: "note", path: key.slice(1) } : { kind: "node", id: key }

export const isNotePath = (claims: Claims, path: string): boolean => {
  const kind = textKind(claims, path)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  return claim !== undefined && claim.kept && claim.opaque !== true
}

export const notesClaimed = (claims: Iterable<Claim>): boolean => {
  for (const claim of claims) if (claim.holds === "text" && claim.kept && claim.opaque !== true) return true
  return false
}

export const NodeAgent = Schema.Struct({
  kind: Schema.Literals(["node", "note"]),
  id: Schema.String,
  file: Schema.String,
  title: Schema.String,
  engine: Schema.String,
  session: Schema.NullOr(Schema.String),
  memory: Schema.Int,
  beside: Schema.Boolean,
})
export type NodeAgent = typeof NodeAgent.Type

export const memoryOf = (agent: Pick<NodeAgent, "memory">): string =>
  agent.memory === 1 ? "1 row" : `${agent.memory} rows`

export const NodeAgents = Schema.Array(NodeAgent)
export type NodeAgents = typeof NodeAgents.Type

export const othersOf = (roster: NodeAgents, id: string): ReadonlySet<string> =>
  new Set(roster.filter((one) => one.id !== id).map((one) => one.id))

export const NO_AGENTS: NodeAgents = []

export const sameAgents: (a: NodeAgents, b: NodeAgents) => boolean = Schema
  .toEquivalence(NodeAgents)

export const agentsIn = (
  derived: Derived,
  declarations: PropDeclarations,
  word: string,
): NodeAgents => {
  if (!declaresKind(declarations, word)) return NO_AGENTS
  return derived.nodes.flatMap((located) => {
    if (isPutAway(derived.claims, located.file)) return []
    if (!isRegular(located)) return []
    const held = textDeclaredAs(declarations, located.node, word)
    const said = held === undefined ? null : sessionIn(held)
    if (said === null) return []
    return [{
      kind: "node",
      id: located.node.id,
      file: located.file,
      title: nodeChatTitle(located.node.title),
      engine: said.engine,
      session: said.session,
      memory: under(derived, located.node.id),
      beside: false,
    }]
  })
}

export const nodeChatTitle = (title: string): string => {
  const label = linkedTitle(title)?.label.trim()
  return label === undefined || label === "" ? title : label
}

export const seatableIn = (derived: Derived, node: string): boolean => {
  const located = derived.byId.get(node)
  if (located === undefined) return false
  return !isPutAway(derived.claims, located.file) && isRegular(located)
}

export const noteTitle = (claims: Claims, path: string): string => {
  const name = nameOf(claims, path)
  if (name !== "README") return name
  const folder = path.slice(0, path.lastIndexOf("/"))
  if (folder === "") return name
  return folder.slice(folder.lastIndexOf("/") + 1)
}

export const notesIn = (
  set: OutlineSet,
  claims: Claims,
  declarations: PropDeclarations,
  sessionWord: string,
  opensWord: string,
): NodeAgents => {
  if (!declaresKind(declarations, sessionWord)) return NO_AGENTS
  return markdownIn(set).flatMap((note) => {
    if (isPutAway(claims, note.path)) return []
    const held = textDeclaredAs(declarations, { custom: note.props }, sessionWord)
    const said = held === undefined ? null : sessionIn(held)
    if (said === null) return []
    const opens = textDeclaredAs(declarations, { custom: note.props }, opensWord)?.trim()
    return [{
      kind: "note" as const,
      id: itemKey({ kind: "note", path: note.path }),
      file: note.path,
      title: noteTitle(claims, note.path),
      engine: said.engine,
      session: said.session,
      memory: 0,
      beside: opens === OPENS_BESIDE,
    }]
  })
}

export const OPENS_BESIDE = "beside"
export const OPENS_ALONE = "alone"

export const opensValue = (beside: boolean): string => beside ? OPENS_BESIDE : OPENS_ALONE

export const seatableNote = (set: OutlineSet, claims: Claims, path: string): boolean => {
  const document = documentAt(set, path)
  return document !== undefined && isMarkdown(document) && !isPutAway(claims, path)
}
