import {
  deadLinkSaid,
  customOf,
  type LocatedRegular,
} from "@olai/format"
import { useReading } from "./reading.tsx"
import { TESTID } from "olai-plugin-outlines/testids"
import { createMemo, Show } from "solid-js"

import { PluginFolds } from "./Folds.tsx"
import { For } from "solid-js"
import { excerptOf } from "./note/excerpt.ts"
import { NoteLine } from "./note/Line.tsx"
import { measuredAt, plainLine } from "./note/preview.ts"
import { Note } from "./Note.tsx"
import { useLicences } from "./reading.tsx"
import { dressed } from "./faces.ts"
import { customEntries, drawerEntries } from "olai-plugin-outlines/property-values"
import { PropsDrawer, type SetProp } from "./props/PropsDrawer.tsx"
import { EdgeRefs } from "./edges/EdgeRefs.tsx"
import { ROW_NOTE } from "@olai/ui-primitives/touch.ts"
import { Tip } from "@olai/web/client/Tip.tsx"

const EDIT_NOTE = "Edit note"

export function NodeBody(props: {
  readonly record?: string
  readonly shows: LocatedRegular
  readonly zoomed?: boolean
  readonly expanded?: boolean
  readonly preview?: boolean
  readonly onToggle?: () => void
  readonly noteHit?: ReadonlyArray<string>
  readonly onEdit?: (caret?: number) => void
  readonly onUnsee?: (target: string) => void
  readonly onProp?: SetProp
  readonly addingProp?: boolean
  readonly onAddingPropEnd?: () => void
}) {
  const reading = useReading()
  const dead = () => reading()?.deadLinks?.[props.shows.node.id] ?? []
  const licences = useLicences()
  const zoomed = () => props.zoomed === true
  const open = () => props.expanded === true
  const line = createMemo(() => {
    const needles = props.noteHit
    if (needles !== undefined && needles.length > 0) {
      const desc = props.shows.node.desc
      const runs = desc === undefined || desc === ""
        ? undefined
        : excerptOf(desc, needles)
      if (runs !== undefined) return { runs, hit: true }
    }
    if (props.preview !== true) return undefined
    const desc = props.shows.node.desc
    if (desc === undefined || desc === "") return undefined
    return { runs: [{ text: plainLine(desc), lit: false }], hit: false }
  })

  return (
    <>
    <Show
      when={zoomed()}
      fallback={
        <>
          <PropsDrawer
            entries={customEntries(customOf(props.shows.node), {
              kind: (key, value) => licences()(props.shows.file, key, value),
              at: kind => dressed("outline.row.placement").get(kind),
            })}
            from={props.shows.file}
            onSet={props.onProp}
            adding={props.addingProp}
            onAddingEnd={props.onAddingPropEnd}
          />

          <PluginFolds node={props.shows.node.id} record={props.record} />

          <Show when={!open() ? line() : undefined}>
            {(one) => (
              <NoteLine
                runs={one().runs}
                hit={one().hit}
                onOpen={(at) => {
                  if (
                    at !== undefined && !one().hit &&
                    props.onEdit !== undefined
                  ) {
                    props.onEdit(measuredAt(props.shows.node.desc ?? "", at))
                    return
                  }
                  props.onToggle?.()
                }}
              />
            )}
          </Show>

          <Show when={open()}>
            <div class="olai-row-detail" data-open="true">
              <Show when={props.shows.node.desc}>
                {(desc) => (
                  <Tip text={EDIT_NOTE}>
                    <div
                      class={`mt-0.5 mb-1 cursor-text ${ROW_NOTE}`}
                      role="button"
                      tabindex={0}
                      onClick={(event) => {
                        if (event.target instanceof Element && event.target.closest("a")) return
                        event.stopPropagation()
                        props.onEdit?.()
                      }}
                      onKeyDown={(event) => {
                        if (event.target instanceof Element && event.target.closest("a")) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          props.onEdit?.()
                        }
                      }}
                    >
                      <Note
                        desc={desc()}
                        from={props.shows.file}
                        open
                      />
                      <span class="sr-only">{EDIT_NOTE}</span>
                    </div>
                  </Tip>
                )}
              </Show>
              <EdgeRefs node={props.shows.node} relation="see" onRemove={props.onUnsee} />
            </div>
          </Show>
        </>
      }
    >
      <PropsDrawer
        entries={drawerEntries(props.shows.node)}
        from={props.shows.file}
        onSet={props.onProp}
        adding={props.addingProp}
        onAddingEnd={props.onAddingPropEnd}
      />
      <Show when={props.shows.node.desc}>
        {(desc) => (
          <Note
            desc={desc()}
            from={props.shows.file}
            class="mt-2 text-muted"
          />
        )}
      </Show>
      <EdgeRefs node={props.shows.node} relation="see" onRemove={props.onUnsee} />
    </Show>
    <For each={dead()}>{link => <div data-testid={TESTID.deadLink} class="text-label text-alarm opacity-80">{deadLinkSaid(link)}</div>}</For>
    </>
  )
}
