/**
 * WHO IS TALKING, and where a run of theirs BEGINS — the rule behind the faces
 * down the left of the transcript.
 *
 * A conversation has three parties now. A person types into it; an agent
 * answers; and a plugin may put a machine's sentence into the same lane
 * (`@olai/surface`'s `UserEntry.rang`, drawn by {@link ./Rang.tsx}). Until this
 * module the panel said which of them had spoken by the SHAPE of a row alone —
 * a right-hand accent bubble, a full-width paragraph, a full-width paragraph
 * with an edge — which is a vocabulary a reader has to learn and then hold
 * while they read. A face is the answer people already know how to read, and it
 * is the answer to a question asked several times a conversation.
 *
 * ## Why the rule is a module and not a `switch` inside the drawing
 *
 * {@link ./face.ts}'s reason, word for word. Every way of getting this wrong
 * puts SOMEBODY ELSE'S face over a sentence — the person's mark on a plugin's
 * doorbell, an agent's on a person's own words — which is the one class of
 * mistake a transcript may not make, and checking it should not require a
 * browser and a plugin ringing a real doorbell.
 *
 * ## A RUN, not a row — why the answer takes two entries
 *
 * The face is drawn where a speaker's run of rows BEGINS and not on every row,
 * which is how chat has been drawn since chat was drawn: an agent's answer that
 * is a paragraph, four tool calls and another paragraph is one turn by one
 * party, and five copies of its mark is five claims where there was one fact.
 * So the question is not "whose is this row" but "is this row the first of
 * theirs", and that needs the row ABOVE.
 *
 * The row above is the IMMEDIATE one, which is what the list can cheaply hand
 * over ({@link ./Transcript.tsx} already keeps that map for the lanes, and
 * already holds a memo per row over the entry it names). A walk backwards to
 * the nearest row that HAS a speaker would be the other shape, and it would
 * make one row's face a function of an unbounded stretch of the list — the
 * thing that memo exists to avoid.
 *
 * Nothing is lost by the local answer, because the second half of the rule is
 * what makes it total: everything the agent's machinery emits is attributed to
 * the AGENT ({@link speakerOf}), so a paragraph after four tool calls is still
 * inside the agent's run and draws no second face.
 *
 * ## Why an unattributed row BREAKS a run rather than being transparent
 *
 * A refusal and a notice are the panel's own words about the conversation
 * rather than anybody's turn in it, so they wear no face. They could either be
 * invisible to the run or end it, and they end it: they are drawn as a line
 * across the column, they are rare, and a reader who has just been told
 * something by the app is a reader for whom the next speaker is worth naming
 * again. Transparent is also the shape that can be WRONG — a notice between a
 * person's message and an agent's answer would have joined two different
 * parties' rows into one run — where ending it is only ever one extra face.
 */

import type { ChatEntry } from "olai-plugin-chat/wire"
/**
 * One of the three parties, as a value.
 *
 * The plugin carries its NAME because a conversation two plugins can reach is
 * one that has to say which rang; the agent carries nothing, because which
 * agent a conversation is with is a fact about the SESSION rather than about a
 * row, and the row does not hold it. The person carries nothing for the same
 * reason and one further one: who is looking is a fact about the CONNECTION
 * (`../who/asking.ts`), and a login copied onto a row would be a second answer
 * to it, free to disagree with the header's.
 */
export type Speaker =
  | { readonly of: "human" }
  | { readonly of: "agent" }
  | { readonly of: "plugin"; readonly name: string }

/**
 * Whose row this is, or `null` for one that is nobody's turn.
 *
 * SIX KINDS, THREE ANSWERS, and the mapping is the whole of the claim:
 *
 *   - a `user` row is a person's, UNLESS it carries the mark that says a
 *     machine put it there — the mark is the only thing that tells the two
 *     apart, which is exactly why {@link ./Rang.tsx} exists;
 *   - `agent`, `tool` and `ask` are all the AGENT: its prose, the calls it
 *     made, and the questions it stopped to ask. A tool row is not a fourth
 *     party — nothing called it but the agent — and treating it as one is what
 *     would put a face on every third row of a working turn;
 *   - `refusal` and `notice` are the PANEL's own words about the conversation,
 *     which is nobody's turn in it. A face over them would be attributing the
 *     app's sentence to whoever it happened to be about.
 *
 * A row that is not there at all (a key whose value has not landed yet, which
 * is an ordinary tick of this list) is nobody's too, and is answered rather
 * than guarded against at each call site.
 */
export const speakerOf = (entry: ChatEntry | undefined): Speaker | null => {
  if (entry === undefined) return null
  switch (entry.kind) {
    case "user":
      return entry.rang === undefined ? { of: "human" } : { of: "plugin", name: entry.rang }
    case "agent":
    case "tool":
    case "ask":
      return { of: "agent" }
    case "refusal":
    case "notice":
      return null
  }
}

/**
 * Are these two the same party — with `null` (nobody) never equal to anybody,
 * itself included.
 *
 * That last is the asymmetry worth stating: two notices in a row are not "the
 * same speaker twice", they are two rows nobody is speaking in, and the
 * question this answers is only ever asked to decide whether a face is owed.
 */
export const sameSpeaker = (one: Speaker | null, other: Speaker | null): boolean => {
  if (one === null || other === null) return false
  if (one.of !== other.of) return false
  return one.of !== "plugin" || other.of !== "plugin" || one.name === other.name
}

/**
 * The face this row is owed, or `null` — which is the whole of what the drawing
 * needs and is why this, rather than {@link speakerOf}, is what the list hands
 * down.
 *
 * One function rather than the list asking two questions and comparing them
 * itself: "does this row open a run" is the rule, and a caller that had to
 * remember to compare against the row above is a caller that can forget.
 */
export const facedAt = (
  entry: ChatEntry | undefined,
  above: ChatEntry | undefined,
): Speaker | null => {
  const speaker = speakerOf(entry)
  if (speaker === null) return null
  return sameSpeaker(speaker, speakerOf(above)) ? null : speaker
}

/**
 * Whether this party's words are drawn on the RIGHT — which is the person's
 * alone, and is the panel's oldest distinction ({@link ./Entry.tsx}'s
 * `MINE_COLUMN`): a right-hand accent bubble means *you said this*, and nothing
 * else in the column may wear it.
 *
 * It is here rather than in the drawing because it is a fact about the SPEAKER
 * and two components now need it — the bubble, and the face over the run that
 * has to sit on the same side as the words it names. Two spellings of "the
 * human is on the right" is how a mark ends up on the far side of the message
 * it belongs to.
 */
export const onTheRight = (speaker: Speaker): boolean => speaker.of === "human"
