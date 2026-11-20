import type { DayGroup } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { Dynamic } from "solid-js/web"

import { CRUMB } from "olai-plugin-outlines/chrome"
import { Link } from "olai-plugin-navigation/routing"
import { TESTID } from "../../testids.ts"
import { DayNode } from "./DayNode.tsx"
import { placeOf } from "./place.ts"
import { atFile } from "olai-plugin-navigation/routes"

export type Heading = "h2" | "h3" | "h4"

export function DayGroups(props: {
  readonly groups: ReadonlyArray<DayGroup>
  readonly heading: Heading
}) {
  return (
    <Key each={props.groups} by="file">
      {(group) => <Group group={group()} heading={props.heading} />}
    </Key>
  )
}

function Group(props: {
  readonly group: DayGroup
  readonly heading: Heading
}) {
  return (
    <section class="mb-6" data-testid={TESTID.dayGroup} data-file={props.group.file}>
      <Dynamic
        component={props.heading}
        class="m-0 mb-2 font-mono text-label text-muted"
      >
        <Link route={atFile(props.group.file)} class={CRUMB}>
          {props.group.file}
        </Link>
      </Dynamic>
      <ul class="m-0 list-none p-0">
        <Key each={props.group.nodes} by={placeOf}>
          {(dated) => (
            <DayNode dated={dated()} trail="over" pill={dated().date} />
          )}
        </Key>
      </ul>
    </section>
  )
}
