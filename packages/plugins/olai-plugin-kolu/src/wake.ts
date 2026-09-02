/**
 * WHAT THE STRIP'S DOORBELL CONTROL SAYS, in kolu's own words — three
 * strings and not one sentence, because core draws the control between them,
 * and beside them the KINDS of file this wake can be pointed at and a whole
 * sentence per way this doorbell can stop watching.
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
 * What is being woken ON is the subject; the `.org` file is the FILTER over
 * it. A control that led with the file would be describing its own mechanism
 * to somebody who wants to know what it does — and the mechanism is not even
 * the interesting half: the file is a filter a person swaps, while "terminal
 * activity" is what the doorbell IS.
 *
 * ## WHICH FILES IT MAY BE POINTED AT, which is not a sentence at all
 *
 * {@link wake.kinds} is the one member here a person never reads. It is the
 * answer to a question only this package can answer — a scope is a filter, and
 * what kolu filters BY is the `kolu-terminal` values on a file's un-done NODES
 * ({@link ./doorbell.ts}), so a file that holds no nodes claims nobody, for
 * ever. The picker was offering every served file, `2026-09-01.md` among the
 * outlines (the human, 2026-09-01), and a conversation scoped to one of those
 * watched the empty set while the heartbeat went on saying the watcher was
 * alive — the exact confusion the heartbeat exists to prevent, handed over by
 * the control. So kolu names the kind it can read and core offers no other.
 *
 * ONE ENTRY, and it will stay one until something in this package can derive a
 * claim out of prose. It is spelled as `@olai/format`'s own word rather than as
 * `.org`, because a suffix is a string two packages can disagree about and a
 * KIND is the registry's single answer — and it is bounded to the kinds that
 * HOLD RECORDS rather than to every kind there is, because `document` is a word
 * the registry claims and a file this doorbell can no more walk than a picture
 * ({@link KINDS} argues it, and {@link ./wake.test.ts} holds it).
 *
 * ## ...AND THE MESSAGES, which are not pieces of a control
 *
 * {@link wake.faults} is a sentence per WAY this doorbell can stop watching,
 * keyed by the way's own word: `gone` for the file that stops being served, and
 * `unwatchable` for the file that is right there and is not something kolu can
 * read a claim out of. They are two sentences because they are two different
 * things to have happened and two different things to do about it, even though
 * the cost is one: no wake, no digest, and — because core drops the row off this
 * plugin's door either way — no heartbeat pretending otherwise.
 *
 * A TABLE rather than two fields, because core INDEXES it by the cause its own
 * walk recorded rather than choosing between arms: a third way for a doorbell to
 * stop watching goes red HERE, naming the sentence this plugin now owes, where a
 * ternary at the composition root would quietly hand somebody the `gone` one.
 *
 * Nothing draws any of them: core hands whichever applies to the same door
 * kolu's own bodies go through, whole, with no lead-in and no numeral
 * (`@olai/plugin-api`'s `PluginServerHalf.wake.faults` argues why each is one
 * string where the drawn three are pieces). So they are written the way
 * {@link ./doorbell.ts} writes a body rather than the way the three above are
 * written — a plain first line a glance can read, the attribution under it, and
 * then what a person has to do about it.
 *
 * NEITHER NAMES A FILE, and that is not an omission core would fill in. Core
 * knows the path and refuses to punch a hole in somebody else's sentence for
 * it; the strip is drawing that path two inches away, marked broken. What only
 * kolu can say is the half that costs: that no terminal is being watched for
 * this conversation any more.
 *
 * AND NEITHER MAY READ AS A HEARTBEAT. The other sentence a quiet conversation
 * can receive says the watcher is alive and the fleet is quiet; these two say
 * the watcher is watching nothing. Confusing them is the whole failure these
 * fields exist to prevent — a silence that is fine and a silence that is broken
 * are indistinguishable on every other channel — so the words below deny the
 * other reading outright rather than leaving a reader to infer it.
 *
 * ## Why it is a module of its own
 *
 * `@olai/plugin-api`'s `PluginServerHalf` reads this off the enabled halves, and
 * {@link ./server.ts} re-exports it beside `kinds` and `probe` for the reason
 * those two are re-exported there: a composition root opens ONE door per
 * plugin. (That neighbour is the PROPERTY kinds this plugin teaches the vault;
 * {@link wake.kinds} below is a different word for a different table, and the
 * two never meet.) It is not IN `server.ts` because that file's closure is the
 * runtime half — `koluHalf`, the mirror, the dial — and the member that refuses
 * a scope for a plugin declaring no wake wants strings, not a socket.
 *
 * The words themselves are pinned by nothing, deliberately: they are prose a
 * person reads on a strip, and a test asserting their spelling would be a
 * test that fails when somebody improves them. What IS held is that the
 * plugin declares them at all — `@olai/server`'s roster copies `wake` onto a
 * row only for a plugin that is RUNNING, and its own bench asserts that
 * rather than trusting this paragraph. The KINDS are held harder than prose
 * can be: they are typed against the registry's RECORD-HOLDING union below, so
 * both ways of getting them wrong — a word the registry never had, and a word
 * it has for a file with no nodes in it — are a type error here rather than a
 * picker that offers the wrong files on somebody else's machine.
 */

