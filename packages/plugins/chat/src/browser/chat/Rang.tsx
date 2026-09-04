/**
 * A MACHINE'S SENTENCE IN A PERSON'S LANE — the panel's third face, and the one
 * nobody typed.
 *
 * A plugin's doorbell arrives as a `user` row (`@olai/surface`'s
 * `UserEntry.rang`, and {@link ./Wake.tsx} for where somebody allowed it),
 * because the human lane is the lane a prompt goes out on and the one every
 * word about a message's fate is already written for. Everything in this file
 * is the work of making that row not look like a person's: the full column
 * instead of a right-hand bubble, a ground and an edge of its own, the plugin's
 * name over the words, and one line until somebody asks for the rest.
 *
 * ## Why its own file
 *
 * {@link ./ToolFrame.tsx}'s reason, word for word. {@link ./Entry.tsx} is the
 * panel's DISPATCH over row kinds — six arms, and every other non-trivial one
 * is a single line handing the narrowed row to the component that knows how it
 * looks. This face is a ground, an edge, a byline, a fold and a body, which is
 * not a line; nested inside the `user` arm it was a hundred of them, two
 * `<Show>`s deep, and the reader who came to find out what a `notice` looks
 * like had to scroll a plugin's fold to get there. That is how a switch stops
 * being a switch, and the rule asks for the folder over the module for
 * exactly this.
 *
 * ## Why the human bubble is NOT here
 *
 * Because this file is the face that is not a person's, and a file that drew
 * both would be back to deciding which of them a row gets — which is the
 * dispatch's job and it already has one. The two faces also SHARE A COLUMN: the
 * context chips, the pictures, the queued strip and the delivery line are drawn
 * once for either, above and below whichever bubble is picked, and pulling the
 * human half down here would mean either duplicating that column or moving it
 * into the file about machines. One copy of each, up where the arm is.
 *
 * ## Why the fate's edge is handed down rather than looked up
 *
 * A delivery that did not land edges this row exactly as it edges a person's,
 * off ONE table of what a fate looks like ({@link ./Entry.tsx}'s `FACE`) — and
 * that table stays there because the strip under both rows reads its words and
 * its tone as well. So the caller hands over the edge and this file decides
 * only what happens when there isn't one. Importing the table back the other
 * way would put the two files that draw one row into a cycle, for a lookup the
 * caller has already done.
 */

import type { UserEntry } from "olai-plugin-chat/wire"
import { createEffect, createMemo, Show } from "solid-js"

import { createDeclared } from "@olai/web/client/declared.ts"
import { isUnfolded, toggleFold } from "./folds.ts"
import { Quoted } from "./Quoted.tsx"
import { rangRow } from "./rang.ts"
import { markNodeRefs } from "./refs.ts"
import { TESTID } from "../../testids.ts"

