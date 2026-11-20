import { definePlugin, Identity, Offers } from "@olai/plugin-api/services"
import { Effect } from "effect"

import { name, browserServices } from "./index.ts"
import { headerNamesOf, whoOf } from "./who/index.ts"

import { Config, configuredIdentity } from "./settings.ts"
export { Config } from "./settings.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  needs: [Offers],
  config: Config,
  apply: (settings) => Effect.gen(function*() {
    const offers = yield* Offers
    yield* offers.browser(browserServices)
    const config = configuredIdentity(settings)
    yield* offers.offer(Identity, () => ({
      headers: headerNamesOf(config.headers),
      who: (headers) => whoOf(headers, config),
    }))
  }),
})
