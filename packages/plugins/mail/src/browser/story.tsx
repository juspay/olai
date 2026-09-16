import { TESTID } from "../testids.ts"
import { storyOf } from "./story.ts"
export const story = (props: { reply: unknown }) => {
  const said = storyOf(props.reply)
  return said ? <div class="border-t border-rule px-2 py-1 text-xs" data-testid={TESTID.mailStory} data-mail-story={said.kind}>{said.text}</div> : null
}
