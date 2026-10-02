/**
 * LEVELS — a palette row that opens a list of its own, and a level that takes
 * a line of text and one choice.
 *
 * The flat list could not ask a command for more than one thing. A verb that
 * needs a place, a line and an agent grew its own page or menu instead. A
 * level is that question asked inside the box: the row's children replace the
 * list, its name becomes a crumb before the input, and Backspace on an empty
 * box (or a press on the crumb) goes back.
 *
 * This module is the CONTRACT (what a plugin hands the palette, over
 * `paletteAdapters`, as an ordinary {@link PaletteItem} whose action is
 * `{ kind: "level" }`) and the pure model of the open path. How a level is
 * drawn, and who owns its live work, is `./Palette.tsx`'s.
 *
 * ## Two kinds
 *
 * A GROUP lists rows. They are ordinary palette rows, so a child may route,
 * run, write or open a further level. Static rows are filtered by the typed
 * text the way the root list is; a function of the typed text does its own
 * matching (a node search is the case that wants it).
 *
 * A VALUE level makes the box a free-text field. Its rows are OPTIONS: one is
 * always chosen, the arrows move the choice, and typing never filters them.
 * Enter submits the text with the chosen option, after an optional validator
 * whose sentence the palette draws in its refusal line.
 *
 * ## Ownership
 *
 * A level is a lifetime. `children`/`options` given as a function run ONCE,
 * inside a scope the palette owns for that open level: anything they create
 * (memos, subscriptions, `onCleanup`) is disposed when the level is popped,
 * when the palette closes, or when the contributing adapter is withdrawn. A
 * submit is handed an `AbortSignal` that aborts at the same moments, and its
 * answer is ignored once it has.
 */
import type { Accessor } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import type { PaletteItem } from "./items.ts"

/** What a `run` row and a value level's submit answer with: stay open, and
 *  say something or not. Nothing (`{}`) closes the palette. */
export interface PaletteRunResult {
  readonly keepOpen?: boolean
  readonly said?: Said
}

/** What a level's own function is handed, once, when the level opens. */
export interface LevelScope {
  /** The text typed in the box at this level. */
  readonly typed: Accessor<string>
  /** Aborted when this level is gone: popped, closed, or withdrawn. */
  readonly signal: AbortSignal
}

/** Rows a level shows: a fixed list, or a function run once per opening,
 *  inside the level's own scope, returning the rows as they change. */
export type LevelRows<R> = ReadonlyArray<R> | ((scope: LevelScope) => Accessor<ReadonlyArray<R>>)

/** One choice in a value level. */
export interface PaletteOption {
  /** Stable among the level's options; what `submit` gets back. */
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly place?: string
  readonly section?: string
}

interface LevelBase {
  /** What the box says while it is empty at this level. */
  readonly placeholder?: string
  /** A non-interactive line under the rows ("Type to find any node"). */
  readonly hint?: string
}

/** A level that lists rows. */
export interface PaletteGroup extends LevelBase {
  readonly kind: "group"
  /** Static rows are filtered by the typed text; a function does its own
   *  matching. Rows may carry a `section` heading and a second-line `place`. */
  readonly children: LevelRows<PaletteItem>
}

/** A level that takes a line of text and exactly one option. */
export interface PaletteValue extends LevelBase {
  readonly kind: "value"
  /** What the box starts holding. */
  readonly initial?: string
  /** Never filtered by typing. The first is chosen unless `chosen` names one. */
  readonly options: LevelRows<PaletteOption>
  readonly chosen?: string
  /** The word on the submit button and the footer's Enter hint. */
  readonly submitLabel?: string
  /** A sentence refuses the submit and keeps the level up. */
  readonly validate?: (text: string, option: PaletteOption | undefined) => string | null
  /** Asynchronous; answers like a `run` row. A second submit while this is in
   *  flight is refused. Check `signal.aborted` before acting on anything the
   *  palette no longer shows. */
  readonly submit: (
    text: string,
    option: PaletteOption | undefined,
    signal: AbortSignal,
  ) => Promise<PaletteRunResult>
}

export type PaletteLevel = PaletteGroup | PaletteValue

// ── the open path, as data ────────────────────────────────────────────────

/**
 * ONE OPEN LEVEL, as the palette remembers it — everything except its live
 * rows, which are rebuilt from {@link PaletteLevel} whenever the palette is
 * drawn again.
 *
 * Kept as a value, apart from the Solid scope that computes its rows, because
 * the two have different owners: the steps live as long as the palette's
 * memory (navigation's activation), so a draft typed at a level survives the
 * palette being redrawn when an unrelated plugin changes; the rows' scope lives
 * as long as the drawing. `controller` is the level's lifetime: aborted when
 * the level is popped, closed or withdrawn, never by a redraw.
 */
