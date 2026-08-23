/**
 * WHAT AN AGENT MEANS by what it sends — as one interface, with one
 * implementation per agent olai knows how to talk to.
 *
 * The protocol proper is read where it is spoken ({@link ../agent.ts} and
 * `@olai/acp`). What is read HERE is everything that is only true of ONE agent:
 * a `_meta` extension one adapter writes, a tool-naming convention one CLI
 * uses, a permission mode one of them has and the other refuses, a steering
 * method that exists on one wire and not the other. Before there were two
 * agents this was a file called `interpret.ts` and the bets were simply the
 * Claude Code adapter's; the file is still here ({@link ./claude.ts}, meaning
 * unchanged) and it now answers to a shape instead of being the shape.
 *
 * THE RULE THAT SURVIVES THE SPLIT, and the one a reviewer should check every
 * new leg against: **every bet is safe to lose in one direction only, and that
 * is the direction it loses in.** An agent that says none of this matches
 * nothing, and what happens then is that a person is asked. **Nothing is ever
 * approved by failing to recognise it.** A leg that answered a tool name it had
 * not positively recognised, or an allow-option for a tool it could not name,
 * would be approving somebody's permissions on their behalf — which is the one
 * failure in this package that is not recoverable by pressing something.
 *
 * EVERY MEMBER IS A PURE FUNCTION OR A CONSTANT, for the reason the old file
 * gave: the rule that stops this panel approving its own permissions is a
 * function with unit tests rather than a branch reachable only by starting a
 * subprocess and talking it into asking.
 *
 * WHAT IS NOT HERE is anything the PROTOCOL carries for everybody — a content
 * block, a usage report, a diff — which is `@olai/acp`'s, and anything a leg
 * would have to KNOW ABOUT A CONVERSATION to answer, which is the caller's.
 * Which side of the boundary a new reader belongs on is not which payload it
 * reads but WHO has to have sent it.
 */

import type { PermissionOption } from "@agentclientprotocol/sdk"
import type { Duration } from "effect"


/** A `_meta`, as every reader here takes one: an object of unknown fields, or
 *  nothing at all. Spelled once because five signatures below take it. */
export type Meta = { readonly [key: string]: unknown } | null | undefined

/**
 * How a message reaches a turn that is ALREADY RUNNING, for an agent that has
 * a way — or `null` for one that has none.
 *
 * `null` is not a degradation olai hides. An agent without steering takes a
 * mid-turn message as an ordinary prompt and reaches it when the running turn
 * is over, which is a real difference in what saying something now BUYS you —
 * so the composer says it ({@link ../../../web/src/client/chat/Composer.tsx}),
 * rather than the panel looking identical and behaving differently.
 */
export interface Steering {
  /** The method that carries it. An EXTENSION on every wire that has one,
   *  hence the leading underscore. */
  readonly method: string
  /** The request's own `_meta`, or `undefined` for a wire that wants none. */
  readonly meta: unknown
  /** How long it may go unanswered before the words go back to the person who
   *  typed them. Its warrant is a claim about this extension rather than about
   *  a pipe, which is why it is a property of the leg. */
  readonly timeout: Duration.Input
  /** Whether the answer says the message went INTO the running turn. Read
   *  POSITIVELY: anything unrecognised is NOT taken, which sends the message
   *  again as an ordinary prompt. The worst case of that is a message the agent
   *  hears twice; the worst case of reading an unknown outcome as taken is a
   *  message nobody has. */
  readonly taken: (answered: unknown) => boolean
}

/** What a session's opening call asks the agent to forward, and where the
 *  answer arrives — for an agent that has such a channel, and `null` for one
 *  that does not. */
export interface RawMessages {
  /** The `_meta` to send with `session/new` and `session/load`. */
  readonly openMeta: { readonly [key: string]: unknown }
  /** The notification the agent forwards under. */
  readonly method: string
  /** The model a turn is RUNNING on, out of one of those messages, or `null`
   *  for a message that says nothing about one. */
  readonly modelIn: (params: unknown) => string | null
  /**
   * What the agent says about ITS OWN CONNECTIONS to the MCP servers of this
   * conversation, out of one of those messages — or `null` for a message that
   * says nothing about them, which is nearly all of them.
   *
   * THE ONE FACT THE PROTOCOL HAS NO PLACE FOR, which is why it is worth
   * reading off an agent's private channel at all. `session/new` takes a list
   * of servers and answers with a session id: whether the agent reached any of
   * them is never on the wire, and #140 could only ever report the failures
   * olai's own probe found before handing anything over. An agent that
   * volunteers the other half is one whose panel can stop guessing.
   *
   * `null` — including on an agent that forwards messages but says nothing per
   * server — leaves every row where olai put it, which is an honest "handed
   * over; nobody has said what became of it" rather than a claim in either
   * direction ({@link ../servers.ts}).
   */
  readonly serversIn: (params: unknown) => ReadonlyArray<Attached> | null
}

/**
 * The auto-allow rule, in one place, over the one thing that differs.
 *
 * POSITIVE RECOGNITION and nothing else: the tool is named, the name belongs to
 * one of the MCP servers WE handed this session, and the request offers an
 * allow-flavoured option — or a person is asked. What differs between agents is
 * only the SPELLING each gives the tools an MCP server contributes
 * (`mcp__<server>__<tool>` on one wire, `<server>_<tool>` on the other), so the
 * spelling is the argument and the rule is written once. Written twice, the one
 * rule this package declares un-widenable would have to be tightened twice —
 * and could silently be tightened once.
 *
 * ALLOW-FLAVOURED, NEVER FIRST, and that is the half that has to be shared:
 * opencode's options are allow-first (`allow_once`, `allow_always`,
 * `reject_once`) where the Claude adapter's ordinary list leads with the
 * refusal, so a client that took "the first option" would deny every one of
 * olai's own tools on one wire and approve somebody's plan-mode exit on the
 * other. One rule, read off the option's own `kind`, is right on both.
 *
 * @param spelling what this agent calls the tools of the server named
 */
