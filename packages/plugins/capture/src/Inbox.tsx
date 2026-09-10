import { TESTID } from "olai-plugin-capture/testids"
import { CountChip } from "@olai/ui-primitives/CountChip.tsx"

import { CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE,ROW_GAP } from "olai-plugin-layout/entry"
import { atFile } from "olai-plugin-navigation/routes"
import { Link } from "olai-plugin-navigation/routing"
import { Show } from "solid-js"
const ENTRY = `${ENTRY_SHAPE} ${ROW_GAP}`
export function Inbox(props: {
  readonly file: string
  readonly isActive: (file: string) => boolean
  readonly broken: boolean
  readonly count: number
}) {
  return (
    <div class="mb-1" data-testid={TESTID.inboxHeld} data-count={String(props.count)}>
      <Link
        route={atFile(props.file)}
        class={`${ENTRY_SHAPE} ${ROW_GAP}`}
        testid={TESTID.inboxLink}
        current={props.isActive(props.file)}
        broken={props.broken}
        title={props.file}
      >
        Inbox
        <Show when={props.broken}>
          {/* No margin of its own: the row has one gap and this is on it — the
              tree's own mark, said the same way (see `File` below). */}
          <span class="text-alarm" title="this file could not be read">
            ⚠
          </span>
        </Show>
        <CountChip
          count={props.count}
          paint={CHIP_QUIET}
          testid={TESTID.inboxCount}
        />
      </Link>
    </div>
  )
}