export interface Step {
  /** Unique per opening, so a late answer can tell its level from a later
   *  opening of the same row. */
  readonly serial: number
  /** The row id that opened it — the path is ids, never labels. */
  readonly id: string
  /** The crumb. */
  readonly label: string
  /** What is typed at this level. */
  readonly text: string
  /** A value level's chosen option id, once somebody has moved it. */
  readonly option?: string
  /** A submit is in flight. */
  readonly busy: boolean
  readonly controller: AbortController
}

let serials = 0
export const openStep = (id: string, label: string, text = ""): Step => ({
  serial: ++serials,
  id,
  label,
  text,
  busy: false,
  controller: new AbortController(),
})

/** Push a level. */
export const drill = (path: ReadonlyArray<Step>, step: Step): ReadonlyArray<Step> => [...path, step]

/**
 * Back to `depth` levels open: what stays, and what went. The caller aborts
 * what went — kept apart so this stays a value.
 *
 * The level left on top has nothing typed: going back is going back to the
 * list, not to the words that were in the box when the next level opened.
 */
export const popTo = (
  path: ReadonlyArray<Step>,
  depth: number,
): { readonly kept: ReadonlyArray<Step>; readonly dropped: ReadonlyArray<Step> } => {
  const at = Math.max(0, Math.min(depth, path.length))
  if (at === path.length) return { kept: path, dropped: [] }
  const kept = path.slice(0, at)
  const top = kept.at(-1)
  return {
    kept: top === undefined ? kept : [...kept.slice(0, -1), { ...top, text: "" }],
    dropped: path.slice(at),
  }
}

/** Replace the step with this serial; the path is unchanged if it is gone. */
export const updateStep = (
  path: ReadonlyArray<Step>,
  serial: number,
  change: (step: Step) => Step,
): ReadonlyArray<Step> => path.map((step) => (step.serial === serial ? change(step) : step))

/** How many leading steps still resolve — `stands(depth, step)` asks the
 *  live contributions about one. The rest is what falls back. */
export const standing = (
  path: ReadonlyArray<Step>,
  stands: (depth: number, step: Step) => boolean,
): number => {
  const miss = path.findIndex((step, depth) => !stands(depth, step))
  return miss === -1 ? path.length : miss
}

/** Resolve a requested path of row ids level by level: `find(depth, id)` is
 *  the row at that depth, or `undefined` once the path stops resolving. */
export const resolvePath = <R>(
  ids: ReadonlyArray<string>,
  find: (depth: number, id: string) => R | undefined,
): ReadonlyArray<R> => {
  const found: Array<R> = []
  for (const [depth, id] of ids.entries()) {
    const row = find(depth, id)
    if (row === undefined) break
    found.push(row)
  }
  return found
}

// ── a value level's choice and submit ─────────────────────────────────────

/** The option that is chosen: the one named, else the level's default, else
 *  the first. Exactly one whenever there are any. */
export const chosenOption = (
  options: ReadonlyArray<PaletteOption>,
  named: string | undefined,
  fallback?: string,
): PaletteOption | undefined =>
  options.find((option) => option.id === named)
    ?? options.find((option) => option.id === fallback)
    ?? options[0]

/** The option one step on or back, wrapping — the arrows. */
export const stepOption = (
  options: ReadonlyArray<PaletteOption>,
  from: PaletteOption | undefined,
  by: 1 | -1,
): PaletteOption | undefined => {
  if (options.length === 0) return undefined
  const at = from === undefined ? -1 : options.findIndex((option) => option.id === from.id)
  if (at === -1) return by === 1 ? options[0] : options.at(-1)
  return options[(at + by + options.length) % options.length]
}

/** What Enter at a value level does: refused while one is in flight, refused
 *  in the level's own words, or sent. */
export type Submitting =
  | { readonly kind: "busy" }
  | { readonly kind: "refused"; readonly sentence: string }
  | { readonly kind: "send"; readonly text: string; readonly option: PaletteOption | undefined }

export const submitting = (
  level: PaletteValue,
  step: Step,
  options: ReadonlyArray<PaletteOption>,
): Submitting => {
  if (step.busy) return { kind: "busy" }
  const option = chosenOption(options, step.option, level.chosen)
  const sentence = level.validate?.(step.text, option) ?? null
  if (sentence !== null) return { kind: "refused", sentence }
  return { kind: "send", text: step.text, option }
}
