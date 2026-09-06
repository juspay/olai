/** Frontmatter belongs to the document, including when no outline editor runs. */
import { customOrder, type Custom } from "@olai/format"
import { For, Show } from "solid-js"
import { TESTID } from "@olai/web/client/testids.ts"
import { useDocumentReading } from "./reading.tsx"
import { readLocation } from "olai-plugin-ui-renderer/contract"
import { properties } from "../index.ts"
import { content } from "olai-plugin-navigation/contract"
import { atFile, atNode, hrefOf, routeIn } from "olai-plugin-navigation/routes"

function PlainProperties(props: { readonly custom: Custom; readonly from: string }) {
  const reading = useDocumentReading()
  const values = (key: string) => { const value = props.custom[key]; return typeof value === "string" ? [value] : value ?? [] }
  const href = (key: string, value: string): string | undefined => {
    const meaning = reading()?.doors.find(one => one.from === props.from && one.prop === key && one.value === value)?.opens
    if (meaning?.kind === "away") return meaning.href
    const route = meaning?.kind === "document" ? atFile(meaning.file) : meaning?.kind === "node" ? atNode(meaning.id) : meaning?.kind === "day" ? routeIn(`/d/${meaning.date}`) : null
    if (route !== null && readLocation(content).some(entry => entry.value.matches(route))) return hrefOf(route)
    return undefined
  }
  return <Show when={customOrder(props.custom).length > 0}>
    <div class="mt-0.5 mb-1 flex flex-wrap items-baseline gap-1 text-[0.8125rem] leading-snug" data-testid={TESTID.props}>
      <For each={customOrder(props.custom)}>{key =>
        <span class="inline-flex min-w-0 max-w-full items-baseline gap-1.5 rounded-full border border-rule bg-panel px-2 py-px" data-testid={TESTID.prop} data-key={key}>
          <span class="font-mono text-[0.65rem] text-muted">{key}</span>
          <span class="min-w-0 break-words text-ink" data-testid={TESTID.propValue}>
            <For each={values(key)}>{(value,i) => <>{i() > 0 ? ", " : ""}<Show when={href(key,value)} fallback={value}>{address => <a class="text-accent hover:underline" href={address()}>{value}</a>}</Show></>}</For>
          </span>
        </span>
      }</For>
    </div>
  </Show>
}

export function Properties(props: { readonly custom: Custom; readonly from: string }) {
  const reading = useDocumentReading()
  return <Show when={readLocation(properties)[0]} fallback={<PlainProperties custom={props.custom} from={props.from} />}>
    {entry => entry().value({get custom() {return props.custom},get from() {return props.from},reading})}
  </Show>
}
