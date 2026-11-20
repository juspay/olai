import { createArrival } from "@olai/web/client/arriving.ts"

// The specifier is a literal because the bundler READS it: that is what gets
// ./pipeline.ts's graph out of `main-*.js` and into a chunk of its own.
const pipeline = createArrival("the markdown renderer", () => import("./pipeline.ts"))

export const markdownReady = pipeline.ready

export const markdownWaiting = pipeline.waiting

export const markdownFailure = pipeline.failure

export const pipelineNow = pipeline.now

export const installPipeline = pipeline.install
