import { createSignal, lazy, Show } from "solid-js"
import { createSaying } from "@olai/web/client/saying.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { SHOWN_WITHOUT_HOVER } from "@olai/ui-primitives/touch.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { Tip } from "@olai/web/client/Tip.tsx"
import type { RowVerb } from "olai-plugin-outlines/slots"
import { TESTID } from "../../testids.ts"
import { chatVerbs } from "../verbs.tsx"
import type { Row } from "./roster.ts"
import { useAgents } from "./answered.tsx"

const ChatRowPanel = lazy(() => import("./ChatRowPanel.tsx"))

export function ChatRowMenu(props: { readonly row: Row }) {
  const saying = createSaying()
  const agents = useAgents()
  const [anchor, setAnchor] = createSignal<HTMLElement | null>(null)
  const verbs = () => chatVerbs(props.row)
  const run = async (verb: RowVerb) => {
    setAnchor(null)
    saying.say(undefined)
    const said = await verb.run(props.row.id)
    if (typeof said === "string") saying.say({ tone: "alarm", text: said })
  }
  return <Show when={verbs().length > 0}>
    <Tip text="More">
    <button type="button"
      class={"hidden size-6 items-center justify-center rounded-control bg-desk text-caption leading-none tracking-[0.05em] text-muted opacity-0 shadow-raised hover:text-ink focus-visible:opacity-100 group-hover/chat:opacity-100 md:inline-flex " + SHOWN_WITHOUT_HOVER}
      classList={{ "opacity-100": anchor() !== null }}
      data-testid={TESTID.chatRowMenu} data-agent={props.row.id}
      aria-haspopup="menu" aria-expanded={anchor() !== null}
      aria-label={`More for ${agents.named(props.row).name}`}
      onClick={event => {
        event.stopPropagation()
        event.preventDefault()
        const button = event.currentTarget
        setAnchor(before => before === null ? button : null)
      }}>•••</button>
    </Tip>
    <Show when={anchor()}>{at =>
      <ChatRowPanel anchor={at()} node={props.row.id} verbs={verbs()}
        pick={verb => void run(verb)} close={() => setAnchor(null)} />
    }</Show>
    <Show when={saying.said()}>{said =>
      <SaidLine said={said()} testid={TESTID.chatRowMenuSaid}
        class={`absolute right-0 top-full ${WITHIN.pop} m-0 mt-1 w-max max-w-[14rem] rounded-control bg-panel px-2 py-1 text-label shadow-raised`} />
    }</Show>
  </Show>
}
