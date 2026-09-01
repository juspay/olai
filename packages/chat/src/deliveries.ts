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
 * The key is MATCHED AS A PAIR — the plugin, and the plugin's own word — and
 * never as the word alone. Two plugins that both call their coalescing key
 * `digest` are two plugins with two subjects, and one silently swallowing the
 * other's sentence is the bug this pairing is the absence of. A body sent with
 * NO key is matched against nothing at all, so it never replaces and is never
 * replaced — a real arm, and one no doorbell takes today: kolu keys BOTH its
 * meanings, because each of its bodies is a fresh derivation of everything
 * standing under that meaning rather than an account of one event, so replacing
 * is lossless and arriving five times over is the thing worth avoiding. The
 * no-key arm is for a sentence that is about a moment and cannot be re-derived.
 *
 * IT USED TO BE A CONCATENATION. {@link Slot}'s `under` held the plugin's name,
 * a separator byte, and the plugin's word; a body with NO word was filed under
 * that same separator followed by a number off a counter, unique because the
 * separator cannot occur in a plugin's name. That is two spelling conventions —
 * a byte that must appear in neither half, and a leading one that means "never
 * matches" — propping up a property the data already has: `from` is a field of
 * every slot, so the pairing is a COMPARISON OF TWO FIELDS and needs no string
 * built for it to be true. The counter went with the concatenation, because
 * `undefined` matches nothing without anything having to be minted: no mutable
 * counter to wrap around, and no reader who has to know what a separator means
 * to see that two plugins' `digest`s cannot collide.
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
 * `under` is the PLUGIN'S OWN WORD, verbatim, and `undefined` for a body sent
 * without one. It is never asked about on its own: the only question anybody
 * asks is whether another body from the same {@link Slot.from} named the same
 * word, which is the pairing the header is about.
 */
export interface Slot {
  /** The plugin's `name`, as data — what the row is marked with when this body
   *  is handed over ({@link ../../surface/src/chat.ts}'s `rang`), and the half
   *  of the coalescing pair that keeps two plugins' `digest`s apart. */
  readonly from: string
  /** The plugin's words, asked for at the moment they go in — see
   *  `@olai/plugins`' `Deliveries.deliver` for why this is not a string. */
  readonly say: () => string | null
  readonly under: string | undefined
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
    say: () => string | null,
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
  /**
   * ... and those ones landed, so they stop waiting. Slots that are no longer
   * there — a coalescing replace that overtook the flush — are silently not
   * removed twice.
   *
   * BY IDENTITY rather than by index or by key: a coalescing replace that
   * landed while the flush was on the wire wrote a NEW slot object into that
   * position, and taking it would drop words nobody ever saw.
   */
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
   *
   * ONLY THAT PLUGIN'S. A conversation may have two doorbells on it and
   * clearing one says nothing about the other — which is the same reason
   * {@link SLOTS} is counted per plugin.
   */
  readonly dropped: (to: Addressed, from: string) => void
  /** How many bodies each plugin has waiting for that conversation — the
   *  numeral the strip draws, and the only thing core supplies about it
   *  (`@olai/surface`'s `Wake.waiting`). */
  readonly counts: (to: Addressed) => ReadonlyMap<string, number>
}

/** The map key. One string rather than a nested map, because every question
 *  here is asked about the whole pair and never about an agent's conversations
 *  as a group. `\0` cannot occur in either half, and it is written as an
 *  ESCAPE rather than as the byte: a literal NUL makes this file read as BINARY
 *  to review tooling, which is how a reviewer stops being able to see it. */
const keyOf = (to: Addressed): string => `${to.agent}\0${to.session}`

export const holding = (): Holding => {
  /** Insertion-ordered, which is what makes the conversation cap's eviction a
   *  read of the map rather than a second table of timestamps. */
  const held = new Map<string, Array<Slot>>()

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

  /**
   * THE SLOTS THAT PASS STAY, and a conversation left holding none stops being
   * held for at all — everything {@link Holding.took} and
   * {@link Holding.dropped} do apart from their one predicate.
   *
   * ## The eviction rule was written down twice
   *
   * Both verbs looked the list up, left if there was none, filtered it, and
   * then — the part worth having once — DELETED THE KEY when the filter left
   * nothing, so a conversation whose last body was taken stops occupying one of
   * the {@link CONVERSATIONS} the cap allows. Two copies of that rule is two
   * places to change it and one of them missed: a `took` that emptied a list
   * and left the key behind would fill the map with empty arrays and evict
   * conversations that really are holding something to make room for them.
   * Neither verb has an opinion about the rule, so neither is where it belongs.
   *
   * ## `set` on the key it already has, and never `delete` then `set`
   *
   * `held`'s insertion order IS the eviction order {@link listFor} maintains,
   * and `Map.set` on a key that is already present replaces the value while
   * keeping the position that key was first inserted at. That is exactly what
   * is wanted here: taking a body that landed, or dropping one a person
   * disowned, is not HOLDING for a conversation, so neither may count as the
   * touch that walks a conversation to the end of the queue and pushes an older
   * one out. `listFor` spells the move-to-the-end out because it means it.
   */
  const keeping = (to: Addressed, keep: (slot: Slot) => boolean): void => {
    const key = keyOf(to)
    const slots = held.get(key)
    if (slots === undefined) return
    const left = slots.filter(keep)
    if (left.length === 0) held.delete(key)
    else held.set(key, left)
  }

  return {
    hold: (to, from, say, coalesce) => {
      const slots = listFor(keyOf(to))
      // THE PAIR, compared rather than spelled: a body replaces one already
      // waiting only when the SAME plugin named the SAME word. A body sent with
      // no word is compared against nothing at all, so it never replaces and is
      // never replaced.
      const at = coalesce === undefined
        ? -1
        : slots.findIndex((slot) => slot.from === from && slot.under === coalesce)
      const slot: Slot = { from, say, under: coalesce }
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
    took: (to, taken) => keeping(to, (slot) => !taken.includes(slot)),
    dropped: (to, from) => keeping(to, (slot) => slot.from !== from),
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
 * THE BODIES, AS ONE MESSAGE — asked for NOW, and only the ones that still have
 * something to say.
 *
 * Each slot is asked at the moment the row is written, which is the whole point
 * of holding a thunk rather than a string (`@olai/plugins`' `Deliveries.deliver`
 * argues it): a body that waited through a turn is about a world that has had a
 * turn to move. A slot that answers `null` has lost its subject and is simply
 * not in the message; if none of them answers, there is no message, and
 * {@link ./chat.ts}'s flush writes no row at all rather than an empty one.
 *
 * Whole paragraphs with a blank line between them, in the order they arrived.
 * The same rule {@link ./prompt.ts}'s `annotated` keeps one message over, and
 * for its reason: core joins whole authored paragraphs and composes none. There
 * is no lead-in, no count, no "3 events" — every word a person reads here is a
 * word the plugin wrote.
 */
export const joined = (slots: ReadonlyArray<Slot>): string | null => {
  const said: Array<string> = []
  for (const slot of slots) {
    const words = slot.say()
    if (words !== null && words !== "") said.push(words)
  }
  return said.length === 0 ? null : said.join("\n\n")
}
