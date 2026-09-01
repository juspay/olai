/**
 * WHAT THE DOORBELL DID, in one line per moment.
 *
 * WHY there is an account at all is {@link ./doorbell.ts}'s header, where the
 * incident that bought it is already told once: a doorbell's failure mode is a
 * call that does not happen, which is byte-for-byte identical to its ordinary
 * quiet operation. This module owns the FORMAT and nothing else.
 *
 * ## It is logfmt, and it is not a format of ours
 *
 * `@olai/log`'s machine face is [logfmt](https://brandur.org/logfmt) — Effect's
 * own `formatLogFmt`, one line per event, every value a `key=value` pair, quoted
 * only when it has to be. That sink's header is explicit that a bespoke renderer
 * would be one more thing to keep consistent with everything else the tree says,
 * and it is right. So these lines are logfmt too: a `kolu doorbell` line and an
 * annotated core line quote by the same rule and parse by the same reader.
 *
 * WHAT IT IS NOT is `Effect.annotateLogs`, which is how a package inside the
 * Effect world says exactly this and would leave no rendering here to get
 * wrong. A plugin cannot reach it: `PluginServices.say` is `(line: string) =>
 * void` — core narrows the Effect away before a plugin ever sees the channel
 * ({@link @olai/plugin-api}'s `PluginServer`). Widening that door is the real
 * fix and it is a change to core's plugin contract, which is why the rendering
 * is HERE and says so, rather than being quietly re-invented as if there were
 * no better shape.
 *
 * ## One formatter, one moment vocabulary
 *
 * A moment and its facts. The moment is one word so a reader can filter to one
 * seam (`derived`, `classified`, `delivered`); the facts are `key=value` so
 * "which terminals were in the set at 21:42" is a `grep` and a look.
 *
 * ONE FORMATTER for every call site, which is this module's whole reason to
 * exist as one: five seams composing their own sentences is five spellings of
 * one fact and no way to `grep` across them — the rule this package already
 * keeps about `heldStateOf` and about `meaningOf`, kept about the thing that
 * says what happened. The same rule binds the MOMENT WORDS, which is why one
 * finding gets one word however many seams reach it.
 *
 * ## It is DEBUG, and that is a decision rather than a default
 *
 * `PluginServices.say` is `Effect.logDebug` and the instance's default level is
 * `info`, so none of this is on until somebody sets `OLAI_LOG_LEVEL=debug`. A
 * doorbell that narrated every event at `info` would be a running commentary on
 * a machine where nothing is wrong, and the one line that mattered would arrive
 * dressed as the ones a reader has learned to skip. What matters is that the
 * evidence EXISTS to be turned on, which it did not. The owner's channel
 * (`warn`) keeps what an owner must read without asking — a malformed knob, a
 * walk that threw — and this adds nothing to it.
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
 * A value as one logfmt token — bare unless it holds a space, a quote or an
 * `=`, and `JSON.stringify` when it does, which is that escape exactly.
 *
 * The EMPTY string is quoted too: `key=` at the end of a line is
 * indistinguishable from a key whose value was lost.
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
 * A COMMA, because logfmt does not care about one: a comma is not a space, a
 * quote or an `=`, so the joined value stays a bare token and `grep` reaches
 * straight through it. This used to join on `·` under a paragraph arguing that
 * a comma would force quoting — which it does not, so the separator was a
 * convention invented to dodge a rule it never triggered. It was also a
 * separator this package had already spent: `repo·label` is kolu's own
 * spelling for a terminal's name ({@link @olai/kolu-client/wire}'s `whoOf`),
 * and one glyph meaning two things inside one line is the ambiguity a
 * separator exists to prevent.
 *
 * EMPTY IS `none`, the same word an absent fact gets: "the set was empty" and
 * "there was no set" read alike to somebody scanning, and the surrounding line
 * already says which.
 */
export const listed = (entries: Iterable<string>): Fact => {
  const all = [...entries]
  return all.length === 0 ? null : all.join(",")
}
