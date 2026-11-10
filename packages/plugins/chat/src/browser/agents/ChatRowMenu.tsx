/**
 * THE `•••` ON A CHATS ROW: the dots, what pressing one runs, and the line a
 * refusal lands on.
 *
 * WHY THE SIDEBAR NEEDS ONE AT ALL. Every verb about a chat lived on the
 * node's row in an outline — which means a person could only reach them from
 * the file the node lives in. The Chats column is where a person LOOKS at what
 * is awake (that is what the dots and the order are for), so it is where they
 * will want to put one to sleep, and walking to another page to do it is a
 * different job. The verbs are the same objects the outline row hangs
 * (`../verbs.tsx`'s `chatVerbs`), so the two menus cannot drift.
 *
 * CHEAP UNTIL PRESSED. This component is a button; the primitive it opens is
 * the far side of a dynamic import (`./ChatRowPanel.tsx`). Up to ten of these
 * are drawn, and a sidebar that mounted ten Kobalte menus nobody opened would
 * pay for all of them on every roster frame.
 */

import { createSignal, lazy, Show } from "solid-js"
import { createSaying } from "@olai/web/client/saying.ts"
import { WITHIN } from "@olai/web/client/layer.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import type { RowVerb } from "olai-plugin-outlines/slots"
import { TESTID } from "../../testids.ts"
import { chatVerbs } from "../verbs.tsx"
import type { Row } from "./roster.ts"

const ChatRowPanel = lazy(() => import("./ChatRowPanel.tsx"))

export function ChatRowMenu(props: { readonly row: Row }) {
  const saying = createSaying()
  const [anchor, setAnchor] = createSignal<HTMLElement | null>(null)
  /** Read when the menu is OPENED rather than per frame: which verbs a row
   *  offers depends on how its agent stands, and the roster moves under an
   *  open menu. A press re-reads nothing — the entry a person saw is the one
   *  they chose. */
  const verbs = () => chatVerbs(props.row)
  const run = async (verb: RowVerb) => {
    setAnchor(null)
    saying.say(undefined)
    const said = await verb.run(props.row.id)
    if (typeof said === "string") saying.say({ tone: "alarm", text: said })
  }
  return <>
    <button type="button"
      class="inline-flex size-6 items-center justify-center rounded-control bg-desk text-caption leading-none tracking-[0.05em] text-muted opacity-0 shadow-raised hover:text-ink focus-visible:opacity-100 group-hover/chat:opacity-100 data-[expanded]:opacity-100"
      data-testid={TESTID.chatRowMenu} data-agent={props.row.id}
      aria-haspopup="true" aria-expanded={anchor() !== null}
      aria-label={`More for ${props.row.title}`} title="More"
      onClick={event => {
        // A control inside the row's own anchor would navigate as well as
        // open; the row draws this one beside it, and the press stops here.
        event.stopPropagation()
        event.preventDefault()
        const button = event.currentTarget
        setAnchor(before => before === null ? button : null)
      }}>•••</button>
    <Show when={anchor()}>{at =>
      <ChatRowPanel anchor={at()} node={props.row.id} verbs={verbs()}
        pick={verb => void run(verb)} close={() => setAnchor(null)} />
    }</Show>
    <Show when={saying.said()}>{said =>
      <SaidLine said={said()} testid={TESTID.chatRowMenuSaid}
        class={`absolute right-0 top-full ${WITHIN.pop} m-0 mt-1 w-max max-w-[14rem] rounded-control bg-panel px-2 py-1 text-label shadow-raised`} />
    }</Show>
  </>
}
