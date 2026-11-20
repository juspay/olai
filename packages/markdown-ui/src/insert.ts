export interface Written {
  readonly text: string
  readonly caret: number
}

export const written = (
  text: string,
  trigger: { readonly from: number },
  insert: string,
  caret: number,
): Written => {
  const head = text.slice(0, trigger.from)
  const tail = text.slice(caret)
  if (insert !== "") {
    return { text: `${head}${insert}${tail}`, caret: head.length + insert.length }
  }
  if (tail === "") return { text: head.trimEnd(), caret: head.trimEnd().length }
  const joined = head.endsWith(" ") && tail.startsWith(" ") ? head.slice(0, -1) : head
  return { text: `${joined}${tail}`, caret: joined.length }
}
