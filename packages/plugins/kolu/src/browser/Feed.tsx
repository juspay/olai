import { Show } from "solid-js"
import { Tip } from "@olai/web/client/Tip.tsx"
import { LAYER } from "@olai/web/client/layer.ts"
import { EventsFeed } from "../appliance/index.ts"
import { TESTID } from "../testids.ts"
import { configurationPanel } from "./configuration.ts"
import { name } from "../wire.ts"

function FeedFoot(props: { readonly onLeave: () => void }) {
  return <Show when={configurationPanel()}>{panel =>
    <footer class="mt-1 flex items-baseline gap-2 border-t border-rule pt-2" data-testid={TESTID.padiFeedFoot}>
      <Tip text="Edit watch configuration" layer={LAYER.over}>
        <button type="button" class="ml-auto flex shrink-0 items-center rounded-control p-0.5 text-muted hover:bg-ink/5 hover:text-ink"
          data-testid={TESTID.padiFeedWrench} aria-label="Edit watch configuration"
          onClick={() => { props.onLeave(); panel().open(name) }}>
          <svg
            class="size-3 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M8.5 5.2 A3.3 3.3 0 1 1 5.2 1.9" />
            <path d="M8.5 5.2 L6.4 5.1" />
            <path d="M5.2 1.9 L5.1 4.0" />
            <path d="M7.5 7.5 L13.6 13.6" />
          </svg>
        </button>
      </Tip>
    </footer>
  }</Show>
}

export function Feed(props: {
  readonly onLeave: () => void
}) {
  return <>
    <h2 class="text-label font-medium uppercase tracking-wider text-muted">Recent activity</h2>
    <EventsFeed />
    <FeedFoot onLeave={props.onLeave} />
  </>
}
