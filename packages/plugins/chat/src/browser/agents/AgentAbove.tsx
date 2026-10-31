/**
 * THE AGENT ABOVE — one press up to the closest ancestor holding a
 * conversation, and the same door worn by that ancestor's crumb.
 *
 * A node that sits under a node agent should say so: the reader of `pick the
 * hinges` is inside `install the cabinets`'s memory, and there is no reason to
 * navigate back to the outline to get from one page to the other. The pill
 * names the NEAREST such ancestor (`./above.ts` reverses the trail and asks the
 * live roster), so a second bound ancestor further up marks its crumb and
 * changes nothing about where the pill goes.
 *
 * ## Two shapes, one gesture
 *
 * The PILL is the page's own affordance and lives where an unbound page's agent
 * line would be, or at the end of a bound page's agent line. The CRUMB MARK is
 * the same door, worn by the crumb of any bound ancestor — where journeys
 * start, rather than only where one happens to land.
 *
 * The mark is a `button` rather than an anchor and stops its press before the
 * row's own: a search row is itself a link, and a control inside an anchor is a
 * control whose activation is also a navigation (the pins' rule). It navigates
 * through the router and announces `olai-navigated` itself, which is what shuts
 * a palette or a header box after a press that was not the row's own.
 *
 * It is not a tab stop (`tabIndex={-1}`): the row it sits in — a search result,
 * a completion row, a breadcrumb link — stays the single stop, and the door for
 * a keyboard is the palette's **Open the agent above**. Nested interactive
 * content is one press for a pointer and two stops for assistive tech; this is
 * the half that keeps the stop count honest.
 *
 * ## The trail is read here, not passed in
 *
 * Every surface that draws either shape already knows its node, and only the
 * node: asking `./above.ts` for its ancestors means a folded row, a docked
 * conversation and a page's head answer one question one way. The memo tracks
 * the pages and the roster, so an agent started or stopped above retargets the
 * pill in place.
 */
import { createMemo, Show } from "solid-js"
import { hrefOfPlain, zoomNode } from "olai-plugin-navigation/routes"
import { useMaybeRouter } from "olai-plugin-navigation/routing"

import { TESTID } from "../../testids.ts"
import { AgentMark } from "../chat/AgentMark.tsx"
import { agentAbove, trailOf } from "./above.ts"
import { type Row } from "./roster.ts"
import { useAgents } from "./answered.tsx"
import { focusAgent, visitAgent } from "./focus.ts"

/** One bound ancestor as a press: its engine's mark, its title, and the name of
 *  the engine beside it. */
function Pill(props: { readonly row: Row; readonly engine: string }) {
  return (
    <a
      href={hrefOfPlain(zoomNode(props.row.id))}
      class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-rule px-2 py-0.5 text-label text-muted no-underline hover:bg-rule hover:text-ink"
      data-testid={TESTID.agentAbove}
      data-agent={props.row.id}
      data-engine={props.row.engine}
      title={`Open the conversation with ${props.row.title}`}
      on:olai-navigated={() => visitAgent(props.row)}
    >
      <span aria-hidden="true">↑</span>
      <AgentMark id={props.row.engine} />
      <span class="min-w-0 truncate text-ink">{props.row.title}</span>
      <span class="shrink-0 text-muted">· {props.engine}</span>
    </a>
  )
}

/**
 * The pill, or nothing at all. `line` puts it where a page's agent line would
 * be: an unbound page has no line of its own, and an empty box under the
 * heading would say a conversation exists.
 */
export function AgentAbove(props: { readonly node: string; readonly line?: boolean }) {
  const agents = useAgents()
  const above = createMemo(() => agentAbove(trailOf(props.node), agents))
  return (
    <Show when={above()}>
      {(row) => {
        const pill = () => (
          <Pill
            row={row()}
            // The roster's title for an engine, or the id the vault wrote when
            // this machine has no row for it.
            engine={agents.standings().find((one) => one.id === row().engine)?.name ?? row().engine}
          />
        )
        return props.line === true
          ? <div class="flex flex-wrap items-center gap-2 border-b border-rule bg-desk/50 px-3 py-1.5 text-label text-muted" data-testid={TESTID.agentAboveLine}>{pill()}</div>
          : pill()
      }}
    </Show>
  )
}

/**
 * The mark a bound ancestor's crumb wears — the same conversation, one press
 * from wherever the crumb is drawn.
 *
 * It draws NOTHING for a node the live roster does not know, so a crumb above
 * an ordinary node looks exactly as it always did.
 */
export function CrumbMark(props: { readonly node: string }) {
  const agents = useAgents()
  const router = useMaybeRouter()
  return (
    <Show when={agents.at(props.node)}>
      {(row) => (
        <button
          type="button"
          tabIndex={-1}
          class="inline-flex shrink-0 items-center rounded-control p-0.5 text-muted hover:bg-rule hover:text-ink"
          data-testid={TESTID.crumbMark}
          data-agent={row().id}
          data-engine={row().engine}
          aria-label={`Open the conversation with ${row().title}`}
          title={`Open the conversation with ${row().title}`}
          onClick={(event) => {
            // The row this can sit in is itself a link (a search result), so
            // the press belongs to this control and to no other.
            event.preventDefault()
            event.stopPropagation()
            if (router === undefined) return
            focusAgent((route) => router.go(route), row())
            // What a followed link says after it moved (`routing.tsx`'s
            // `follow`), so a palette or a header box closes itself.
            event.currentTarget.dispatchEvent(new CustomEvent("olai-navigated", { bubbles: true }))
          }}
        >
          <AgentMark id={row().engine} />
        </button>
      )}
    </Show>
  )
}
