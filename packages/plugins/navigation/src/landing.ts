import type { Route } from "./routes.ts"
import { panesOf,type Workspace } from "./workspace.ts"

export interface Landing {
  readonly file: string
  readonly at: string
  readonly spent: boolean
}

export type Landings = ReadonlyMap<number, Landing>

export const NOWHERE: Landings = new Map()

export const asTheyWere = (all: Landings): Landings => all

export const landingOf = (route: Route): Landing | undefined => {
  const address = route.kind === "at" ? route.address : undefined
  if (address?.kind === "heading") {
    return { file: address.path, at: address.slug, spent: false }
  }
  if (address?.kind === "row") {
    return { file: address.path, at: address.id, spent: false }
  }
  return undefined
}

export const landingsOf = (workspace: Workspace): Landings => {
  const all = new Map<number, Landing>()
  panesOf(workspace).forEach((pane, index) => {
    const land = landingOf(pane.route)
    if (land !== undefined) all.set(index, land)
  })
  return all
}

export const marked = (
  all: Landings,
  index: number,
  land: Landing | undefined,
): Landings => {
  if (land === undefined && !all.has(index)) return all
  const next = new Map(all)
  if (land === undefined) next.delete(index)
  else next.set(index, land)
  return next
}

export const spent = (
  all: Landings,
  index: number,
  file: string,
  at: string,
): Landings => {
  const land = all.get(index)
  if (land === undefined || land.spent) return all
  if (land.file !== file || land.at !== at) return all
  return marked(all, index, { ...land, spent: true })
}
