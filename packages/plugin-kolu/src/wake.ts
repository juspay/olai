/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS, in kolu's own words — three
 * strings and not one sentence, because core draws the control between them,
 * and beside them ONE whole sentence for the one moment nothing is drawn.
 *
 * ## Why the plugin owns every word and core owns none
 *
 * The row a person reads is `<subject> · <from> <the picker>`, and with
 * nothing picked it is `<subject> · off`. Core owns the row, the picker, the
 * clearing and the numeral; it composes no clause. A single string with a
 * hole in it would have made core the author of everything around the hole —
 * and the four ways a wake could be described (a fleet, a mailbox, a build,
 * a calendar) have nothing in common but that they are wakes. So the SUBJECT
 * is this file's, the lead-in to the file picker is this file's, and the
 * noun the held bodies are counted in is this file's, in both grammatical
 * numbers so that core never has to decide whether the plural takes an `s`.
 *
 * ## Why the SUBJECT leads and the file does not
 *
 * What is being woken ON is the subject; the `.olai` file is the FILTER over
 * it. A control that led with the file would be describing its own mechanism
 * to somebody who wants to know what it does — and the mechanism is not even
 * the interesting half: the file is a filter a person swaps, while "terminal
 * activity" is what the doorbell IS.
 *
 * ## ...AND THE FOURTH, which is a MESSAGE and not a piece of a control
 *
 * {@link wake.gone} is what a conversation is told when the file it woke on
 * stops being served. Nothing draws it: core hands it to the same door kolu's
 * own bodies go through, whole, with no lead-in and no numeral
 * (`@olai/plugins`' `PluginServerHalf.wake.gone` argues why it is one string
 * where the others are three). So it is written the way {@link ./doorbell.ts}
 * writes a body rather than the way the three above are written — a plain first
 * line a glance can read, the attribution under it, and then what a person has
 * to do about it.
 *
 * IT NAMES NO FILE, and that is not an omission core would fill in. Core knows
 * the path and refuses to punch a hole in somebody else's sentence for it; the
 * strip is drawing that path two inches away, marked broken. What only kolu can
 * say is the half that costs: that no terminal is being watched for this
 * conversation any more.
 *
 * AND IT MUST NOT READ AS A HEARTBEAT. The other sentence a quiet conversation
 * can receive says the watcher is alive and the fleet is quiet; this one says
 * the watcher is watching nothing. Confusing them is the whole failure this
 * field exists to prevent — a silence that is fine and a silence that is broken
 * are indistinguishable on every other channel — so the words below deny the
 * other reading outright rather than leaving a reader to infer it.
 *
 * ## Why it is a module of its own
 *
 * `@olai/plugins`' `PluginServerHalf` reads this off the enabled halves, and
 * {@link ./server.ts} re-exports it beside `kinds` and `probe` for the reason
 * those two are re-exported there: a composition root opens ONE door per
 * plugin. It is not IN `server.ts` because that file's closure is the runtime
 * half — `koluHalf`, the mirror, the dial — and the member that refuses a
 * scope for a plugin declaring no wake wants three strings, not a socket.
 *
 * The words themselves are pinned by nothing, deliberately: they are prose a
 * person reads on a strip, and a test asserting their spelling would be a
 * test that fails when somebody improves them. What IS held is that the
 * plugin declares them at all — `@olai/server`'s roster copies `wake` onto a
 * row only for a plugin that is RUNNING, and its own bench asserts that
 * rather than trusting this paragraph.
 */

/** kolu's doorbell, as the strip says it. See the header for why it is three
 *  pieces and why the subject leads. */
export const wake = {
  /** What the wake is ON. */
  subject: "wake on terminal activity",
  /** The lead-in to the file picker: the file is the FILTER, and this is the
   *  word that says so without saying "filter", which is a mechanism word. */
  from: "terminals from",
  /** What core is holding, in kolu's own noun and in both numbers — core
   *  supplies the numeral and joins them. A `fleet event` is what one held
   *  body is ABOUT, which is the honest name for it: the body itself is a
   *  fresh derivation of everything standing, so calling them "messages"
   *  would promise five messages where one will arrive. */
  waiting: { one: "fleet event waiting", many: "fleet events waiting" },
  /**
   * ... and the one whole sentence, for the moment the file goes away. See the
   * header: no picker around it, no file named in it, and it says both halves
   * — the file is gone AND nothing is being watched — because a reader told
   * only the first half would reasonably assume the watcher carried on.
   *
   * The third paragraph is the denial. "Not a quiet fleet" is there so that
   * this can never be read as the reassurance a heartbeat gives, and the last
   * clause is the way out, because a machine-sent message that cannot be acted
   * on from inside its own text is a message a person resents
   * ({@link ./doorbell.ts} spends the same rule on its closing line).
   */
  gone: [
    "The file this conversation's terminal wake was pointed at is no longer in the served directory — renamed, moved, or deleted.",
    "",
    "Written by olai's kolu watcher, not by a person.",
    "",
    "No terminals are being watched for this conversation any more. Nothing is claimed, nothing will be derived, and nothing is being held back — this is not a quiet fleet, it is a doorbell with no file behind it. Point the wake control at a file that exists and it starts again.",
  ].join("\n"),
}
