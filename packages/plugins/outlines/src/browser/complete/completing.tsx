import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  type Signal,
  on,
} from "solid-js"

import { tagText } from "@olai/format"

import { Completions } from "./Completions.tsx"
import { nodePlace, type Place } from "olai-plugin-search/ui/place.ts"
import { type NodeProp, nodeProps } from "olai-plugin-search/ui/props.ts"
import { createCursor } from "@olai/ui-primitives/cursor.ts"
import { createSearch } from "../search.ts"
import { atOnce, spend, type Taking } from "@olai/web/client/settled.ts"
import { useToday } from "../clock.ts"
import { dayLabel, naturalDays } from "../date/natural.ts"
import { createTags } from "./asking.ts"
import { listKey } from "@olai/web/client/keys.ts"
import { sameTrigger, triggerIn, type Trigger, type Written, written } from "./trigger.ts"

export interface Choice {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly place?: Place
  readonly props?: ReadonlyArray<NodeProp>
  readonly from?: string
  readonly choose: () => void
  readonly taking: Taking
}

export interface Completion {
  /**
   * The arrows, Enter and Escape all mean something in a row's editor already
   * (`../keys.ts`), so the order matters and it is this way round for the
   * reason every editor with a completion in it chooses: while a list is up,
   * those keys are the list's.
   */
  readonly key: (event: KeyboardEvent) => boolean
  readonly Panel: () => JSX.Element
}

export interface Listing {
  readonly showing: Accessor<boolean>
  readonly kind: Accessor<Trigger["kind"] | "filter" | null>
  readonly choices: Accessor<ReadonlyArray<Choice>>
  readonly active: Accessor<number>
  readonly hover: (at: number) => void
  readonly failure: Accessor<string | null>
}

export const createCompletion = (field: {
  readonly dismissal?: Signal<string | null>
  readonly text: Accessor<string>
  readonly caret: Accessor<number>
  readonly rewrite: (next: Written) => void
  readonly dated: (day: string) => void
  readonly mirrored: (target: string) => void
}): Completion => {
  const today = useToday()
  const [dismissed, setDismissed] = field.dismissal ?? createSignal<string | null>(null)

  const trigger = createMemo<Trigger | null>(() => {
    const found = triggerIn(field.text(), field.caret())
    return found === null || tokenOf(found) === dismissed() ? null : found
  }, null, { equals: sameTrigger })

  const tokenOf = (found: Trigger): string => `${found.kind}:${found.from}`

  const nodes = createSearch(() => {
    const found = trigger()
    return found !== null && found.kind === "mirror" ? found.query : null
  }, "node")

  const tags = createTags(() => {
    const found = trigger()
    return found !== null && found.kind === "tag"
      ? { sigil: found.sigil, query: found.query }
      : null
  })

  const replace = (found: Trigger, insert: string): void => {
    field.rewrite(written(field.text(), found, insert, field.caret()))
  }

  const choices = createMemo<ReadonlyArray<Choice>>(() => {
    const found = trigger()
    if (found === null) return []
    switch (found.kind) {
      case "date":
        return naturalDays(found.query, today()).map((named) => ({
          id: named.day,
          label: named.phrase,
          hint: dayLabel(named.day),
          taking: atOnce,
          choose: () => {
            replace(found, "")
            field.dated(named.day)
          },
        }))
      case "tag":
        return tags.rows().map((tag) => {
          const written = tagText({ sigil: found.sigil, tag: tag.name })
          return {
          id: written,
          label: written,
          from: "",
          hint: `${tag.count}`,
          taking: tags.taking,
          choose: () => {
            replace(found, written)
            setDismissed(tokenOf(found))
          },
          }
        })
      case "mirror":
        return nodes.hits().map((hit) => ({
          id: hit.id,
          label: hit.title,
          from: hit.file,
          place: nodePlace(hit),
          props: nodeProps(hit),
          taking: nodes.taking,
          choose: () => {
            replace(found, "")
            field.mirrored(hit.id)
          },
        }))
    }
  })

  const cursor = createCursor(() => choices().length)

  createEffect(on(() => trigger()?.query ?? null, cursor.top))

  const failure = createMemo<string | null>(() => {
    const found = trigger()
    if (found === null) return null
    switch (found.kind) {
      case "date":
        return null
      case "tag":
        return tags.failure()
      case "mirror":
        return nodes.failure()
    }
  })

  const listing: Listing = {
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
      if (found === null || !listing.showing()) return false
      switch (listKey(event)) {
        case "dismiss":
          setDismissed(tokenOf(found))
          return true
        case "next":
          cursor.step(1)
          return true
        case "prev":
          cursor.step(-1)
          return true
        case "take": {
          const choice = choices()[cursor.at()]
          if (choice === undefined) return false
          spend(choice, (one) => one.choose())
          return true
        }
        case null:
          return false
      }
    },
  }
}
