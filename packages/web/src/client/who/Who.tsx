/**
 * Who is looking, in the header: every answer has a face, and the face
 * is an icon. The words are the tooltip.
 *
 * Four constructors, a closed set. `asking` while the door has not
 * answered; `none` when this request is anonymous; `yes` when a login
 * arrived; `error` when the door failed. LAST in the chrome row — top
 * right — wearing the same icon-button the agent and prefs wear, so the
 * bar's items-center has one height.
 *
 * A person's PICTURE is the server's answer, already resolved down
 * `@olai/identity`'s ladder — a proxy's IdP avatar, an operator's avatar
 * template, the gravatar of a real email claim, or none. This file draws
 * what it was handed and knows nothing about headers or templates; when
 * the answer is none, the same silhouette anonymous wears stands in, and
 * the person is still `yes` (they have a login, and now often a name).
 */

import { Match, Show, Switch, type JSX } from "solid-js"

import { LAYER } from "../layer.ts"
import { ICON_BUTTON } from "../readout.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "../Tip.tsx"
import { createWho, type Who as Person } from "./asking.ts"
import { saying } from "./saying.ts"

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

/** A person: their picture when the server resolved one, and the same
 *  silhouette as anonymous when it did not — a person with no picture is
 *  still a person, which is what the tooltip and `data-who` say. */
function Chip(props: { readonly person: Person }) {
  return (
    <Tip text={saying(props.person)} layer={LAYER.over}>
      <span
        class={`${ICON_BUTTON} border border-paper/25 ${
          props.person.picture === null ? "text-paper/80" : "p-1.5"
        }`}
        aria-label={saying(props.person)}
      >
        <Show when={props.person.picture} fallback={<UserIcon />}>
          {(src) => (
            <img
              src={src()}
              alt=""
              width={20}
              height={20}
              referrerPolicy="no-referrer"
              class="size-5 rounded-full"
            />
          )}
        </Show>
      </span>
    </Tip>
  )
}
