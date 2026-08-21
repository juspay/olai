/**
 * Who is looking, in the header: every answer has a face.
 *
 * Four constructors, a closed set — the same discipline as the mark
 * glyphs. `asking` while the door has not answered; `none` when nobody
 * is on this request (direct access, a local serve); `yes` when a login
 * arrived; `error` when the door failed. Absence is a state, not a
 * missing chip: a bar that only draws a person cannot be trusted when
 * the person is gone.
 *
 * Drawn next to the wordmark, not in the chrome row of pills. The
 * wordmark is the APP; this is WHO IS LOOKING. WhatsApp's rule in
 * `AppHeader.tsx` — identity and search in the bar — is this chip on a
 * phone, not a fifth pill. The picture of a person is a remote gravatar
 * (`index.html`'s image policy); nobody and a failed door are local
 * marks, so absence does not fetch.
 */

import { Match, Show, Switch, type JSX } from "solid-js"

import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "../Tip.tsx"
import { createWho, type Who as Person } from "./asking.ts"

/** The four faces the slot can draw. Closed so a typo is a missing
 *  `Match` rather than a chip that draws nothing. */
export type Face = "asking" | "none" | "yes" | "error"

export function Who() {
  const asking = createWho()
  const person = () => asking.who()
  const face = (): Face => {
    if (!asking.heard()) return "asking"
    if (asking.failed()) return "error"
    return person() == null ? "none" : "yes"
  }
  return (
    <span
      data-testid={TESTID.identity}
      data-who={face()}
      data-login={person()?.login}
    >
      <Switch>
        <Match when={face() === "asking"}>
          <Mark
            label="asking who is looking"
            text=""
            mark={<Circle dashed={false} dim />}
          />
        </Match>
        <Match when={face() === "none"}>
          <Mark
            label="nobody is looking"
            text="nobody"
            mark={<Silhouette />}
          />
        </Match>
        <Match when={face() === "error"}>
          <Mark
            label="could not tell who is looking"
            text="couldn't ask"
            mark={<Circle dashed dim={false} />}
          />
        </Match>
        <Match when={person()}>
          {(one) => <Chip person={one()} />}
        </Match>
      </Switch>
    </span>
  )
}

function Mark(props: {
  readonly label: string
  readonly text: string
  readonly mark: JSX.Element
}) {
  return (
    <Tip text={props.label} layer={LAYER.over}>
      <span
        class="inline-flex min-h-11 items-center gap-1.5 md:min-h-0"
        aria-label={props.label}
      >
        {props.mark}
        <Show when={props.text !== ""}>
          <span class="hidden text-xs text-paper/80 md:inline">{props.text}</span>
        </Show>
      </span>
    </Tip>
  )
}

function Circle(props: { readonly dashed: boolean; readonly dim: boolean }) {
  return (
    <span
      aria-hidden="true"
      class={`size-7 shrink-0 rounded-full border border-paper/40 ${
        props.dashed ? "border-dashed" : ""
      } ${props.dim ? "opacity-50" : ""}`}
    />
  )
}

/** Local, not a gravatar: nobody is not a person with no email. */
function Silhouette() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 28"
      width={28}
      height={28}
      class="size-7 shrink-0 text-paper/50"
    >
      <circle cx="14" cy="14" r="13" fill="none" stroke="currentColor" />
      <circle cx="14" cy="11" r="4" fill="currentColor" />
      <path d="M7 22c1.2-4.2 4.4-6 7-6s5.8 1.8 7 6" fill="currentColor" />
    </svg>
  )
}

function Chip(props: { readonly person: Person }) {
  return (
    <Tip text={props.person.login} layer={LAYER.over}>
      <span
        class="inline-flex min-h-11 items-center gap-1.5 md:min-h-0"
        aria-label={props.person.login}
      >
        <img
          src={props.person.gravatar}
          alt=""
          width={28}
          height={28}
          referrerPolicy="no-referrer"
          class="size-7 shrink-0 rounded-full border border-paper/20 bg-paper/10"
        />
        <span class="hidden min-w-0 max-w-[12rem] truncate text-xs text-paper/80 md:inline">
          {props.person.login}
        </span>
      </span>
    </Tip>
  )
}
