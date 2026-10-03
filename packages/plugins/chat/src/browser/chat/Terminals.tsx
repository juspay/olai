import { Key } from "@solid-primitives/keyed"
/** Output survives handle release, so a finished command remains readable. */
import { Show } from "solid-js"
import type { TerminalView } from "olai-plugin-chat/wire"
export const Terminals = (props: { entries: readonly TerminalView[] }) => (
  <Key each={props.entries} by="id">{(terminal) => (
    <section aria-label="Terminal output" class="border-t border-rule/60 px-3 py-2 text-label">
      <div class="mb-1 text-muted">
        {terminal().running ? "Running" : terminal().signal ?? (terminal().exitCode === null ? "Finished" : `Exit ${terminal().exitCode}`)}
        <Show when={terminal().truncated}><span> · Earlier output omitted</span></Show>
      </div>
      <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono">{terminal().output}</pre>
    </section>
  )}</Key>
)
