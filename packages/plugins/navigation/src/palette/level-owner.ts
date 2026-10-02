/**
 * THE OWNER OF THE PALETTE'S OPEN LEVELS — the path, the live scope that
 * computes each level's rows, and every way a level opens, stands, answers and
 * goes. `./Palette.tsx` composes it with the root list and the box; the
 * drawing of a level is `./LevelView.tsx`'s; the pure rules are
 * `./levels.ts`'s.
 *
 * Two lifetimes, each with one owner:
 *
 * - The PATH (`Step`s) is this module's memory, owned by navigation's
 *   activation: `resetLevelMemory` is called where the palette's own memory is
 *   reset. A draft typed in a level, its chosen option and a submit in flight
 *   survive the overlay being redrawn. Each step's controller is the level's
 *   lifetime — aborted when it is popped, closed or stops standing, never by a
 *   redraw.
 * - The ROWS (`Live`) are Solid roots owned by the drawing that called
 *   {@link createLevelOwner}: rebuilt from each step's kept level when the
 *   drawing is, disposed when the step goes or the drawing does — one
 *   `onCleanup`, here.
 */
import { batch, createEffect, createMemo, createRoot, createSignal, onCleanup, untrack, type Accessor } from "solid-js"
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

/** An open level, remembered with the adapter its path came from. */
export type Step = StepOf<PaletteAdapter>

/** One open level's live rows, in a Solid root the drawing owns. */
export interface Live {
  readonly serial: number
  /** The step's own level and adapter, for the drawing's convenience. */
  readonly level: PaletteLevel
  readonly adapter: PaletteAdapter
  readonly rows: Accessor<ReadonlyArray<PaletteItem>>
  readonly options: Accessor<ReadonlyArray<PaletteOption>>
  readonly dispose: () => void
}

/** THE OPEN LEVELS, root first. */
const memory = createSignal<ReadonlyArray<Step>>([])

/** End these levels' lifetimes: whatever they started is told to stop, and
 *  any answer they get from here on is dropped. */
const abortSteps = (steps: ReadonlyArray<Step>) => { for (const step of steps) step.controller.abort() }

/** Navigation's activation starting or stopping: every level ends. */
export const resetLevelMemory = (): void => {
  abortSteps(memory[0]())
  memory[1]([])
}

/** What the box around the levels does when they move — the palette's own
 *  state, which this module asks for rather than holds. */
export interface LevelHost {
  readonly adapters: Accessor<ReadonlyArray<PaletteAdapter>>
  /** A newer interaction began: a late action from before may not answer. */
  readonly touched: () => void
  /** The root's own query, emptied when the first level opens. */
  readonly leaveRoot: () => void
  /** The list starts over at the top; `chosen` is whether a row is lit. */
  readonly relist: (chosen: boolean) => void
  /** Nothing said and nothing refused any more. */
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
  /** How many levels stand. */
  readonly depth: Accessor<number>
  readonly top: Accessor<TopLevel | undefined>
  /** The top level when it is a value level, with its options and choice. */
  readonly valueTop: Accessor<ValueTop | undefined>
  readonly crumbs: Accessor<ReadonlyArray<Crumb>>
  /** What a screen reader is told when the level changes. */
  readonly announced: Accessor<string>
  /** Type at the top level. */
  readonly type: (text: string) => void
  readonly drill: (item: PaletteItem, level: PaletteLevel) => void
  /** Back to `to` levels open. */
  readonly pop: (to: number, focus?: boolean) => void
  /** A drawing rebuilt over open levels. */
  readonly restore: () => void
  /** `showAt`'s path, onto a box already blank. */
  readonly openAt: (at: OpenAt) => void
  /** The arrows at a value level. */
  readonly move: (by: 1 | -1) => void
  readonly choose: (option: PaletteOption | undefined) => void
  readonly submit: () => void
}

