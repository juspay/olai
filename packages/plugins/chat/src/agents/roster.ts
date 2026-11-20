import { type Adapter, type Engine, type Leg, type NotHere, type PromptChannel, type Where } from "@kolu/acp/engine"
import type { AgentChoice, OffBecause } from "olai-plugin-chat/wire"
import { AGENT_PATH_ENV } from "../adapter.ts"

export interface Installed {
  readonly id: string
  readonly name: string
  readonly adapter: Adapter
  readonly leg: Leg
  readonly prompt: PromptChannel
}

export type Standing =
  | { readonly standing: "here"; readonly installed: Installed }
  | { readonly id: string; readonly name: string; readonly standing: "not-here"; readonly missing: NotHere }

export type Roster = ReadonlyArray<Standing>

export const here = (roster: Roster): ReadonlyArray<Installed> => {
  const installed: Installed[] = []
  for (const row of roster) if (row.standing === "here") installed.push(row.installed)
  return installed
}

export const offBecause = (roster: Roster): OffBecause | null => {
  if (roster.some((row) => row.standing === "here")) return null
  return roster.length === 0 ? { kind: "no-engine" } : { kind: "none-installed" }
}

export const choiceOf = (row: Standing): AgentChoice =>
  row.standing === "here"
    ? { id: row.installed.id, name: row.installed.name, standing: "here" }
    : { id: row.id, name: row.name, standing: "not-here", missing: row.missing }

export const rosterOf = (
  where: Where,
  engines: ReadonlyArray<Engine>,
): Roster => engines.map(engine => standingOf(engine, engine.at(where)))

const standingOf = (engine: Engine, at: Adapter | NotHere): Standing =>
  "why" in at
    ? { id: engine.id, name: engine.name, standing: "not-here", missing: at }
    : {
      standing: "here",
      installed: { id: engine.id, name: engine.name, adapter: at, leg: engine.leg, prompt: engine.prompt },
    }

export const roster = (
  vars: Record<string, string | undefined>,
  cwd: string,
  engines: ReadonlyArray<Engine>,
): Roster =>
  rosterOf({ env: vars, cwd, found: (name) => onPath(name, searchPath(vars)) }, engines)

export interface Detection {
  readonly read: (engines: ReadonlyArray<Engine>) => Roster
  readonly forget: (id: string) => void
}

export const detecting = (vars: Record<string, string | undefined>, cwd: string): Detection => {
  const asked = new Map<string, Standing>()
  const where: Where = { env: vars, cwd, found: (name) => onPath(name, searchPath(vars)) }
  return {
    read: (engines) =>
      engines.map((engine) => {
        const cached = asked.get(engine.id)
        if (cached !== undefined) return cached
        const standing = standingOf(engine, engine.at(where))
        asked.set(engine.id, standing)
        return standing
      }),
    forget: (id) => {
      asked.delete(id)
    },
  }
}

const searchPath = (vars: Record<string, string | undefined>): string =>
  vars[AGENT_PATH_ENV] ?? vars["PATH"] ?? ""

export const onPath = (name: string, search: string): string | null =>
  Bun.which(name, { PATH: search })
