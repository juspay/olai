/**
 * WHICH MCP servers a conversation has, and how each one stands.
 *
 * `mcp-roster-visible`: the panel answers "what tool servers does this
 * conversation have?" instead of leaving the MODEL to answer it. The incident
 * is the model getting it wrong — an opencode asked that question listed olai
 * and deepwiki, omitted kolu, and then called `kolu_lifecycle_create`
 * perfectly. Nothing in a conversation's context is a record of what it was
 * handed; the client that handed it over is the only thing that knows.
 *
 * THE ROSTER IS BUILT IN LAYERS, and each layer is only as certain as whoever
 * spoke for it. That is the whole design, and the reason these are two
 * functions rather than one:
 *
 *   - **what olai handed over** ({@link rosterOf}) is fully known, because this
 *     process composed the list and put it on the wire. It is read off the very
 *     array given to `session/new`, so a roster row cannot describe a server
 *     the session was not actually given — the two cannot drift, because
 *     there is only one of them.
 *   - **what the agent then made of it** ({@link movedBy}) is knowable only
 *     where the agent says so. ACP itself never does: `session/new` answers
 *     with a session id and not one word per server, which is why #140 could
 *     only ever report the failures olai found ITSELF. One agent does say —
 *     the Claude Code adapter forwards its CLI's `system`/`init`, and that
 *     message carries a status per server ({@link ./agents/claude.ts}) — and an
 *     agent that says nothing leaves every row at `handed`, which is an honest
 *     answer rather than a degraded one.
 *   - **what the AGENT brought of its own** is in neither, and is not in this
 *     module at all. See {@link movedBy} for why a row for one could not be
 *     kept honest, and `../../web/src/client/chat/Roster.tsx` for the sentence
 *     the panel says instead.
 *
 * PURE, and separated from {@link ./agent.ts} for the reason every leg rule is:
 * "what a person is told this conversation can reach" is a sentence worth
 * asserting without starting a subprocess, and the interesting cases here — an
 * agent that names a server we never handed, a status word nobody has seen
 * before — are ones a running agent would not produce on demand.
 */

import type { McpServer } from "@agentclientprotocol/sdk"
import type { ChatServer, ServerStanding } from "@olai/surface"

import type { Attached } from "./agents/leg.ts"

/** The one status word that means the agent has the server. Everything else —
 *  including a word no version of anything has sent yet — is
 *  {@link ServerStanding}'s `unattached`, which is the direction this may fail
 *  in: the worst case is a working server drawn as one the agent did not
 *  confirm, and the worst case of the other reading is a tick over tools that
 *  are not there. */
const CONNECTED = "connected"

/**
 * The roster as OLAI composed it: every server this session was handed, plus
 * the one it was meant to have and did not.
 *
 * Read off `handing` — the literal `mcpServers` array that goes to
 * `session/new` ({@link ./agent.ts}'s `mcpServersOf`) — rather than off the
 * values that array was built from. The panel's list and the session's list are
 * then the same list read twice, and the failure mode this closes is the one
 * that matters most here: a roster that says a conversation has a server it was
 * never given is worse than the silence it replaces, because it is the same
 * wrong answer the model was giving, in a place a person has decided to trust.
 *
 * `where` is where the server IS, in whichever way its transport spells that:
 * the URL for one reached over http, the absolute executable for one spawned on
 * this host. Both come off the entry itself, so an entry shape this does not
 * know says `null` rather than guessing — and a `null` there is drawn as
 * nothing at all rather than as a blank line.
 *
 * ORDER IS THE ORDER THEY WERE HANDED, with the missing one last. It is the
 * only order that is a fact rather than a preference, and it puts olai's own
 * server first because olai's own server is handed first.
 *
 * @param handing the `mcpServers` this session is being opened with
 * @param missing what a person is owed about the server it was not given, or
 *   `null` when there was nothing to miss ({@link ./kolu.ts}'s `missingFrom` —
 *   a host with no kolu on it had nothing go wrong)
 */
