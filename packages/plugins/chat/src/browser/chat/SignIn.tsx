import { Index } from "solid-js"
/**
 * SIGN IN, as a row in the panel.
 *
 * Drawn from `ChatState.signIn` rather than from the transcript, and the case
 * that decides it is the one with no transcript at all: an agent that refuses to
 * OPEN a conversation because nobody is signed in has no session, so there is
 * no conversation for a row to live in. `../agents/Fold.tsx` draws this above
 * whichever face the body picks, which is the only place true of both.
 *
 * THREE ARMS, and each is a different thing a person does:
 *
 *   - **choosing** — one button per method the agent advertised, taken from
 *     `talking.methods` (the handshake) rather than from this row, because the
 *     methods are a fact about the agent and this is a fact about a gesture.
 *   - **terminal** — a process this panel runs: what it has printed (with its
 *     URLs clickable), one line to type the code into, and a way out. Exit 0 is
 *     the end and the row goes by itself; anything else leaves the output on
 *     screen AS the failure.
 *   - **agent** — a page and a wait: the card, and nothing to type.
 *
 * NOTHING HERE IS OPTIMISTIC. A press calls a verb; the row is drawn from what
 * the server says, so two tabs showing one sign-in cannot disagree — which is
 * the whole reason the attempt is the agent's and not this component's.
 */

import type { AuthMethod, SignIn as Attempt, SignInLink } from "olai-plugin-chat/wire"
import { agentIn } from "olai-plugin-chat/wire"
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js"

import { TESTID } from "../../testids.ts"
import { LinkCard } from "./LinkCard.tsx"
import { linkify } from "./links.ts"
import type { Chat } from "./state.ts"

/** The one arm drawn as a process's own words — named because the renderer
 *  below takes it as its argument, and `Extract` at the call site would be the
 *  same sentence spelled where nobody looks for it. */
type Terminal = Extract<Attempt, { kind: "terminal" }>

/** Whether the attempt in front of a reader is still going — asked of the arm,
 *  because the three of them say it in three ways. A chooser waits for nobody:
 *  it is a question, not an attempt. */
const running = (attempt: Attempt): boolean => {
  switch (attempt.kind) {
    case "choosing":
      return false
    case "terminal":
      return attempt.running
    case "agent":
      return attempt.why === null
  }
}

/** What the attempt is doing, in its own words — the state a person stares at
 *  while they wait for something they cannot see. */
const doing = (attempt: Attempt): string => {
  switch (attempt.kind) {
    case "choosing":
      return ""
    case "terminal":
      if (attempt.running) return "Running…"
      return attempt.code === null ? "Stopped" : `Exit ${attempt.code}`
    case "agent":
      if (attempt.why !== null) return "Failed"
      return attempt.link?.done === true ? "Finishing up…" : "Waiting for you"
  }
}

