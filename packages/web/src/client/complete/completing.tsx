/**
 * The three input widgets, as one loop: what is armed, what it offers, and what
 * choosing one does.
 *
 * `!` a day, `#`/`@` a tag, `((` a node to mirror. Workflowy's three, and they
 * are ONE component here rather than three because they are one gesture — type
 * a character, see a shortlist, walk it with the arrows, press Enter — and the
 * only thing that differs between them is where the rows come from and what
 * choosing one writes. Three copies of the arrow keys is three chances for the
 * arrows to mean something slightly different depending on which character
 * opened the list.
 *
 * ## Nothing here is state, except one dismissal
 *
 * What is armed is a FUNCTION of the text and the caret ({@link ./trigger.ts}),
 * so backspacing over the `!` shuts the widget and typing it again opens the
 * same one. There is no "the picker is open" flag to get out of step with the
 * line — which is what makes this survive every other thing that can happen to
 * a row mid-typing: a live frame redrawing it, `Tab` moving it, a refusal
 * landing under it.
 *
 * The one piece of memory is ESCAPE, and it remembers a TOKEN rather than a
 * mood: dismissing the popup over `#ho` keeps it shut while that `#ho` is being
 * typed, and moving the caret elsewhere or starting another tag brings it back.
 * Without it, Escape in a row with a live trigger could only mean "throw away
 * everything you typed", which is the wrong of the two answers to a key pressed
 * to make a popup go away.
 *
 * ## Where each list comes from
 *
 *   - a DAY is read from the phrase and today, purely (`../date/natural.ts`).
 *   - a TAG is the SERVER's vocabulary — every tag the set writes, counted
 *     and ranked beside the index it is read from (`@olai/format`'s
 *     `vocabulary.ts`), asked through `./asking.ts`. It was the loaded set's
 *     own until `vault-in-browser`'s PR 2, which took the loaded set away.
 *   - a NODE is the SERVER's search — `../search/nodes.ts`, the same primitive
 *     the ⌘K palette and the header box call, debounce and all. A third door
 *     onto one reading, which is the rule that file exists to keep.
 *
 * So two of the three are now questions, and the two askers are one shape:
 * debounce, latest-wins, a refusal of its own. What is left local is the one
 * list that is a function of a phrase and a calendar.
 *
 * ## What choosing one writes
 *
 * A TAG is text: the span is replaced in the draft and nothing is sent, because
 * a tag lives inline in the title and the draft commits like any other typing.
 * The other two are OPS — `set_date` and `add_mirror`, through the editor's own
 * gate (`../edit/editing.tsx`) — and both take their trigger's text back OUT of
 * the line first, because `!next fri` is not something anybody wants left in a
 * title.
 *
 * ## Why not Kobalte's `Combobox`, which is the ecosystem's answer
 *
 * Asked, because HACKING.md's SolidJS rule says to ask and because the `•••`
 * menu is that library's now. A `Combobox` OWNS ITS INPUT: it renders the
 * field, holds the value, decides when the list is open, and reads the whole
 * box as the query. Every one of those is already somebody else's here — the
 * field is the title editor, the value is the DRAFT, and the query is a SPAN
 * inside the line rather than the line. Adopting it would mean replacing the
 * row's `<input>` with a control whose value model is not the draft's, to get a
 * listbox and four keydowns; what it would cost is the one thing this editor is
 * built around (`../edit/RowEditor.tsx`'s first paragraph). The rows, the row
 * component and the search behind the `((` list are all shared with the
 * palette, which is the reuse that was actually available.
 */

import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
} from "solid-js"

import { tagText } from "@olai/format"

import { Completions } from "./Completions.tsx"
import { nodePlace } from "../search/place.ts"
import { type NodeProp, nodeProps } from "../search/props.ts"
import { createCursor } from "../search/cursor.ts"
import { createSearch } from "../search/nodes.ts"
import { atOnce, type Taking } from "../settled.ts"
import { useToday } from "../today.tsx"
import { dayLabel, naturalDays } from "../date/natural.ts"
import { createTags } from "./asking.ts"
import { listKey } from "../keys.ts"
import { sameTrigger, triggerIn, type Trigger, type Written, written } from "./trigger.ts"

/** One row of the popup. `choose` is the whole of what it does, so the
 *  component that draws these knows nothing about dates, tags or mirrors. */
