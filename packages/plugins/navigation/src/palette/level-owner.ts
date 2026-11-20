import { batch, createEffect, createMemo, createRoot, createSignal, mapArray, onCleanup, untrack, type Accessor } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import type { PaletteAdapter } from "../index.ts"
import { filterItems, type PaletteItem } from "./items.ts"
import {
  chosenOption,
  drill,
  type LevelRows,
  type LevelScope,
  openStep,
  type PaletteLevel,
  type PaletteOption,
  type PaletteValue,
  popTo,
  resolvePath,
  rootStands,
  standing,
  type Step as StepOf,
  stepOption,
  submitting,
  updateStep,
} from "./levels.ts"
import type { OpenAt } from "./state.ts"

export type Step = StepOf<PaletteAdapter>

export interface Live {
  readonly serial: number
  readonly level: PaletteLevel
  readonly adapter: PaletteAdapter
  readonly rows: Accessor<ReadonlyArray<PaletteItem>>
  readonly options: Accessor<ReadonlyArray<PaletteOption>>
  readonly dispose: () => void
}

const memory = createSignal<ReadonlyArray<Step>>([])

const abortSteps = (steps: ReadonlyArray<Step>) => { for (const step of steps) step.controller.abort() }

export const resetLevelMemory = (): void => {
  abortSteps(memory[0]())
  memory[1]([])
}

export interface LevelHost {
  readonly adapters: Accessor<ReadonlyArray<PaletteAdapter>>
  readonly touched: () => void
  readonly leaveRoot: () => void
  readonly relist: (chosen: boolean) => void
  readonly hush: () => void
  readonly say: (said: Said) => void
  readonly refuse: (sentence: string) => void
  readonly close: () => void
  readonly focus: () => void
}

export interface TopLevel { readonly live: Live; readonly step: Step }
export interface ValueTop extends TopLevel {
  readonly level: PaletteValue
  readonly options: ReadonlyArray<PaletteOption>
  readonly chosen: PaletteOption | undefined
}
export interface Crumb { readonly serial: number; readonly id: string; readonly label: string }

export interface LevelOwner {
  readonly depth: Accessor<number>
  readonly top: Accessor<TopLevel | undefined>
  readonly topLive: Accessor<Live | undefined>
  readonly valueTop: Accessor<ValueTop | undefined>
  readonly crumbs: Accessor<ReadonlyArray<Crumb>>
  readonly busy: Accessor<boolean>
  readonly options: Accessor<ReadonlyArray<PaletteOption> | undefined>
  readonly chosenId: Accessor<string | undefined>
  readonly announced: Accessor<string>
  readonly type: (text: string) => void
  readonly drill: (item: PaletteItem, level: PaletteLevel) => void
  readonly pop: (to: number, focus?: boolean) => void
  readonly restore: () => void
  readonly openAt: (at: OpenAt) => void
  readonly move: (by: 1 | -1) => void
  readonly choose: (option: PaletteOption | undefined) => void
  readonly submit: () => void
}

