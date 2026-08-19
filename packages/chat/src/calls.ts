/**
 * What has been said about each tool call in this conversation.
 *
 * The protocol tells you a call's DISPLAY title and nothing else. Two things
 * this panel needs are said somewhere else entirely — in the agent-specific
 * `_meta` {@link ./interpret.ts} reads — and both are needed at a moment when
 * the frame that carried them has already gone past:
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
 * remembers both.
 *
 * TWO RULES, and they are the same rule at two scales, which is why both are
 * a spread:
 *
 *   - **a frame refines, never retracts.** The facts arrive across frames and
 *     each carries what it knows: a subagent's terminal output arrives with
 *     only the parent, a plan exit's with only the name, and a completion with
 *     neither. A row that read a completion's silence as "no agent now" would
 *     step out of its lane at the moment the call finished, which is the
 *     moment somebody looks.
 *   - **a request's own words win.** Where the adapter stamps the answer onto
 *     the question itself — which it does for a permission request and not for
 *     an elicitation — that is the most direct thing anybody said, and the
 *     remembered frame is the fallback rather than the other way round.
 *
 * Its own module for the reason {@link ./questions.ts} is: this is a small
 * state machine about a conversation rather than a fact about the protocol,
 * and the failure it prevents — a request answered from a stale frame, an
 * attribution taken back off a call — is one nobody can reach without starting
 * a subprocess and talking it into a fan-out. A rule worth being sure of is
 * one worth asserting over values.
 *
 * It knows nothing about ACP. What a `_meta` MEANS is `interpret.ts`'s, and
 * what to do with the answer is the caller's; this owns only the remembering.
 */

import { parentToolUseIn, toolNameIn } from "./interpret.ts"

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

/** Everything one `_meta` says about the call it rode in on. The two readings
 *  in one value, so a frame and a request contribute the same shape and the
 *  merges below are one operation rather than a field-by-field `??` per
 *  caller. */
const saidIn = (
  meta: { readonly [key: string]: unknown } | null | undefined,
): Said => {
  const name = toolNameIn(meta)
  const parent = parentToolUseIn(meta)
  return {
    ...(name === null ? {} : { name }),
    ...(parent === null ? {} : { parent }),
  }
}

/** Nothing said, which is what an unknown call and a bare `_meta` both come
 *  to. Frozen and shared: {@link Calls.about} answers one of these for most of
 *  the calls a conversation makes. */
const NOTHING: Said = Object.freeze({})

export class Calls {
  #said = new Map<string, Said>()

  /** A frame went past. What it said about its call is folded in; a frame that
   *  said nothing costs nothing and leaves no entry, so a conversation of
   *  ordinary calls keeps an empty map. */
  heard(
    id: string,
    meta: { readonly [key: string]: unknown } | null | undefined,
  ): void {
    const said = saidIn(meta)
    if (said.name === undefined && said.parent === undefined) return
    this.#said.set(id, { ...this.#said.get(id), ...said })
  }

  /**
   * Everything known about the call a REQUEST is about — its own words over
   * the remembered ones.
   *
   * The `_meta` is the request's, not a frame's, and the call may be `null`:
   * an elicitation scoped to a request rather than a session names none, and
   * asking about no call is answered rather than refused, because a question
   * that named nothing is an ordinary question the main agent asked.
   */
  about(
    id: string | null,
    meta: { readonly [key: string]: unknown } | null | undefined,
  ): Said {
    return { ...(id === null ? NOTHING : this.#said.get(id)), ...saidIn(meta) }
  }

  /** The conversation is over. A call id is only ever looked up inside the
   *  session that minted it, so keeping these would be every call the process
   *  had ever seen, held for the life of a server meant to run for weeks. */
  forget(): void {
    this.#said.clear()
  }
}
