/**
 * WHO THE AGENT IS SIGNED IN AS, drawn after its name in the agent line.
 *
 * The case it exists for is two Claude Code accounts — work and personal —
 * where a conversation can quietly run on the wrong one. The chip is the
 * answer to "who is this about to run as" before a person types, and pressing
 * it is the way to switch: the same chooser `/login` asks for, one gesture from
 * the fact it changes.
 *
 * NOT DRAWN AT ALL for an agent that does not report an identity, which is most
 * engines today. That absence is a state of its own — the protocol's silence
 * means "not reported", not "nobody signed in" — and the known logged-out state
 * is the chip reading `Not signed in` (`../chat/identity.ts` holds both rules).
 *
 * A BUTTON ONLY WHERE THERE IS SOMETHING TO PRESS. The agent's own handshake
 * says whether it offered a way in; an agent with no methods gets a plain label,
 * because a chip that opened a chooser with no buttons on it would be a control
 * that could not do what it looks like it does.
 *
 * `LINE_VERB`'s rule is kept: no border and no extra padding, so the line does
 * not change height as the chip comes and goes (`./verb.ts` argues it).
 */

import { Show } from "solid-js"

import type { AuthStatus } from "olai-plugin-chat/wire"

import { TESTID } from "../../testids.ts"
import { identityOf, identityTitleOf } from "../chat/identity.ts"
import type { Chat } from "../chat/state.ts"

const CHIP = "inline-flex items-center rounded-control bg-ink/5 px-1.5 text-label text-muted"

export function Identity(props: {
  readonly chat: Chat
  /** The whole value, as an accessor: the agent revises it mid-conversation
   *  (`kind` and the account can change when a sign-in lands), so the chip's
   *  words have to follow the cell rather than a value read once. */
  readonly identity: () => AuthStatus
  /** Whether the agent offered a way in — the handshake's methods, not a
   *  guess. */
  readonly pressable: boolean
}) {
  const said = () => identityOf(props.identity())
  const title = () => identityTitleOf(props.identity())
  const kind = () => props.identity().kind ?? "unknown"
  return (
    <Show
      when={props.pressable}
      fallback={
        <span class={CHIP} data-testid={TESTID.chatIdentity} data-kind={kind()} title={title()}>
          {said()}
        </span>
      }
    >
      <button
        type="button"
        class={`${CHIP} hover:bg-ink/10 hover:text-ink`}
        data-testid={TESTID.chatIdentity}
        data-kind={kind()}
        title={`${title()} — press to sign in as someone else`}
        onClick={() => props.chat.signIn(null)}
      >
        {said()}
      </button>
    </Show>
  )
}
