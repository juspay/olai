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
 *   - a TAG is enumerated from the loaded set, by the format's own walk
 *     (`./tags.ts`, which argues why this one is not the server's).
 *   - a NODE is the SERVER's search — `../search/nodes.ts`, the same primitive
 *     the ⌘K palette and the header box call, debounce and all. A third door
 *     onto one reading, which is the rule that file exists to keep.
 *
 * ## What choosing one writes
 *
 * A TAG is text: the span is replaced in the draft and nothing is sent, because
 * a tag lives inline in the title and the draft commits like any other typing.
 * The other two are OPS — `set_date` and `add_mirror`, through the editor's own
 * gate (`../edit/editing.tsx`) — and both take their trigger's text back OUT of
 * the line first, because `!next fri` is not something anybody wants left in a
 * title.
 */

import { type Accessor, createEffect, createMemo, createSignal, on } from "solid-js"

import { useDerived } from "../derived.tsx"
import { useEditor } from "../edit/editing.tsx"
import { nodePlace } from "../palette/items.ts"
import { createNodeSearch } from "../search/nodes.ts"
import { useToday } from "../today.tsx"
import { dayLabel, naturalDays } from "../date/natural.ts"
import { matchTags, tagsOf } from "./tags.ts"
import { triggerIn, type Trigger, type Written, written } from "./trigger.ts"

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
  readonly choose: () => void
}

export interface Completion {
  /** Which widget is armed, or `null`. Drawn as a fact on the popup so a
   *  scenario can say WHICH list it is looking at. */
  readonly kind: Accessor<Trigger["kind"] | null>
  readonly choices: Accessor<ReadonlyArray<Choice>>
  readonly active: Accessor<number>
  readonly hover: (at: number) => void
  /** A refusal from the node search, in its own words — never dropped
   *  (`../run.ts` forbids a silent handler). */
  readonly failure: Accessor<string | null>
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
}

export const createCompletion = (field: {
  /** What is in the editor right now. */
  readonly text: Accessor<string>
  /** Where the caret is in it. */
  readonly caret: Accessor<number>
  /** Put this text in the field and the caret at that offset — the DOM half,
   *  which is the one thing this hook cannot do for itself. */
  readonly rewrite: (next: Written) => void
}): Completion => {
  const editor = useEditor()
  const derived = useDerived()
  const today = useToday()
  const [dismissed, setDismissed] = createSignal<string | null>(null)
  const [active, setActive] = createSignal(0)

  /** What the caret is inside, minus anything Escape has shut. */
  const trigger = createMemo<Trigger | null>(() => {
    const found = triggerIn(field.text(), field.caret())
    return found === null || tokenOf(found) === dismissed() ? null : found
  })

  /** WHICH token a dismissal is about: the widget and where it starts, so the
   *  same `#` keeps its dismissal while it is being typed and a second one
   *  further along the line is a fresh offer. */
  const tokenOf = (found: Trigger): string => `${found.kind}:${found.from}`

  /** The set's tags, re-counted when the live indexes move and not per
   *  keystroke. */
  const tags = createMemo(() => tagsOf(derived()))

  // The server's search, asked only while `((` is what is armed — the same
  // primitive, the same debounce and the same minimum the palette uses.
  const nodes = createNodeSearch(() => {
    const found = trigger()
    return found !== null && found.kind === "mirror" ? found.query : null
  })

  /** Replace the trigger's span with `insert`, in the field and in the draft.
   *  Empty takes the span out, which is what the two op widgets do. */
  const replace = (found: Trigger, insert: string): void => {
    field.rewrite(written(field.text(), found, insert, field.caret()))
  }

  const choices = createMemo<ReadonlyArray<Choice>>(() => {
    const found = trigger()
    if (found === null) return []
    if (found.kind === "date") {
      return naturalDays(found.query, today()).map((named) => ({
        id: named.day,
        label: named.phrase,
        hint: dayLabel(named.day),
        choose: () => {
          replace(found, "")
          editor.dated(named.day)
        },
      }))
    }
    if (found.kind === "tag") {
      return matchTags(tags(), found.sigil, found.query).map((tag) => ({
        id: `${tag.sigil}${tag.name}`,
        label: `${tag.sigil}${tag.name}`,
        hint: `${tag.count}`,
        // The tag AND NOTHING ELSE — no trailing space, which is what Workflowy
        // adds and what this deliberately does not. A title is stored verbatim,
        // so a space nobody typed is a space in somebody's git history; the
        // caret is left right after the tag and the next character is theirs.
        //
        // What ends the popup instead is the DISMISSAL: the token that has just
        // been completed is put away, so the very next Enter is the row's own
        // ("commit and open the next line") rather than a second press of the
        // row that has already been taken.
        choose: () => {
          replace(found, `${tag.sigil}${tag.name}`)
          setDismissed(tokenOf(found))
        },
      }))
    }
    return nodes.hits().map((hit) => ({
      id: hit.id,
      label: hit.title,
      place: nodePlace(hit),
      choose: () => {
        replace(found, "")
        editor.mirrored(hit.id)
      },
    }))
  })

  // A keystroke means a different list: start again at the top, which is the
  // answer a person typing towards something wants. Keyed on the QUERY rather
  // than on the rows, so walking the list with the arrows does not reset it and
  // hits arriving from the server do not either.
  createEffect(on(() => trigger()?.query ?? null, () => setActive(0)))
  // ...and a list that got shorter while somebody was standing near the bottom
  // of it — which only the server-fed one can do — keeps the cursor on a row
  // that exists. The palette's own guard, one directory over.
  createEffect(() => {
    const many = choices().length
    if (active() >= many) setActive(many === 0 ? 0 : many - 1)
  })

  const step = (by: 1 | -1): void => {
    const many = choices().length
    if (many === 0) return
    setActive((at) => (at + by + many) % many)
  }

  return {
    kind: () => trigger()?.kind ?? null,
    choices,
    active,
    hover: setActive,
    failure: nodes.failure,
    key: (event) => {
      const found = trigger()
      // NOTHING ON SCREEN TAKES NOTHING. A trigger with no matches draws no
      // popup, and a key that a person cannot see the effect of must go on
      // meaning what it has always meant — Escape abandons the draft, the
      // arrows walk the outline. Claiming keys off the armed trigger rather
      // than off the visible list made Escape in a row with a `#nomatch` in it
      // do nothing at all, which is the worst answer of the three.
      if (found === null || choices().length === 0) return false
      // Escape shuts the POPUP and keeps the draft — see the header.
      if (event.key === "Escape") {
        setDismissed(tokenOf(found))
        return true
      }
      if (event.key === "ArrowDown") {
        step(1)
        return true
      }
      if (event.key === "ArrowUp") {
        step(-1)
        return true
      }
      // A bare Enter only: `Ctrl+Enter` is the mark and `Shift+Enter` the note,
      // and neither stops being itself because a list is up.
      if (
        event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.shiftKey &&
        !event.altKey
      ) {
        choices()[active()]?.choose()
        return true
      }
      return false
    },
  }
}
