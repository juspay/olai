import { Dynamic } from "solid-js/web"
import { TESTID as IDS_OUTLINES } from "olai-plugin-outlines/testids"
import { TESTID as IDS_UI_PRIMITIVES } from "@olai/ui-primitives/testids.ts"
import { Key } from "@solid-primitives/keyed"
import { createMemo, createSignal, For, Index, Show } from "solid-js"

import type { Entry } from "olai-plugin-outlines/property-values"
import { type Door, doorFor } from "./door.ts"

import { type BlockChrome, layOut } from "../live/seam.ts"
import { DRESSINGS } from "../live/dressings.ts"
import { Handle } from "./handle.tsx"
import { type ClosedBy, type Editing, leavingCommits, openedOn, sending, writes } from "./editor.ts"
import { Link } from "olai-plugin-navigation/routing"
import { useDoors, useLicences, useNames } from "../reading.tsx"
import { composing } from "@olai/web/client/composition.ts"
import type { Said } from "@olai/web/client/saying.ts"
import { createSaying } from "@olai/web/client/saying.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"

import { TARGET } from "@olai/ui-primitives/touch.ts"

const BLOCK_CHROME: BlockChrome = {
  Handle,
  factId: IDS_UI_PRIMITIVES.prop,
  valueId: IDS_UI_PRIMITIVES.propValue,
}

const FOLDS_PAST = 56

const SUMMARISED_AT = 40

// Kobalte moves focus onto the pressed `•••` menu item as that menu closes,
// after any microtask, so a microtask-scheduled focus is taken away one beat
// later. A macrotask lands after it.
const afterMicrotasks = (task: () => void): void => { setTimeout(task, 0) }

export type SetProp = (key: string, value: string, was: string | null) => Promise<Said | undefined>

export function PropsDrawer(props: {
  readonly entries: ReadonlyArray<Entry>
  readonly from: string
  readonly onSet?: SetProp
  readonly adding?: boolean
  readonly onAddingEnd?: () => void
}) {
  const names = useNames()
  const doors = useDoors()
  const doorOf = (key: string, value: string): Door | null => {
    const opens = doors()(props.from, key, value)
    return opens === undefined ? null : doorFor(opens, value, names())
  }

  const [editing, setEditing] = createSignal<Editing | null | undefined>(undefined)
  const [paned, setPaned] = createSignal<string | undefined>(undefined)
  const naming = () => editing() === null || props.adding === true
  const saying = createSaying()
  const licences = useLicences()
  const laid = createMemo(() =>
    layOut(
      props.entries,
      editing()?.key,
      (key, value) => licences()(props.from, key, value),
      DRESSINGS,
    )
  )

  const close = (): void => {
    setEditing(undefined)
    props.onAddingEnd?.()
  }

  const commit = async (was: Editing | null, key: string, value: string): Promise<void> => {
    close()
    if (!writes(was, key, value)) {
      saying.say(null)
      return
    }
    const sent = sending(was, key, value)
    saying.say(await props.onSet?.(sent.key, sent.value, sent.was))
  }

  return (
    <>
      <Show when={laid().run.length > 0 || naming()}>
        <div
          class="mt-0.5 mb-1 flex flex-wrap items-baseline gap-1 text-body leading-snug"
          data-testid={IDS_UI_PRIMITIVES.props}
        >
        <Key each={laid().run} by={keyOf}>
          {(laid) => (
            <>
              <Chip
                entry={laid().entry}
                doorOf={doorOf}
                open={openedOn(editing(), laid().entry)}
                onOpen={props.onSet === undefined
                  ? undefined
                  : () => setEditing({ key: laid().entry.key, value: laid().entry.value })}
                onCommit={(was, value) => void commit(was, "", value)}
                onCancel={close}
              />
              <Dynamic component={laid().chip}
                entry={laid().entry}
                onOpen={props.onSet === undefined ? undefined : () => setEditing({ key: laid().entry.key, value: laid().entry.value })}
                chrome={BLOCK_CHROME}
                opened={paned() === laid().entry.key}
                onToggle={laid().pane === undefined ? undefined : () => {
                  const key = laid().entry.key
                  setPaned(was => was === key ? undefined : key)
                }}
              />
            </>
          )}
        </Key>
        <Show when={naming()}>
          <NewChip
            onCommit={(key, value) => void commit(null, key, value)}
            onCancel={close}
          />
        </Show>
        <Show when={props.onSet !== undefined && laid().run.length > 0 && !naming()}>
          <Tip text="Add property">
            <button
              type="button"
              class={`${CHIP} cursor-pointer items-baseline rounded-full text-muted hover:text-accent`}
              data-testid={IDS_OUTLINES.propAdd}
              aria-label="Add property"
              onClick={(event) => {
                event.stopPropagation()
                setEditing(null)
              }}
            >
              +
            </button>
          </Tip>
        </Show>
        </div>
      </Show>
      <Key each={laid().blocks} by={one => one.entry.key}>{one =>
        <Dynamic component={one().block} entry={one().entry} chrome={BLOCK_CHROME}
          onOpen={props.onSet === undefined ? undefined : () => setEditing({ key: one().entry.key, value: one().entry.value })} />
      }</Key>
      <Key each={laid().run.filter(one => one.pane !== undefined && paned() === one.entry.key)} by={one => one.entry.key}>{one =>
        <Dynamic component={one().pane} entry={one().entry} chrome={BLOCK_CHROME}
          onOpen={props.onSet === undefined ? undefined : () => setEditing({ key: one().entry.key, value: one().entry.value })} />
      }</Key>
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-1 text-label"
            testid={IDS_OUTLINES.propSaid}
          />
        )}
      </Show>
    </>
  )
}

