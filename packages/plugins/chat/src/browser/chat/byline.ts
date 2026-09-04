/**
 * WHO A MACHINE'S SENTENCE SAYS IT IS FROM — read off the sentence itself,
 * because there is nowhere else honest to read it from.
 *
 * A `user` row a plugin rang (`@olai/surface`'s `UserEntry.rang`) is drawn with
 * a face of its own ({@link ./Entry.tsx}), and a face wants a name on it. This
 * module answers where the name comes from: the FIRST LINE OF THE BODY, which
 * the plugin wrote, and never a label this client composed.
 *
 * ## Why not core's own byline
 *
 * Because core's mark does not survive a replay. `@olai/plugin-api`'s `Deliveries.deliver`
 * says it in its own words and requires the body to CARRY its own attribution:
 * the browser is handed `rang` while the conversation is live, but
 * a conversation rebuilt from the agent's store comes back out of message
 * chunks that carry text and no keys. A byline this client minted from `rang`
 * would therefore be a byline that VANISHES the first time somebody resumes the
 * conversation, leaving a plugin's paragraph sitting unattributed in the lane a
 * person's own words go out on. The sentence has to carry the attribution, so
 * the attribution is drawn out of the sentence — one name on the row, authored
 * once, by the half that will still be there tomorrow.
 *
 * ## One rule, not two
 *
 * The byline is the first line; the body is everything after it, minus one
 * blank line if the plugin left one. kolu's bodies are a plain sentence saying
 * what happened, a blank line, then the account whose own first line names the
 * watcher that wrote it — so that arm is the ordinary one — but a body whose
 * second line is already prose splits the same way rather than falling through
 * to a special case. Two rules keyed on whether a blank line happens to
 * be there would be two answers to "where does the label end", free to
 * disagree about a body nobody anticipated.
 *
 * ## Nothing is ever invented
 *
 * A body with no newline in it, an empty first line, or nothing under the first
 * line comes back with NO byline and the whole text as body. The face then
 * draws without a label, which is the honest shape: the alternative is a panel
 * captioning a plugin's words with a name the plugin did not put there, and the
 * one thing a byline must not do is claim an attribution nobody wrote.
 *
 * A MODULE rather than a slice inside the component, for {@link ./face.ts}'s
 * reason: it is a rule about text, every way of getting it wrong is a person
 * reading the wrong half of a sentence as a label, and checking it should not
 * require a browser and a plugin ringing a real doorbell.
 */

/** A machine's sentence, split into the label it opens with and the rest. */
export interface Byline {
  /** The plugin's own attribution line, or `""` when the body carries none —
   *  never a name this client made up. */
  readonly byline: string
  /** Everything under it, and the WHOLE text when there is no byline: the
   *  words are drawn either way, which is the half that makes an unrecognised
   *  body safe rather than merely tolerated. */
  readonly body: string
}

/** One blank line directly under the byline — the separator kolu's bodies use,
 *  eaten so the paragraph does not open with a hole. `\r` is in the class
 *  because a plugin's body is a string from anywhere. */
const OPENING_GAP = /^[ \t\r]*\n/

/**
 * The byline this body opens with, and what is left of it.
 *
 * Total, and deliberately: every arm answers with a `body`, so a caller can
 * draw the words without asking first whether the split worked.
 */
export const bylineOf = (text: string): Byline => {
  const breaks = text.indexOf("\n")
  const whole: Byline = { byline: "", body: text }
  if (breaks < 0) return whole
  const byline = text.slice(0, breaks).trimEnd()
  const body = text.slice(breaks + 1).replace(OPENING_GAP, "")
  // A LABEL WITH NOTHING UNDER IT IS NOT A LABEL. An empty opening line, or a
  // body that is only its own first line and some whitespace, is one sentence
  // — and drawing it as a caption over an empty paragraph would turn the whole
  // message into chrome.
  return byline === "" || body.trim() === "" ? whole : { byline, body }
}