/**
 * WHAT A MACHINE'S SENTENCE LOOKS LIKE — a `user` row that nobody typed.
 *
 * FULL WIDTH AND LEFT-ALIGNED, which is the first half of the distinction and
 * is drawn rather than labelled: the right-hand accent bubble means *you said
 * this*, and a plugin's sentence wearing it would put words in a person's
 * mouth. The column itself is the arm's ({@link ./Entry.tsx}), because it is
 * the half both faces share.
 *
 * THE OTHER HALF IS A FACE OF ITS OWN, and it is the half that was missing.
 * Full width alone was a faint `bg-rule/20` box, which is what the panel puts
 * under nothing in particular — near enough to the human bubble that a reader
 * had to READ THE WORDS to find out who had spoken, which is the one question
 * a row should answer before it is read. So: its own ground, a 3px edge down
 * the left, and the plugin's own name over the words ({@link ./byline.ts}). A
 * THIRD face beside the two the panel already has, never a variant of either.
 *
 * `pill` for the ground and `ink` for the edge, which is this palette's
 * vocabulary rather than a colour picked to look different. `pill` is a filled
 * surface and a lightness step of paper (`../theme/palettes.ts`), so it lifts
 * off the transcript's `desk` in every theme, light or dark, without borrowing
 * a status hue; `ink` is the FRAME's own colour, and the frame is exactly what
 * spoke — the machinery around the conversation rather than either party in
 * it. Not `accent`: that is the human bubble's, and the whole point is not to
 * be it. Not `alarm` or `doing` either — nothing is wrong and nothing is in
 * flight; something happened that somebody asked to be told about. And not the
 * prototype's violet, tempting as a fourth hue is: a colour outside the table
 * is a colour ten palettes have no answer for and no contrast test can hold
 * (`../theme/contrast.test.ts`), which is how a face ends up unreadable on the
 * one theme nobody tried it in.
 *
 * AND IT IS ONE LINE UNTIL SOMEBODY ASKS FOR MORE, which is the other half of
 * distinct: a face nobody can miss, holding ten lines of terminal ids and
 * derivation, is a wall in the middle of the conversation — and the reader who
 * wanted the ids is one press from them. So the row folds to the plugin's own
 * essence line, with the account behind an expand, exactly as a tool row folds
 * ({@link ./ToolFrame.tsx}). {@link ./rang.ts} carries that rule and the reason
 * the seam is the plugin's line rather than a summary composed here — and the
 * reason the AGENT is not folded to: it is handed the whole body on the wire,
 * because it needs the ids to act on them.
 *
 * AND THE IDS IN IT ARE PRESSABLE, on the same terms as the ids the agent names
 * in its own prose ({@link ./refs.ts}: a backticked span the SET declares). It
 * is the same door and not a second one, which is the point — the row exists to
 * POINT AT SOMETHING, and it was the one row in the panel whose ids nobody
 * could press, because the pass walks `<code>` elements and a quoted paragraph
 * has none. {@link ./quoted.ts} gives it exactly that one piece of markup and
 * argues why nothing else of markdown follows; the effect below is the walk.
 *
 * That is also what took the fold off the head LINE and gave it a chevron of
 * its own (ruled, human 2026-08-31): a reference inside a button is a press
 * with two meanings, and the line has to be able to hold one.
 *
 * A FATE STILL EDGES IT, off {@link ./Entry.tsx}'s table: a delivery that did
 * not land is the same fact about a machine's words as about a person's, and it
 * takes the ground over — what became of the words outranks who said them, for
 * as long as it is true. The BYLINE stays either way, because who spoke is true
 * whatever happened to it. The one difference from a person's row is the
 * button, which is the arm's and not this file's.
 */
const RANG = "border-l-[3px] border-ink bg-pill"

/** The edge a machine's sentence takes — the fate's, where there is one, or its
 *  own quiet one. Its own function rather than the human bubble's with a flag
 *  through it: what differs between the two faces is only the no-fate arm, and
 *  a boolean parameter would be two rules in one signature. */
const rangBubbleOf = (fated: string | undefined): string => fated ?? RANG

/**
 * WHAT THE FOLD HOLDS BACK — a plugin's account, drawn the one way a machine's
 * words may be drawn.
 *
 * Its own component because it is drawn from TWO places and must be the same
 * paragraph in both: under an opened fold, and on a row that has no fold to
 * open ({@link ./rang.ts}). Two copies of this markup would be two answers to
 * "how does a doorbell's body look", free to drift — and the arm that would
 * drift is the unfoldable one, which is precisely the arm nobody is looking at
 * while they work on the interesting one.
 *
 * QUOTED, NOT RENDERED, and that is the row's oldest rule rather than a
 * shortcut taken here: the mark that says a plugin said this does not survive a
 * replay (`@olai/surface`'s `UserEntry.rang`), so a body markdown-rendered only
 * while the mark is live would come back as raw backticks and bullets the first
 * time somebody resumed the conversation. Words that must read correctly
 * unrendered anyway are better rendered once, honestly, than twice, differently
 * — and the fold changed nothing about that: it changed WHEN these words are on
 * screen, never what they are.
 *
 * ONE EXCEPTION, AND IT IS NOT THAT RULE BENDING: the runs between backticks
 * are drawn as code spans ({@link ./Quoted.tsx}, over {@link ./quoted.ts}'s
 * rule), because a plugin names the node it is ringing about in them and an id
 * in backticks is a reference this panel already knows how to make pressable.
 * None of the rest of markdown is interpreted — no headings, no lists, no
 * emphasis, no links, no fences — and {@link ./quoted.ts} argues at length why
 * the backticks come off and what it costs on a replay.
 */
