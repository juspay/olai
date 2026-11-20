import { createArrival } from "@olai/web/client/arriving.ts"

// Bun's bundler reads this specifier to split ./pipeline.ts's graph into a
// chunk of its own; a computed one is inlined into the entry instead.
const pipeline = createArrival("the markdown renderer", () => import("./pipeline.ts"))

export type MarkdownArrival =
  | { readonly kind: "waiting" }
  | { readonly kind: "ready" }
  | { readonly kind: "failed"; readonly error: Error }

const WAITING: MarkdownArrival = { kind: "waiting" }
const READY: MarkdownArrival = { kind: "ready" }

export const markdownArrival = (): MarkdownArrival => {
  const error = pipeline.failure()
  if (error !== undefined) return { kind: "failed", error }
  return pipeline.ready() ? READY : WAITING
}

export const pipelineNow = pipeline.now

export const installPipeline = pipeline.install
