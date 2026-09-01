/**
 * WHAT THE DOORBELL DID, in one line per moment — the evidence half of
 * `doorbell-missing-claim`, and the reason that P1 took an afternoon and a
 * census of a chat transcript to find instead of one `grep`.
 *
 * ## Why this exists at all
 *
 * The doorbell was SILENT ABOUT ITSELF. It walked a vault, decided a meaning,
 * composed a sentence and handed it to core, and the only line it ever wrote
 * was the `catch` at the edge of {@link ./server.ts}'s `ring` — which fires
 * when the walk THROWS and never when it merely answers nothing. So the whole
 * failure mode this feature actually has (a terminal that is not in the set)
 * looks exactly like the whole success mode it is designed for (a terminal
 * nobody scoped): no call, no line, nothing.
 *
 * On 2026-09-01 a lane sat `waiting` for 26 minutes with the nag knob on and
 * drew nothing. Ruling out the queue, the scope, the knobs, the link and the
 * mirror took a per-terminal delivery census counted BY HAND out of a chat
 * transcript, because that transcript was the only record of what the doorbell
 * had done. One `derived` line naming the ringing set would have said it in one
 * glance: the terminal was not in it.
 *
 * ## The shape, and why it is `key=value` rather than prose
 *
 * A moment and its facts. The moment is one word so a reader can filter to one
 * seam (`derived`, `classified`, `delivered`); the facts are `key=value` so the
 * answer to "which terminals were in the set at 21:42" is a `grep` and a look
 * rather than a paragraph to read. It is deliberately NOT JSON: these lines
 * share a log with Effect's own rendering and a person reads them at a
 * terminal, where one dense line beats a pretty-printed object every time.
 *
 * ONE FORMATTER for every call site, which is this module's whole reason to be
 * a module. Five seams composing their own sentences is five spellings of the
 * same fact and no way to `grep` across them — the same rule this package keeps
 * about `heldStateOf` and about `meaningOf`, kept about the thing that says what
 * happened.
 *
 * ## It is DEBUG, and that is a decision rather than a default
 *
 * `PluginServices.say` is `Effect.logDebug` and the instance's default level is
 * `info`, so none of this is on until somebody sets `OLAI_LOG_LEVEL=debug`. It
 * is the right level: a doorbell that narrated every event at `info` would be a
 * running commentary on a machine where nothing is wrong, and the one line that
 * mattered would arrive dressed as the ones a reader has learned to skip. What
 * matters is that the evidence EXISTS to be turned on, which it did not. The
 * owner's channel (`warn`) stays for what an owner must read without asking —
 * a malformed knob, a walk that threw — and this adds nothing to it.
 */

/** One fact's value, as a caller has it to hand — a count, a word, a list, or
 *  nothing at all. `null` is rendered rather than dropped, because a key that
 *  is sometimes absent is a key a reader cannot tell from one that was never
 *  written. */
export type Fact = string | number | boolean | null

/**
 * SAY WHAT JUST HAPPENED — the moment, then its facts, in the order the caller
 * names them.
 *
 * The order is the CALLER'S and is never sorted: these lines are read down a
 * terminal, and the fact a reader wants first is the one the seam knows to put
 * first.
 */
export type Trace = (moment: string, facts: Readonly<Record<string, Fact>>) => void

/** The line's own prefix — the plugin, then the feature, so a `grep` can take
 *  the whole doorbell or one seam of it and neither is a guess about spelling. */
const PREFIX = "kolu doorbell"

/**
 * A value as one token.
 *
 * QUOTED ONLY WHEN IT HAS TO BE, through `JSON.stringify`, which is both the
 * escape and the test: a bare token is what a reader wants and what a `grep`
 * for `terminal=11e565c0` finds, so a file path (no spaces) stays bare and a
 * title (which may hold anything at all) gets quotes. The EMPTY string is
 * quoted too, because `key=` at the end of a line is indistinguishable from a
 * key whose value was lost.
 */
const tokenOf = (fact: Fact): string => {
  if (fact === null) return "none"
  if (typeof fact !== "string") return String(fact)
  return fact !== "" && !/[\s"=]/.test(fact) ? fact : JSON.stringify(fact)
}

/**
 * The tracer, closed over whichever channel the caller has — `services.say` in
 * a serve, and a collector in a test.
 *
 * A FUNCTION rather than a class or a service, for the reason every other seam
 * in this package crosses as one: what a plugin is handed is a `(line: string)
 * => void`, and nothing here needs more than that.
 */
export const tracing = (say: (line: string) => void): Trace => (moment, facts) => {
  let line = `${PREFIX} ${moment}`
  for (const [key, fact] of Object.entries(facts)) line += ` ${key}=${tokenOf(fact)}`
  say(line)
}

/**
 * A LIST OF THINGS AS ONE FACT — the ringing set, the values that matched
 * nobody, the scopes passed over.
 *
 * `·` rather than a comma, so the token stays bare through {@link tokenOf} and
 * a reader can still see where one entry ends: a comma is what a person's eye
 * expects to be able to split on, and quoting the whole list to keep it would
 * cost the `grep` that is the point. EMPTY IS `none`, the same word an absent
 * fact gets, because "the set was empty" and "there was no set" read the same
 * to somebody scanning and differ only in a way the surrounding line already
 * says.
 */
export const listed = (entries: Iterable<string>): Fact => {
  const all = [...entries]
  return all.length === 0 ? null : all.join("·")
}
