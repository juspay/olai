/**
 * What has been said about each tool call in this conversation.
 *
 * The protocol tells you a call's DISPLAY title and nothing else. Two things
 * this panel needs are said somewhere else entirely — in whatever corner of a
 * frame this agent's leg reads them out of ({@link ./agents/leg.ts}) — and both
 * are needed at a moment when the frame that carried them has already gone
 * past:
 *
 *   - **which tool a call is**, programmatically. A permission request carries
 *     a title ("Ready to code?") and never a name, and the name is what stops
 *     this panel approving its own permissions.
 *   - **which agent made it**. A subagent's question reaches olai on the one
 *     feed everything else does, and a form drawn without this is drawn in the
 *     main agent's voice.
 *
 * The adapter answers both the same way and it is the reason this is ONE
 * module rather than two maps: it announces the call before it asks about it
 * (`ensureToolCallEmitted`), and a notification and a request travel the same
 * pipe in order — so by the time either question is put, the answer has
 * already been said on a frame. One frame answers both, so one thing
 * remembers both. It is true of the other agent too, for its own reason: an
 * opencode permission request names the call it is about by the same id the
 * announcement carried, and that id is where the tool's name is
 * ({@link ./agents/opencode.ts}).
 *
 * ONE RULE: **a frame refines, never retracts.** The facts arrive across
 * frames and each carries what it knows — a subagent's terminal output arrives
 * with only the parent, a plan exit's with only the name, and a completion
 * with neither. A row that read a completion's silence as "no agent now" would
 * step out of its lane at the moment the call finished, which is the moment
 * somebody looks. So a merge is a spread, and an absent field is "nothing has
 * said yet" rather than "nobody will".
 *
 * A QUESTION WITH WORDS OF ITS OWN is not a second rule. A permission request
 * carries the adapter's stamp on the tool call it is about, in the shape every
 * frame carries it — so it is FOLDED IN like one, and reading it is the
 * ordinary lookup. Precedence falls out (the last frame in wins, and the
 * request is the last) rather than being a second thing a caller has to
 * apply in the right order; and what the request said stays known, for the
 * next question about the same call.
 *
 * Its own module for the reason {@link ./questions.ts} is: this is a small
 * state machine about a conversation rather than a fact about the protocol,
 * and the failure it prevents — a request answered from a stale frame, an
 * attribution taken back off a call — is one nobody can reach without starting
 * a subprocess and talking it into a fan-out. A rule worth being sure of is
 * one worth asserting over values.
 *
 * It knows nothing about ACP. What a frame MEANS is the LEG's
 * ({@link ./agents/leg.ts}) — handed in at construction, because which agent
 * this conversation is with is decided per conversation now — and what to do
 * with the answer is the caller's; this owns only the remembering.
 */

import type { Leg, Meta } from "./agents/leg.ts"

/**
 * What is known about one call.
 *
 * Both fields OPTIONAL, and that is the shape carrying the rule rather than a
 * comment reminding somebody of it: absent means "nothing has said yet", which
 * is what makes a spread the whole of the merge. `null` would make "nobody
 * said" a value a later frame could assert, and the first frame to say only
 * half of what it knows would take the other half back.
 */
export interface Said {
  /** Which tool it is, programmatically — never the display title. */
  readonly name?: string
  /** The `Agent` call it was made INSIDE, by the id it arrived as, when a
   *  subagent made it. */
  readonly parent?: string
}

/** Nothing said, which is what a frame with no adapter corner in it and a call
 *  nobody has mentioned both come to. Frozen and SHARED, because it is the
 *  answer for most frames a conversation carries: the ordinary tool call says
 *  neither of these things, and {@link heard} runs on every one of them. */
const NOTHING: Said = Object.freeze({})

/** Everything ONE FRAME says about the call it rode in on. The two readings in
 *  one value, so a frame and a request contribute the same shape and the merges
 *  below are one operation rather than a field-by-field `??` per caller — and
 *  {@link NOTHING} rather than a fresh empty when it says neither, so a frame
 *  nothing is read from costs nothing to read.
 *
 *  The CALL ID is read as well as the `_meta`, because on one of the two wires
 *  it is where the name is: opencode sends no `_meta` at all and puts the
 *  tool's name at the head of the id. Which of them a leg reads is the leg's;
 *  what arrives here is a frame, whole. */
const saidIn = (leg: Leg, id: string, meta: Meta): Said => {
  const name = leg.toolName(meta, id)
  const parent = leg.parentToolUse(meta)
  if (name === null && parent === null) return NOTHING
  return {
    ...(name === null ? {} : { name }),
    ...(parent === null ? {} : { parent }),
  }
}

export class Calls {
  #said = new Map<string, Said>()
  readonly #leg: Leg

  constructor(leg: Leg) {
    this.#leg = leg
  }

  /** A frame went past. What it said about its call is folded in; a frame that
   *  said nothing leaves no entry and allocates nothing, so a conversation of
   *  ordinary calls keeps an empty map — which is nearly every conversation,
   *  and this runs on every frame of all of them. */
  heard(id: string, meta: Meta): void {
    const said = saidIn(this.#leg, id, meta)
    if (said === NOTHING) return
    this.#said.set(id, { ...this.#said.get(id), ...said })
  }

  /**
   * Everything said about one call so far.
   *
   * A LOOKUP and nothing else. A question that arrives with words of its own
   * about its call — which a permission request does — hands them to
   * {@link heard} first, because they are another frame about that call and
   * not a second kind of source; so there is one rule here rather than a
   * precedence a caller could get backwards, and what a request said is
   * remembered for the next question about the same call instead of being
   * thrown away.
   *
   * The call may be `null`: a form elicitation may be scoped to a REQUEST
   * rather than to a session, and one an MCP server sends may name no call.
   * That is answered rather than refused — a question that named nothing is an
   * ordinary question the main agent asked.
   */
  about(id: string | null): Said {
    return (id === null ? undefined : this.#said.get(id)) ?? NOTHING
  }

  /** The conversation is over. A call id is only ever looked up inside the
   *  session that minted it, so keeping these would be every call the process
   *  had ever seen, held for the life of a server meant to run for weeks. */
  forget(): void {
    this.#said.clear()
  }
}
