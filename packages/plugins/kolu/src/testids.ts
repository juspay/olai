import { TESTID as appliance } from "./contracts/appliance-testids.ts"
import { testIds } from "./contracts/testIds.ts"

const CHROME = testIds({
  padi: "padi",
  padiFeed: "padi-feed",
  padiFeedFoot: "padi-feed-foot",
  padiFeedWrench: "padi-feed-wrench",
})

type SharedKey = Extract<keyof typeof appliance, keyof typeof CHROME>
type SharedValue = Extract<
  (typeof appliance)[keyof typeof appliance],
  (typeof CHROME)[keyof typeof CHROME]
>

type Assert<T extends true> = T

type _NoSharedKey = Assert<[SharedKey] extends [never] ? true : SharedKey>
type _NoSharedValue = Assert<[SharedValue] extends [never] ? true : SharedValue>

export const TESTID = { ...appliance, ...CHROME }

import type {} from "@olai/ui-primitives/testids.ts"
type OwnedTestIds = typeof TESTID
declare module "@olai/ui-primitives/testids.ts" {
  interface TestIdTables { readonly "plugins/kolu": OwnedTestIds }
}
