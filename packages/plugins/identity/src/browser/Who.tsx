/**
 * Who is looking, in the header: every answer has a face, and the face
 * is an icon. The words are the tooltip.
 *
 * Four constructors, a closed set. `asking` while the door has not
 * answered; `none` when this request is anonymous; `yes` when a login
 * arrived; `error` when the door failed. It hangs in `app.viewer`, which
 * is the app's last seat — top right, on a phone as well as a desktop —
 * wearing the same icon-button the agent and prefs wear, so the bar's
 * items-center has one height. WHERE it sits is the app's; every word and
 * stroke in it is this row's.
 *
 * A person's PICTURE is the server's answer, already resolved down this
 * row's own ladder ({@link ../who/picture.ts}) — a proxy's IdP avatar, an
 * operator's avatar template, the gravatar of a real email claim, or none.
 * This file draws what it was handed and knows nothing about headers or
 * templates; when the answer is none, the same silhouette anonymous wears
 * stands in, and the person is still `yes` (they have a login, and now
 * often a name).
 *
 * THE ASK IS THE TAB'S rather than this chip's ({@link ./mine.ts}). It used
 * to be `createWho()` called here, which was right while the header was the
 * only reader; the transcript names the person over each run of their
 * messages too (`olai-plugin-chat`'s `Speaker.tsx`, through this row's
 * `./person` door), and a resource per face would be one `who.get` per run
 * of a conversation for an answer that does not move for the life of the
 * socket.
 *
 * THE SILHOUETTE moved out for the same reason (`@olai/web/client/who`): the
 * ladder's bottom rung is drawn in two places now, and two traced outlines
 * of one shape is the drift nobody can see.
 */

import { Match, Show, Switch, type JSX } from "solid-js"

import { LAYER } from "@olai/web/client/layer.ts"
import { ICON_BUTTON } from "@olai/web/client/readout.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import type { Who as Person } from "@olai/web/client/who/asking.ts"
import { whoAmI, saying, UserIcon } from "@olai/web/client/who/index.ts"

/** The four faces the slot can draw. Closed so a typo is a missing
 *  `Match` rather than a chip that draws nothing. */
export type Face = "asking" | "none" | "yes" | "error"

export function Who() {
  const asking = whoAmI()
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
            <UserIcon class="size-4" />
          </Icon>
        </Match>
        <Match when={face() === "none"}>
          <Icon label="anonymous">
            <UserIcon class="size-4" />
          </Icon>
        </Match>
        <Match when={face() === "error"}>
          <Icon label="could not tell who is looking" alarm>
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
        <Show when={props.person.picture} fallback={<UserIcon class="size-4" />}>
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
