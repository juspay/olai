import { createEffect, createSignal, For, onCleanup, Show, Switch, Match } from "solid-js"
import type { BrowserManagement } from "@olai/surface/management"
import { run } from "@olai/web/client/run.ts"
import { takingOfflineFocus as appTakingFocus } from "@olai/web/client/connection/focus.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { TESTID } from "../testids.ts"
import { configurationAuthored, controlOf, labelOf, knobLabel, knobUnit, knobWidth, knobAuthored, type PolicyReading } from "./knobs.ts"

export function Control(props: {
  readonly name: string
  readonly value: PolicyReading
  readonly configure: BrowserManagement["configure"]
  readonly frozen?: string
  readonly label?: boolean
}) {
  const text = () => typeof props.value.value === "boolean" ? (props.value.value ? "yes" : "no") : String(props.value.value)
  const reading = () => props.value.problem?.raw ?? text()
  const [edited, setDraft] = createSignal<string>()
  const draft = () => edited() ?? reading()
  const [pending, setPending] = createSignal(false)
  const [refused, setRefused] = createSignal<string>()
  let reset: HTMLButtonElement | undefined
  let active = true
  onCleanup(() => { active = false })
  const metadata = () => controlOf(props.value)
  const frozen = () => props.frozen ?? (metadata() === undefined ? "This setting can't be changed here." : undefined)
  const disabled = () => frozen() !== undefined || pending()
  const named = () => {
    const why = frozen()
    return why === undefined ? labelOf(props.value.key) : `${labelOf(props.value.key)} — ${why}`
  }
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
      setPending(false)
      setDraft(undefined)
    })
  }
  const saveDraft = () => { if (edited() !== undefined) save(draft()) }
  const userLeaving = (event: FocusEvent) =>
    event.relatedTarget !== reset && !appTakingFocus()
  // Bound natively (`on:`) because solid-js delegates keydown at document,
  // where @kobalte/core's createEscapeKeyDown dismissal already spent Escape.
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); saveDraft() }
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation()
      setDraft(undefined); setRefused(undefined)
    }
  }
  const invalid = () => props.value.problem !== undefined || refused() !== undefined
  return <Tip text={props.value.says} disabled={props.value.says === ""}>
    <div class="plugins-knob" data-testid={TESTID.pluginKnob} data-config={props.value.key} data-set-by={props.value.setBy} data-value={text()}>
      <div class="plugins-knob-line">
        <Show when={props.label !== false}><span class="plugins-knob-key">{knobLabel(props.value.key)}</span></Show>
        <Switch fallback={<span>{text()}</span>}>
          <Match when={!props.value.problem && metadata()?.kind === "choice" ? metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "choice" }> : undefined}>{choice =>
            <Show when={choice().options.length <= 4} fallback={
              <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
                <select class="plugins-knob-input" aria-label={named()} disabled={disabled()} value={text()} onChange={event => save(event.currentTarget.value)}>
                  <For each={choice().options}>{option => <option value={option}>{option}</option>}</For>
                </select>
              </Tip>
            }>
              <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
                <div class="plugins-knob-segments" role="group" aria-label={named()}>
                  <For each={choice().options}>{option => <button type="button" disabled={disabled()} aria-pressed={text() === option} data-value={option}
                    onClick={() => save(option)}>{option}</button>}</For>
                </div>
              </Tip>
            </Show>
          }</Match>
          <Match when={!props.value.problem && metadata()?.kind === "switch"}>
            <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
              <button type="button" role="switch" aria-label={named()} aria-checked={props.value.value === true} disabled={disabled()}
                class={`prototype-switch relative h-5 w-9 shrink-0 rounded-full ${props.value.value === true ? "bg-done" : "bg-rule"}`} onClick={() => save(props.value.value === true ? "no" : "yes")}>
                <span class={`absolute top-0.5 size-4 rounded-full bg-panel ${props.value.value === true ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </Tip>
          </Match>
          <Match when={props.value.problem || metadata()?.kind === "number" || metadata()?.kind === "text"}>
            <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
              <input class="plugins-knob-input" style={{ width: knobWidth(props.value) }} aria-label={named()} aria-invalid={invalid() ? "true" : undefined}
                disabled={disabled()} value={draft()}
                enterkeyhint="done" autocorrect="off" autocapitalize="none" spellcheck={false}
                type={metadata()?.kind === "number" && !props.value.problem ? "number" : "text"} inputmode={metadata()?.kind === "number" ? "numeric" : undefined}
                min={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).min : undefined}
                max={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).max : undefined}
                step={metadata()?.kind === "number" && (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).integer ? 1 : "any"}
                placeholder={metadata()?.kind === "text" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "text" }>).expected : undefined}
                onInput={event => { setDraft(event.currentTarget.value); setRefused(undefined) }}
                onBlur={event => { if (userLeaving(event)) saveDraft() }} on:keydown={keyboard} />
            </Tip>
            <Show when={metadata()?.kind === "number" && knobUnit(props.value.key)}>{unit => <span class="plugins-knob-key">{unit()}</span>}</Show>
          </Match>
        </Switch>
        <Show when={knobAuthored(props.value)}>
          <Tip text={configurationAuthored} say>
            <span class="plugins-knob-source" data-testid={TESTID.pluginSource} aria-hidden="true">●</span>
          </Tip>
        </Show>
        <Show when={knobAuthored(props.value) || props.value.problem !== undefined}>
          <Tip text="Use default">
            <button ref={reset} type="button" class="plugins-knob-reset" aria-label={`Use default for ${props.value.key}`} data-testid={TESTID.pluginReset} disabled={disabled()} onClick={() => save(null)}>↺</button>
          </Tip>
        </Show>
      </div>
      <Show when={props.value.problem}>{problem => <p class="plugins-knob-problem" data-testid={TESTID.pluginProblem}>{problem().why} · using {text()}</p>}</Show>
      <Show when={refused()}>{reason => <p role="alert" class="plugins-knob-problem" data-testid={TESTID.pluginProblem}>{reason()}</p>}</Show>
    </div>
    <Show when={props.value.says}>{said => <span class="sr-only">{said()}</span>}</Show>
  </Tip>
}
