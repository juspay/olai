import { Schema } from "effect"

export const Conversing = Schema.Struct({ agent: Schema.String, session: Schema.String })
export type Conversing = typeof Conversing.Type

export const PanelAddress = Schema.Union([
  Schema.Struct({ ...Conversing.fields, current: Schema.optionalKey(Schema.Literal(true)) }),
  Schema.Struct({ node: Schema.String }),
])
export type PanelAddress = typeof PanelAddress.Type
