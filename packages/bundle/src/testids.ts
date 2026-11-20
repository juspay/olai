export { PLUGIN_TESTID } from "./testids.generated.ts"

import { PLUGIN_TESTID } from "./testids.generated.ts"

export type PluginTestId = (typeof PLUGIN_TESTID)[keyof typeof PLUGIN_TESTID]

import { TESTID as boot } from "@olai/web/client/testids.ts"
import { TESTID as primitives } from "@olai/ui-primitives/testids.ts"
import { TESTID as markdown } from "@olai/markdown-ui/testids.ts"
import { TESTID as history } from "@olai/edit-history/testids.ts"

export const TESTID = { ...boot, ...primitives, ...markdown, ...history, ...PLUGIN_TESTID } as const
export type TestId = (typeof TESTID)[keyof typeof TESTID]
