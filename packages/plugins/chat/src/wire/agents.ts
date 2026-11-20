import { NodeAgent } from "@olai/format"
import { Schema } from "effect"

export const AgentStanding = Schema.Union([
  Schema.Literal("needs-you"),
  Schema.Literal("working"),
  Schema.Literal("waking"),
  Schema.Literal("idle"),
  Schema.Literal("gone"),
  Schema.Literal("asleep"),
  Schema.Literal("unbound"),
])
export type AgentStanding = typeof AgentStanding.Type

export const Forecast = Schema.Struct({
  lastSlept: Schema.NullOr(Schema.String),
  after: Schema.Number,
  floor: Schema.Number,
  latest: Schema.Number,
  next: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("unmarked") }),
    Schema.Struct({ kind: Schema.Literal("unbound") }),
    Schema.Struct({ kind: Schema.Literal("unchanged") }),
    Schema.Struct({ kind: Schema.Literal("little"), rows: Schema.Number }),
    Schema.Struct({ kind: Schema.Literal("busy") }),
    Schema.Struct({ kind: Schema.Literal("due"), at: Schema.String, rows: Schema.Number }),
    Schema.Struct({ kind: Schema.Literal("running") }),
    Schema.Struct({ kind: Schema.Literal("skipped"), until: Schema.String }),
  ]),
})
export type Forecast = typeof Forecast.Type

export const NodeAgentRow = Schema.Struct({
  ...NodeAgent.fields,
  changed: Schema.optionalKey(Schema.String),
  sleeps: Schema.Boolean,
  sleep: Schema.NullOr(Forecast),
  standing: AgentStanding,
  unopened: Schema.optionalKey(Schema.Boolean),
  since: Schema.optionalKey(Schema.String),
  waiting: Schema.Int,
  said: Schema.NullOr(Schema.Struct({
    text: Schema.String,
    at: Schema.String,
  })),
  seen: Schema.NullOr(Schema.String),
})
export type NodeAgentRow = typeof NodeAgentRow.Type

export const Agents = Schema.Array(NodeAgentRow)
export type Agents = typeof Agents.Type

export const NO_AGENT_ROSTER: Agents = []

export const sameAgentRoster: (a: Agents, b: Agents) => boolean = Schema
  .toEquivalence(Agents)

export const ItemLocation = Schema.Struct({
  key: Schema.String,
  kind: Schema.Literals(["node", "note"]),
  title: Schema.String,
  file: Schema.String,
  path: Schema.Array(Schema.String),
})
export type ItemLocation = typeof ItemLocation.Type

export const matchesTyped = (item: ItemLocation, typed: string): boolean => {
  const looking = typed.trim().toLowerCase()
  return [item.file, ...item.path, item.title].join(" › ").toLowerCase().includes(looking)
}
