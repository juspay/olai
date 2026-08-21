/**
 * The signed-in person, in the header: a gravatar, and the login beside it
 * (on desktop) or on hover (on a phone).
 *
 * Drawn next to the wordmark, not in the chrome row of pills. The wordmark
 * is the APP; this is WHO IS LOOKING. WhatsApp's rule in `AppHeader.tsx` —
 * identity and search in the bar — is this chip on a phone, not a fifth
 * pill that would squeeze the search magnifier. Absent (direct access, a
 * local serve) it draws a slot that says `none` and nothing a reader can
 * see, which is the whole of "nothing guesses".
 *
 * The picture is a remote gravatar. The shell's image policy admits that
 * origin (`index.html`); this component does not know a policy exists.
 */

import { Show } from "solid-js"

import { LAYER } from "../layer.ts"
import { TESTID } from "../testids.ts"
import { Tip } from "../Tip.tsx"
import { createWho, type Who as Person } from "./asking.ts"

export function Who() {
  const asking = createWho()
  const person = () => asking.who()
  const who = (): "none" | "yes" | undefined => {
    if (!asking.heard()) return undefined
    return person() == null ? "none" : "yes"
  }
  return (
    <span
      data-testid={TESTID.identity}
      data-who={who()}
      data-login={person()?.login}
    >
      <Show when={person()}>
        {(one) => <Chip person={one()} />}
      </Show>
    </span>
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
