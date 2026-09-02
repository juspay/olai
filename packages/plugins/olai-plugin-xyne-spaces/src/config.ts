/**
 * THE VAULT HALF of the Spaces mirror — a `xyne-channel` property on a
 * node agent.
 *
 * Secrets stay in ENV (`OLAI_SPACES_URL`, `OLAI_SPACES_TOKEN`). Which
 * channel a conversation posts to is CONFIG, so it lives on the node that
 * IS the agent (`agent-session`), not in a sidecar file and not on a
 * session id that *fresh session* is allowed to throw away.
 *
 *   agent-session: claude:<session>
 *   xyne-channel:  <spaces channel id>
 *
 * A node with the channel and no session yet is named intent (the pill
 * can fault on missing env) and posts nothing until a conversation is
 * bound. A conversation no node claims does not post. Trim is the
 * default; there is no second file of knobs.
 */

import {
  AGENT_PROP,
  agentsOf,
  customText,
  isRegular,
  type Derived,
} from "@olai/format"

/** The property a node agent carries to name the Spaces channel. */
export const CHANNEL_PROP = "xyne-channel"

/** Default orchestrator-reply cap, the human's ruling. */
export const DEFAULT_TRIM = 500

export interface ChannelBind {
  readonly node: string
  readonly file: string
  readonly title: string
  readonly channel: string
  readonly engine: string
  readonly session: string
}

export interface SpacesReading {
  /** Node agents that have both a current session and a channel. */
  readonly binds: ReadonlyArray<ChannelBind>
  /** Any live node carrying {@link CHANNEL_PROP}, session or not — intent. */
  readonly named: ReadonlyArray<{ readonly node: string; readonly file: string }>
  readonly trim: number
}

/**
 * What the vault says the mirror's knobs are, read off one revision.
 *
 * The roster is {@link agentsOf}: put-away and mirrors are already out.
 * The channel is a second custom key on the same node. First claim wins
 * where two nodes name one session, the same rule as `agentAt`.
 */
export const spacesConfigIn = (derived: Derived): SpacesReading => {
  const channelOf = new Map<string, string>()
  for (const located of derived.nodes) {
    if (!isRegular(located)) continue
    const channel = customText(located.node, CHANNEL_PROP)?.trim()
    if (channel === undefined || channel === "") continue
    channelOf.set(located.node.id, channel)
  }

  const named: Array<{ readonly node: string; readonly file: string }> = []
  const claimed = new Set<string>()
  const binds: Array<ChannelBind> = []
  for (const agent of agentsOf(derived)) {
    const channel = channelOf.get(agent.id)
    if (channel === undefined) continue
    named.push({ node: agent.id, file: agent.file })
    if (agent.session === null) continue
    const pair = `${agent.engine}/${agent.session}`
    if (claimed.has(pair)) continue
    claimed.add(pair)
    binds.push({
      node: agent.id,
      file: agent.file,
      title: agent.title,
      channel,
      engine: agent.engine,
      session: agent.session,
    })
  }

  return { binds, named, trim: DEFAULT_TRIM }
}

/** The bind for this conversation, or nothing — a chat no node agent
 *  claims, or a node agent with no `xyne-channel`. */
export const bindOf = (
  reading: SpacesReading,
  agent: string,
  session: string,
): ChannelBind | undefined =>
  reading.binds.find((bind) => bind.engine === agent && bind.session === session)

export { AGENT_PROP }
