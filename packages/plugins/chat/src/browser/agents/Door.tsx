/**
 * THE DOOR ON AN AGENT-CARRYING ROW: what that node's agent is, and one line of
 * what it last said.
 *
 * The kolu Dock-row pattern, pointed at a node agent instead of a terminal
 * (docs/plugins/kolu.md): a state pip, the standing facts, a recency, and one
 * line of annotation under them. That shape is borrowed deliberately — a reader
 * who has learnt what a terminal's row means on a lane board should not have to
 * learn a second vocabulary for the agent sitting on the row above it.
 *
 * ## The PATTERN and not the component, which is a fence rather than a choice
 *
 * kolu's row IS a component — `@kolu/solid-dockrow`, with `@kolu/solid-statepip`
 * for the pip — and this file may not name either. Those are PRODUCT-TIER
 * imports, confined by `packages/bundle/src/fence.test.ts` to the two
 * package that is kolu's tenancy (`olai-plugin-kolu`), which is the whole
 * arrangement that lets a serve run
 * without kolu at all. A core face reaching for kolu's row would put an
 * appliance's package on the critical path of a directory that has never heard
 * of one.
 *
 * So what is shared is what CORE owns and both wear: `../readout.ts`'s `Look`
 * and `DOT` — a mark, two or three words, and a sentence behind them — which
 * the connection dot and the Commit pill already are ({@link ./roster.ts}'s
 * `LOOK`). The costume that would have been a third one is not; the geometry
 * that stays this file's is the box and the second line, because those are
 * about a property run rather than about a readout.
 *
 * A BLOCK and not a chip, on the live-properties seam's own rule
 * (docs/live-properties.md): a chip appears only while there is something to
 * say, and a block OWNS ITS ROW because the thing it names is worth a row
 * whether or not anything is happening. A node agent somebody wrote down is
 * exactly that — there is always something to say about it, including *nobody
 * has bound a session to this one*.
 *
 * ## Why it is NOT registered on that seam
 *
 * The seam is keyed on a KIND a plugin contributed, and its whole point is that
 * a general package names no tenant (`../live/seam.ts`, and the fence one
 * package over that holds it). A node agent is not an appliance's face: `agent`
 * is core's own property, the roster is core's own cell, and the panel it
 * switches is core's own panel. Registering it there would mean either teaching
 * core to contribute a kind to its own registry, or letting the drawer name a
 * thing no plugin owns — and the second is exactly the import direction the
 * extraction exists to make impossible.
 *
 * So the ROW draws it, beside the property run rather than inside it
 * (`../NodeBody.tsx`), which is the same arrangement the ⏱ chip already lives
 * under: a live face with no plugin kind to hang off, drawn by the row, with
 * its own header saying why.
 *
 * ## What it says, and what it does not
 *
 * The standing facts, in one line: how it stands — which is also whether it has
 * a session at all, since *no session bound* is one of the seven — its engine,
 * and HOW BIG ITS MEMORY IS, which is the number this whole design turns on,
 * because the subtree is what a fresh session would read.
 *
 * And under them, ONE LINE of the agent's latest message — with the
 * qualification drawn rather than implied: this is what olai HEARD, written
 * down while the panel was in that conversation (`olai-plugin-chat`'s `sessions.ts`).
 * A door with nothing on that line is an agent olai has not heard yet, which is
 * a line absent rather than an empty one.
 *
 * NO PRESS ON AN UNBOUND AGENT, and that is the one place this differs from the
 * roster row. From the sidebar an unbound row still means *take me to this
 * agent* and can still do the half that exists (its node); here the reader is
 * already standing on the node, so the only half left is the one there is no
 * session for. A control that did nothing would be a control a person presses
 * to find out — so it is drawn as the row it is.
 */

import { Show } from "solid-js"

import { memoryOf } from "@olai/format"

import { DOT } from "@olai/web/client/readout.ts"
import { SaidLine } from "@olai/web/client/SaidLine.tsx"
import { TESTID } from "../../testids.ts"
// HOW LONG AGO, REACHED AND NOT RE-SPELLED. `agoOf` is the commit pill's by
// history and by nothing else — it is pure arithmetic over an ISO stamp and a
// clock, with its own table of cases — and a second phrasing of *2m ago* in
// this app would be a second thing to keep saying the same words
// (`../chat/elapsed.ts` makes the same argument from the other side about why
// ITS phrasing differs: it counts a turn's own life, not a stamp's age). It
// lives under `commit/` still because this is its second reader and not its
// third; the day a third arrives it belongs at the client's root, with
// `../saying.ts` and `../refusals.tsx`.
import { agoOf, createNow } from "@olai/web/client/commit/ago.ts"
import { useAgents } from "./answered.tsx"
import { createFocus, type Focus } from "./focus.ts"
import { LOOK, type Row } from "./roster.ts"

