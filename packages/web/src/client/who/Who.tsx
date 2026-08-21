/**
 * Who is looking, in the header: every answer has a face, and the face
 * is an icon. The words are the tooltip.
 *
 * Four constructors, a closed set. `asking` while the door has not
 * answered; `none` when this request is anonymous; `yes` when a login
 * arrived (the gravatar is the icon); `error` when the door failed.
 * LAST in the chrome row — top right — wearing the same icon-button
 * the agent and prefs wear, so the bar's items-center has one height.
 */

import { Match, Switch, type JSX } from "solid-js"

import { LAYER } from "../layer.ts"
import { ICON_BUTTON } from "../readout.ts"
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
          <Icon label="asking who is looking" dim>
            <UserIcon />
          </Icon>
        </Match>
        <Match when={face() === "none"}>
          <Icon label="anonymous">
            <UserIcon />
          </Icon>
        </Match>
        <Match when={face() === "error"}>
          <Icon label="could not tell who is looking" alarm>
            <UserIcon />
          </Icon>
        </Match>
        <Match when={person()}>
          {(one) => <Chip person={one()} />}
        </Match>
      </Switch>
    </span>
  )
}

function Icon(props: {
  readonly label: string
  readonly dim?: boolean
  readonly alarm?: boolean
  readonly children: JSX.Element
}) {
  return (
    <Tip text={props.label} layer={LAYER.over}>
      <span
        class={`${ICON_BUTTON} border border-paper/25 ${
          props.alarm === true ? "text-alarm" : "text-paper/80"
        } ${props.dim === true ? "opacity-50" : ""}`}
        aria-label={props.label}
      >
        {props.children}
      </span>
    </Tip>
  )
}

/** Outline user, same stroke language as {@link ../Leaf.tsx}. */
function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      class="size-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.2c1.3-3.2 3.6-4.7 6.5-4.7s5.2 1.5 6.5 4.7" />
    </svg>
  )
}

function Chip(props: { readonly person: Person }) {
  return (
    <Tip text={props.person.login} layer={LAYER.over}>
      <span
        class={`${ICON_BUTTON} border border-paper/25 p-1.5`}
        aria-label={props.person.login}
      >
        <img
          src={props.person.gravatar}
          alt=""
          width={20}
          height={20}
          referrerPolicy="no-referrer"
          class="size-5 rounded-full"
        />
      </span>
    </Tip>
  )
}