/** Call inside the drawing's owner: the rows' roots are disposed with it. */
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

  /**
   * DOES THIS STEP STILL STAND? The root of the path stands while its adapter
   * is contributed, `available`, and still offers that row id as a level; a
   * deeper step while its adapter is contributed — its parent's rows may move
   * under it without anything being withdrawn (`./levels.ts`'s `rootStands`).
   */
  const stands = (live: ReadonlyArray<PaletteAdapter>) => (depth: number, step: Step) =>
    depth === 0
      ? rootStands(live.includes(step.source), step.source.available?.() !== false, step.source.items?.() ?? [], step.id)
      : live.includes(step.source)
  /** The levels still standing: cut at the first that does not, so nothing is
   *  drawn from a dead or withdrawn contribution even for the moment before
   *  the effect below takes it down. */
  const standingLives = createMemo(() => {
    const steps = path()
    const all = lives()
    const aligned = all.findIndex((one, at) => steps[at]?.serial !== one.serial)
    const upTo = Math.min(standing(steps, stands(host.adapters())), aligned === -1 ? all.length : aligned)
    return upTo === all.length ? all : all.slice(0, upTo)
  })
  const depth = () => standingLives().length
  /** One `{ serial, id, label }` per standing level, read by the crumbs and
   *  the box's name. Equal while the same levels stand, so typing at a level
   *  does not redraw them. */
  const crumbs = createMemo(
    () => {
      const steps = path()
      return standingLives().map((live, at) => {
        const step = steps[at]!
        return { serial: live.serial, id: step.id, label: step.label }
      })
    },
    [],
    { equals: (was, now) => was.length === now.length && was.every((one, at) => one.serial === now[at]!.serial) },
  )
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

  const [announced, setAnnounced] = createSignal("")
  const announce = (to: ReadonlyArray<Step>) =>
    setAnnounced(to.length === 0 ? "All commands" : to.map((step) => step.label).join(", "))
  /** The level named was withdrawn under the person: say so, in the aside
   *  tone — nothing they did was refused. */
  const fellBack = (step: Step) => host.say({ tone: "aside", text: `“${step.label}” is no longer available.` })
  /** Root rows that open a level, with the adapter that contributed each. */
  const levelRoots = () =>
    host.adapters().flatMap((adapter) =>
      adapter.available?.() === false ? [] : (adapter.items?.() ?? []).map((item) => ({ item, adapter })))

  /**
   * GO BACK to `to` levels open — Backspace on an empty box, a crumb, a
   * close. What is popped is aborted and its rows' scope disposed, so no work
   * a level started outlives it.
   */
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

  /** Open the level a row names, on top of the path. */
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

  /**
   * Open a path of row ids against the LIVE contributions, level by level —
   * what `showAt` does with a requested one. Each id is looked up in the rows
   * the level below lists AT THAT MOMENT, so it resolves through levels whose
   * rows are listed synchronously; it stops at the first id that does not
   * resolve. (A redraw does not come through here: it already knows what was
   * open — {@link restore}.)
   */
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

  /** Put a resolved path in place of whatever was open. */
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

  /**
   * A drawing rebuilt over open levels. The remembered steps already carry the
   * level each opened and the adapter its path came from, so only the rows'
   * scope is rebuilt — nothing is looked up again among rows that may not have
   * arrived yet, and the text, option and busy flag are the steps' own. What no
   * longer stands — its adapter was withdrawn, or stopped offering the row —
   * falls back and says so; its return will not reopen it.
   */
  const restore = () => {
    const remembered = untrack(path)
    if (remembered.length === 0) return
    const kept = untrack(() => standing(remembered, stands(host.adapters())))
    abortSteps(remembered.slice(kept))
    install(remembered.slice(0, kept).map((step) => ({ step, live: openLive(step) })))
    if (kept < remembered.length) fellBack(remembered[kept]!)
  }

  /** `showAt`: a path of ids, as deep as it resolves, with `text` in the
   *  deepest level when the whole path did. */
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

  /** THE CONTRIBUTION BEHIND AN OPEN LEVEL STOPPED STANDING: take down what
   *  it opened (its scopes, its submits) and stand at the deepest level that
   *  is still there. `standingLives` already stopped drawing it. */
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

  /**
   * SUBMIT A VALUE LEVEL — the typed text with the chosen option. Refused in
   * place by the level's validator; refused while one is in flight; and its
   * answer, like a `run` row's, closes the palette or keeps it up with
   * something said. An answer for a level that is gone — popped, closed,
   * withdrawn — changes nothing.
   */
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
    valueTop,
    crumbs,
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
