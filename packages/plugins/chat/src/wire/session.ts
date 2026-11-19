/** WHICH CONVERSATION a panel is addressed by — the only session fact this
 *  module still declares, because every other one an ACP agent supplies (its
 *  settings, its plan, the terminals it was given) is `@kolu/acp/wire`'s: the
 *  package that speaks the protocol owns its words, and both panels drawn from
 *  those shapes read the one declaration. */
import { Schema } from "effect"

export const Conversing = Schema.Struct({ agent: Schema.String, session: Schema.String })
export type Conversing = typeof Conversing.Type

/** A panel exists before the agent has granted it a session — addressed by the
 *  ITEM KEY its chat belongs to (a node's id, or `/` and a note's path).
 *
 *  A PAIR SAYS WHICH OF TWO THINGS IT MEANS. With `current`, it is "this
 *  node's chat, which I last saw as this pair": a page following a node can be
 *  one roster frame behind, and the scheduler serves such a pair only while the
 *  node is still bound to it, holding nothing otherwise. Without it, the pair
 *  is a visit — an earlier chat somebody chose — and is opened wherever it
 *  lives. Absent is a visit, so every caller that does not say keeps the
 *  meaning a pair always had. */
export const PanelAddress = Schema.Union([
  Schema.Struct({ ...Conversing.fields, current: Schema.optionalKey(Schema.Literal(true)) }),
  Schema.Struct({ node: Schema.String }),
])
export type PanelAddress = typeof PanelAddress.Type