export interface Choice {
  /** Identifies the row to a test and to nothing else. */
  readonly id: string
  readonly label: string
  /** A word at the right of the line — the day a phrase means, how many nodes
   *  carry a tag. */
  readonly hint?: string
  /** Where a node sits — the second line, for the `((` rows only. */
  readonly place?: string
  /** The node's properties — the third line, for the `((` rows only. A tag
   *  completion is not a node and has none. */
  readonly props?: ReadonlyArray<NodeProp>
  readonly choose: () => void
}

/**
 * What the CONSUMER gets: two things, and it needs both of them.
 *
 * A field with a completion in it has to do exactly two jobs — offer its keys
 * to the list before answering them itself, and draw the list somewhere. So
 * this hands back one of each, and nothing else. It used to hand back the six
 * accessors {@link Panel} reads, and the editor then had to import a second
 * component and wire it to them: a consumer composing several exports by hand
 * is the missing primitive saying so.
 */
export interface Completion {
  /**
   * Offer this keydown to the widget FIRST, and say whether it was taken.
   *
   * The arrows, Enter and Escape all mean something in a row's editor already
   * (`../keys.ts`), so the order matters and it is this way round for the
   * reason every editor with a completion in it chooses: while a list is up,
   * those keys are the list's. Everything else — every character, `Tab`,
   * `Ctrl+Enter` — goes straight through, so the widget never takes a key it
   * has no answer for.
   */
  readonly key: (event: KeyboardEvent) => boolean
  /** The box, drawn where the field puts it. */
  readonly Panel: () => JSX.Element
}

/** What {@link Panel} reads — this module's own shape, not the consumer's. */
export interface Listing {
  /**
   * WHETHER THERE IS A BOX ON SCREEN, asked once.
   *
   * The panel's `<Show>` and the first line of `key` are the same question —
   * "nothing on screen takes nothing" is only true if the two agree — and they
   * were two formulas in two files, which is how a refused `((` search came to
   * draw a visible panel whose Escape fell straight through to the outline.
   */
  readonly showing: Accessor<boolean>
  /** Which widget is armed, or `null`. Drawn as a fact on the popup so a
   *  scenario can say WHICH list it is looking at. */
  readonly kind: Accessor<Trigger["kind"] | null>
  readonly choices: Accessor<ReadonlyArray<Choice>>
  readonly active: Accessor<number>
  readonly hover: (at: number) => void
  /** A refusal from whichever list is a question — the node search or the tag
   *  vocabulary — in its own words, never dropped (`../run.ts` forbids a silent
   *  handler). One slot, because one trigger is armed at a time. */
  readonly failure: Accessor<string | null>
}

