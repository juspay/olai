import type { PageRequest } from "@olai/format"
import type { Ops as Gate } from "@olai/ops"
import type { Ops } from "@olai/plugin-api/services"
import { Effect } from "effect"

export const opsDoor = (gate: Gate, refused: Ops["refused"]): Ops => ({
  gate,
  reading: Effect.catch(gate.read, () => Effect.succeed(null)),
  page: (request) => gate.page(request as PageRequest),
  prop: (write) => Effect.asVoid(gate.run({ op: "prop", id: write.node, key: write.key, value: write.value }, "web")),
  document: (file) => Effect.asVoid(gate.run({ op: "create-doc", file }, "web")),
  refused,
})
