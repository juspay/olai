/**
 * A FIXED SHORTLIST UNDER A FIELD — the completion box, offering a list the
 * field already knows rather than one a trigger asks the server for.
 *
 * Its one caller is the filter bar's syntax hint (`../filter/FilterBar.tsx`):
 * a focused, empty box offers the forms its grammar takes, and a form chosen
 * goes into the box. It is the same box, the same rows and the same keys as the
 * row editor's three widgets (`./completing.tsx`), so the popover is not a
 * second one to learn or to keep anchored: `./Completions.tsx` draws it, from
 * the outline row's overlay socket, and it goes when the field that drew it
 * goes — the `<Show>` in that component is its whole lifetime.
 *
 * ONE DIFFERENCE from a trigger's list, and it is on purpose: nothing is
 * active until an arrow says so. A trigger's list is an answer to what was
 * typed, so its top row is a guess worth offering to Enter; this list is a
 * reminder shown before anything was typed, and an Enter in an empty filter
 * must go on meaning nothing rather than filling the box with the first form.
 */
import { type Accessor, createEffect, createSignal, on } from "solid-js"

import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { listKey } from "@olai/web/client/keys.ts"
import { atOnce } from "@olai/web/client/settled.ts"

import type { Choice, Completion, Listing } from "./completing.tsx"
import { Completions } from "./Completions.tsx"

export interface Offered {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly choose: () => void
}

export const createOffer = (field: {
  /** Whether the list is up — the field's own answer (focused, empty, not
   *  shut by Escape). */
  readonly showing: Accessor<boolean>
  readonly offered: ReadonlyArray<Offered>
  /** What Escape does: puts the list away and leaves the caret where it is. */
  readonly dismiss: () => void
}): Completion => {
  const choices: ReadonlyArray<Choice> = field.offered.map((one) => ({ ...one, taking: atOnce }))
  const cursor = createCursor(() => choices.length)
  /** Whether an arrow has put the cursor on a row since the list came up. */
  const [walked, setWalked] = createSignal(false)
  createEffect(on(field.showing, () => {
    setWalked(false)
    cursor.top()
  }))

  const listing: Listing = {
    showing: field.showing,
    kind: () => "filter",
    choices: () => choices,
    active: () => (walked() ? cursor.at() : -1),
    hover: (at) => {
      setWalked(true)
      cursor.to(at)
    },
    failure: () => null,
  }

  return {
    Panel: () => <Completions listing={listing} />,
    key: (event) => {
      if (!field.showing()) return false
      switch (listKey(event)) {
        case "dismiss":
          field.dismiss()
          return true
        case "next":
          if (walked()) cursor.step(1)
          else setWalked(true)
          return true
        case "prev":
          if (walked()) cursor.step(-1)
          else {
            setWalked(true)
            cursor.to(choices.length - 1)
          }
          return true
        case "take": {
          if (!walked()) return false
          choices[cursor.at()]?.choose()
          return true
        }
        case null:
          return false
      }
    },
  }
}
