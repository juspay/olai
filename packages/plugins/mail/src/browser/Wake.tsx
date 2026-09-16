import { Effect } from "effect"
import { createSignal, Show } from "solid-js"
import type { WakeContext } from "olai-plugin-chat/slots"
export function MailWake(props: WakeContext) {
  const [problem, setProblem] = createSignal<string>()
  return <><span class="text-muted">wake on new mail</span><span aria-hidden="true" class="text-muted">·</span>
    <button type="button" role="switch" aria-label="wake on new mail" aria-checked={props.pick() === true} data-testid="mail-wake-switch" onClick={() => {
      setProblem(undefined)
      Effect.runFork(props.setPick(props.pick() === true ? null : true).pipe(Effect.catch(error => Effect.sync(() => setProblem(error.reason)))))
    }}>{props.pick() === true ? "on" : "off"}</button>
    <Show when={problem()}><span role="alert">{problem()}</span></Show>
  </>
}
