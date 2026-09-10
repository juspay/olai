/** Local drafts belong to this mounted control; accepted writes belong to the
 * serve. A replacement reading never creates a second configuration store. */
import { createEffect, createSignal, For, onCleanup, Show, Switch, Match } from "solid-js"
import type { BrowserManagement } from "@olai/surface/management"
import { run } from "@olai/web/client/run.ts"
import { TESTID } from "./testids.ts"
import { configurationAuthored, controlOf, labelOf, knobLabel, knobUnit, knobWidth, knobAuthored, type PolicyReading } from "./rows.ts"

export function Control(props: {
  readonly name: string
  readonly value: PolicyReading
  readonly configure: BrowserManagement["configure"]
  readonly frozen?: string
  readonly label?: boolean
}) {
  const text = () => typeof props.value.value === "boolean" ? (props.value.value ? "yes" : "no") : String(props.value.value)
  const reading = () => props.value.problem?.raw ?? text()
  const [draft, setDraft] = createSignal(reading())
  const [pending, setPending] = createSignal(false)
  const [refused, setRefused] = createSignal<string>()
  let dirty = false
  let reset: HTMLButtonElement | undefined
  let active = true
  onCleanup(() => { active = false })
  createEffect(() => { const value = reading(); if (!dirty) setDraft(value) })
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
      setDraft(reading())
    })
  }
  const saveDraft = () => { if (dirty) save(draft()) }
  // Bound natively on the input: Solid's delegated listener runs at document,
  // where the popover's Escape dismissal would already have spent the key.
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); saveDraft() }
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation()
      dirty = false; setDraft(reading()); setRefused(undefined)
    }
  }
  const invalid = () => props.value.problem !== undefined || refused() !== undefined
  return <div class="plugins-knob" title={props.value.says} data-testid={TESTID.pluginKnob} data-config={props.value.key} data-set-by={props.value.setBy} data-value={text()}>
    <div class="plugins-knob-line">
      <Show when={props.label !== false}><span class="plugins-knob-key">{knobLabel(props.value.key)}</span></Show>
      <Switch fallback={<span>{text()}</span>}>
        <Match when={!props.value.problem && metadata()?.kind === "choice" ? metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "choice" }> : undefined}>{choice =>
          <Show when={choice().options.length <= 4} fallback={
            <select class="plugins-knob-input" aria-label={labelOf(props.value.key)} disabled={disabled()} title={frozen()} value={text()} onChange={event => save(event.currentTarget.value)}>
              <For each={choice().options}>{option => <option value={option}>{option}</option>}</For>
            </select>
          }>
            <div class="plugins-knob-segments" role="group" aria-label={labelOf(props.value.key)} title={frozen()}>
              <For each={choice().options}>{option => <button type="button" disabled={disabled()} aria-pressed={text() === option} data-value={option}
                onClick={() => save(option)}>{option}</button>}</For>
            </div>
          </Show>
        }</Match>
        <Match when={!props.value.problem && metadata()?.kind === "switch"}>
          <button type="button" role="switch" aria-label={labelOf(props.value.key)} aria-checked={props.value.value === true} disabled={disabled()} title={frozen()}
            class={`prototype-switch relative h-5 w-9 shrink-0 rounded-full ${props.value.value === true ? "bg-done" : "bg-rule"}`} onClick={() => save(props.value.value === true ? "no" : "yes")}>
            <span class={`absolute top-0.5 size-4 rounded-full bg-panel ${props.value.value === true ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </Match>
        <Match when={props.value.problem || metadata()?.kind === "number" || metadata()?.kind === "text"}>
          <input class="plugins-knob-input" style={{ width: knobWidth(props.value) }} aria-label={labelOf(props.value.key)} aria-invalid={invalid() ? "true" : undefined}
            disabled={disabled()} title={frozen()} value={draft()}
            type={metadata()?.kind === "number" && !props.value.problem ? "number" : "text"} inputmode={metadata()?.kind === "number" ? "numeric" : "text"}
            min={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).min : undefined}
            max={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).max : undefined}
            step={metadata()?.kind === "number" && (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).integer ? 1 : "any"}
            placeholder={metadata()?.kind === "text" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "text" }>).expected : undefined}
            onInput={event => { dirty = true; setDraft(event.currentTarget.value); setRefused(undefined) }}
            onBlur={event => { if (event.relatedTarget !== reset) saveDraft() }} on:keydown={keyboard} />
          <Show when={metadata()?.kind === "number" && knobUnit(props.value.key)}>{unit => <span class="plugins-knob-key">{unit()}</span>}</Show>
        </Match>
      </Switch>
      <Show when={knobAuthored(props.value)}><span class="plugins-knob-source" data-testid={TESTID.pluginSource} title={configurationAuthored}>●</span></Show>
      <Show when={knobAuthored(props.value) || props.value.problem !== undefined}>
        <button ref={reset} type="button" class="plugins-knob-reset" aria-label={`Use default for ${props.value.key}`} title="Use default" data-testid={TESTID.pluginReset} disabled={disabled()} onClick={() => save(null)}>↺</button>
      </Show>
    </div>
    <Show when={props.value.problem}>{problem => <p class="plugins-knob-problem" data-testid={TESTID.pluginProblem}>{problem().why} · using {text()}</p>}</Show>
    <Show when={refused()}>{reason => <p role="alert" class="plugins-knob-problem" data-testid={TESTID.pluginProblem}>{reason()}</p>}</Show>
  </div>
}
