import type { Fake } from "@olai/tests/harness/fake.ts"
import { join } from "node:path"
export const fake: Fake = {
  word: "browser",
  env: ({ on }) => ({ OLAI_BROWSER_MCP: on ? join(import.meta.dirname, "browser-mcp") : "" }),
}
