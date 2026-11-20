import { Index } from "solid-js"

import type { AuthMethod, SignIn as Attempt, SignInLink } from "@kolu/acp/wire"
import { agentIn } from "olai-plugin-chat/wire"
import { createSignal, For, type JSX, Match, Show, Switch } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Tip } from "@olai/web/client/Tip.tsx"
import { identityOf } from "./identityChip.ts"
import { LinkCard } from "./LinkCard.tsx"
import { linkify } from "./links.ts"
import type { Chat } from "./state.ts"

type Terminal = Extract<Attempt, { kind: "terminal" }>

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
  const methods = (): ReadonlyArray<AuthMethod> => agentIn(state())?.methods ?? []
  const [line, setLine] = createSignal("")

  const agentName = () => agentIn(state())?.name ?? "this agent"

  const why = (held: Attempt): string | null => held.kind === "choosing" ? null : held.why

  const methodOf = (held: Attempt): string | null =>
    held.kind === "choosing" ? null : held.method

  const title = (held: Attempt): string =>
    held.kind === "choosing" ? `Sign in to ${agentName()}` : held.label

  const send = () => {
    const typed = line().trim()
    if (typed === "") return
    setLine("")
    props.chat.signInInput(typed)
  }

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
      <Show when={body.attempt.running}>
        <input
          class="mt-2 w-full rounded-control border border-rule bg-paper px-2 py-1 font-mono text-label"
          data-testid={TESTID.chatSignInInput}
          placeholder="Paste the code here"
          enterkeyhint="send"
          autocorrect="off"
          autocapitalize="none"
          spellcheck={false}
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

  const Card = (body: { readonly link: SignInLink }): JSX.Element => (
    <div class="mt-2">
      <LinkCard message={body.link.message} url={body.link.url} host={body.link.host} done={body.link.done} />
    </div>
  )

  const Body = (body: { readonly attempt: Attempt }) => <Switch>
    <Match when={body.attempt.kind === "choosing"}>
      <Show when={state().identity}>
        {identity => (
          <Show when={identity().kind !== "none"}>
            <p class="m-0 mt-2 text-label text-muted" data-testid={TESTID.chatSignInCurrent}>
              Signed in as {identityOf(identity())}
            </p>
          </Show>
        )}
      </Show>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <For each={methods().filter((method) => method.runs !== "hand")}>{method =>
          <Tip text={method.description ?? ""} disabled={!method.description}><button type="button"
            class="flex h-8 items-center rounded-control border border-accent px-3 text-label text-accent"
            data-testid={TESTID.chatSignInMethod} data-method={method.id}
            onClick={() => props.chat.signIn(method.id)}>
            {method.name}
            <Show when={method.description}>{said => <span class="sr-only"> — {said()}</span>}</Show>
          </button></Tip>
        }</For>
      </div>
      <For each={methods().filter((method) => method.runs === "hand")}>{method => (
        <div class="mt-2" data-testid={TESTID.chatSignInByHand} data-method={method.id}>
          <p class="m-0 text-label text-muted">{method.name} — run this in a terminal on the server:</p>
          <pre
            class="mt-1 overflow-auto whitespace-pre-wrap break-all rounded-control border border-rule bg-paper px-2 py-1 font-mono text-label"
            data-testid={TESTID.chatSignInCommand}
          >
            {method.command}
          </pre>
          <p class="m-0 mt-1 text-label text-muted">
            Then <strong>Put to sleep</strong> and open the chat again: the agent reads its account when it
            starts, so the one already running will not see it.
          </p>
        </div>
      )}</For>
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

          <Show when={why(held())}>
            {(said) => <p class="m-0 mt-1 break-words text-label text-alarm">{said()}</p>}
          </Show>

          <div class="mt-2 flex items-center gap-2">
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
