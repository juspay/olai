import { rowElements } from "./row-elements.ts"
import { usePane } from "olai-plugin-navigation/pane"
import { usePaneId, useRouter, useShown } from "olai-plugin-navigation/routing"
import { TESTID as IDS_NAVIGATION } from "olai-plugin-navigation/testids"
import { TESTID as IDS_OUTLINES } from "olai-plugin-outlines/testids"
import { type Row, shownRecord } from "@olai/format"
import { createEffect, createSignal, onCleanup, Show } from "solid-js"

import { createDeclared } from "./declared.ts"
import { setFolded } from "./fold/memory.ts"
import { createFoldReading } from "./fold/reading.ts"
import { aim, failedSays, missedSays, shutAlong } from "./fold/landing.ts"
import { Editable } from "./edit/Editable.tsx"
import { DeleteFile } from "./files.tsx"
import { StartLine } from "./edit/StartLine.tsx"
import { useNarrowed } from "./filter/narrowed.tsx"
import { unfiltered } from "./filter/why.ts"
import { bringOntoScreen, selectNode } from "./focus.ts"
import { useHere, useLanding } from "olai-plugin-navigation/routing"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { createSaying } from "@olai/web/client/saying.ts"
import { concealDone, doneHiddenOn, revealDone } from "./settings/done.ts"

import { Tree } from "./Tree.tsx"

export function OutlinePage(props: {
  readonly file: string
  readonly rows: ReadonlyArray<Row>
  readonly held: ReadonlyArray<Row>
}) {
  const router = useRouter()
  const narrowed = useNarrowed()
  const folds = createFoldReading()
  const pane = usePane()
  const paneId = usePaneId()
  const shown = useShown()
  const here = useHere()
  const landing = useLanding(() => props.file)

  const saying = createSaying()
  const [lost, setLost] = createSignal<ReadonlySet<string>>(new Set())
  const declared = createDeclared((message, ids) => {
    console.warn(
      "olai: could not ask the set what the landing names, so the arrival is still owed —",
      message,
    )
    setLost((before) => {
      const next = new Set(before)
      for (const id of ids) next.add(id)
      return next
    })
  })
  let owing: {
    readonly file: string | undefined
    readonly id: string | undefined
    said: undefined | "failure" | "miss"
  } = { file: undefined, id: undefined, said: undefined }
  let minted:
    | { readonly file: string; readonly pane: string; readonly keys: ReadonlySet<string> }
    | undefined
  const conceal = (): void => {
    if (minted !== undefined) {
      concealDone(minted.file, minted.pane, minted.keys)
      minted = undefined
    }
  }
  onCleanup(conceal)
  createEffect(() => {
    if (!(unfiltered(narrowed) && doneHiddenOn(props.file))) conceal()
  })
  createEffect(() => {
    const at = landing.owed()
    if (at !== owing.id || props.file !== owing.file) {
      if (owing.said !== undefined) saying.say(null)
      if (props.file !== owing.file || at !== undefined) conceal()
      owing = { file: props.file, id: at, said: undefined }
    }
    if (at === undefined || !shown()) return
    const whole = unfiltered(narrowed) && doneHiddenOn(props.file) ? props.held : undefined
    const aimAt = aim(props.rows, at, declared.told, whole)
    if (aimAt.kind === "ask") {
      declared.want([at])
      if (lost().has(at) && owing.said !== "failure") {
        owing.said = "failure"
        saying.say({ tone: "alarm", text: failedSays(at) })
      }
      return
    }
    if (aimAt.kind === "miss") {
      if (owing.said !== "miss") {
        owing.said = "miss"
        saying.say({ tone: "alarm", text: missedSays(at, aimAt.target) })
      }
      return
    }
    if (aimAt.kind === "reveal") {
      const keys = new Set(aimAt.chain.map((row) => row.key))
      minted = {
        file: props.file,
        pane: paneId(),
        keys: revealDone(props.file, paneId(), keys),
      }
      return
    }
    saying.say(null)
    const chain = aimAt.chain
    const shut = shutAlong(chain, folds())
    if (shut.length > 0) setFolded(shut, false)
    const last = chain.at(-1)
    if (last === undefined) return
    selectNode(shownRecord(last).node.id)
    const frame = requestAnimationFrame(() => {
      if (!shown()) return
      const row = rowElements.read()?.find(pane?.id, last.at.node.id, "record")
      if (row === undefined) return
      bringOntoScreen(row)
      landing.landed(at)
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    <>
      <Show when={saying.said()}>
        {(said) => (
          <SaidLine
            said={said()}
            class="mb-2 text-body leading-snug"
            testid={IDS_OUTLINES.landingSaid}
          />
        )}
      </Show>
      <Editable rows={() => props.rows} file={props.file} within={[]}>
        <Tree rows={props.rows} />
        <Show when={unfiltered(narrowed) && props.held.length === 0}>
          <StartLine
            at={{ kind: "first", file: props.file }}
            label="This outline is empty. Write the first line."
          />
          <div class="mt-2">
            <DeleteFile file={props.file} />
          </div>
        </Show>
      </Editable>
    </>
  )
}
