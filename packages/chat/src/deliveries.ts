/**
 * WHAT A DOORBELL SAID THAT IS NOT AT THE AGENT YET — the held bodies, in
 * arrival order, per conversation.
 *
 * A plugin can put a sentence into a conversation ({@link ../../plugins/src/plugin.ts}'s
 * `Deliveries`), and there are two moments at which core cannot hand one over:
 * a turn is running, or nobody is in that conversation at all. This module is
 * what core holds in between, and it is the whole of what core holds — the
 * decision about WHICH of the three arms a body takes is {@link ./chat.ts}'s
 * `offer`, and it is taken under two permits this file knows nothing about.
 *
 * ## Why holding is not the queue that was deleted
 *
 * {@link ./chat.ts}'s header is emphatic that this file keeps no queue: a
 * mid-turn prompt went into an array, waited for the turn to end, and was
 * thrown away by the next cancel, destroying USER WORDS with no copy anywhere
 * (#194). That argument is about words a person typed and has no second copy
 * of. A doorbell body is a MACHINE'S DERIVATION of state that is still true: it
 * was composed from what the plugin can see right now, and a plugin whose
 * subject is still in that state derives it again on its next tick. So the
 * words here are re-creatable where a person's are not, and the reason the
 * queue had to go does not reach them.
 *
 * What IS the same is the cost of getting it wrong, which is why the two caps
 * below are counts and not policies: a conversation nobody opens for a week
 * must not grow an unbounded array of sentences nobody will read.
 *
 * ## Replace IN PLACE, and never append-and-drop
 *
 * A plugin that sends a fresh whole sentence per event and marks them with one
 * {@link Holding.hold} key gets ONE held body — the newest — sitting where the
 * FIRST one sat. Keeping the position is what makes arrival order survive the
 * replacing: a doorbell that re-derived its digest three times would otherwise
 * walk to the end of the list and be read after a wake that arrived before it.
 *
 * The key is the plugin's own word paired with the plugin, never the word
 * alone. Two plugins that both call their coalescing key `digest` are two
 * plugins with two subjects, and one silently swallowing the other's sentence
 * is the bug this pairing is the absence of. A body sent with NO key gets a
 * fresh unique one, so it never replaces and is never replaced — a real arm,
 * and one no doorbell takes today: kolu keys BOTH its meanings, because each
 * of its bodies is a fresh derivation of everything standing under that
 * meaning rather than an account of one event, so replacing is lossless and
 * arriving five times over is the thing worth avoiding. The no-key arm is for
 * a sentence that is about a moment and cannot be re-derived.
 *
 * ## Memory only, and it says so here rather than only in the PR
 *
 * Nothing in this module reaches a disk. The picks a person made are written
 * down ({@link ./scopes.ts}); the sentences are not. A serve that restarts
 * comes back holding nothing, which is honest and is not a loss: whatever
 * derived these bodies re-observes its own subject and rings again.
 *
 * ## Its own module, for {@link ./turns.ts}'s reason
 *
 * Every rule above is reachable through the real thing only by starting a
 * subprocess, holding a turn open and having a plugin ring — so the rules live
 * where a test can call them, which is the argument `turns.ts`, `questions.ts`
 * and `calls.ts` already make for the small state machines beside them.
 */

/**
 * WHICH CONVERSATION — the pair, because a session id means nothing to the
 * wrong agent.
 *
 * Core's own identity for a conversation, spelled the way {@link ./memory.ts}
 * and `@olai/surface`'s `SessionInfo` already spell it rather than minted a
 * second time.
 */
export interface Addressed {
  readonly agent: string
  readonly session: string
}

/**
 * One body waiting, and whose door it came through.
 *
 * `under` is the COALESCE IDENTITY rather than the plugin's own word: see the
 * header for why the two are not the same thing. It is opaque to every reader
 * — the only question anybody asks of it is whether two slots share it.
 */
export interface Slot {
  /** The plugin's `name`, as data — what the row is marked with when this body
   *  is handed over ({@link ../../surface/src/chat.ts}'s `rang`). */
  readonly from: string
  readonly body: string
  readonly under: string
}