import type { NodeKind } from "@olai/format"

/**
 * THE KIND OF FILE A KOLU WAKE CAN BE POINTED AT — one, and it is the outline.
 *
 * Typed against the registry's own union rather than spelled as a suffix: the
 * word travels to the picker as data (`@olai/surface`'s `BuiltPlugin`'s
 * `wake.kinds`) and is compared there against `fileKind`'s answer, so the two
 * ends are reading one table. A `.org` written out here would be a second
 * answer to a question `@olai/format`'s `kinds.ts` settles, and the failure it
 * buys is silent: a picker that offers nothing at all.
 *
 * ## `NodeKind` AND NOT `FileKind`, which is the whole of what the annotation
 * is worth
 *
 * `FileKind` is every kind the registry claims, documents included — so it
 * catches `"hologram"`, a word that names no file, and passes `"document"`,
 * which names the very files this lane exists to keep off the picker. A future
 * hand adding one here would type-check GREEN and rebuild the defect whole: the
 * picker would offer `.md` files, {@link ./doorbell.ts} would walk one and find
 * no nodes to carry a claim, and the heartbeat would go on reporting a live
 * watch over the empty set. The door this PR closed, with the key left in it.
 *
 * {@link NodeKind} is the registry's record-holding kinds — the complement of
 * `BodyKind`, derived from the same `holds` column — so naming a bodied kind
 * here is the same class of error as naming a word the table never had, and
 * `./wake.test.ts` fails the build if it ever stops being.
 *
 * IT IS KOLU'S BOUND AND NOT CORE'S, and the distinction is exact: core cannot
 * know whether a doorbell can walk a kind and never asks. THIS annotation can,
 * because this package knows what it reads — the `kolu-terminal` values on a
 * file's un-done NODES — and a plugin that really did read a document's prose
 * would annotate its own list differently and be right to.
 *
 * A named constant rather than a member written inline, so this annotation
 * exists to be checked — a literal inside the object below would widen to
 * `string` against {@link PluginServerHalf}'s own field and check nothing.
 */
const KINDS: readonly [NodeKind, ...Array<NodeKind>] = ["outline"]

/** kolu's doorbell, as the strip says it. See the header for why the drawn half
 *  is three pieces and why the subject leads. */
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
  /** WHICH FILES THIS MAY BE POINTED AT — see the header, and {@link KINDS}
   *  for why the word rather than the suffix. */
  kinds: KINDS,
  /**
   * ... and the sentences, one per way this doorbell can stop watching, keyed by
   * the way's own word. Core INDEXES this by the cause it recorded rather than
   * choosing between arms, which is what makes a third cause a compile error
   * here instead of a wrong sentence there (`@olai/plugin-api`'s
   * `PluginServerHalf.wake.faults`).
   */
  faults: {
    /**
     * THE FILE WENT. See the header: no picker around it, no file named in it,
     * and it says both halves
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
    /**
     * ... and THE FILE IS THERE AND HAS NOTHING KOLU CAN READ.
     *
     * The SAME THREE PARTS as {@link wake.faults.gone} — the first line a glance
     * can read, the attribution, the denial and the way out — because a person
     * may receive either of them and must not have to learn two shapes of
     * message. What differs is the middle clause of the first line, which is the
     * only thing that actually differs: the file is there, and it holds no
     * nodes, so there is nothing on it that could ever claim a terminal.
     *
     * IT SAYS WHY IN THE MECHANISM'S OWN TERMS — "no nodes", "claim" — rather
     * than "wrong kind of file", because a person who reads only that the pick
     * was wrong has been told nothing they can act on, and the whole of what is
     * wrong with a document here is a fact about how this doorbell derives.
     *
     * A conversation can only be in this state from a pick made before the
     * picker filtered ({@link wake.kinds}), a tab left open from an older serve,
     * or a record edited by hand — so it is rare and it is nobody's mistake to
     * be scolded for. The last clause says what to press.
     */
    unwatchable: [
      "The file this conversation's terminal wake is pointed at is not an outline — it is served, and it holds no nodes, so nothing in it can claim a terminal.",
      "",
      "Written by olai's kolu watcher, not by a person.",
      "",
      "No terminals are being watched for this conversation. Nothing is claimed, nothing will be derived, and nothing is being held back — this is not a quiet fleet, it is a doorbell pointed at a file that can never carry a claim. Point the wake control at an outline and it starts.",
    ].join("\n"),
  },
}
