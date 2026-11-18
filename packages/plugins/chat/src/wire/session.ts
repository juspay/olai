/** WHICH CONVERSATION a panel is addressed by — the only session fact this
 *  module still declares, because every other one an ACP agent supplies (its
 *  settings, its plan, the terminals it was given) is `@kolu/acp/wire`'s: the
 *  package that speaks the protocol owns its words, and both panels drawn from
 *  those shapes read the one declaration. */
import { Schema } from "effect"

export const Conversing = Schema.Struct({ agent: Schema.String, session: Schema.String })
export type Conversing = typeof Conversing.Type

/** A panel exists before the agent has granted it a session — addressed by the
 *  ITEM KEY its chat belongs to (a node's id, or `/` and a note's path). */
export const PanelAddress = Schema.Union([Conversing, Schema.Struct({ node: Schema.String })])
export type PanelAddress = typeof PanelAddress.Type

