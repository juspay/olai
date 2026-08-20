/**
 * Git as a phone banner: uncommitted, blocked, a fault, or unpushed.
 *
 * The desktop pill is ALWAYS drawn (`./Commit.tsx`), because a chip that
 * vanished cannot be trusted. A banner can: it is only there when there is
 * news, and a healthy tree is the page itself. Tap opens the same panel the
 * pill opens. WHERE this sits is `../News.tsx`.
 */

import { Show } from "solid-js"
import { Portal } from "solid-js/web"

import { createNow } from "./ago.ts"
import { explain, faceOf, isInert, isNews, newsSays } from "./said.ts"
import { Panel } from "./Panel.tsx"
import { BANNER } from "../readout.ts"
import { createPopover } from "../popover.ts"
import { autoPush } from "../settings/autopush.ts"
import { createCommit } from "./state.ts"
import { TESTID } from "../testids.ts"

export function GitNews() {
  const commit = createCommit(autoPush)
  const panel = createPopover()
  const now = createNow()

  const face = () => faceOf(commit.pending(), commit.heard(), commit.git())
  const inert = () => isInert(face())
  const unpushed = () => commit.pending().unpushed?.commits ?? 0
  const said = () => explain(face(), commit.pending(), commit.git())
  const show = () => isNews(face(), unpushed())
  const line = () => newsSays(face(), commit.waiting(), unpushed())
  const alarm = () => face() === "error"

  return (
    <Show when={show()}>
      <>
        <button
          type="button"
          ref={panel.setTrigger}
          class={`${BANNER} justify-between ${
            alarm() ? "text-alarm" : "text-doing"
          }`}
          data-testid={TESTID.gitNews}
          data-state={face()}
          data-uncommitted={commit.waiting()}
          data-unpushed={unpushed()}
          data-repo={commit.pending().repo._tag}
          aria-expanded={inert() ? undefined : panel.open()}
          aria-disabled={inert() ? true : undefined}
          aria-label={said()}
          onClick={() => {
            if (!inert()) panel.toggle()
          }}
        >
          {line()}
        </button>
        <Show when={panel.open() && !inert() ? panel.at() : null}>
          {(at) => (
            <Portal>
              <Panel commit={commit} now={now()} at={at()} inside={panel.setPanel} />
            </Portal>
          )}
        </Show>
      </>
    </Show>
  )
}
