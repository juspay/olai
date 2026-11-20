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
  readonly showing: Accessor<boolean>
  readonly offered: ReadonlyArray<Offered>
  readonly dismiss: () => void
}): Completion => {
  const choices: ReadonlyArray<Choice> = field.offered.map((one) => ({ ...one, taking: atOnce }))
  const cursor = createCursor(() => choices.length)
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