const NO_DOOR = (_key: string, _value: string): null => null

const CHIP = "inline-flex min-w-0 max-w-full gap-1.5 border border-rule bg-panel px-2 py-px"

function Chip(props: {
  readonly entry: Entry
  readonly doorOf: (key: string, value: string) => Door | null
  readonly open?: Editing
  readonly onOpen?: () => void
  readonly onCommit: (was: Editing, value: string) => void
  readonly onCancel: () => void
}) {
  const doors = createMemo(() => {
    const ask = props.entry.system ? NO_DOOR : props.doorOf
    return props.entry.values.map((one) => ask(props.entry.key, one))
  })
  const folds = () =>
    props.entry.value.length > FOLDS_PAST && doors().every((one) => one === null)
  const opens = () => (props.entry.system ? undefined : props.onOpen)
  return (
    <span
      class={CHIP}
      classList={{
        "items-baseline rounded-full": !folds(),
        "items-start rounded-control": folds(),
      }}
      data-testid={IDS_UI_PRIMITIVES.prop}
      data-key={props.entry.key}
      data-system={props.entry.system ? "true" : undefined}
    >
      <Handle label={props.entry.key} onOpen={opens()} />
      <Show
        when={props.open}
        fallback={
          <Show
            when={folds()}
            fallback={
              <span class="min-w-0 break-words text-ink" data-testid={IDS_UI_PRIMITIVES.propValue}>
                <Values
                  values={props.entry.values}
                  doors={doors()}
                  onOpen={opens()}
                />
              </span>
            }
          >
            <Folded value={props.entry.value} />
          </Show>
        }
      >
        {(was) => {
          const snapshot = was()
          let answeredBy: ClosedBy = null
          return (
            <Box
              testid={IDS_OUTLINES.propEdit}
              about={props.entry.key}
              value={snapshot.value}
              wide
              focus
              closedBy={() => answeredBy}
              onCommit={(value) => {
                answeredBy = "enter"
                props.onCommit(snapshot, value)
              }}
              onLeave={(value) => props.onCommit(snapshot, value)}
              onCancel={() => {
                answeredBy = "escape"
                props.onCancel()
              }}
            />
          )
        }}
      </Show>
    </span>
  )
}

function Values(props: {
  readonly values: ReadonlyArray<string>
  readonly doors: ReadonlyArray<Door | null>
  readonly onOpen?: () => void
}) {
  return (
    <Index each={props.values}>
      {(value, index) => (
        <>
          <Show when={index > 0}>
            <span class="text-muted" aria-hidden="true">, </span>
          </Show>
          <Value
            value={value()}
            door={props.doors[index] ?? null}
            onOpen={props.onOpen}
          />
        </>
      )}
    </Index>
  )
}

