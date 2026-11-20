import type { Server } from "@kolu/acp/wire"
import { For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { Missing } from "./Missing.tsx"
import { SAID } from "./standing.ts"
import type { Chat } from "./state.ts"

export function Roster(props: { readonly chat: Chat }) {
  const servers = () => props.chat.state().servers

  return (
    <Show when={servers().length > 0}>
      <section
        class="shrink-0 border-b border-rule bg-desk/40 px-3 py-1.5 text-caption leading-snug"
        data-testid={TESTID.chatRoster}
        aria-label="Tools"
      >
        <p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <For each={servers()}>{(server) => <Chip server={server} />}</For>
          <Tip text="Tools the agent set up itself aren't listed">
            <span
              class="text-muted/80"
              data-testid={TESTID.chatRosterOwn}
            >
              <span aria-hidden="true">· </span>Plus the agent&rsquo;s own
            </span>
            <span class="sr-only">Tools the agent set up itself aren&rsquo;t listed</span>
          </Tip>
        </p>
        <Missing servers={servers()} />
      </section>
    </Show>
  )
}

function Chip(props: { readonly server: Server }) {
  const said = () => SAID[props.server.standing]
  const mark = () => said().mark
  return (
    <Tip text={`${props.server.name} ${said().sentence}${
      props.server.where === null ? "" : ` — ${props.server.where}`
    }`}>
      <span
        class="flex items-baseline gap-1 text-ink"
        data-testid={TESTID.chatServer}
        data-server={props.server.name}
        data-standing={props.server.standing}
        data-at={props.server.at}
      >
        <Show when={props.server.at} fallback={<span>{props.server.name}</span>}>
          {(at) => <a href={at()} class="underline decoration-rule underline-offset-2 hover:decoration-ink">{props.server.name}</a>}
        </Show>
        <Show when={mark()}>
          {(one) => <span class={one().tint} aria-hidden="true">{one().glyph}</span>}
        </Show>
        <span class="sr-only">{said().sentence}{props.server.where === null ? "" : ` — ${props.server.where}`}</span>
      </span>
    </Tip>
  )
}
