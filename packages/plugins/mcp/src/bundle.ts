import { buildSurfaceFace, type RootedSurfaceClients, type SurfaceClientCallable } from "@kolu/surface/client"
import type { Surface, SurfaceSpec } from "@kolu/surface/define"
import type { ExposeMap } from "@kolu/surface/expose"
import type { BespokeTool, McpSibling } from "@kolu/surface-mcp"
import { scopedTo, type Reading } from "./live-client.ts"
import type { writerAt } from "./authority.ts"

export interface Row {
  readonly name: string
  readonly surface: { readonly spec: unknown }
  readonly resources: Readonly<Record<string, unknown>>
  readonly tools: ReadonlyArray<unknown>
  readonly charter?: string
}

type Spec = {
  readonly cells?: Readonly<Record<string, unknown>>
  readonly collections?: Readonly<Record<string, unknown>>
  readonly streams?: Readonly<Record<string, unknown>>
  readonly procedures?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

const declares = (spec: unknown, member: string, verb: string): boolean => {
  const it = spec as Spec
  if (it.procedures?.[member] !== undefined) return it.procedures[member]![verb] !== undefined
  return it.cells?.[member] !== undefined || it.collections?.[member] !== undefined || it.streams?.[member] !== undefined
}

export const ownerIn = (rows: ReadonlyArray<Row>, member: string, verb: string): string | undefined =>
  rows.find(row => declares(row.surface.spec, member, verb))?.name

export const runnerIn = (rows: ReadonlyArray<Row>): ReadonlyMap<string, string> => {
  const owners = new Map<string, string>()
  for (const row of rows) {
    for (const tool of row.tools) {
      const it = tool as { readonly kind?: string; readonly fixed?: Readonly<Record<string, unknown>> }
      const op = it.kind === "write" ? it.fixed?.["op"] : undefined
      if (typeof op === "string" && !owners.has(op)) owners.set(op, row.name)
    }
  }
  return owners
}

/** A row's tools keep the names they were AUTHORED with: a tool name is the
 *  vocabulary that appears in agent prompts and in docs, and must not move when
 *  the composition does. */
export const siblingsOf = (
  rows: ReadonlyArray<Row>,
  verbs: (row: Row) => Record<string, BespokeTool>,
): Record<string, McpSibling<SurfaceSpec>> =>
  Object.fromEntries(rows.map(row => [row.name, {
    surface: row.surface as Surface<SurfaceSpec>,
    expose: row.resources as ExposeMap<SurfaceSpec>,
    tools: verbs(row),
  }] as const))

export const clientsFor = (
  rows: ReadonlyArray<Row>,
  read: Reading,
  caller: Parameters<typeof writerAt>[1],
): RootedSurfaceClients => ({
  clients: Object.fromEntries(rows.map(row => [
    row.name,
    buildSurfaceFace(row.surface as Surface<SurfaceSpec>, scopedTo(read, caller, row.name)) as SurfaceClientCallable,
  ])),
})
