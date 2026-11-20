import { agentIn, type Unopened as Refused } from "olai-plugin-chat/wire"
import { createSignal, Match, Show, Switch } from "solid-js"

import { GO_PILL, QUIET_PILL } from "@olai/web/client/pill.ts"
import { useAgents } from "../agents/answered.tsx"
import { startFreshChat } from "../agents/fresh-start.ts"
import { isPast } from "../agents/past.ts"
import { agentReadings } from "../agents/reading.ts"
import type { Conversing } from "../../sessions.ts"
import { TESTID } from "../../testids.ts"
import { Refusal } from "./Refusal.tsx"
import type { Chat } from "./state.ts"

export function Unopened(
  props: { readonly chat: Chat; readonly unopened: Refused; readonly node: string },
) {
  return (
    <div
      class="olai-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 text-body text-muted"
      data-testid={TESTID.chatUnopened}
      data-cause={props.unopened.cause?.kind}
    >
      <Switch
        fallback={<AgentSaidNo chat={props.chat} unopened={props.unopened} node={props.node} />}
      >
        <Match when={props.unopened.cause?.kind === "capacity"}>
          <WaitingForASeat why={props.unopened.why} />
        </Match>
        <Match when={props.unopened.cause?.kind === "missing"}>
          <NotOnThisMachine chat={props.chat} unopened={props.unopened} node={props.node} />
        </Match>
      </Switch>

      <Show when={props.chat.refused()}>
        {(failure) => (
          <div class="mt-3" data-testid={TESTID.chatRefused}>
            <Refusal failure={failure()} />
          </div>
        )}
      </Show>
    </div>
  )
}

function AgentSaidNo(props: {
  readonly chat: Chat
  readonly unopened: Refused
  readonly node: string
}) {
  return (
    <>
      <p class="m-0 mb-3 text-ink">
        {props.unopened.what === null
          ? "The agent couldn't open a chat."
          : "The agent couldn't open that chat."}
      </p>

      <p class="m-0 mb-3 break-words text-label text-alarm" data-testid={TESTID.chatUnopenedWhy}>
        {props.unopened.why}
      </p>

      <p class="m-0 mb-3">
        Your notes still work. Try again once the problem is fixed.
      </p>

      <span class="flex flex-wrap gap-2">
        <TryAgain chat={props.chat} />
        <StartFresh chat={props.chat} node={props.node} />
      </span>
    </>
  )
}

function WaitingForASeat(props: { readonly why: string }) {
  return (
    <>
      <p class="m-0 mb-3 text-ink" data-testid={TESTID.chatUnopenedWhy}>{props.why}</p>
      <p class="m-0">This chat opens here as soon as a seat frees.</p>
    </>
  )
}

function NotOnThisMachine(props: {
  readonly chat: Chat
  readonly unopened: Refused
  readonly node: string
}) {
  return (
    <>
      <p class="m-0 mb-3 text-ink">This chat isn't on this machine.</p>

      <p class="m-0 mb-3">
        The engine here has no record of it — it may live on another computer, its history
        was cleared, or nothing was ever said in it. What this agent knows is in its notes,
        and that is untouched.
      </p>

      <p class="m-0 mb-3 break-words text-label" data-testid={TESTID.chatUnopenedWhy}>
        {props.unopened.why}
      </p>

      <span class="flex flex-wrap gap-2">
        <StartFresh chat={props.chat} node={props.node} />
        <TryAgain chat={props.chat} />
      </span>
    </>
  )
}

function TryAgain(props: { readonly chat: Chat }) {
  return (
    <button type="button" class={QUIET_PILL} data-testid={TESTID.chatReopen}
      onClick={() => props.chat.reopen()}>
      Try again
    </button>
  )
}

function StartFresh(props: { readonly chat: Chat; readonly node: string }) {
  const agents = useAgents()
  const [starting, setStarting] = createSignal(false)
  const bound = (): Conversing | null => {
    const row = agents.at(props.node)
    if (row === undefined || row.session === null) return null
    if (isPast(agentReadings()?.visiting(props.node), row)) return null
    const refused = props.chat.state().unopened
    return agentIn(props.chat.state())?.id === row.engine && refused?.what === row.session
      ? { agent: row.engine, session: row.session }
      : null
  }
  const press = (pair: Conversing): void => {
    if (starting()) return
    setStarting(true)
    const chat = props.chat
    const node = props.node
    chat.refuse([])
    void (async () => {
      try {
        const failure = await startFreshChat(node, pair.agent, () => pair)
        if (failure === null) return
        const bodies = agentReadings()?.at(node)
        for (const body of bodies === undefined || bodies.size === 0 ? [chat] : bodies) {
          body.refuse([failure.message])
        }
      } finally {
        setStarting(false)
      }
    })()
  }
  return (
    <Show when={bound()}>
      {(pair) => (
        <button type="button" class={GO_PILL} data-testid={TESTID.chatUnopenedFresh}
          data-node={props.node} disabled={starting()} aria-busy={starting()}
          onClick={() => press(pair())}>
          Start fresh chat
        </button>
      )}
    </Show>
  )
}