export const createCompletion = (field: {
  /** What is in the editor right now. */
  readonly text: Accessor<string>
  /** Where the caret is in it. */
  readonly caret: Accessor<number>
  /** Put this text in the field and the caret at that offset — the DOM half,
   *  which is the one thing this hook cannot do for itself. */
  readonly rewrite: (next: Written) => void
  /**
   * The two OPS a completion can cause, handed in rather than reached for.
   *
   * They are the same kind of thing as `rewrite`: an effect at the edge, which
   * the caller has and this does not. Reaching for `useEditor()` here would
   * make this module a consumer of the row editor's context — a completion in
   * any other field would drag the outline's draft in with it — and would put
   * one verb-shaped member on that interface per widget.
   */
  readonly dated: (day: string) => void
  readonly mirrored: (target: string) => void
}): Completion => {
  const today = useToday()
  const [dismissed, setDismissed] = createSignal<string | null>(null)

  /** What the caret is inside, minus anything Escape has shut.
   *
   *  BY VALUE (`./trigger.ts`'s `sameTrigger`), because a parse mints a fresh
   *  object and the caret moves far more often than what is armed does — see
   *  that predicate for what a caret moving inside one `#tag` used to re-run. */
  const trigger = createMemo<Trigger | null>(() => {
    const found = triggerIn(field.text(), field.caret())
    return found === null || tokenOf(found) === dismissed() ? null : found
  }, null, { equals: sameTrigger })

  /** WHICH token a dismissal is about: the widget and where it starts, so the
   *  same `#` keeps its dismissal while it is being typed and a second one
   *  further along the line is a fresh offer. */
  const tokenOf = (found: Trigger): string => `${found.kind}:${found.from}`

  // The server's search, asked only while `((` is what is armed — the same
  // primitive, the same debounce and the same minimum the palette uses. RECORDS
  // ONLY: what this widget writes is a mirror, which names a node id.
  const nodes = createSearch(() => {
    const found = trigger()
    return found !== null && found.kind === "mirror" ? found.query : null
  }, "node")

  // ...and the set's own vocabulary, asked only while a `#` or an `@` is what
  // is armed (`./asking.ts`). The same debounce, the same latest-wins rule and
  // no minimum: a bare `#` is a question with an answer.
  const tags = createTags(() => {
    const found = trigger()
    return found !== null && found.kind === "tag"
      ? { sigil: found.sigil, query: found.query }
      : null
  })

  /** Replace the trigger's span with `insert`, in the field and in the draft.
   *  Empty takes the span out, which is what the two op widgets do. */
  const replace = (found: Trigger, insert: string): void => {
    field.rewrite(written(field.text(), found, insert, field.caret()))
  }

  /** A SWITCH rather than a chain of `if`s whose last arm is a fall-through:
   *  the three kinds and the three lists are one table the compiler checks, so
   *  a fourth trigger could not quietly render node hits. */
  const choices = createMemo<ReadonlyArray<Choice>>(() => {
    const found = trigger()
    if (found === null) return []
    switch (found.kind) {
      case "date":
        return naturalDays(found.query, today()).map((named) => ({
          id: named.day,
          label: named.phrase,
          hint: dayLabel(named.day),
          choose: () => {
            replace(found, "")
            field.dated(named.day)
          },
        }))
      case "tag":
        // The SERVER's vocabulary — every tag the set writes, counted and
        // ranked there (`@olai/format`'s `vocabulary.ts`), asked through
        // `./asking.ts`. The rows carry the name and the count; the SIGIL is
        // the question this widget asked, which is why it is read off the
        // trigger here rather than off each row.
        //
        // PUT BACK TOGETHER BY `tagText`, which is the inverse of the `tagPart`
        // the vocabulary took apart on the other side of the wire: that pair
        // exists so that where the sigil sits is not a claim made at a call
        // site, and re-spelling it here would be the round trip split across a
        // helper and a template literal.
        return tags.rows().map((tag) => {
          const written = tagText({ sigil: found.sigil, tag: tag.name })
          return {
          id: written,
          label: written,
          hint: `${tag.count}`,
          // The tag AND NOTHING ELSE — no trailing space, which is what
          // Workflowy adds and what this deliberately does not. A title is
          // stored verbatim, so a space nobody typed is a space in somebody's
          // git history; the caret is left right after the tag and the next
          // character is theirs.
          //
          // What ends the popup instead is the DISMISSAL: the token that has
          // just been completed is put away, so the very next Enter is the
          // row's own ("commit and open the next line") rather than a second
          // press of the row that has already been taken.
          choose: () => {
            replace(found, written)
            setDismissed(tokenOf(found))
          },
          }
        })
      case "mirror":
        // RECORDS, asked for on the request and answered in the type
        // (`../search/nodes.ts`): what this widget writes is a mirror, which
        // names a node id.
        return nodes.hits().map((hit) => ({
          id: hit.id,
          label: hit.title,
          place: nodePlace(hit),
          props: nodeProps(hit),
          choose: () => {
            replace(found, "")
            field.mirrored(hit.id)
          },
        }))
    }
  })

  // WHICH row Enter takes — the one cursor every shortlist in this client
  // shares (`../search/cursor.ts`), so the arrows mean the same thing here and
  // in the ⌘K palette, and so does what the bottom of a list does. It keeps a
  // list that got shorter under somebody honest, which the `((` rows need
  // because theirs arrive from the server.
  const cursor = createCursor(() => choices().length)

  // A keystroke means a different question: start again at the top, which is
  // the answer a person typing towards something wants. Keyed on the QUERY
  // rather than on the rows, so walking the list with the arrows does not reset
  // it and hits arriving from the server do not either.
  createEffect(on(() => trigger()?.query ?? null, cursor.top))

  /**
   * A refused CALL, from whichever list is a question — one accessor, because
   * the panel draws one sentence and which door could not be answered is not a
   * distinction a reader of the popup has any use for.
   *
   * THE SAME TABLE {@link choices} is, rather than `a.failure() ?? b.failure()`:
   * that spelling is right only while at most one asker holds a refusal at a
   * time, which is true and is a rule nothing checks. Read off the armed trigger
   * the answer is a fact the compiler keeps — a fourth widget could not quietly
   * inherit the node search's error.
   */
  const failure = createMemo<string | null>(() => {
    const found = trigger()
    if (found === null) return null
    switch (found.kind) {
      // A day list is a pure function of a phrase and a calendar; there is
      // nothing it could be refused by.
      case "date":
        return null
      case "tag":
        return tags.failure()
      case "mirror":
        return nodes.failure()
    }
  })

  /**
   * HOW A KEY SPENDS A ROW of whatever is armed — through the answer that row
   * came from (`../settled.ts`'s `Taking`).
   *
   * It exists because a list HOLDS STILL through a settle and a flight — the
   * rows a reader is looking at stay until the next ones arrive
   * (`../settled.ts`) — which is right to draw and wrong to write from. A `((`
   * take mints a placement and a `#` take rewrites the line, so `Enter`
   * pressed within 200ms of a keystroke would spend the PREVIOUS prefix's row.
   *
   * THE SAME TABLE {@link choices} and {@link failure} are, and for their
   * reason: which list a trigger draws from is a fact the compiler keeps, so a
   * fourth widget cannot quietly inherit the node search's answer about
   * staleness either.
   *
   * A DAY LIST is never behind: `naturalDays` is a pure function of a phrase
   * and a calendar, computed from the trigger in hand — which is exactly what
   * `atOnce` names.
   *
   * A PLAIN FUNCTION rather than a memo, which {@link Listing.showing} beside
   * it already is and for the same reason: nothing DRAWS this, its one reader
   * is a keydown, and a memo would be a graph node recomputing on every
   * keystroke and every caret move for a value wanted once per `Enter`.
   */
  const taking = (): Taking => {
    const found = trigger()
    // Nothing armed spends nothing — and the key handler below has already
    // returned by then, so this is the arm that cannot be reached rather than
    // a second rule.
    if (found === null) return () => undefined
    switch (found.kind) {
      case "date":
        return atOnce
      case "tag":
        return tags.taking
      case "mirror":
        return nodes.taking
    }
  }

  const listing: Listing = {
    // A box is on screen when something is armed AND it has something to say —
    // rows, or a refusal from whichever list is the server's. One rule, read by
    // the panel and by the keys below.
    showing: () => trigger() !== null && (choices().length > 0 || failure() !== null),
    kind: () => trigger()?.kind ?? null,
    choices,
    active: cursor.at,
    hover: cursor.to,
    failure,
  }

  return {
    Panel: () => <Completions listing={listing} />,
    key: (event) => {
      const found = trigger()
      // NOTHING ON SCREEN TAKES NOTHING. A trigger with no matches draws no
      // popup, and a key that a person cannot see the effect of must go on
      // meaning what it has always meant — Escape abandons the draft, the
      // arrows walk the outline. Claiming keys off the armed trigger rather
      // than off the visible list made Escape in a row with a `#nomatch` in it
      // do nothing at all, which is the worst answer of the three.
      if (found === null || !listing.showing()) return false
      // WHICH key it is, is the registry's (`../keys.ts`) — a component
      // matching Escape and the arrows privately is exactly the silent
      // disagreement that file exists to make impossible. What each one MEANS
      // is this file's.
      switch (listKey(event)) {
        case "dismiss":
          // Shuts the POPUP and keeps the draft — see the header.
          setDismissed(tokenOf(found))
          return true
        case "next":
          cursor.step(1)
          return true
        case "prev":
          cursor.step(-1)
          return true
        case "take": {
          // Nothing to take is not a key: a panel can be up saying only that
          // the search was refused, and swallowing Enter there would be a
          // keystroke that does nothing at all.
          const choice = choices()[cursor.at()]
          if (choice === undefined) return false
          // ...and rows that answer an older prefix are not this KEY's to
          // take ({@link taking}) — where a POINTER's press on one still is,
          // which is why the guard is here rather than inside `choose`: a hand
          // on a row is a hand on the row it can SEE, and taking it is what
          // that hand asked for. Enter is the one that means "the row under the
          // cursor", and the cursor's row is about to change underneath it.
          //
          // CLAIMED all the same: a list is on screen under the caret, and an
          // `Enter` falling through to the row's own handler would end the
          // line the reader is still typing a tag into.
          taking()(choice.choose)
          return true
        }
        case null:
          return false
      }
    },
  }
}
