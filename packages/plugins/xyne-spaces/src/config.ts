/**
 * THE VAULT HALF of the Spaces mirror — a `xyne-channel` property on a
 * node agent.
 *
 * Secrets stay in ENV (`OLAI_SPACES_URL`, `OLAI_SPACES_TOKEN`). Which
 * channel a conversation posts to is CONFIG, so it lives on the node that
 * IS the agent — the one carrying a binding — not in a sidecar file and not
 * on a session id that *fresh session* is allowed to throw away.
 *
 *   chat-agent-session: claude:<session>
 *   xyne-channel:       <spaces channel id>
 *
 * A node with the channel and no session yet is named intent (the pill
 * can fault on missing env) and posts nothing until a conversation is
 * bound. A conversation no node claims does not post. Trim is the
 * default; there is no second file of knobs.
 *
 * ## WHY THIS FILE NAMES ANOTHER PLUGIN'S WORD, and does not spell it
 *
 * The binding used to be `@olai/format`'s `AGENT_PROP`, a bare key core owned,
 * and this module re-exported it. It is a chat KIND now
 * (`olai-plugin-chat`'s `kinds.ts`), so the format spells nothing and the word
 * has to come from the plugin that teaches it: `olai-plugin-chat/binding`, a
 * door of two strings with an empty import graph.
 *
 * AN IMPORT AND NOT A COPY, which is the phase rather than a preference. *No
 * plugin consumes a plugin* was a rule of this tree and the Cordis proposal
 * retired it: `needs` is the dependency arm, it is REACTIVE, and the
 * half-wired state the ban feared is `waiting` — a legitimate, inspectable
 * state the runtime resolves or reports. This mirror is named in that section
 * as the first edge that needs it, and the edge is already real: this half
 * names `Watching`, which chat's row OFFERS, so it is `waiting` without chat
 * either way. A hand-copied constant would have bought nothing and could
 * silently disagree — one plugin renamed and this one goes on reading a column
 * no vault has.
 *
 * IT IS NOT A CLAIM, and could not be. A claim is the registry's, set equal to
 * the word the REGISTERING plugin's name composes, so this package declares
 * nothing about anybody's vault. What {@link SESSIONS} does is fold chat's
 * claim into a reading of THIS revision's declarations, which is what any
 * reader of a declared kind does — and it is that fold, not the constant, that
 * makes a vault's own migration row win over the claimed key here exactly as it
 * does in chat.
 */

import {
  agentsIn,
  customText,
  declarationsOf,
  isRegular,
  type Derived,
  type KindVocabulary,
} from "@olai/format"
import { SESSION_TYPE } from "olai-plugin-chat/binding"

/** The property a node agent carries to name the Spaces channel. */
export const CHANNEL_PROP = "xyne-channel"

/** THE KIND A BINDING IS, re-exported so this package's own bench builds its
 *  fixtures under the same word the reading looks for — and so a reader of
 *  either finds one name rather than two. It is chat's, and the header argues
 *  why that is an import. */
export { SESSION_TYPE }

/**
 * ...AND THAT KIND AS A VOCABULARY, so the reading below sees chat's CLAIM
 * folded in exactly as every other reader of it does (`@olai/format`'s
 * `withClaims`, which is the one place precedence lives).
 *
 * BOTH HALVES ARE THE SAME TABLE, which is `olai-plugin-kolu`'s `ownKinds`
 * argument one plugin over: a Spaces mirror runs only where there are
 * conversations to mirror, so the kind is enabled wherever this reading happens.
 * `admits` is the widest predicate this side can honestly offer — the shape of a
 * binding value is chat's own reading, not this package's — and it decides
 * nothing here anyway: a value gate belongs to the serve that REGISTERED the
 * kind, and what this table is spent on is the fold.
 */
const OWN = new Map([[SESSION_TYPE, {
  kind: SESSION_TYPE,
  takes: `\`${SESSION_TYPE}\` (an engine, optionally \`:\` and a session id)`,
  admits: () => true,
  claims: SESSION_TYPE,
}]])
const SESSIONS: KindVocabulary = { built: OWN, enabled: OWN }

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
 * The roster is {@link agentsIn}, asked with this revision's declarations and
 * chat's word: put-away and mirrors are already out, and which COLUMN the
 * bindings are in is the vault's answer rather than a key spelled here. The
 * channel is a second custom key on the same node. First claim wins where two
 * nodes name one session, the same rule as chat's own `agentAt`.
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
  for (const agent of agentsIn(derived, declarationsOf(derived, SESSIONS), SESSION_TYPE)) {
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
