/**
 * The servers this conversation does NOT have, in sentences — the whole of
 * `mcp-fail-visible`, drawn under {@link ./Roster.tsx}'s list of the ones it
 * does.
 *
 * A server that failed to attach used to leave a debug log line and a session
 * quietly short of its tools: the panel drew a perfectly healthy conversation,
 * the agent could not see kolu's terminals, and the way to find out which of
 * those was true was to read olai's log from outside the app. The whole of this
 * component is that the two are told apart on screen.
 *
 * ITS OWN COMPONENT, still, now that the roster names the healthy servers as
 * well. The two answer two questions — *which servers are here* and *why is one
 * of them not* — and they change for different reasons: a fifth standing moves
 * the chips, a reworded probe moves these. A conversation that got everything
 * answers only the first, so this is a component that is absent rather than a
 * branch inside that one, and its testid is what a scenario asserts the absence
 * of.
 *
 * The REASON is the feature — "kolu did not attach" is the sentence every
 * failure shares and the one that never helped anybody — so it is not folded
 * behind a disclosure, which would ship the log line again one click further
 * away. Two short lines per server, on rows nobody sees unless something
 * actually failed.
 *
 * TWO STANDINGS reach here and the sentence is what tells them apart
 * ({@link ./standing.ts}): olai's own probe refused to hand the server over
 * (`missing`), or olai handed it over and the AGENT could not attach it
 * (`unattached`) — which is a fact olai could not report at all until
 * `mcp-roster-visible`, because ACP's `session/new` says nothing per server.
 * They want different things done about them, which is why the words differ.
 */

import { notHere } from "olai-plugin-chat/wire"
import type { Server } from "@kolu/acp/wire"
import { createMemo, For, Show } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { SAID } from "./standing.ts"

export function Missing(props: { readonly servers: ReadonlyArray<Server> }) {
  /**
   * The rows this component is about, picked out of the whole roster.
   *
   * HERE rather than in the caller, because which standings mean "this
   * conversation does not have it" is this component's own subject — a caller
   * that pre-filtered would be the rule living one file away from the thing it
   * is about, and the component could not be read alone.
   *
   * Asked as "is this server not here?" rather than by listing the two
   * standings that mean it: `notHere` is a TOTAL switch over the four words
   * (`olai-plugin-chat/wire`), so a fifth standing has to answer the question
   * rather than quietly not match a list here.
   *
   * MEMOIZED, which is the difference between one filter per change and two
   * fresh arrays per read: `<Show>` reads it and `<For>` reads it, and a fresh
   * array on the second read is one `mapArray` can never skip — throwing away
   * exactly what the cell's `arrayKey: "name"` identity declaration buys.
   */
  const absent = createMemo(() => props.servers.filter(notHere))
  return (
    <Show when={absent().length > 0}>
      <div class="mt-1 space-y-1" data-testid={TESTID.chatMissing}>
        <For each={absent()}>{(server) => <Row server={server} />}</For>
      </div>
    </Show>
  )
}

/**
 * WHAT TO PUT UNDER THE NAME — the sentence a person reads about a server
 * this conversation does not have.
 *
 * A `missing` row's words are the PROBE'S and are already a sentence, written
 * by the plugin whose tool would not answer, and they are carried through
 * untouched: no template here takes a noun from anybody.
 *
 * An `unattached` row's words are the AGENT'S and are a WORD — `needs-auth`,
 * `failed` — because the client quotes what the agent said rather than
 * wrapping it (`@kolu/acp/wire`'s `Server`, whose `said` is the agent's own).
 * A word alone under a server's name reads as a tag rather than as an answer,
 * so the framing is this panel's: the client carries the fact and the panel
 * words it, which is the same division `./standing.ts` keeps one line up.
 */
const reasonOf = (server: Server): string | null =>
  server.said === null
    ? null
    : server.standing === "unattached"
    ? `the agent did not attach it: ${server.said}`
    : server.said

/** One of them: what is not here, why not, and — when there was one — which
 *  file was asked. */
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
      {/* The server's own words, and the reason this strip is worth its
          pixels. `break-words` because a reason can carry a socket path or an
          errno string, and a 26rem drawer is not wide enough to be trusted
          with one. Absent when the agent or the probe said nothing at all —
          an empty line under the name would be this panel implying a sentence
          nobody wrote. */}
      <Show when={reasonOf(props.server)}>
        {(said) => (
          <p class="break-words pl-3 text-muted" data-testid={TESTID.chatMissingWhy}>
            {said()}
          </p>
        )}
      </Show>
      {/* WHICH file was asked. The incident this whole feature comes from was
          exactly this question: a `kolu` on PATH is not necessarily the host's
          kolu, and a padi-spawned terminal prepends its own bundled copy. It
          truncates and keeps the whole of it under the pointer, because a
          store path is longer than this drawer and the tail of one is the half
          that identifies it. The tip needs no spoken copy: the path IS this
          paragraph's text, whole, and only the drawing is cut.

          Absent for the one failure that never reached a file, where the
          reason above is the whole of it — an empty line under it would be
          this panel implying a path it does not have. */}
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