function RangBody(props: { readonly said: string }) {
  return (
    <p class="whitespace-pre-wrap" data-testid={TESTID.chatRangBody}>
      <Quoted said={props.said} />
    </p>
  )
}

/**
 * One doorbell's row, inside the column the arm drew for it.
 *
 * WHO is a parameter rather than `entry.rang` read back off the row, because
 * the caller has already had to narrow it: the mark is what picked this face
 * over the human one, and a component re-asking a question its own existence
 * answers would have a `undefined` arm nothing can reach and everything has to
 * read past.
 */
export function Rang(props: {
  readonly entry: UserEntry
  /** Whose doorbell — the plugin's own name, as data, since a conversation two
   *  plugins can reach needs to say which rang. */
  readonly by: string
  /** The edge a fate puts on this row, or nothing where the message simply
   *  went. Handed down off {@link ./Entry.tsx}'s one table of fates; the header
   *  above says why it is not looked up here. */
  readonly fated: string | undefined
}) {
  /** The essence line the plugin put at the top of its own sentence, what is
   *  left under it, and whether that rest is on screen ({@link ./rang.ts}, over
   *  {@link ./byline.ts}'s split).
   *
   *  A MEMO, because {@link ./folds.ts} is ONE signal for every folded thing on
   *  screen: any fold anywhere re-runs this, and the memo is what stops that
   *  reaching the paragraph — {@link ./Diff.tsx} holds the same line for the
   *  same reason. */
  const said = createMemo(() => rangRow(props.entry.text, isUnfolded(props.entry.id)))
  /**
   * WHAT THE SET SAYS ABOUT THE IDS IN THIS SENTENCE — the same question the
   * agent's own prose asks, asked once for this message ({@link ./declared.ts}).
   *
   * IT DID NOT RUN HERE BEFORE, and that was a gap rather than a decision. The
   * pass walks `<code>` elements ({@link ./refs.ts}), a quoted paragraph had
   * none, and the one row in the panel whose entire purpose is to point at
   * something was therefore the one row whose ids a reader had to copy out and
   * search for by hand. {@link ./quoted.ts} is what gives this body spans to
   * walk; this is the walk.
   *
   * ASKED HERE rather than in {@link ./Entry.tsx}, where the agent's is. The
   * rule that file states is "once per message, and only for a row that has
   * rendered markdown in it, off a `kind` that never changes for an entry" —
   * and this component is mounted for exactly the rows that pass a version of
   * that test, since the mark is what picked this face. Creating it in the arm
   * would put a second condition in a switch whose every other non-trivial arm
   * is one line, for an asker only this file can spend.
   */
  const declared = createDeclared()
  /** The row's own element, so the ids inside it can be found. A ref rather
   *  than a query on the pane, for {@link ./Entry.tsx}'s reason: the pass is
   *  over ONE message. */
  let rang: HTMLDivElement | undefined
  /**
   * Ask about the ids this sentence names, and mark the ones already answered.
   *
   * IT TRACKS THE FOLD, which is the one thing this pass does that the agent's
   * does not have to. A machine's row streams no text — the body arrives whole —
   * but the ACCOUNT is not in the page until somebody opens it ({@link ./rang.ts};
   * absent rather than hidden, deliberately), so the spans that carry the ids
   * come into existence on a press. Reading `said()` is what re-runs this then;
   * without it the pass would run once over a folded row, see the byline alone,
   * and never look again at the half the ids are in.
   *
   * ONE PASS over the WHOLE row, byline and account together, rather than one
   * per part: `markNodeRefs` marks with what has been answered and hands back
   * every id it saw, and two walks would be two chances to disagree about which
   * spans were asked about — {@link ./refs.ts} argues that at length. It also
   * means an id in the plugin's opening line is a reference on the same terms as
   * one in the account, which is what {@link ./byline.ts} would want: the seam
   * between them is about where a LABEL ends, not about what may be pressed.
   */
  createEffect(() => {
    said()
    if (rang === undefined) return
    declared.want(markNodeRefs(rang, declared.named))
  })
  return (
    <div
      class={`w-full rounded py-1.5 pl-3 pr-2 text-sm text-ink ${
        rangBubbleOf(props.fated)
      }`}
      data-testid={TESTID.chatRang}
      data-rang-by={props.by}
      data-unfolded={said().open}
      ref={rang}
    >
      {/* WHO SPOKE AND WHAT MOVED, in one line, and it is the only line until
          somebody asks for more. A label rather than a line of the paragraph:
          small, mono and muted, which is the same chrome the queued strip and
          the delivery line are drawn in, so the panel has one voice for "this
          is about the message" and another for the message. The words are the
          PLUGIN's, unedited; only their weight on the page is this component's.

          THE WHOLE LINE WAS THE BUTTON, and it is not any more (ruled, human
          2026-08-31: *"a fully-clickable strip would fight the link and make
          the fold/hover ambiguous. Precision over affordance: the logo says
          whose, the one link says where."*). A plugin names the node it is
          ringing about, and that name is a REFERENCE — pressable, and pressing
          it shows the node ({@link ./refs.ts}). A reference nested inside a
          button is a press with two meanings and no way for a reader to tell
          which they are about to get; it is also markup a browser is entitled
          to reject, since a button may not hold another control.

          So the control is a DISCLOSURE CHEVRON of its own — the very glyph
          {@link ./ToolFrame.tsx} already draws at the end of a foldable row,
          moved to the front where it is the line's own affordance rather than
          an afterthought at the end of one. It keeps everything the line had:
          `aria-expanded`, a real button so it is tabbed to and pressed with a
          key, and a name so a screen reader hears a verb rather than a triangle.

          `title` stays, on the LINE rather than on the control, and that is
          where it always belonged: the account under the pointer is a second
          way in, and a hover that only worked over a 12px triangle would be a
          way in nobody finds.

          NOT UPPERCASE any more, which is the one look this change takes with
          it. The transform is inherited by everything on the line, ids
          included, and a node called `lane-sd` drawn as `LANE-SD` is a label
          shouting a name that is not spelled that way — in the one row whose
          purpose is to point at it. The mono, the size and the muted tone are
          what make this the chrome voice; the shouting was never the part
          doing that work. */}
      <Show when={said().folds} fallback={<RangBody said={said().body} />}>
        <div
          class="mb-0.5 flex w-full items-start gap-1.5 font-mono text-[0.6875rem] tracking-wider text-muted"
          title={said().open ? undefined : said().body}
        >
          <button
            type="button"
            // `cursor-pointer`, and it is not decoration: a chevron the mouse
            // does not acknowledge is a control most people never find. The
            // panel says pressable the same way everywhere — `Reference.tsx`'s
            // node chip and `styles.css`'s `code[data-node-ref]` both carry it —
            // and this is the transcript's third pressable thing joining them.
            class="shrink-0 cursor-pointer rounded-sm leading-4 hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent"
            data-testid={TESTID.chatRangFold}
            aria-expanded={said().open}
            aria-label={said().open ? "hide the account" : "show the account"}
            onClick={() => toggleFold(props.entry.id)}
          >
            <span aria-hidden="true">{said().open ? "▾" : "▸"}</span>
          </button>
          {/* The plugin's own opening line, as text. Its backticked runs are
              code spans like any other sentence's in this panel
              ({@link ./Quoted.tsx}) — which is what the head line being a plain
              line rather than a button is FOR. */}
          <span class="min-w-0" data-testid={TESTID.chatRangByline}>
            <Quoted said={said().byline} />
          </span>
        </div>
        {/* NOT `hidden`, but absent: a body kept in the page and painted away is
            a body a screen reader still walks and a scenario still finds, which
            is the whole of what the fold was for. */}
        <Show when={said().open}>
          <RangBody said={said().body} />
        </Show>
      </Show>
    </div>
  )
}
