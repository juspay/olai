import { servedDirectory } from "./vault.ts"
import { TESTID } from "olai-plugin-outlines/testids"
import { Markdown } from "@olai/markdown-ui/Markdown.tsx"


export function Note(props: {
  readonly desc: string
  readonly from: string
  readonly class?: string
  readonly open?: boolean
}) {
  return (
    <div
      data-testid={TESTID.desc}
      data-preview={props.open === true ? "false" : undefined}
      data-open={props.open === true ? "true" : undefined}
    >
      <Markdown members={servedDirectory()?.members()}
            claims={servedDirectory()?.claims()}
        source={props.desc}
        from={props.from}
        class={`olai-md-compact ${props.class ?? ""}`}
      />
    </div>
  )
}
