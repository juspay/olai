import type { ChatState } from "olai-plugin-chat/wire"
export type Offered = ChatState["models"][number]

export const visibleModels = (
  models: ReadonlyArray<Offered>,
  query: string,
): ReadonlyArray<Offered> => {
  const wanted = query.trim().toLowerCase()
  if (wanted === "") return models
  return models.filter(
    (model) =>
      model.name.toLowerCase().includes(wanted) ||
      model.value.toLowerCase().includes(wanted),
  )
}