export function SignIn(props: { readonly chat: Chat }) {
  const state = () => props.chat.state()
  const attempt = () => state().signIn
  /** What the agent offers. The chooser draws this and nothing else reads it. */
  const methods = (): ReadonlyArray<AuthMethod> => agentIn(state())?.methods ?? []
  const [line, setLine] = createSignal("")

  /** The agent's own name, for the chooser's question. */
  const agentName = () => agentIn(state())?.name ?? "this agent"

  /** WHY AN ATTEMPT ENDED, when it did — the agent's own sentence about an exec
   *  failure or a refusal. `null` for a chooser (which ended nothing) and for
   *  an attempt that is still going. */
  const why = (held: Attempt): string | null => held.kind === "choosing" ? null : held.why

  /** The method an attempt is running, or `null` — what "try again" is pressed
   *  with, and the reason it is not offered on a chooser. */
  const methodOf = (held: Attempt): string | null =>
    held.kind === "choosing" ? null : held.method

  /** WHAT TO CALL THE ROW: the agent's own name for the method when one is
   *  running, and the agent's own name for ITSELF when the question is which
   *  method to pick. */
  const title = (held: Attempt): string =>
    held.kind === "choosing" ? `Sign in to ${agentName()}` : held.label

  const send = () => {
    const typed = line().trim()
    if (typed === "") return
    setLine("")
    props.chat.signInInput(typed)
  }

  /** THE PROCESS'S OWN WORDS, streamed as they arrive. Quoted rather than
   *  rendered, and its URLs clickable — the URL IS why most of this text is
   *  here (a `claude auth login` prints the page and nothing else worth
   *  reading). */
  const Output = (body: { readonly attempt: Terminal }): JSX.Element => (
    <>
      <pre
        class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-label"
        data-testid={TESTID.chatSignInOutput}
      >
        <Index each={linkify(body.attempt.output)}>
          {(piece) => (
            <Show when={piece().href} fallback={piece().text}>
              {(href) => (
                <a
                  class="text-accent underline underline-offset-2"
                  href={href()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {piece().text}
                </a>
              )}
            </Show>
          )}
        </Index>
      </pre>
      {/* ONE LINE, and only while there is a process to write to: the code a
          sign-in asks for is the whole of what a person types here, and a box
          over a finished process would be one whose contents go nowhere. */}
      <Show when={body.attempt.running}>
        <input
          class="mt-2 w-full rounded-control border border-rule bg-paper px-2 py-1 font-mono text-label"
          data-testid={TESTID.chatSignInInput}
          placeholder="Paste the code here"
          value={line()}
          onInput={(event) => setLine(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            send()
          }}
        />
      </Show>
    </>
  )

  /** THE PAGE an agent method sent somebody to, which is the whole of what
   *  there is to do about that arm until the agent says it is done. */
  const Card = (body: { readonly link: SignInLink }): JSX.Element => (
    <div class="mt-2">
      <LinkCard message={body.link.message} url={body.link.url} host={body.link.host} done={body.link.done} />
    </div>
  )

  const Body = (body: { readonly attempt: Attempt }) => <Switch>
    <Match when={body.attempt.kind === "choosing"}>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <For each={methods()}>{method => <button type="button"
          class="flex h-8 items-center rounded-control border border-accent px-3 text-label text-accent"
          data-testid={TESTID.chatSignInMethod} data-method={method.id}
          title={method.description ?? undefined} onClick={() => props.chat.signIn(method.id)}>
          {method.name}
        </button>}</For>
      </div>
    </Match>
    <Match when={body.attempt.kind === "terminal" ? body.attempt : undefined}>
      {held => <Output attempt={held()} />}
    </Match>
    <Match when={body.attempt.kind === "agent" ? body.attempt : undefined}>
      {held => <Show when={held().link} fallback={<p class="m-0 mt-2 text-label text-muted">Waiting for the agent…</p>}>
        {link => <Card link={link()} />}
      </Show>}
    </Match>
  </Switch>

  return (
    <Show when={attempt()}>
      {(held) => (
        <section
          class="m-2 rounded-control border border-doing bg-doing/10 px-3 py-2 text-body"
          data-testid={TESTID.chatSignIn}
          data-kind={held().kind}
          data-method={methodOf(held()) ?? undefined}
        >
          <div class="flex items-baseline gap-2">
            <p class="m-0 min-w-0 flex-1 truncate">{title(held())}</p>
            <span class="shrink-0 text-caption text-muted" data-testid={TESTID.chatSignInStatus}>
              {doing(held())}
            </span>
          </div>

          <Body attempt={held()} />

          {/* THE AGENT'S OWN SENTENCE about why an attempt ended — an exec
              failure, or a refusal. On its own line, because it is the one
              thing a person acts on next. */}
          <Show when={why(held())}>
            {(said) => <p class="m-0 mt-1 break-words text-label text-alarm">{said()}</p>}
          </Show>

          <div class="mt-2 flex items-center gap-2">
            {/* TRY AGAIN is offered exactly where it is honest: an attempt that
                has STOPPED, and stopped by failing rather than by somebody
                pressing cancel (which takes the row away with it). A running
                one has nothing to try. */}
            <Show when={running(held()) ? null : methodOf(held())}>
              {(method) => (
                <button
                  type="button"
                  class="flex h-8 items-center rounded-control border border-accent px-3 text-label text-accent"
                  data-testid={TESTID.chatSignInRetry}
                  onClick={() => props.chat.signIn(method())}
                >
                  Try again
                </button>
              )}
            </Show>
            <button
              type="button"
              class="flex h-8 items-center rounded-control border border-rule px-3 text-label text-muted hover:text-ink"
              data-testid={TESTID.chatSignInCancel}
              onClick={() => props.chat.signInCancel()}
            >
              {running(held()) || methodOf(held()) !== null
                ? running(held()) ? "Cancel" : "Close"
                : "Not now"}
            </button>
          </div>
        </section>
      )}
    </Show>
  )
}
