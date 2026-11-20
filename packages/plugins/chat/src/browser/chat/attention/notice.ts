import type { ChatState } from "olai-plugin-chat/wire"
import type { Notice } from "olai-plugin-alerts/contract"
import type { Asked } from "./asked.ts"
import { previewText } from "../preview-text.ts"

const LINE = 140

const UNNAMED = "olai"

export const openingLine = (text: string): string | undefined => {
  let from = 0
  while (from <= text.length) {
    const end = text.indexOf("\n", from)
    const said = previewText(text.slice(from, end === -1 ? undefined : end), LINE)
    if (said !== "") return said
    if (end === -1) return undefined
    from = end + 1
  }
  return undefined
}

export const noticeOf = (
  state: Pick<ChatState, "session" | "asking">,
  asked: Asked | undefined,
  called?: string,
): Notice => ({
  tag: `olai:awaiting:${state.session?.id ?? ""}`,
  title: state.session?.title ?? called ?? UNNAMED,
  body: bodyOf(state.asking, asked),
  data: { kind: "ask" },
})

const bodyOf = (asking: number, asked: Asked | undefined): string => {
  const others = Math.max(0, asking - 1)
  const more = others === 0 ? "" : ` (and ${others} more)`
  const line = asked === undefined ? undefined : openingLine(asked.text)
  return line === undefined
    ? `Waiting on your answer${more}`
    : `${line}${more}`
}
