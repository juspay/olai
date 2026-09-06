/** Shared text rendering is used by documents, outline notes and chat. Fetch
 * the split pipeline beside the first stylesheet without executing it. */
export default {
  preloadModules: [{ module: "@olai/markdown-ui/pipeline.ts", priority: "low" as const }],
}
