import type { Accessor } from "solid-js"
import type { Said } from "@olai/web/client/saying.ts"
import type { PaletteItem } from "./items.ts"

export interface PaletteRunResult {
  readonly keepOpen?: boolean
  readonly said?: Said
}

export interface LevelScope {
  readonly typed: Accessor<string>
  readonly signal: AbortSignal
}

export type LevelRows<R> = ReadonlyArray<R> | ((scope: LevelScope) => Accessor<ReadonlyArray<R>>)

export interface PaletteOption {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly place?: string
  readonly section?: string
}

interface LevelBase {
  readonly placeholder?: string
  readonly hint?: string
}

export interface PaletteGroup extends LevelBase {
  readonly kind: "group"
  readonly children: LevelRows<PaletteItem>
}

export interface PaletteValue extends LevelBase {
  readonly kind: "value"
  readonly initial?: string
  readonly options: LevelRows<PaletteOption>
  readonly chosen?: string
  readonly submitLabel?: string
  readonly validate?: (text: string, option: PaletteOption | undefined) => string | null
  readonly submit: (
    text: string,
    option: PaletteOption | undefined,
    signal: AbortSignal,
  ) => Promise<PaletteRunResult>
}

export type PaletteLevel = PaletteGroup | PaletteValue

export interface Step<S = unknown> {
  readonly serial: number
  readonly id: string
  readonly label: string
  readonly text: string
  readonly option?: string
  readonly busy: boolean
  readonly controller: AbortController
  readonly level: PaletteLevel
  readonly source: S
}

let serials = 0
export const openStep = <S>(
  id: string,
  label: string,
  level: PaletteLevel,
  source: S,
  text: string = level.kind === "value" ? level.initial ?? "" : "",
): Step<S> => ({
  serial: ++serials,
  id,
  label,
  text,
  busy: false,
  controller: new AbortController(),
  level,
  source,
})

export const drill = <S>(path: ReadonlyArray<Step<S>>, step: Step<S>): ReadonlyArray<Step<S>> => [...path, step]

export const popTo = <S>(
  path: ReadonlyArray<Step<S>>,
  depth: number,
): { readonly kept: ReadonlyArray<Step<S>>; readonly dropped: ReadonlyArray<Step<S>> } => {
  const at = Math.max(0, Math.min(depth, path.length))
  if (at === path.length) return { kept: path, dropped: [] }
  const kept = path.slice(0, at)
  const top = kept.at(-1)
  return {
    kept: top === undefined ? kept : [...kept.slice(0, -1), { ...top, text: "" }],
    dropped: path.slice(at),
  }
}

export const updateStep = <S>(
  path: ReadonlyArray<Step<S>>,
  serial: number,
  change: (step: Step<S>) => Step<S>,
): ReadonlyArray<Step<S>> => path.map((step) => (step.serial === serial ? change(step) : step))

export const standing = <S>(
  path: ReadonlyArray<Step<S>>,
  stands: (depth: number, step: Step<S>) => boolean,
): number => {
  const miss = path.findIndex((step, depth) => !stands(depth, step))
  return miss === -1 ? path.length : miss
}

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

export const rootStands = (
  present: boolean,
  available: boolean,
  offered: ReadonlyArray<PaletteItem>,
  id: string,
  busy: boolean,
): boolean =>
  present && available && (busy || offered.some((item) => item.id === id && item.action.kind === "level"))

export const chosenOption = (
  options: ReadonlyArray<PaletteOption>,
  named: string | undefined,
  fallback?: string,
): PaletteOption | undefined =>
  options.find((option) => option.id === named)
    ?? options.find((option) => option.id === fallback)
    ?? options[0]

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

export type Submitting =
  | { readonly kind: "busy" }
  | { readonly kind: "refused"; readonly sentence: string }
  | { readonly kind: "send"; readonly text: string; readonly option: PaletteOption | undefined }

export const submitting = (
  level: PaletteValue,
  step: Step<unknown>,
  options: ReadonlyArray<PaletteOption>,
): Submitting => {
  if (step.busy) return { kind: "busy" }
  const option = chosenOption(options, step.option, level.chosen)
  const sentence = level.validate?.(step.text, option) ?? null
  if (sentence !== null) return { kind: "refused", sentence }
  return { kind: "send", text: step.text, option }
}