function Value(props: {
  readonly value: string
  readonly door: Door | null
  readonly onOpen?: () => void
}) {
  const unsaid = (door: Door): string | undefined =>
    door.face === props.value ? undefined : door.says
  /**
   * `role="img"` with a name and no words: a bare span's `aria-label` is not a
   * name the platform exposes, and an element with a role is. An `aria-label`
   * on the anchor would take the face off the platform's reading of it
   * (WCAG 2.5.3).
   */
  const Stored = (one: { readonly door: Door }) => (
    <Show when={unsaid(one.door)}>
      {(id) => <span role="img" aria-label={id()} />}
    </Show>
  )
  return (
    <Show when={props.door} fallback={<Plain value={props.value} onOpen={props.onOpen} />}>
      {(door) => (
        <span data-door={door().kind}>
          <Show
            when={awayFrom(door())}
            fallback={
              <Link route={inApp(door())} class={LINKED} tip={door().says}>
                <Face value={door().face} day={door().kind === "day"} />
                <Stored door={door()} />
              </Link>
            }
          >
            {(href) => (
              <Tip text={door().says}>
                <a
                  class={LINKED}
                  href={href()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Face value={door().face} day={false} />
                  <Stored door={door()} />
                </a>
              </Tip>
            )}
          </Show>
        </span>
      )}
    </Show>
  )
}

function Plain(props: { readonly value: string; readonly onOpen?: () => void }) {
  return (
    <Show when={props.onOpen} fallback={<>{props.value}</>}>
      {(open) => (
        <Tip text="Change">
          <button
            type="button"
            class="cursor-text text-left hover:text-accent"
            onClick={(event) => {
              event.stopPropagation()
              open()()
            }}
          >
            {props.value}
          </button>
        </Tip>
      )}
    </Show>
  )
}

function Face(props: {
  readonly value: string
  readonly day: boolean
}) {
  return (
    <Show when={props.day} fallback={<Clamped value={props.value} />}>
      <span class="rounded-full bg-pill px-1.5">{props.value}</span>
    </Show>
  )
}

function Clamped(props: { readonly value: string }) {
  return (
    <span class="inline-block max-w-[min(22rem,100%)] truncate align-bottom">
      {props.value}
    </span>
  )
}

function Folded(props: { readonly value: string }) {
  const summary = createMemo(() => shortened(props.value))
  return (
    <details class="min-w-0" data-testid={IDS_OUTLINES.propFold}>
      <summary
        class="cursor-pointer list-none break-words text-ink marker:content-none"
        onClick={(event) => event.stopPropagation()}
      >
        <span data-testid={IDS_UI_PRIMITIVES.propValue}>{summary()}</span>
        <span class="ml-1 text-muted" aria-hidden="true">▾</span>
      </summary>
      <div class="mt-1 break-words text-ink">{props.value}</div>
    </details>
  )
}

function NewChip(props: {
  readonly onCommit: (key: string, value: string) => void
  readonly onCancel: () => void
}) {
  const [key, setKey] = createSignal("")
  const [value, setValue] = createSignal("")
  let box: HTMLInputElement | undefined
  let answeredBy: ClosedBy = null
  const cancel = (): void => {
    answeredBy = "escape"
    props.onCancel()
  }
  return (
    <span
      class={`${CHIP} items-baseline rounded-full`}
      onFocusOut={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        if (!leavingCommits(answeredBy)) return
        props.onCommit(key(), value())
      }}
    >
      <Box
        testid={IDS_OUTLINES.propEditKey}
        value=""
        placeholder="Name"
        focus
        mono
        onInput={setKey}
        onCommit={() => box?.focus()}
        onCancel={cancel}
      />
      <Box
        testid={IDS_OUTLINES.propEdit}
        value=""
        placeholder="Value"
        wide
        ref={(element) => (box = element)}
        onInput={setValue}
        onCommit={(typed) => {
          answeredBy = "enter"
          props.onCommit(key(), typed)
        }}
        onCancel={cancel}
      />
    </span>
  )
}

function Box(props: {
  readonly testid: string
  readonly about?: string
  readonly value: string
  readonly placeholder?: string
  readonly focus?: boolean
  readonly mono?: boolean
  readonly wide?: boolean
  readonly ref?: (element: HTMLInputElement) => void
  readonly onInput?: (value: string) => void
  readonly onCommit: (value: string) => void
  readonly onCancel: () => void
  readonly onLeave?: (value: string) => void
  readonly closedBy?: () => ClosedBy
}) {
  const [held, setHeld] = createSignal(props.value)
  return (
    <input
      type="text"
      class={`${TARGET} md:min-h-0 min-w-0 rounded-control border border-rule bg-paper px-1 py-0 text-ink`}
      classList={{
        "font-mono text-caption w-16": props.mono === true,
        "flex-1 min-w-28 text-body": props.wide === true,
      }}
      data-testid={props.testid}
      data-key={props.about}
      placeholder={props.placeholder}
      enterkeyhint={props.mono === true ? "next" : "done"}
      autocomplete="off"
      autocorrect="off"
      autocapitalize="none"
      spellcheck={false}
      value={props.value}
      ref={(element) => {
        props.ref?.(element)
        afterMicrotasks(() => {
          if (props.focus === true) {
            element.focus()
            element.select()
          }
        })
      }}
      onClick={(event) => event.stopPropagation()}
      onInput={(event) => {
        setHeld(event.currentTarget.value)
        props.onInput?.(event.currentTarget.value)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.stopPropagation()
          // The key that picks a candidate in Japanese, Chinese or Korean
          // arrives as a `keydown` reading `Enter`.
          if (composing(event)) return
          props.onCommit(held())
          return
        }
        if (event.key === "Escape") {
          event.preventDefault()
          event.stopPropagation()
          props.onCancel()
        }
      }}
      onBlur={() => {
        if (!leavingCommits(props.closedBy?.() ?? null)) return
        props.onLeave?.(held())
      }}
    />
  )
}

const LINKED =
  "underline decoration-rule underline-offset-2 hover:text-accent hover:decoration-current"

const awayFrom = (door: Door): string | undefined =>
  door.kind === "away" ? door.href : undefined

const inApp = (door: Door) => {
  if (door.kind === "away") throw new Error("an external door asked for an app route")
  return door.route
}

const shortened = (value: string): string => {
  if (value.length <= SUMMARISED_AT) return value
  const cut = value.slice(0, SUMMARISED_AT)
  const space = cut.lastIndexOf(" ")
  return `${space > SUMMARISED_AT / 2 ? cut.slice(0, space) : cut}…`
}

const keyOf = (laid: { readonly entry: Entry }): string =>
  `${laid.entry.system ? "system" : "custom"}:${laid.entry.key}`
