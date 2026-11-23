/** Local drafts belong to this mounted control; accepted writes belong to the
 * serve. A replacement reading never creates a second configuration store.
 *
 * It sits under `src/contracts/` because two packages draw it now — the
 * plugins panel's rows and the page a plugin the vault defines has of its own
 * — and a component another package may mount must reach nothing this
 * activation holds (`./control.ts`). Everything it draws from arrives as a
 * prop; everything it keeps is one draft, which dies with the mount. */
import { createEffect, createSignal, For, onCleanup, Show, Switch, Match, type JSX } from "solid-js"
import type { BrowserManagement } from "@olai/surface/management"
import { run } from "@olai/web/client/run.ts"
import { takingOfflineFocus } from "@olai/web/client/connection/focus.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { TESTID } from "../testids.ts"
import { switchText } from "@olai/plugin-api/configuration"
import { configurationAuthored, controlOf, labelOf, knobLabel, knobUnit, knobWidth, knobAuthored, type PolicyReading } from "./knobs.ts"

/** THE PANEL'S OWN WORD for a typed value beside a list — a choice's `other`
 *  (`@olai/plugin-api/configuration`'s `Control`). One word for every such
 *  choice, never a plugin's, so this file still knows no plugin. */
const OTHER = "custom"

export function Control(props: {
  readonly name: string
  readonly value: PolicyReading
  readonly configure: BrowserManagement["configure"]
  readonly frozen?: string
  readonly label?: boolean
}) {
  const text = () => typeof props.value.value === "boolean" ? switchText(props.value.value) : String(props.value.value)
  const reading = () => props.value.problem?.raw ?? text()
  const [edited, setDraft] = createSignal<string>()
  const draft = () => edited() ?? reading()
  const [pending, setPending] = createSignal(false)
  const [refused, setRefused] = createSignal<string>()
  /** The typed-value segment was pressed, and no save has been accepted since. */
  const [typing, setTyping] = createSignal(false)
  let reset: HTMLButtonElement | undefined
  let segments: HTMLDivElement | undefined
  let field: HTMLInputElement | undefined
  let active = true
  onCleanup(() => { active = false })
  const metadata = () => controlOf(props.value)
  const frozen = () => props.frozen ?? (metadata() === undefined ? "This setting can't be changed here." : undefined)
  const disabled = () => frozen() !== undefined || pending()
  /** The list this knob draws, when it is one and the reading is good. */
  const choice = () => {
    const control = metadata()
    return !props.value.problem && control?.kind === "choice" ? control : undefined
  }
  const listed = () => choice()?.options.includes(text()) === true
  /**
   * WHETHER THE TYPED-VALUE FIELD IS OPEN: while the saved value is not on the
   * list, or from a press of the segment until the next accepted save — so a
   * typed `200k` closes it and presses `200k`, and ↺ closes it too.
   */
  const typedOpen = () => choice()?.other !== undefined && (typing() || !listed())
  /**
   * WHAT THE CONTROL IS CALLED, and — where it will not move — why. The tip
   * beside it says the same words for a pointer, and a tip exposes nothing to
   * assistive tech, so the NAME is the copy a reader gets. The reason comes
   * after what is being set, never instead of it: a frozen knob must still
   * answer "which setting is this?".
   */
  const named = (what = labelOf(props.value.key)) => {
    const why = frozen()
    return why === undefined ? what : `${what} — ${why}`
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
      setTyping(false)
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
   *
   * A MOVE TO THIS KNOB'S OWN ↺ OR SEGMENTS IS NOT A LEAVE either: the press
   * that follows is the person's choice. Saving the typed draft first would
   * set `pending`, which disables the segments, and the press would be lost —
   * the draft written, or refused, in place of the word that was pressed.
   */
  const leaving = (event: FocusEvent) =>
    event.relatedTarget !== reset && !(event.relatedTarget instanceof Node && segments?.contains(event.relatedTarget) === true)
    && !takingOfflineFocus()
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
  /**
   * THE ONE TEXT INPUT A KNOB DRAWS, whichever value it edits — a text or
   * number knob's own, or a choice's typed value: one draft, Enter saves,
   * leaving saves a changed draft, Escape drops it.
   *
   * THE KEYBOARD IT ASKS FOR. `enterkeyhint="done"` because Enter here saves
   * the draft and leaves the knob where it is (`keyboard`, above) — nothing is
   * sent and nowhere is gone to. A knob's text value is a setting rather than
   * prose — a path, a name, a duration — so the three corrections go off with
   * it.
   */
  const DraftInput = (input: JSX.InputHTMLAttributes<HTMLInputElement>) =>
    <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
      <input {...input} class={input.class === undefined ? "plugins-knob-input" : `plugins-knob-input ${input.class}`} disabled={disabled()}
        enterkeyhint="done" autocorrect="off" autocapitalize="none" spellcheck={false}
        onInput={event => { setDraft(event.currentTarget.value); setRefused(undefined) }}
        onBlur={event => { if (leaving(event)) saveDraft() }} on:keydown={keyboard} />
    </Tip>
  return <Tip text={props.value.says} disabled={props.value.says === ""}>
    <div class="plugins-knob" data-testid={TESTID.pluginKnob} data-config={props.value.key} data-set-by={props.value.setBy} data-value={text()}>
      <div class="plugins-knob-line">
        <Show when={props.label !== false}><span class="plugins-knob-key">{knobLabel(props.value.key)}</span></Show>
        <Switch fallback={<span>{text()}</span>}>
          <Match when={choice()}>{list =>
            <Show when={list().options.length <= 4 || list().other !== undefined} fallback={
              <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
                <select class="plugins-knob-input" aria-label={named()} disabled={disabled()} value={text()} onChange={event => save(event.currentTarget.value)}>
                  <For each={list().options}>{option => <option value={option}>{option}</option>}</For>
                </select>
              </Tip>
            }>
              <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
                <div ref={segments} class="plugins-knob-segments" role="group" aria-label={named()}>
                  <For each={list().options}>{option => <button type="button" disabled={disabled()} aria-pressed={!typedOpen() && text() === option} data-value={option}
                    onClick={() => save(option)}>{option}</button>}</For>
                  {/* PRESSING IT SAVES NOTHING: it opens the field below. It
                      carries no `data-value`, so no option's word can name it. */}
                  <Show when={list().other}>
                    <button type="button" disabled={disabled()} aria-pressed={typedOpen()} data-testid={TESTID.pluginOther}
                      onClick={() => { setTyping(true); queueMicrotask(() => field?.focus()) }}>{OTHER}</button>
                  </Show>
                </div>
              </Tip>
            </Show>
          }</Match>
          <Match when={!props.value.problem && metadata()?.kind === "switch"}>
            <Tip text={frozen() ?? ""} disabled={frozen() === undefined}>
              <button type="button" role="switch" aria-label={named()} aria-checked={props.value.value === true} disabled={disabled()}
                class={`prototype-switch relative h-5 w-9 shrink-0 rounded-full ${props.value.value === true ? "bg-done" : "bg-rule"}`} onClick={() => save(switchText(props.value.value !== true))}>
                <span class={`absolute top-0.5 size-4 rounded-full bg-panel ${props.value.value === true ? "left-[18px]" : "left-0.5"}`} />
              </button>
            </Tip>
          </Match>
          <Match when={props.value.problem || metadata()?.kind === "number" || metadata()?.kind === "text"}>
            {/* `inputmode` is set ONLY for a number, where the keyboard it asks
                for genuinely differs. It used to say `text` for everything else,
                which is the default spelled out: a value with no effect that
                reads like a decision. */}
            <DraftInput style={{ width: knobWidth(props.value) }} aria-label={named()} aria-invalid={invalid() ? "true" : undefined}
              value={draft()}
              type={metadata()?.kind === "number" && !props.value.problem ? "number" : "text"} inputmode={metadata()?.kind === "number" ? "numeric" : undefined}
              min={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).min : undefined}
              max={metadata()?.kind === "number" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).max : undefined}
              step={metadata()?.kind === "number" && (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "number" }>).integer ? 1 : "any"}
              placeholder={metadata()?.kind === "text" ? (metadata() as Extract<NonNullable<PolicyReading["control"]>, { kind: "text" }>).expected : undefined} />
            <Show when={metadata()?.kind === "number" && knobUnit(props.value.key)}>{unit => <span class="plugins-knob-key">{unit()}</span>}</Show>
          </Match>
        </Switch>
        {/* WHERE THE VALUE CAME FROM. The dot is a mark and not a word, so the
            sentence it stands for rides an `sr-only` twin beside it — the tip
            draws nothing a reader can reach. */}
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
      {/* THE TYPED VALUE, on a line of its own so the knob stays one column on
          a phone, and the same input as every text knob's. It reads the saved
          word only when that word is not one of the list's. */}
      <Show when={typedOpen()}>
        <DraftInput ref={field} class="plugins-knob-other" data-testid={TESTID.pluginOtherField}
          aria-label={named(`${labelOf(props.value.key)}, ${OTHER}`)} aria-invalid={refused() !== undefined ? "true" : undefined}
          value={edited() ?? (listed() ? "" : text())} placeholder={choice()?.other?.expected} />
      </Show>
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
