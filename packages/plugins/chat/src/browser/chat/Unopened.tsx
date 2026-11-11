/** An opening refusal belongs to the requested conversation. Show the
 * engine's reason and retry that same attempt; no composer is available until
 * the session opens. Missing engine capability is drawn by NoAgent instead.
 *
 * NOT EVERY REFUSAL IS LIKE THE OTHERS, and this face is where that shows.
 * Three bodies, and the branch is `Unopened.cause` (`olai-plugin-chat/wire`'s
 * `UnopenedCause`) — never the sentence, which is the agent's own prose:
 *
 *   - a refusal for want of a SEAT is not a fault and not a thing to press
 *     again: every node agent is awake, the server is holding this attempt,
 *     and it opens itself the moment somebody puts one to sleep
 *     (`../../server/readings.ts`). So that case is drawn quietly, says what
 *     to do, and offers no button — a *Try again* there would be a control
 *     whose only honest answer is "still full", and an alarm colour would
 *     report a problem with a chat that has nothing wrong with it;
 *   - a chat this engine's store has no record of (ACP's `-32002`,
 *     `../../agent.ts`'s `missingOf`) is the opposite kind of permanent: *Try
 *     again* is honest about what it asks for and will be refused for ever.
 *     It is drawn calm rather than red — nothing broke, the chat is simply
 *     somewhere else — and the gesture that MOVES is on it;
 *   - everything else is an agent saying no in its own words, with the retry
 *     that is exactly what fixing the problem makes work.
 *
 * THE WAY OUT IS ON THE LAST TWO, and only for the node's CURRENT chat. A
 * fresh start re-points the node's `agent-session`; offering it while reading
 * an EARLIER chat of that node would re-point a binding the person is not
 * looking at. That question belongs to the button that asks it
 * ({@link StartFresh}) rather than to the body it sits in: a body's job is
 * which words, and neither of these two reads the answer. */

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

/**
 * WHICH OF THE THREE, and the box all of them are drawn in.
 *
 * They share a scroller, an id and the said line under them, and nothing else
 * — one is about a fault and offers the way out of it, one is about a wait and
 * offers nothing, one is about a chat that is elsewhere. They are three
 * components for that reason rather than one with flags threaded through its
 * paragraphs.
 */
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

      {/* WHAT A PRESS WAS TOLD, when there was one to press. The panel's
          refusal line lives in the transcript, and there is no transcript here
          — so without this a click on a control in this body could be
          refused and say nothing at all, which is the one thing the error
          rule asks of every error. It is the same component the conversation draws,
          because it is the same kind of answer.

          The press it reports is the SECOND one: `reopen` takes the attempt as
          it reads it, so a retry already in flight leaves nothing for the next
          click to leave with, and it is told so rather than opening a second
          conversation on top of the first. A refused fresh start lands here
          too ({@link StartFresh}), for the same reason and on the same line. */}
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

/** THE AGENT ANSWERED, AND ITS ANSWER WAS NO — the ordinary case, and the one
 *  there is something to do about. */
function AgentSaidNo(props: {
  readonly chat: Chat
  readonly unopened: Refused
  readonly node: string
}) {
  return (
    <>
      <p class="m-0 mb-3 text-ink">
        {/* NAMED where a name was asked for, and not otherwise. A boot picks
            its own conversation, so "could not open `fake-stored-old`" would
            be this panel putting a name to a choice nobody made. */}
        {props.unopened.what === null
          ? "The agent couldn't open a chat."
          : "The agent couldn't open that chat."}
      </p>

      {/* Its own line and its own id, for `Missing.tsx`'s reason: the REASON is
          what this face exists for, and `break-words` because it can carry a
          session id or a method name into a 26rem drawer. */}
      <p class="m-0 mb-3 break-words text-label text-alarm" data-testid={TESTID.chatUnopenedWhy}>
        {props.unopened.why}
      </p>

      <p class="m-0 mb-3">
        Your notes still work. Try again once the problem is fixed.
      </p>

      {/* AND THE WAY OUT BESIDE IT where this is the node's current chat. The
          words above stay exactly what they were: this is still the agent
          saying no, and the problem may still be a thing somebody can fix —
          what changes is that waiting for that is no longer the only move a
          person has. */}
      <span class="flex flex-wrap gap-2">
        <TryAgain chat={props.chat} />
        <StartFresh chat={props.chat} node={props.node} />
      </span>
    </>
  )
}

/** EVERY SEAT IS TAKEN, which is not a fault and not a thing to press again.
 *  The sentence is the server's, verbatim — it names how many seats there are
 *  and the node menu's refusal says exactly the same words — and the line
 *  under it is what this panel is going to do about it on its own. */
function WaitingForASeat(props: { readonly why: string }) {
  return (
    <>
      <p class="m-0 mb-3 text-ink" data-testid={TESTID.chatUnopenedWhy}>{props.why}</p>
      <p class="m-0">This chat opens here as soon as a seat frees.</p>
    </>
  )
}

