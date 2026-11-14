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
 *
 * AND NOT DRAWN AT ALL BELOW md, which is the same rule the outline's `•••`
 * keeps (`@olai/ui-primitives`'s `MENU_CELL`): that is a fact about ROOM, and
 * a 390pt row spends its width on the title. Above it, where the width is
 * there, whether the dots are VISIBLE is a fact about the pointer instead —
 * `SHOWN_WITHOUT_HOVER` draws them for a tablet, which used to get the one
 * state worth nobody's while: a transparent target a thumb can hit and an
 * eye cannot find.
 */

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

const ChatRowPanel = lazy(() => import("./ChatRowPanel.tsx"))

export function ChatRowMenu(props: { readonly row: Row }) {
  const saying = createSaying()
  const [anchor, setAnchor] = createSignal<HTMLElement | null>(null)
  /** Which verbs a row offers depends on how its agent STANDS, so this tracks
   *  the roster rather than freezing at the press: an agent that goes to sleep
   *  under an open menu loses *Put to sleep* from it, which is the same answer
   *  the outline row's menu gives for the same reason. */
  const verbs = () => chatVerbs(props.row)
  const run = async (verb: RowVerb) => {
    setAnchor(null)
    saying.say(undefined)
    const said = await verb.run(props.row.id)
    if (typeof said === "string") saying.say({ tone: "alarm", text: said })
  }
  return <Show when={verbs().length > 0}>
    {/* NOT DRAWN BELOW md, and `hidden` rather than transparent: a phone
        spends no width on a control it has no room for (`ui-primitives/
        touch.ts`'s `MENU_REVEAL` says the same thing for the outline's `•••`),
        and an `opacity-0` control is still a 24px target a thumb can hit at
        the row's right edge — invisible, and in the way of the row itself.
        Above md that same sentence is why the dots do not fade at all on a
        touch screen: the hole they would otherwise leave is a tablet, which
        is wide enough to draw them and has no hover to find them with. */}
    <Tip text="More">
    <button type="button"
      class={"hidden size-6 items-center justify-center rounded-control bg-desk text-caption leading-none tracking-[0.05em] text-muted opacity-0 shadow-raised hover:text-ink focus-visible:opacity-100 group-hover/chat:opacity-100 md:inline-flex " + SHOWN_WITHOUT_HOVER}
      classList={{ "opacity-100": anchor() !== null }}
      data-testid={TESTID.chatRowMenu} data-agent={props.row.id}
      aria-haspopup="menu" aria-expanded={anchor() !== null}
      aria-label={`More for ${props.row.title}`}
      onClick={event => {
        // A control inside the row's own anchor would navigate as well as
        // open; the row draws this one beside it, and the press stops here.
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
