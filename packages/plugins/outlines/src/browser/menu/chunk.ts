import { createArrival } from "@olai/web/client/arriving.ts"

const menu = createArrival("the ••• menu", async () => (await import("./Dropdown.tsx")).Dropdown)

export const menuReady = menu.ready

export const menuFailure = menu.failure

export const dropdownNow = menu.now
