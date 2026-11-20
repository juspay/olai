import { notHere } from "olai-plugin-chat/wire"
import type { Server } from "@kolu/acp/wire"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { SAID } from "./standing.ts"

export function Missing(props: { readonly servers: ReadonlyArray<Server> }) {
  const absent = createMemo(() => props.servers.filter(notHere))
  return (
    <Show when={absent().length > 0}>
      <div class="mt-1 space-y-1" data-testid={TESTID.chatMissing}>
        <For each={absent()}>{(server) => <Row server={server} />}</For>
      </div>
    </Show>
  )
}

const reasonOf = (server: Server): string | null =>
  server.said === null
    ? null
    : server.standing === "unattached"
    ? `the agent did not attach it: ${server.said}`
    : server.said

function Row(props: { readonly server: Server }) {
  return (
    <div data-testid={TESTID.chatMissingServer} data-server={props.server.name}>
      <p class="flex items-baseline gap-1.5 text-ink">
        <span
          class="inline-block size-1.5 shrink-0 -translate-y-px rounded-full bg-alarm"
          aria-hidden="true"
        />
        <span>
          <span class="font-semibold">{props.server.name}</span>{" "}
          {SAID[props.server.standing].sentence}
        </span>
      </p>
      <Show when={reasonOf(props.server)}>
        {(said) => (
          <p class="break-words pl-3 text-muted" data-testid={TESTID.chatMissingWhy}>
            {said()}
          </p>
        )}
      </Show>
      <Show when={props.server.where}>
        {(where) => (
          <Tip text={where()}>
            <p class="truncate pl-3 text-muted/80">{where()}</p>
          </Tip>
        )}
      </Show>
    </div>
  )
}
