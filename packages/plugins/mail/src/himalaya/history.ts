import { Schema } from "effect"
export const History = Schema.Struct({
  "history-id": Schema.String,
  next_page: Schema.optionalKey(Schema.NullOr(Schema.String)),
  history: Schema.Array(Schema.Struct({ id: Schema.String, "messages-added-details": Schema.Array(Schema.Struct({
    id: Schema.String, "thread-id": Schema.NullOr(Schema.String), "label-ids": Schema.Array(Schema.String),
  })) })),
})
export type History = typeof History.Type
export const arrivingIn = (page: History): string[] => [...new Set(page.history.flatMap(record => record["messages-added-details"].flatMap(message =>
  message["thread-id"] !== null && message["label-ids"].includes("INBOX") ? [message["thread-id"]] : [])))]
