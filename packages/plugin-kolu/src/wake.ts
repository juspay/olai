/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS, in kolu's own words — three
 * strings and not one sentence, because core draws the control between them.
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
}
