/** Local drafts belong to this mounted control; accepted writes belong to the
 * serve. A replacement reading never creates a second configuration store. */
import { createEffect, createSignal, For, onCleanup, Show, Switch, Match } from "solid-js"
import type { BrowserManagement } from "@olai/surface/management"
import { run } from "@olai/web/client/run.ts"
import { takingOfflineFocus } from "@olai/web/client/connection/focus.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
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
  /**
   * WHAT THE CONTROL IS CALLED, and — where it will not move — why. The tip
   * beside it says the same words for a pointer, and a tip exposes nothing to
   * assistive tech, so the NAME is the copy a reader gets. The reason comes
   * after what is being set, never instead of it: a frozen knob must still
   * answer "which setting is this?".
   */
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
  /**
   * WHETHER THIS BLUR IS A LEAVE — a person moving on, which is a save, or the
   * APP TAKING THE KEYBOARD, which is not. The reconnect freeze is a modal
   * `<dialog>` (`@olai/web/client/connection/Offline.tsx`), and it blurs
   * whatever had the caret while the wire is away; `takingOfflineFocus` is how
   * that call is spelled on this side of the wire, and the outlines' editors
   * read the same flag for the same reason
   * (`@olai-plugin-outlines/browser/edit/RowEditor.tsx`). Saving on that blur
   * writes a half-typed draft into the shared file because a plugin was
   * toggled in another tab — a write nobody asked for, from a page whose wire
   * is gone.
   */
  const leaving = (event: FocusEvent) =>
    event.relatedTarget !== reset && !takingOfflineFocus()
  // Bound natively on the input: Solid's delegated listener runs at document,
  // where the popover's Escape dismissal would already have spent the key.
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
            {/* THE KEYBOARD A KNOB ASKS FOR. `enterkeyhint="done"` because Enter
                here saves the draft and leaves the knob where it is (`keyboard`,
                above) — nothing is sent and nowhere is gone to.

                `inputmode` is set ONLY for a number, where the keyboard it asks
                for genuinely differs. It used to say `text` for everything else,
                which is the default spelled out: a value with no effect that
                reads like a decision. A knob's text value is a setting rather
                than prose — a path, a name, a duration — so the three
                corrections go off with it. */}
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
                onBlur={event => { if (leaving(event)) saveDraft() }} on:keydown={keyboard} />
            </Tip>
            <Show when={metadata()?.kind === "number" && knobUnit(props.value.key)}>{unit => <span class="plugins-knob-key">{unit()}</span>}</Show>
          </Match>
        </Switch>
        {/* WHERE THE VALUE CAME FROM. The dot is a mark and not a word, so the
            sentence it stands for rides an `sr-only` twin beside it — the tip
            draws nothing a reader can reach. */}
        <Show when={knobAuthored(props.value)}>
          <Tip text={configurationAuthored}>
            <span class="plugins-knob-source" data-testid={TESTID.pluginSource} aria-hidden="true">●</span>
            <span class="sr-only">{configurationAuthored}</span>
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
    {/* THE SCHEMA'S OWN DESCRIPTION — what this knob is for. It was the row's
        `title` and nothing else said it; the tip above draws it for a pointer
        and exposes nothing, so the same sentence sits here for a reader, AFTER
        the knob so that what a scenario reads off the knob is still its value. */}
    <Show when={props.value.says}>{said => <span class="sr-only">{said()}</span>}</Show>
  </Tip>
}
