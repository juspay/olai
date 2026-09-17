import { expect, test } from "bun:test"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
import { atFile } from "olai-plugin-navigation/routes"
import { pinnedAt, pinnedLayout, pinsOf } from "./pins.ts"

const routes = routingIn()

test("bare and named layout rows coexist with page pins and compare only pages", () => {
  const shelf = [
    { id: "bare", title: "/s/house.olai/%23missing" },
    { id: "named", title: "[Planning](/s/house.olai/garden.olai?w=20,80&f=1)" },
    { id: "page", title: "/house.olai" },
    { id: "text", title: "a note" },
  ]
  const pins = pinsOf(routes, shelf)
  expect(pins.map(pin => pin.id)).toEqual(["bare", "named", "page"])
  expect(pins[0]).toMatchObject({ target: { kind: "layout" }, name: "house.olai · /#missing", written: false })
  expect(pins[1]).toMatchObject({ name: "Planning", bare: "house.olai · garden.olai", written: true })
  expect(pinnedAt(routes, shelf, atFile("house.olai"))?.id).toBe("page")
  expect(pinnedLayout(routes, shelf, routes.layoutIn("/s/house.olai/garden.olai?w=90,10")!)?.id).toBe("named")
  expect(pinnedLayout(routes, shelf, routes.layoutIn("/s/garden.olai/house.olai")!)).toBeUndefined()
})

test("layout titles remain safe to follow with malformed or empty segments", () => {
  for (const title of ["/s/", "/s/%", "/s/house.olai/%", "/s/house.olai?t=leaf"]) {
    const [pin] = pinsOf(routes, [{ id: "p", title }])
    expect(pin?.target.kind).toBe("layout")
    if (pin?.target.kind !== "layout") throw new Error("expected a layout")
    expect(routes.layoutIn(routes.layoutHref(pin.target.workspace))).not.toBeNull()
  }
})


test("workspace recognition precedes the unchanged page parser", () => {
  const title = "/s/house.olai/garden.olai"
  expect(routes.routeIn(title)).toEqual(atFile("s/house.olai/garden.olai"))
  expect(pinsOf(routes, [{id: "p", title}])[0]?.target.kind).toBe("layout")
})