/**
 * How many bodies ONE plugin may have waiting for ONE conversation before the
 * oldest is dropped.
 *
 * A count and not a byte budget, because what a body costs is the plugin's
 * business and what this end can honestly bound is how many of them it is
 * holding. Thirty-two is far past the number a coalescing plugin ever reaches
 * — a plugin that keys its sentences holds exactly one — so the cap only ever
 * bites on a plugin that is ringing without one, which is the case worth
 * bounding.
 *
 * NO ELISION LINE when it bites. Saying "and 4 more" would be core composing a
 * sentence, which is the one thing the doorbell's whole shape refuses
 * ({@link ./probes.ts}: core displays a sentence and never composes one).
 */
export const SLOTS = 32

/**
 * ... and how many CONVERSATIONS are held for at all.
 *
 * The other unbounded axis: a plugin scoped to conversations a person has long
 * since stopped opening would otherwise grow one list per conversation for the
 * life of the process. Evicted least-recently-held-for, which is the same rule
 * {@link ./scopes.ts} evicts a pick by and for the same reason — membership of
 * an agent's session list is not proof of anything, so the only safe eviction
 * is the one that costs no probe.
 */
const CONVERSATIONS = 32

/**
 * THE HELD BODIES — put one in, read what is waiting, take what was handed
 * over.
 *
 * Five verbs and no `flush`: draining is a DECISION about a live agent and a
 * running turn, and it belongs where those are known. What this holds is a
 * list, and the only thing it decides is where a body goes in it.
 */
export interface Holding {
  /**
   * One more body for that conversation — appended, or REPLACING IN PLACE the
   * one already there under the same key.
   *
   * `coalesce` is the plugin's own word or nothing at all; the identity it is
   * turned into is this module's (see the header).
   */
  readonly hold: (
    to: Addressed,
    from: string,
    body: string,
    coalesce: string | undefined,
  ) => void
  /**
   * What is waiting for that conversation, oldest first.
   *
   * The array is the CALLER'S to hand back to {@link Holding.took} verbatim.
   * That is what makes a flush safe against a body arriving while it is on the
   * wire: what is taken is exactly what was offered, by identity, so a slot
   * that appeared in between stays.
   */
  readonly waiting: (to: Addressed) => ReadonlyArray<Slot>
  /** ... and those ones landed, so they stop waiting. Slots that are no longer
   *  there — a coalescing replace that overtook the flush — are silently not
   *  removed twice. */
  readonly took: (to: Addressed, taken: ReadonlyArray<Slot>) => void
  /**
   * ... AND THAT PLUGIN'S DOORBELL WAS TURNED OFF, so what it is holding for
   * that conversation stops waiting.
   *
   * The one verb here that throws words away, and it is owed. A doorbell is
   * off until a person picks and off again the moment they clear, and a
   * message that arrived after the clear because it had been queued before it
   * would be the control lying about itself — the strip says `off` while a
   * sentence it disowns is still on its way in. `hold` and `took` cannot cover
   * this between them: the bodies are not at the agent, so there is nothing to
   * have landed, and nothing else ever consults the scope.
   *
   * NOTHING IS LOST BY IT, which is why dropping is honest here where it would
   * not be for words a person typed. A held body is a fresh derivation of what
   * is standing right now ({@link ./chat.ts}'s `deliverTo`), so a person who
   * picks the file again gets the next derivation, which says everything this
   * one would have said.
   */
  readonly dropped: (to: Addressed, from: string) => void
  /** How many bodies each plugin has waiting for that conversation — the
   *  numeral the strip draws, and the only thing core supplies about it
   *  (`@olai/surface`'s `Wake.waiting`). */
  readonly counts: (to: Addressed) => ReadonlyMap<string, number>
}

/** The map key. One string rather than a nested map, because every question
 *  here is asked about the whole pair and never about an agent's conversations
 *  as a group. ` ` cannot occur in either half. */
const keyOf = (to: Addressed): string => `${to.agent} ${to.session}`