export const allowingOurs = (
  spelling: (server: string) => string,
): Leg["allowedWithoutAsking"] =>
(tool, given, options) => {
  const ours = tool !== null && given.some((server) => tool.startsWith(spelling(server)))
  if (!ours) return null
  return options.find((option) => option.kind.startsWith("allow"))?.optionId ?? null
}

/** What a leg says about a call that SPAWNED an agent — structural rather than
 *  `@olai/surface`'s `Spawned`, which is what the caller assigns it to:
 *  everything here is a pure function over a payload and none of them knows
 *  what a transcript is. */
export interface Spawn {
  readonly kind?: string
}

/**
 * What a leg says an agent said about one of ITS OWN connections to an MCP
 * server: the server's name, and the agent's own word for how it stands.
 *
 * Here beside {@link Spawn} and for its reason: this is a payload reading, and
 * what {@link ../servers.ts} then makes of it — a roster row, a standing, a
 * sentence — is a fact about a conversation that no leg may know. Declared the
 * other way round, the file that is only allowed to be wrong about one agent
 * would have been importing the panel's own vocabulary.
 *
 * The STATUS IS A STRING and deliberately not a vocabulary of ours. It is the
 * wrapped CLI's own field (`connected`, `failed`, `needs-auth`, `pending`,
 * `disabled` are the ones its binary carries today) and an open set that may
 * grow without asking anybody here — so it is carried verbatim, matched
 * positively against the one value that means yes, and shown to a person in
 * the agent's own spelling for everything else.
 */
export interface Attached {
  readonly name: string
  readonly status: string
}

/**
 * One agent's answers.
 *
 * A leg is DATA about how to read a wire, not a strategy that acts: nothing
 * here spawns, sends or remembers. {@link ./roster.ts} says which legs exist
 * and how to find their agents; {@link ../agent.ts} does the talking.
 */
export interface Leg {
  /**
   * The PROGRAMMATIC name of the tool, out of what a FRAME said — or `null`
   * when this agent says it somewhere else, or not at all.
   *
   * The question the fail-safe rule turns on, and the reason it is answered per
   * agent: `session/request_permission` describes the call it is about with a
   * DISPLAY title, and "which tool is this" is what the answer depends on. An
   * agent that answers neither this nor {@link Leg.toolNameOf} leaves every call
   * unnamed, and a call nobody named is a call a person is asked about.
   */
  readonly toolNameIn: (meta: Meta) => string | null

  /**
   * ... and out of the CALL ID, for a wire that puts it there.
   *
   * TWO READERS RATHER THAN ONE over both, and the split is not cosmetic: what
   * a frame said has to be REMEMBERED, because the frame is gone by the time a
   * permission request asks about its call ({@link ../calls.ts}), and what the
   * ID says never does — the id is the key that question arrives under. Asked
   * as one function over both, an agent that names its tools in the id made
   * every frame of every call look like news, and the registry that exists to
   * hold the rare thing wrote and held one entry per call for the life of a
   * session.
   */
  readonly toolNameOf: (toolCallId: string) => string | null

  /**
   * The option a permission request is answered with WITHOUT asking a person,
   * or `null` when it is a person's to answer.
   *
   * POSITIVE RECOGNITION, in every leg: the tool is named, the name is one of
   * the servers WE handed this session, and the request offers an
   * allow-flavoured option — or nothing is bypassed. What differs between legs
   * is only the SPELLING an agent gives the tools an MCP server contributes,
   * and a leg that matched more loosely than its agent's spelling would be
   * widening the one rule in this package that must not widen.
   *
   * @param tool the programmatic name of the tool, or `null` when nothing named
   *   it — a name we do not know is answered by ASKING
   * @param given the MCP servers this conversation was handed, by name
   * @param options the request's own options, in the agent's own order
   */
  readonly allowedWithoutAsking: (
    tool: string | null,
    given: ReadonlyArray<string>,
    options: ReadonlyArray<PermissionOption>,
  ) => string | null

  /** The `Agent`/`Task` call a frame's own call was made INSIDE, or `null` for
   *  a call the main agent made itself. An agent that carries no attribution
   *  answers `null` for everything, and its fan-outs render flat — the losing
   *  direction this can afford. */
  readonly parentToolUse: (meta: Meta) => string | null

  /** What this frame says about an agent this call STARTED, or `null` for a
   *  frame that says nothing about one — which is nearly all of them. */
  readonly spawned: (meta: Meta, input: unknown) => Spawn | null

  /** The permission mode to ask a fresh session for, or `null` for an agent
   *  that has none. A refusal is not a boot failure either way:
   *  {@link Leg.allowedWithoutAsking} is the backstop, and what a refusal costs
   *  is one round trip per tool call. */
  readonly bypassMode: string | null

  /** How a message reaches a running turn, or `null` when it cannot and queues
   *  instead — see {@link Steering}. */
  readonly steering: Steering | null

  /** The agent's own forwarded messages, or `null` for an agent that forwards
   *  none — see {@link RawMessages}. */
  readonly rawMessages: RawMessages | null
}