export const rosterOf = (
  handing: ReadonlyArray<McpServer>,
  missing: ChatServer | null,
): ReadonlyArray<ChatServer> => [
  ...handing.map((server): ChatServer => ({
    name: server.name,
    where: whereOf(server),
    // HANDED, never `connected`, and this is the layering in one line: olai
    // knows it gave the server to the session and cannot know the session took
    // it. Only an agent's own word moves a row past here ({@link movedBy}).
    standing: { kind: "handed" },
  })),
  ...missing === null ? [] : [missing],
]

/** Where one handed server is, out of the entry the session was given. The two
 *  transports olai hands over spell it differently — a URL for the route on
 *  this process's own listener, an absolute path for somebody else's program on
 *  this host — and an entry of a shape this does not know answers `null`, which
 *  is the same "nothing to point at" the one pathless probe failure produces. */
const whereOf = (server: McpServer): string | null => {
  if ("url" in server && typeof server.url === "string") return server.url
  if ("command" in server && typeof server.command === "string") return server.command
  return null
}

/**
 * ... and the roster as the AGENT's own report leaves it — or `null` when that
 * report moved nothing.
 *
 * `null` for "nothing moved" because this is asked on every message an agent
 * forwards, and the Claude Code adapter forwards one per TURN: a conversation
 * whose servers are all fine would otherwise republish an identical roster to
 * every open tab for the life of the session. It is the same shape
 * {@link ./agent.ts} already reads the live model through, for the same reason.
 *
 * WHAT MOVES, and what deliberately does not:
 *
 *   - **a handed row the agent named** takes the agent's answer. `connected` is
 *     recognised positively and everything else becomes `unattached` carrying
 *     the agent's own word — a status set that grows on somebody else's release
 *     schedule may not be a set this file claims to know.
 *   - **a handed row the agent did NOT name** keeps the standing it had. An
 *     agent naming some of its servers has said nothing about the others, and
 *     reading silence as a downgrade would make a row flicker on every message
 *     that happened to be shorter than the last.
 *   - **a `missing` row is never touched**, whatever the agent says. That row
 *     is olai's own probe's finding about a server it did NOT hand over, so an
 *     agent reporting a server of that name is reporting its OWN — a `kolu` out
 *     of somebody's `~/.claude.json`, not the one this host's padi would not
 *     answer for. Letting it overwrite the probe would turn the one failure
 *     #140 exists to show back into a tick.
 *   - **a server the agent names that olai never handed** adds no row, and
 *     this is the layer's boundary rather than an oversight. The agent's own
 *     MCP servers are configured where olai cannot see, are told to us at most
 *     once per turn by an agent free to reconnect one in between, and are
 *     absent entirely from the other leg — so a row for one is a row that
 *     could never be kept honest, on one agent only. The panel says "plus the
 *     agent's own" instead, which is true of every agent and stays true.
 *
 * @param roster the conversation's roster as it stands
 * @param said what the agent reported, by name
 */
export const movedBy = (
  roster: ReadonlyArray<ChatServer>,
  said: ReadonlyArray<Attached>,
): ReadonlyArray<ChatServer> | null => {
  let moved = false
  const next = roster.map((server): ChatServer => {
    if (server.standing.kind === "missing") return server
    const reported = said.find((one) => one.name === server.name)
    if (reported === undefined) return server
    const standing: ServerStanding = reported.status === CONNECTED
      ? { kind: "connected" }
      // The agent's own word, quoted rather than translated — the same rule
      // #140's four probe sentences follow, and the reason a reader can act on
      // `needs-auth` (sign the server in) differently from `failed` (it broke).
      : { kind: "unattached", why: `the agent did not attach it: ${reported.status}` }
    if (same(server.standing, standing)) return server
    moved = true
    return { ...server, standing }
  })
  return moved ? next : null
}

/** Whether two standings say the same thing — the whole of what "this report
 *  moved nothing" means, over a union whose arms carry at most one field. */
const same = (before: ServerStanding, after: ServerStanding): boolean =>
  before.kind === after.kind
  && ("why" in before ? before.why : null) === ("why" in after ? after.why : null)
