/** Session facts supplied by an ACP agent, independent of their controls. */
import { Schema } from "effect"

const SettingInfo = { id: Schema.String, name: Schema.String, description: Schema.String }
export const SessionSetting = Schema.Union([
  Schema.Struct({ ...SettingInfo, type: Schema.Literal("select"), currentValue: Schema.String,
    options: Schema.Array(Schema.Struct({ value: Schema.String, name: Schema.String, description: Schema.String })) }),
  Schema.Struct({ ...SettingInfo, type: Schema.Literal("boolean"), currentValue: Schema.Boolean }),
])
export type SessionSetting = typeof SessionSetting.Type
export const PlanStep = Schema.Struct({ content: Schema.String,
  priority: Schema.Literals(["high", "medium", "low"]),
  status: Schema.Literals(["pending", "in_progress", "completed"]) })
export type PlanStep = typeof PlanStep.Type
export const TerminalView = Schema.Struct({ id: Schema.String, output: Schema.String,
  truncated: Schema.Boolean, exitCode: Schema.NullOr(Schema.Number),
  signal: Schema.NullOr(Schema.String), running: Schema.Boolean })
export type TerminalView = typeof TerminalView.Type