/**
 * THE CHAT IS SOMEWHERE ELSE — a vault opened on a new machine, an engine
 * store that was cleared, an id minted by a computer this one has never been.
 *
 * NO ALARM COLOUR, because nothing here is broken: olai is intact, the engine
 * is running and answering, and the agent's memory was never in the transcript
 * in the first place — it is in the notes, which is the sentence a person needs
 * most and the reason a fresh chat costs nothing. The engine's own words stay,
 * because the id in them is how somebody recognises which chat this was, but
 * they are a DETAIL line rather than the headline.
 *
 * *Try again* stays too, and honestly: a store on a network volume that was not
 * mounted a second ago is the same refusal from an engine that will find the
 * chat on the next press.
 *
 * AND ONE OF THEM WAS MADE HERE, a minute ago. No engine writes a session
 * nobody has spoken into, so a fresh chat left unused until the next restart
 * is a real `-32002` of an id this machine minted — which is why the sentence
 * names that too rather than only blaming another computer. It is one press
 * out again, exactly as the first was.
 */
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

      {/* Muted, not alarm: the same id, the same sentence, and no longer a
          warning — see this component's own reason. */}
      <p class="m-0 mb-3 break-words text-label" data-testid={TESTID.chatUnopenedWhy}>
        {props.unopened.why}
      </p>

      {/* The way out first here, because on this body it is the move: the
          retry beside it is for the store that comes back. */}
      <span class="flex flex-wrap gap-2">
        <StartFresh chat={props.chat} node={props.node} />
        <TryAgain chat={props.chat} />
      </span>
    </>
  )
}

/** ASK FOR THE SAME CONVERSATION AGAIN — one control, because the two bodies
 *  that draw it draw the SAME one: the header's own quiet pill at the header's
 *  own scale, in prose rather than in the transcript's 11px mono line, so it
 *  is the shared spelling rather than `Entry.tsx`'s smaller lookalike. What
 *  differs between the bodies is where it sits, which is the body's to say. */
function TryAgain(props: { readonly chat: Chat }) {
  return (
    <button type="button" class={QUIET_PILL} data-testid={TESTID.chatReopen}
      onClick={() => props.chat.reopen()}>
      Try again
    </button>
  )
}

/**
 * ONE PRESS, AND NOTHING TO CONFIRM.
 *
 * The agent line's *Fresh start* asks first, and its question is the whole
 * reason it is safe: *the current chat moves to earlier chats*. On this body
 * that sentence is false — there IS no current chat, the engine refused to open
 * one — so a confirmation here would be olai asking a person to agree to
 * something that is not going to happen, in front of the one button that gets
 * them moving. The gesture underneath is the same one
 * (`conversation.startAgentSession`, the node's own opening permit); what is
 * dropped is a question with no subject.
 *
 * ON THE NODE'S OWN ENGINE, always. This is a way out of a lost conversation,
 * not an invitation to change engine — the engine menu belongs to the gesture
 * that has a conversation to compare against.
 *
 * MAY IT BE OFFERED AT ALL? That is this button's question and nobody else's,
 * so it is asked here: the bodies around it choose words, and neither reads
 * the answer. The reader must not be on a history visit
 * ({@link ../agents/past.ts}, the same predicate the fold line draws *Earlier
 * chat* from), and the pair that was REFUSED must be the pair the node is
 * bound to — engine and session, never the session alone. Ids live in one
 * engine's own space and an adapter may reuse one across engines
 * (`../../scoped.ts` records replacements on that assumption), so an earlier
 * chat on another engine with the same id would otherwise be handed the
 * gesture that re-points the binding. Nothing is drawn for a bare node, for a
 * refused open nobody named a conversation for (a boot, a `session/new` that
 * wanted a signature — there is no lost chat to move on from), or for an
 * earlier chat read out of this node's history.
 *
 * A REFUSED PRESS SAYS WHY, on the line this body already draws for a refused
 * *Try again* ({@link Unopened}'s `chat.refused()`), rather than silently
 * leaving the person on the same dead end they pressed to escape — and it puts
 * the reader back on the conversation the node is still bound to, so the body
 * under that line is still the body about THAT chat. That half is the shared
 * gesture's ({@link ../agents/fresh-start.ts}); writing it a second time here
 * is what left a refused press showing one face over a different refusal.
 */
function StartFresh(props: { readonly chat: Chat; readonly node: string }) {
  const agents = useAgents()
  const [starting, setStarting] = createSignal(false)
  /** The pair this press would replace, or `null` where there is none to. */
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
    // THE CONVERSATION THIS PRESS BELONGS TO, held across the round trip —
    // and it can MOVE while the request is in flight, by this gesture's own
    // doing. A refusal returns the reader to the chat the node is still bound
    // to ({@link ../agents/fresh-start.ts}), which is a different address and
    // therefore a different `Chat` than the node-addressed one this body was
    // drawn in: the line written on the object that was pressed would be a
    // line nothing renders. So the refusal is said on the node's readers as
    // they stand afterwards, with the pressed conversation as the fallback for
    // a node that has none left.
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