export const holding = (): Holding => {
  /** Insertion-ordered, which is what makes the conversation cap's eviction a
   *  read of the map rather than a second table of timestamps. */
  const held = new Map<string, Array<Slot>>()
  /** What a body with no coalesce key is filed under — unique, so it never
   *  replaces and is never replaced. */
  let minted = 0

  /** That conversation's list, made and MOVED TO THE END: holding for a
   *  conversation is the touch the cap's eviction order is about. */
  const listFor = (key: string): Array<Slot> => {
    const already = held.get(key)
    if (already !== undefined) {
      held.delete(key)
      held.set(key, already)
      return already
    }
    const fresh: Array<Slot> = []
    held.set(key, fresh)
    // The OLDEST conversation goes, which with the re-insertion above is the
    // one held for longest ago. A `Map` iterates in insertion order, so the
    // first key is that one.
    while (held.size > CONVERSATIONS) {
      const oldest = held.keys().next().value
      if (oldest === undefined) break
      held.delete(oldest)
    }
    return fresh
  }

  return {
    hold: (to, from, body, coalesce) => {
      const under = coalesce === undefined
        ? ` ${++minted}`
        : `${from} ${coalesce}`
      const slots = listFor(keyOf(to))
      const at = slots.findIndex((slot) => slot.under === under)
      const slot: Slot = { from, body, under }
      // IN PLACE, which is the whole of the coalescing rule: the newest words
      // land where the first ones under this key landed, so a plugin that
      // re-derives its sentence does not walk to the back of the queue.
      if (at !== -1) {
        slots[at] = slot
        return
      }
      slots.push(slot)
      // ... and the cap is per PLUGIN, because two plugins ringing one
      // conversation are two subjects and one must not evict the other's
      // words. The oldest of this plugin's own goes.
      let mine = 0
      for (const one of slots) if (one.from === from) mine++
      if (mine <= SLOTS) return
      const drop = slots.findIndex((one) => one.from === from)
      if (drop !== -1) slots.splice(drop, 1)
    },
    // A COPY. The list behind this is the one `hold` mutates in place, so a
    // caller that kept the result across an await and handed it back would be
    // handing back whatever landed in between — and `took`'s identity filter
    // would take the very slots it exists to leave alone.
    waiting: (to) => [...(held.get(keyOf(to)) ?? [])],
    took: (to, taken) => {
      const key = keyOf(to)
      const slots = held.get(key)
      if (slots === undefined) return
      // BY IDENTITY rather than by index or by key: a coalescing replace that
      // landed while the flush was on the wire wrote a NEW slot object into
      // that position, and taking it would drop words nobody ever saw.
      const left = slots.filter((slot) => !taken.includes(slot))
      if (left.length === 0) {
        held.delete(key)
        return
      }
      held.set(key, left)
    },
    dropped: (to, from) => {
      const key = keyOf(to)
      const slots = held.get(key)
      if (slots === undefined) return
      // ONLY THAT PLUGIN'S. A conversation may have two doorbells on it and
      // clearing one says nothing about the other — which is the same reason
      // the cap above is per plugin.
      const left = slots.filter((slot) => slot.from !== from)
      if (left.length === 0) {
        held.delete(key)
        return
      }
      held.set(key, left)
    },
    counts: (to) => {
      const counted = new Map<string, number>()
      for (const slot of held.get(keyOf(to)) ?? []) {
        counted.set(slot.from, (counted.get(slot.from) ?? 0) + 1)
      }
      return counted
    },
  }
}

/**
 * THE BODIES, AS ONE MESSAGE — whole paragraphs with a blank line between
 * them, in the order they arrived.
 *
 * The same rule {@link ./prompt.ts}'s `annotated` keeps one message over, and
 * for its reason: core joins whole authored paragraphs and composes none. There
 * is no lead-in, no count, no "3 events" — every word a person reads here is a
 * word the plugin wrote, which is what {@link ./probes.ts}' rule means when the
 * thing being displayed is several sentences instead of one.
 */
export const joined = (slots: ReadonlyArray<Slot>): string =>
  slots.map((slot) => slot.body).join("\n\n")