export function createLevelOwner(host: LevelHost): LevelOwner {
  const [path, setPath] = memory
  const [lives, setLives] = createSignal<ReadonlyArray<Live>>([])
  onCleanup(() => { for (const live of untrack(lives)) live.dispose() })

  const NONE: Accessor<ReadonlyArray<never>> = () => []
  const openLive = (step: Step): Live =>
    createRoot((dispose) => {
      const { level, source: adapter } = step
      const typed = createMemo(() => path().find((one) => one.serial === step.serial)?.text ?? "")
      const scope: LevelScope = { typed, signal: step.controller.signal }
      const computed = <R,>(rows: LevelRows<R>, filter: (text: string, rows: ReadonlyArray<R>) => ReadonlyArray<R>): Accessor<ReadonlyArray<R>> => {
        if (typeof rows !== "function") return createMemo(() => filter(typed(), rows))
        try {
          return rows(scope)
        } catch (fault) {
          console.error(`olai: the palette level "${step.label}" failed to list its rows`, fault)
          return NONE
        }
      }
      return {
        serial: step.serial,
        level,
        adapter,
        rows: level.kind === "group" ? computed(level.children, (text, rows) => filterItems(text, rows)) : NONE,
        options: level.kind === "value" ? computed(level.options, (_text, rows) => rows) : NONE,
        dispose,
      }
    })

  const stands = (live: ReadonlyArray<PaletteAdapter>) => (depth: number, step: Step) =>
    depth === 0
      ? rootStands(
        live.includes(step.source),
        step.source.available?.() !== false,
        step.source.items?.() ?? [],
        step.id,
        step.busy,
      )
      : live.includes(step.source)
  const shape = createMemo(() => path(), [], {
    equals: (was, now) =>
      was.length === now.length
      && was.every((step, at) => step.serial === now[at]!.serial && step.busy === now[at]!.busy),
  })
  const standingLives = createMemo(() => {
    const steps = shape()
    const all = lives()
    const aligned = all.findIndex((one, at) => steps[at]?.serial !== one.serial)
    const upTo = Math.min(standing(steps, stands(host.adapters())), aligned === -1 ? all.length : aligned)
    return upTo === all.length ? all : all.slice(0, upTo)
  })
  const depth = () => standingLives().length
  const topLive = createMemo(() => standingLives().at(-1))
  const serials = createMemo(() => standingLives().map((live) => live.serial), [], {
    equals: (was, now) => was.length === now.length && was.every((serial, at) => serial === now[at]),
  })
  const crumbs = createMemo(mapArray(serials, (serial): Crumb => {
    const step = untrack(shape).find((one) => one.serial === serial)!
    return { serial, id: step.id, label: step.label }
  }))
  const top = createMemo(() => {
    const live = standingLives().at(-1)
    if (live === undefined) return undefined
    const step = path().find((one) => one.serial === live.serial)
    return step === undefined ? undefined : { live, step }
  })
  const valueTop = (): ValueTop | undefined => {
    const at = top()
    if (at === undefined || at.live.level.kind !== "value") return undefined
    const level = at.live.level
    const options = at.live.options()
    return { ...at, level, options, chosen: chosenOption(options, at.step.option, level.chosen) }
  }
  const busy = createMemo(() => top()?.step.busy ?? false)
  const chosenId = createMemo(() => valueTop()?.chosen?.id)
  const options = createMemo(() => {
    const at = top()
    return at?.live.level.kind === "value" ? at.live.options() : undefined
  })

  const [announced, setAnnounced] = createSignal("")
  const announce = (to: ReadonlyArray<Step>) =>
    setAnnounced(to.length === 0 ? "All commands" : to.map((step) => step.label).join(", "))
  const fellBack = (step: Step) => host.say({ tone: "aside", text: `“${step.label}” is no longer available.` })
  const levelRoots = () =>
    host.adapters().flatMap((adapter) =>
      adapter.available?.() === false ? [] : (adapter.items?.() ?? []).map((item) => ({ item, adapter })))

  const pop = (to: number, focus = true) => {
    const { kept, dropped } = popTo(untrack(path), to)
    if (dropped.length === 0) return
    abortSteps(dropped)
    const gone = untrack(lives).slice(kept.length)
    batch(() => {
      host.touched()
      setPath(kept)
      setLives((all) => all.slice(0, kept.length))
      host.relist(kept.length > 0)
      host.hush()
      announce(kept)
    })
    for (const live of gone) live.dispose()
    if (focus) host.focus()
  }

  const drillInto = (item: PaletteItem, level: PaletteLevel) => {
    const below = untrack(top)
    const adapter = below?.step.source
      ?? untrack(levelRoots).find((one) => one.item.id === item.id && one.item.action.kind === "level")?.adapter
    if (adapter === undefined) return
    const step = openStep(item.id, item.label, level, adapter)
    const live = openLive(step)
    batch(() => {
      host.touched()
      if (below === undefined) host.leaveRoot()
      setPath((steps) => drill(steps, step))
      setLives((all) => [...all, live])
      host.relist(true)
      host.hush()
      announce(untrack(path))
    })
    host.focus()
  }

  const resolveLevels = (ids: ReadonlyArray<string>): ReadonlyArray<TopLevel> => {
    const opened: Array<TopLevel> = []
    const found = resolvePath(ids, (_at, id) => untrack(() => {
      const below = opened.at(-1)?.live
      const candidates = below === undefined
        ? levelRoots()
        : below.level.kind === "group"
          ? below.rows().map((item) => ({ item, adapter: below.adapter }))
          : []
      const hit = candidates.find((one) => one.item.id === id && one.item.action.kind === "level")
      if (hit === undefined || hit.item.action.kind !== "level") return undefined
      const step = openStep(hit.item.id, hit.item.label, hit.item.action.level, hit.adapter)
      opened.push({ step, live: openLive(step) })
      return step
    }))
    return opened.slice(0, found.length)
  }

  const install = (opened: ReadonlyArray<TopLevel>) => {
    const gone = untrack(lives)
    batch(() => {
      host.touched()
      setPath(opened.map((one) => one.step))
      setLives(opened.map((one) => one.live))
      host.relist(opened.length > 0)
      announce(opened.map((one) => one.step))
    })
    for (const live of gone) live.dispose()
  }

  const restore = () => {
    const remembered = untrack(path)
    if (remembered.length === 0) return
    const kept = untrack(() => standing(remembered, stands(host.adapters())))
    abortSteps(remembered.slice(kept))
    install(remembered.slice(0, kept).map((step) => ({ step, live: openLive(step) })))
    if (kept < remembered.length) fellBack(remembered[kept]!)
  }

  const openAt = (at: OpenAt) => {
    const opened = resolveLevels(at.path)
    const last = opened.at(-1)
    const full = opened.length === at.path.length
    install(
      full && last !== undefined && at.text !== undefined
        ? [...opened.slice(0, -1), { ...last, step: { ...last.step, text: at.text } }]
        : opened,
    )
    queueMicrotask(host.focus)
  }

  createEffect(() => {
    const standingNow = standingLives()
    if (standingNow.length === untrack(lives).length) return
    const lost = untrack(path)[standingNow.length]
    untrack(() => pop(standingNow.length, false))
    if (lost !== undefined) fellBack(lost)
  })

  const type = (text: string) => {
    const at = untrack(top)
    if (at === undefined) return
    host.touched()
    setPath((steps) => updateStep(steps, at.step.serial, (step) => ({ ...step, text })))
  }
  const choose = (option: PaletteOption | undefined) => {
    const at = untrack(top)
    if (at === undefined || option === undefined) return
    setPath((steps) => updateStep(steps, at.step.serial, (step) => ({ ...step, option: option.id })))
  }
  const move = (by: 1 | -1) => {
    const value = untrack(valueTop)
    if (value !== undefined) choose(stepOption(value.options, value.chosen, by))
  }

  const submit = () => {
    const at = untrack(valueTop)
    if (at === undefined) return
    const verdict = submitting(at.level, at.step, at.options)
    if (verdict.kind === "busy") return
    if (verdict.kind === "refused") {
      host.refuse(verdict.sentence)
      return
    }
    const { serial, controller } = at.step
    const settle = () => setPath((steps) => updateStep(steps, serial, (step) => ({ ...step, busy: false })))
    setPath((steps) => updateStep(steps, serial, (step) => ({ ...step, busy: true })))
    host.hush()
    void Promise.resolve()
      .then(() => at.level.submit(verdict.text, verdict.option, controller.signal))
      .then(
        (result) => {
          if (controller.signal.aborted) return
          settle()
          if (result.said) host.say(result.said)
          else if (!result.keepOpen) host.close()
        },
        (fault: unknown) => {
          if (controller.signal.aborted) return
          settle()
          console.error(`olai: the palette level "${at.step.label}" failed to submit`, fault)
          host.say({ tone: "alarm", text: "That didn't work. Try again." })
        },
      )
  }

  return {
    depth,
    top,
    topLive,
    valueTop,
    crumbs,
    busy,
    options,
    chosenId,
    announced,
    type,
    drill: drillInto,
    pop,
    restore,
    openAt,
    move,
    choose,
    submit,
  }
}
