/** Local drafts belong to this mounted control; accepted writes belong to the
 * serve. A replacement reading never creates a second configuration store. */
import { createEffect, createSignal, For, onCleanup, Show, Switch, Match } from "solid-js"
import type { BrowserManagement } from "@olai/surface/management"
import { run } from "@olai/web/client/run.ts"
import { TESTID } from "./testids.ts"
import { configurationAuthored, controlOf, labelOf, valueLabel, type PolicyReading } from "./rows.ts"

export function Control(props: {
  readonly name: string
  readonly value: PolicyReading
  readonly configure: BrowserManagement["configure"]
  readonly frozen?: string
}) {
  const text = () => typeof props.value.value === "boolean" ? (props.value.value ? "yes" : "no") : String(props.value.value)
  const [draft, setDraft] = createSignal(text())
  const [pending, setPending] = createSignal(false)
  const [refused, setRefused] = createSignal<string>()
  let dirty = false
  let reset: HTMLButtonElement | undefined
  let active = true
  onCleanup(() => { active = false })
  createEffect(() => { const value = text(); if (!dirty) setDraft(value) })
  const metadata = () => controlOf(props.value)
  const frozen = () => props.frozen ?? (metadata() === undefined ? "This serve does not describe an editable control." : undefined)
  const disabled = () => frozen() !== undefined || pending()
  const save = (value: string | null) => {
    if (disabled()) return
    setPending(true)
    setRefused(undefined)
    run(props.configure(props.name, props.value.key, value), failure => {
      if (!active) return
      setPending(false)
      setRefused(failure.message)
    }, () => {
      if (!active) return
      dirty = false
      setPending(false)
      setDraft(text())
    })
  }
  const commit = () => { if (dirty) save(draft()) }
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); commit() }
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation()
      dirty = false; setDraft(text()); setRefused(undefined)
    }
  }
  const inputClass = "min-w-0 rounded border border-rule bg-panel px-2 py-1 text-sm text-ink disabled:opacity-60"
  return <div class="py-2 text-xs" data-testid={TESTID.pluginControl} data-config={props.value.key} data-set-by={props.value.setBy} data-value={text()}>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-28 text-ink">{labelOf(props.value.key)}</span>
      <Switch fallback={<span>{valueLabel(props.value)}</span>}>
        <Match when={metadata()?.kind === "choice" ? metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "choice" }> : undefined}>{choice =>
          <Show when={choice().options.length <= 4} fallback={
            <select class={inputClass} aria-label={labelOf(props.value.key)} disabled={disabled()} value={text()} onChange={event => save(event.currentTarget.value)}>
              <For each={choice().options}>{option => <option value={option}>{valueLabel({ ...props.value, value: option })}</option>}</For>
            </select>
          }>
            <div class="inline-flex flex-wrap overflow-hidden rounded border border-rule" role="group" aria-label={labelOf(props.value.key)}>
              <For each={choice().options}>{option => <button type="button" disabled={disabled()} aria-pressed={text() === option} data-value={option}
                class={`px-2 py-1 text-sm disabled:opacity-60 ${text() === option ? "bg-accent/15 text-ink" : "text-muted"}`} onClick={() => save(option)}>{valueLabel({ ...props.value, value: option })}</button>}</For>
            </div>
          </Show>
        }</Match>
        <Match when={metadata()?.kind === "switch"}>
          <button type="button" role="switch" aria-label={labelOf(props.value.key)} aria-checked={props.value.value === true} disabled={disabled()}
            class={inputClass} onClick={() => save(props.value.value === true ? "no" : "yes")}>{props.value.value === true ? "Yes" : "No"}</button>
        </Match>
        <Match when={metadata()?.kind === "number" || metadata()?.kind === "text"}>
          <input class={inputClass} aria-label={labelOf(props.value.key)} disabled={disabled()} value={draft()}
            type={metadata()?.kind === "number" ? "number" : "text"} inputmode={metadata()?.kind === "number" ? "numeric" : "text"}
            min={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).min : undefined}
            max={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).max : undefined}
            step={metadata()?.kind === "number" && (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).integer ? 1 : "any"}
            placeholder={metadata()?.kind === "text" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "text" }>).expected : undefined}
            onInput={event => { dirty = true; setDraft(event.currentTarget.value); setRefused(undefined) }}
            onBlur={event => { if (event.relatedTarget !== reset) commit() }} on:keydown={keyboard} />
        </Match>
      </Switch>
      <span class="text-muted">{props.value.setBy !== "default" ? configurationAuthored : "default"}</span>
      <Show when={props.value.setBy !== "default" || props.value.problem !== undefined}>
        <button ref={reset} type="button" class="text-muted underline disabled:opacity-60" data-testid={TESTID.pluginUseDefault} disabled={disabled()} onClick={() => save(null)}>↺ Use default</button>
      </Show>
    </div>
    <p class="mt-1 text-muted">{props.value.says}</p>
    <Show when={frozen()}>{reason => <p class="text-muted">{reason()}</p>}</Show>
    <Show when={props.value.problem}>{problem => <p class="mt-1 text-alarm" data-testid={TESTID.pluginProblem}>File says {JSON.stringify(problem().raw)}: {problem().why}; using {text()}</p>}</Show>
    <Show when={refused()}>{reason => <p role="alert" class="mt-1 text-alarm" data-testid={TESTID.pluginProblem}>{reason()}</p>}</Show>
  </div>
}
