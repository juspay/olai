/**
 * WHAT RECENTLY WANTED ATTENTION — the drawer off the Padi pill.
 *
 * THE CHROME ONLY. What is inside it is the appliance's (`@olai/kolu-ui`'s
 * `EventsFeed`): this file is where the section sits, how wide it is and
 * how the portalled half of `../popover.ts`'s focus cycle finds it — the
 * same contract `../commit/Panel.tsx` and `../settings/Panel.tsx` wear,
 * because a popover that its trigger stops reaching is a bug the chrome
 * half writes, not the log.
 *
 * THE PILL stays beside the pile of badges a page might draw in a place
 * where the header's word is "no". It does NOT carry a summary of its own
 * — the count a drawer reads off a header is the one the panel itself is
 * for, which is `one-git-indicator`'s own door.
 *
 * ## And under the log, the FOOT
 *
 * The drawer's last line is not an event: it is WHO THE WATCH CANNOT SAY
 * and the door onto the file that decides it. Two facts off the wire's
 * `mutes` cell — the mutes' own titles, and the `_olai/Kolu.olai` the
 * convention read (`@olai/server`'s `koluConfig.ts`), so the wrench's
 * navigation is the opening of a page that exists and never a special
 * case. The register is the log's own: the seat is the foot's, the words
 * are the muted ink the rows already speak — a door drawn loud is an
 * affordance reading as an alarm, and a muted terminal is not news.
 *
 * The line NAMES, it does not count zero: nobody muted is the wrench
 * alone, because "0 muted" is noise about a noise that is not there. And
 * DRAWN ONLY WHEN THERE IS A CONFIG: a vault no Kolu.olai decides
 * anything for runs the watcher's defaults, and defaults have no page to
 * open — the drawer is the log alone (the events stay on top; config and
 * status sit at the bottom).
 */

import { Show } from "solid-js"

import { EventsFeed, useFleet } from "@olai/kolu-ui"

import { type Anchor, styleOf } from "../anchor.ts"
import { LAYER } from "../layer.ts"
import { Link } from "../router.tsx"
import { atFile } from "../routes.ts"
import { TESTID } from "../testids.ts"

/**
 * THE FOOT — see the header. Read off the fleet context the drawer's rows
 * already read from (`@olai/kolu-ui`'s `fleet` holds the cell's fold): the
 * vault walk answers on the same frame the timers get their knobs from, so
 * the line here and the watcher's gate can never disagree about who is
 * silenced — rename a mute in the file and the name here moves with the
 * revision, exactly as a threshold edit moves the watch.
 */
function FeedFoot(props: {
  /** The drawer's escort out: a press on the wrench is a navigation, and the
   *  panel goes away — the caret belongs to the page it lands on. */
  readonly onLeave: () => void
}) {
  const fleet = useFleet()
  const mutes = () => fleet.mutes()
  return (
    <Show when={mutes().file}>
      {(file) => (
        <footer
          class="mt-1 flex items-baseline gap-2 border-t border-paper/15 pt-2"
          data-testid={TESTID.padiFeedFoot}
        >
          <Show when={mutes().names.length > 0}>
            <span
              class="min-w-0 flex-1 truncate text-[0.6875rem] text-muted"
              data-testid={TESTID.padiFeedMutes}
              title={mutes().names.join(", ")}
            >
              {`${mutes().names.length} muted · ${mutes().names.join(", ")}`}
            </span>
          </Show>
          {/* A plain press closes the drawer without handing the caret to
              the trigger (the dismissal's day job): the page the wrench
              opens is where the reader goes. A click held with ANY modifier
              aims the page, not the drawer — the browser's own new-tab ask
              and this app's own split (`alt`, `../press.ts`'s `splitClick`)
              alike — so the leaving is conditional on the aim being the
              place itself. `onLeave` wraps the link rather than riding it
              because `../router.tsx`'s `Link` carries no press slot, and
              the click bubbles. */}
          <span
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              props.onLeave()
            }}
          >
            <Link
              route={atFile(file())}
              class="ml-auto flex shrink-0 items-center rounded p-0.5 text-muted hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              testid={TESTID.padiFeedWrench}
              label={`open the watch's config in ${file()}`}
              title={`${file()} — the watch's thresholds and mutes, an outline like any other`}
            >
              {/* A wrench, drawn here in the set's own stroked hand
                  (`../file/icons.tsx` argues the convention): the door onto
                  the watch's knobs, an affordance rather than an alarm. */}
              <svg
                class="size-3 shrink-0"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                aria-hidden="true"
              >
                {/* The jaw: three quarters of a circle, the mouth open up
                    and to the right. */}
                <path d="M8.5 5.2 A3.3 3.3 0 1 1 5.2 1.9" />
                <path d="M8.5 5.2 L6.4 5.1" />
                <path d="M5.2 1.9 L5.1 4.0" />
                {/* The handle, off the jaw's lower edge. */}
                <path d="M7.5 7.5 L13.6 13.6" />
              </svg>
            </Link>
          </span>
        </footer>
      )}
    </Show>
  )
}

export function Feed(props: {
  /** Where to sit, in viewport pixels — see `../anchor.ts`. */
  readonly at: Anchor
  /** The portalled-half handshake (`../popover.ts`'s). */
  readonly inside: (el: HTMLElement | undefined) => void
  /** Shut the panel WITHOUT the caret walk — the wrench's press navigates. */
  readonly onLeave: () => void
}) {
  return (
    <section
      ref={props.inside}
      // No `w-*`: `styleOf(at)` writes the width inline, so a class could
      // never beat it — the panels this wears (`commit/Panel.tsx`,
      // `settings/Panel.tsx`) wear that as a rule, and carry
      // `overflow-x-hidden` with it. Folded in here.
      class={`fixed ${LAYER.over} flex min-h-0 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border-0 bg-panel p-4 text-sm shadow-xl ring-1 ring-rule/40 focus:outline-none`}
      style={styleOf(props.at)}
      // Focusable, never in the tab order — the popover's half of the focus
      // cycle, worn the way every one of these panels wears it.
      tabindex="-1"
      data-testid={TESTID.padiFeed}
      aria-label="what recently wanted attention"
    >
      <h2 class="text-xs font-medium uppercase tracking-wider text-muted">
        recently wanted attention
      </h2>
      <EventsFeed />
      <FeedFoot onLeave={props.onLeave} />
    </section>
  )
}
