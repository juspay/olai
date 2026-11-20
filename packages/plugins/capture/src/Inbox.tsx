import { TESTID } from "olai-plugin-capture/testids"
import { CountChip } from "@olai/ui-primitives/CountChip.tsx"

import { CHIP_QUIET } from "olai-plugin-layout/chip"
import { ENTRY_SHAPE,ROW_GAP } from "olai-plugin-layout/entry"
import { atFile } from "olai-plugin-navigation/routes"
import { Link } from "olai-plugin-navigation/routing"
import { Tip } from "@olai/web/client/Tip.tsx"
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
        tip={props.file}
        label={`Inbox, ${props.file}`}
      >
        Inbox
        <Show when={props.broken}>
          <Tip text="Couldn't open this file">
            <span class="text-alarm" role="img" aria-label="Couldn't open this file">
              ⚠
            </span>
          </Tip>
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
