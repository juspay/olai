/**
 * Which MCP servers this conversation has — the strip under the header.
 *
 * The visible half of `mcp-roster-visible`. #140 drew the FAILURES and
 * deliberately nothing on a healthy session, on the argument that a working
 * conversation is owed no sentence ({@link ./Missing.tsx}, which still draws
 * them and is still that argument). The argument the incident makes back is
 * that "which servers does this conversation have?" is a question people
 * actually ask — and that with nothing on screen to answer it, the thing they
 * ask is the MODEL. It answered wrong: an opencode listed olai and deepwiki,
 * omitted kolu, and then called `kolu_lifecycle_create` perfectly. The client
 * that handed the servers over is the only thing that knows, so the client says
 * it.
 *
 * WHAT IT DRAWS, and each line is only as certain as who spoke for it:
 *
 *   - **the roster** — every server this conversation was handed, in the order
 *     it was handed, plus the one it was meant to have and did not. A tick is
 *     drawn where the AGENT ITSELF said the server attached and nowhere else;
 *     a name with no mark is one olai handed over and nobody has reported on,
 *     which is every row on an agent that says nothing per server
 *     (`../../../../chat/src/servers.ts`).
 *   - **"plus the agent's own"** — the hedge, and the reason this strip can be
 *     read as an answer at all. Olai lists what olai handed over; the servers a
 *     person put in their own agent's config are configured where olai cannot
 *     see them. A list that stopped at the last chip would be making the
 *     completeness claim the model made.
 *   - **the reasons**, which are {@link ./Missing.tsx}'s and are drawn by it:
 *     the name, the sentence the probe or the server or the agent gave, and the
 *     file that was probed. TWO COMPONENTS because they answer two questions —
 *     which servers are here, and why one of them is not — and a healthy
 *     conversation answers only the first, so the second is a component that
 *     is simply absent rather than a branch inside this one.
 *
 * Three arguments about how it is drawn, and each is a thing it deliberately is
 * not:
 *
 *   - **it is not an alarm, even when something failed.** Nothing is broken:
 *     the conversation works, the outlines are served, and the agent will
 *     answer — it simply has fewer tools than it might have. So this takes the
 *     panel's quiet vocabulary (`panel` under a `desk`, the header's own 11px
 *     mono, muted prose) and one `alarm` mark, which is the smallest this
 *     palette has for "something to look at". A red banner would teach a reader
 *     to close the drawer.
 *   - **it is not folded.** The REASON is the feature — "kolu did not attach"
 *     is the sentence every failure shares and the one that never helped
 *     anybody — so hiding it behind a disclosure would ship the log line again,
 *     one click further away. It is a line, plus two short ones per failure.
 *   - **it is not in the transcript.** This is a standing property of the
 *     session, like the model in the header above it, and not something that
 *     happened at a point in the conversation. A notice row would scroll out of
 *     reach under the first answer — which is where the reader is when they
 *     wonder what the agent can see.
 *
 * UNDER THE HEADER rather than inside it, which is where the roadmap item put
 * it ("the roster row lives with the agent identity the header already shows")
 * and is what that means in a 26rem drawer: the header's second line already
 * carries the agent, the model, the context readout and the live cue, all of it
 * under one `truncate`, and a roster added to that line would push the model
 * off the end of it on a phone. This is the same block — above the scroll,
 * never carried away by it, in the same 11px mono — one line down.
 *
 * IT DRAWS ON EVERY CONVERSATION and is absent only where there is no
 * conversation to have servers: no agent configured, or the beat between two
 * sessions. That is the same `<Show>` #140 had, reading a member that now means
 * something else — an empty roster was "everything arrived" and is now "there
 * is nothing to report about", because servers are handed at session open.
 *
 * It does not reach the app header's agent toggle, which is the one piece of
 * chrome a shut panel cannot swallow. That bit is spent on `asking` and should
 * stay spent on it: a turn stopped on a question will never finish by itself,
 * so a person who cannot see it is stuck. A conversation short of a tool is not
 * stuck — the agent answers — so what it is owed is a place to be found, not an
 * interruption.
 */

import { type ChatServer, whyNot } from "@olai/surface"
import { For, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Missing } from "./Missing.tsx"
import { SAID } from "./standing.ts"
import type { Chat } from "./state.ts"

export function Roster(props: { readonly chat: Chat }) {
  const servers = () => props.chat.state().servers
  /** The ones this conversation does NOT have. Asked as "is there a reason?"
   *  rather than by listing the two standings that have one, because the union
   *  grounds a reason on exactly those two — so this cannot fall out of step
   *  with them, and a fifth standing has to answer the question rather than
   *  quietly not match a list. */
  const absent = () => servers().filter((server) => whyNot(server) !== null)

  return (
    <Show when={servers().length > 0}>
      <section
        class="shrink-0 border-b border-rule/70 bg-panel px-3 py-1.5 font-mono text-[0.6875rem] leading-snug"
        data-testid={TESTID.chatRoster}
        aria-label="tool servers"
      >
        <p class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <For each={servers()}>{(server) => <Chip server={server} />}</For>
          {/* THE HEDGE, and it is drawn on every conversation including a
              perfect one. Olai knows what it handed over and cannot know what
              the agent brought: those servers live in the agent's own config,
              are named to us at most once a turn by an agent free to reconnect
              one in between, and are not named at all on the other leg. A strip
              that ended at the last chip would be claiming a completeness this
              end has no way to have. */}
          <span
            class="text-muted/70"
            data-testid={TESTID.chatRosterOwn}
            title="olai lists the servers it handed this conversation; whatever the agent is configured with of its own is not olai's to see"
          >
            <span aria-hidden="true">· </span>plus the agent&rsquo;s own
          </span>
        </p>
        <Missing servers={absent()} />
      </section>
    </Show>
  )
}

/** One server on the roster: its name, how it stands, and — on hover — where it
 *  is. */
function Chip(props: { readonly server: ChatServer }) {
  const said = () => SAID[props.server.standing.kind]
  return (
    <span
      class="flex items-baseline gap-1 text-ink"
      data-testid={TESTID.chatServer}
      data-server={props.server.name}
      // The STANDING as data, so a scenario can assert the state without
      // asserting the mark: which glyph says "connected" is a decision about
      // pixels, and a test that pinned it would fail the next time somebody
      // improved it (`../../../../../HACKING.md`).
      data-standing={props.server.standing.kind}
      title={`${props.server.name} ${said().sentence}${
        props.server.where === null ? "" : ` — ${props.server.where}`
      }`}
    >
      <span>{props.server.name}</span>
      <Show when={said().glyph !== ""}>
        <span class={said().tint} aria-hidden="true">{said().glyph}</span>
      </Show>
      <span class="sr-only">{said().sentence}</span>
    </span>
  )
}
