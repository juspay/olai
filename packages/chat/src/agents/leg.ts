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
}

/** What a leg says about a call that SPAWNED an agent — structural rather than
 *  `@olai/surface`'s `Spawned`, which is what the caller assigns it to:
 *  everything here is a pure function over a payload and none of them knows
 *  what a transcript is. */
export interface Spawn {
  readonly kind?: string
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
   * The PROGRAMMATIC name of the tool a frame is about, or `null` when nothing
   * on this frame says.
   *
   * The question the fail-safe rule turns on, and the reason it is answered per
   * agent: `session/request_permission` describes the call it is about with a
   * DISPLAY title, and "which tool is this" is what the answer depends on. One
   * agent stamps the name in a `_meta`; another puts it at the head of the call
   * id. An agent that does neither says `null`, and a call nobody named is a
   * call a person is asked about.
   *
   * @param meta the frame's `_meta`, if it had one
   * @param toolCallId the call's own id, which is a name on some wires
   */
  readonly toolName: (meta: Meta, toolCallId: string) => string | null

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
