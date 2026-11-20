import { Match, Show, Switch } from "solid-js"

import type { AgentChoice } from "olai-plugin-chat/wire"
import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import type { Who as Person } from "@olai/surface"
import { Dynamic } from "solid-js/web"
import { viewer } from "../viewer.ts"
import { AgentMark, MARK } from "./AgentMark.tsx"
import { PluginMark } from "./PluginMark.tsx"
import { onTheRight, type Speaker as Party } from "./speakers.ts"

const ANONYMOUS = "You"

const AnonymousIcon = (props: { readonly class: string }) => (
  <svg class={props.class} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <circle cx="12" cy="8" r="3" />
    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
  </svg>
)
const UserIcon = (props: { readonly class: string }) =>
  <Dynamic component={viewer()?.UserIcon ?? AnonymousIcon} {...props} />

const AN_AGENT = "agent"

export interface Faced {
  readonly party: Party
  readonly agent: Pick<AgentChoice, "id" | "name"> | undefined
}

export function Speaker(props: Faced) {
  const person = () => viewer()?.who()
  const called = (): string => {
    switch (props.party.of) {
      case "human": {
        const one = person()
        return one == null ? ANONYMOUS : one.name ?? one.login
      }
      case "agent":
        return props.agent?.name ?? AN_AGENT
      case "plugin":
        return props.party.name
    }
  }
  const account = (): string | undefined =>
    props.party.of === "human" ? personTitle(person()) : undefined
  return (
    <div
      class="mb-1 flex min-w-0 items-center gap-1.5 text-caption text-muted"
      classList={{
        "flex-row-reverse": onTheRight(props.party),
      }}
      data-testid={TESTID.chatSpeaker}
      data-speaker={props.party.of}
      data-speaker-name={called()}
    >
      <Switch>
        <Match when={props.party.of === "human"}>
          <Show when={person()?.picture} fallback={<UserIcon class={MARK} />}>
            {(src) => (
              <img
                src={src()}
                alt=""
                width={14}
                height={14}
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                class={`${MARK} rounded-full object-cover`}
              />
            )}
          </Show>
        </Match>
        <Match when={props.party.of === "agent"}>
          <AgentMark id={props.agent?.id ?? ""} />
        </Match>
        <Match when={props.party.of === "plugin" ? props.party.name : undefined}>
          {(name) => <PluginMark name={name()} />}
        </Match>
      </Switch>
      <Tip text={account() ?? ""} disabled={account() === undefined}>
        <span class="min-w-0 truncate">
          {called()}
        </span>
        <Show when={account()}>{one => <span class="sr-only">{one()}</span>}</Show>
      </Tip>
    </div>
  )
}

const personTitle = (one: Person | null | undefined): string | undefined =>
  one == null ? undefined : viewer()?.saying(one)
