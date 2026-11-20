import { Match, Show, Switch, type JSX } from "solid-js"

import { LAYER } from "@olai/web/client/layer.ts"
import { ICON_BUTTON } from "@olai/web/client/readout.ts"

const DESKTOP_ROUND = "md:!w-7 md:!px-0"
import { TESTID } from "../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import type { Who as Person } from "./viewer/asking.ts"
import { type Viewer, saying, UserIcon } from "./viewer/index.ts"

export type Face = "asking" | "none" | "yes" | "error"

export function Who(props: { readonly viewer: Viewer }) {
  const person = () => props.viewer.who()
  const face = (): Face => {
    if (!props.viewer.heard()) return "asking"
    if (props.viewer.failed()) return "error"
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
          <Icon label="Checking who you are…" dim>
            <UserIcon class="size-4" />
          </Icon>
        </Match>
        <Match when={face() === "none"}>
          <Icon label="Not signed in">
            <UserIcon class="size-4" />
          </Icon>
        </Match>
        <Match when={face() === "error"}>
          <Icon label="Couldn't check who you are" alarm>
            <UserIcon class="size-4" />
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
        class={`${ICON_BUTTON} ${DESKTOP_ROUND} ${
          props.alarm === true ? "text-alarm" : ""
        } ${props.dim === true ? "opacity-50" : ""}`}
        aria-label={props.label}
      >
        {props.children}
      </span>
    </Tip>
  )
}

function Chip(props: { readonly person: Person }) {
  return (
    <Tip text={saying(props.person)} layer={LAYER.over}>
      <span
        class={`${ICON_BUTTON} ${DESKTOP_ROUND}`}
        aria-label={saying(props.person)}
      >
        <Show when={props.person.picture} fallback={<UserIcon class="size-4" />}>
          {(src) => (
            <img
              src={src()}
              alt=""
              width={20}
              height={20}
              referrerPolicy="no-referrer"
              loading="eager"
              decoding="async"
              class="size-5 rounded-full"
            />
          )}
        </Show>
      </span>
    </Tip>
  )
}
