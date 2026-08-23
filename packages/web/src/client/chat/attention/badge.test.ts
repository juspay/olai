import { expect, test } from "bun:test"

import { channelFor } from "./badge.ts"

test("an installed app with the API badges its own icon", () => {
  expect(channelFor(true, true)).toBe("app")
})

test("a plain tab marks its title and favicon, API or not", () => {
  // `setAppBadge` exists in a Chromium TAB and is ignored there, so the
  // presence of the API is not the question — where the page is running is.
  expect(channelFor(true, false)).toBe("tab")
  expect(channelFor(false, false)).toBe("tab")
})

test("an install on a browser with no badging API still gets the tab's mark", () => {
  expect(channelFor(false, true)).toBe("tab")
})
