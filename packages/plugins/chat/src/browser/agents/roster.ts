/** The seven server-owned node-agent standings, and their one presentation.
 * Lifecycle is per node, so this module does not derive it from the foreground
 * chat cell; it only decides how the wire's answer looks. */

import type { AgentStanding, NodeAgentRow } from "olai-plugin-chat/wire"

export type Standing = AgentStanding
export type Row = NodeAgentRow

/** What each standing is called, how it is painted, and what it means — the
 *  static door's table (`../../attention.ts`), which a tab's dot reads too. */
export { LOOK } from "../../attention.ts"