export function AgentDoor(props: { readonly node: string }) {
  // ONE LOOKUP, and that is the whole of what a row does here. This component
  // is mounted for EVERY node of the outline and answers nothing on nearly all
  // of them, so what it may cost is a map read: the roster is subscribed once
  // for the whole app (`./answered.tsx`, which argues what subscribing per
  // row would cost).
  const roster = useAgents()
  // THE GESTURE AND ITS LINE, held HERE rather than inside the door: the line
  // has to outlive the row it was about (`./focus.ts`), and this wrapper is
  // what stays mounted when the roster's frame replaces that row.
  const focus = createFocus()

  return (
    <Show when={roster.at(props.node)}>
      {(agent) => <Door agent={agent()} focus={focus} />}
    </Show>
  )
}

function Door(props: { readonly agent: Row; readonly focus: Focus }) {
  const look = () => LOOK[props.agent.standing]
  const now = createNow()

  return (
    <div class="mb-1.5 ml-6 max-w-[44rem]">
      <div
        class="rounded-lg border border-rule bg-panel px-2.5 py-1.5"
        classList={{ "cursor-pointer hover:border-accent": props.agent.session !== null }}
        data-testid={TESTID.agentDoor}
        data-agent={props.agent.id}
        data-standing={props.agent.standing}
        // A PRESS ONLY WHERE THERE IS SOMETHING TO OPEN. Spelled as the role
        // and the handler going together rather than as a disabled button:
        // there is no disabled state to explain here, the row simply is not a
        // control on a node nobody has bound a session to.
        {...(props.agent.session === null ? {} : {
          role: "button",
          tabindex: 0,
          title: `open this agent in the panel — ${look().detail}`,
          onClick: () => props.focus.open(props.agent),
          onKeyDown: (event: KeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            props.focus.open(props.agent)
          },
        })}
      >
        {/* THE STANDING FACTS, and NOT the node's title. kolu's row names its
            terminal because the row is the only thing on screen that could;
            this door is drawn one line under the node's own title, every time,
            so naming it again would be furniture at the width of the fact it
            was crowding out (the same rule a spawn's door keeps about its
            description — `../chat/door.ts`). What is left is what only the
            door can say. */}
        <p class="m-0 flex items-center gap-2 text-[0.8125rem] leading-snug">
          <span class={`${DOT} ${look().dot}`} aria-hidden="true" />
          {/* THE STANDING NEVER SHRINKS. It is the one word on this line a
              person is reading the door FOR, and a flex row shrinks its items
              in proportion — so without this the state was clipped to `asle…`
              while the engine beside it kept its full width. */}
          <span class="shrink-0 font-semibold text-accent">{look().label}</span>
          <span class="min-w-0 truncate text-muted">
            · {props.agent.engine} · memory: this subtree ({memoryOf(props.agent)})
          </span>
          {/* HOW LONG AGO, off the reader's own clock — so a door that said
              *2m* at breakfast is not still saying it at noon. The clock is
              this door's own and ticks only while it is on screen, which is
              what makes a board with three agent rows three minute-timers
              rather than one per row of the outline. */}
          <Show when={props.agent.said}>
            {(heard) => (
              <span class="ml-auto shrink-0 text-muted">{agoOf(heard().at, now())}</span>
            )}
          </Show>
        </p>
        {/* ONE LINE, and it is the agent's own words — never olai's about it
            (`olai-plugin-chat`'s `heard.ts` picks the row). The qualification is in
            the tooltip rather than in the line, because the line is one line
            and spending half of it on a caveat would leave no room for the
            message it is a caveat about. */}
        <Show when={props.agent.said}>
          {(heard) => (
            <p
              class="m-0 mt-0.5 truncate text-[0.8125rem] leading-snug text-muted"
              data-testid={TESTID.agentSaid}
              title="the last thing olai heard this agent say"
            >
              {heard().text}
            </p>
          )}
        </Show>
      </div>
      <Show when={props.focus.said()}>
        {(line) => (
          <SaidLine
            said={line()}
            testid={TESTID.agentRefused}
            class="mt-1 text-[0.75rem]"
          />
        )}
      </Show>
    </div>
  )
}
