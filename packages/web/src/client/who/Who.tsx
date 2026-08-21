/**
 * Who is looking, in the header: every answer has a face.
 *
 * Four constructors, a closed set. `asking` while the door has not
 * answered; `none` when this request is anonymous (direct access, a
 * local serve); `yes` when a login arrived; `error` when the door
 * failed. Absence is a state, not a missing chip.
 *
 * LAST in the chrome row — top right — wearing the same pill the
 * connection and commit wear, so the bar's items-center has one height
 * to align. A person is a gravatar in that pill; anonymous is the word,
 * not a fake avatar named nobody.
 */

import { Match, Switch } from "solid-js"

import { LAYER } from "../layer.ts"
import { PILL } from "../readout.ts"
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
          <Pill label="asking who is looking" text="…" />
        </Match>
        <Match when={face() === "none"}>
          <Pill label="anonymous" text="anonymous" />
        </Match>
        <Match when={face() === "error"}>
          <Pill
            label="could not tell who is looking"
            text="couldn't ask"
            alarm
          />
        </Match>
        <Match when={person()}>
          {(one) => <Chip person={one()} />}
        </Match>
      </Switch>
    </span>
  )
}

function Pill(props: {
  readonly label: string
  readonly text: string
  readonly alarm?: boolean
}) {
  return (
    <Tip text={props.label} layer={LAYER.over}>
      <span
        class={`${PILL} ${props.alarm === true ? "text-alarm" : "text-muted"}`}
        aria-label={props.label}
      >
        {props.text}
      </span>
    </Tip>
  )
}

function Chip(props: { readonly person: Person }) {
  return (
    <Tip text={props.person.login} layer={LAYER.over}>
      <span class={PILL} aria-label={props.person.login}>
        <img
          src={props.person.gravatar}
          alt=""
          width={20}
          height={20}
          referrerPolicy="no-referrer"
          class="size-5 shrink-0 rounded-full"
        />
        <span class="hidden min-w-0 max-w-[12rem] truncate md:inline">
          {props.person.login}
        </span>
      </span>
    </Tip>
  )
}
